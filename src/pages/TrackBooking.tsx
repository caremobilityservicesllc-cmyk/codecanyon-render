import { useState, useEffect } from 'react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Calendar, Clock, Car, Users, Loader2, AlertCircle, CheckCircle2, XCircle, Timer, Star, Phone, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { BookingStatusTimeline } from '@/components/booking/BookingStatusTimeline';
import { DriverTrackingMap } from '@/components/booking/DriverTrackingMap';
import { DriverRating } from '@/components/booking/DriverRating';
import { ContactButtons } from '@/components/booking/ContactButtons';
import { BookingContactButtons } from '@/components/booking/BookingContactButtons';
import { LiveChatWidget } from '@/components/booking/LiveChatWidget';
import { TrafficAlertBanner } from '@/components/booking/TrafficAlertBanner';
import { RideTimeRemaining } from '@/components/booking/RideTimeRemaining';
import { ModifyBookingDialog } from '@/components/booking/ModifyBookingDialog';
import { toast } from 'sonner';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface BookingData {
  id: string;
  booking_reference: string;
  status: BookingStatus;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  passengers: number;
  total_price: number | null;
  created_at: string;
  driver_id: string | null;
  driver_location_lat: number | null;
  driver_location_lng: number | null;
  estimated_arrival: string | null;
  ride_started_at: string | null;
  ride_completed_at: string | null;
}

interface DriverData {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  average_rating: number | null;
  phone: string;
  total_rides: number | null;
}

export default function TrackBooking() {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);

  const statusConfig: Record<BookingStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: t.status.pending, icon: <Timer className="h-4 w-4" />, variant: 'secondary' },
    confirmed: { label: t.status.confirmed, icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' },
    completed: { label: t.status.completed, icon: <CheckCircle2 className="h-4 w-4" />, variant: 'outline' },
    cancelled: { label: t.status.cancelled, icon: <XCircle className="h-4 w-4" />, variant: 'destructive' },
  };

  // Check if user has already rated this booking
  useEffect(() => {
    const checkExistingRating = async () => {
      if (!booking?.id || !booking?.driver_id || booking?.status !== 'completed') {
        setHasRated(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('driver_ratings')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setHasRated(!!data);
    };

    checkExistingRating();
  }, [booking?.id, booking?.driver_id, booking?.status]);

  // Fetch driver details when booking has a driver
  useEffect(() => {
    const fetchDriver = async () => {
      if (!booking?.driver_id) {
        setDriver(null);
        return;
      }

      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, avatar_url, average_rating, phone, total_rides')
        .eq('id', booking.driver_id)
        .maybeSingle();

      if (!error && data) {
        setDriver(data);
      }
    };

    fetchDriver();
  }, [booking?.driver_id]);

  // Set up real-time subscription when booking is found
  useEffect(() => {
    if (!booking) {
      setIsLive(false);
      return;
    }

    const channel = supabase
      .channel(`booking-${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload) => {
          const newData = payload.new as BookingData;
          const oldData = booking;
          
          setBooking(newData);
          
          if (newData.driver_location_lat !== null && newData.driver_location_lng !== null) {
            if (
              oldData?.driver_location_lat !== newData.driver_location_lat ||
              oldData?.driver_location_lng !== newData.driver_location_lng
            ) {
              setLastLocationUpdate(new Date());
            }
          }
          
          if (oldData && oldData.status !== newData.status) {
            toast.success(t.trackPage.statusUpdated.replace('{status}', statusConfig[newData.status].label), {
              description: t.trackPage.statusUpdatedDesc,
            });
          }
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [booking?.id]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBooking(null);

    if (!reference.trim() || !email.trim()) {
      setError(t.trackPage.enterBothFields);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_reference', reference.trim().toUpperCase())
        .eq('contact_email', email.trim().toLowerCase())
        .single();

      if (queryError || !data) {
        setError(t.trackPage.bookingNotFound);
        setIsLoading(false);
        return;
      }

      setBooking(data as BookingData);
    } catch (err) {
      console.error('Track booking error:', err);
      setError(t.trackPage.errorOccurred);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              {t.track.title}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t.track.enterReference}
            </p>
          </div>

          {/* Search Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-accent" />
                {t.track.title}
              </CardTitle>
              <CardDescription>
                {t.booking.bookingReference}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrack} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reference">{t.booking.bookingReference}</Label>
                  <Input
                    id="reference"
                    placeholder="e.g., RF-MKI698NF"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.booking.emailAddress}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.common.loading}
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      {t.track.track}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Booking Result */}
          {booking && (
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{booking.booking_reference}</CardTitle>
                    <CardDescription>
                      {t.trackPage.bookedOn} {format(new Date(booking.created_at), 'PPP')}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={statusConfig[booking.status].variant} className="flex items-center gap-1">
                      {statusConfig[booking.status].icon}
                      {statusConfig[booking.status].label}
                    </Badge>
                    {isLive && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                        </span>
                        {t.trackPage.liveUpdates}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Timeline */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">{t.common.status}</h3>
                  <BookingStatusTimeline currentStatus={booking.status} />
                </div>

                {/* Trip Details */}
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="font-semibold text-foreground">{t.common.details}</h3>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t.booking.pickupLocation}</p>
                        <p className="font-medium text-foreground">{booking.pickup_location}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t.booking.dropoffLocation}</p>
                        <p className="font-medium text-foreground">{booking.dropoff_location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t.common.date}</p>
                        <p className="font-medium text-foreground">
                          {format(new Date(booking.pickup_date), 'PPP')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t.common.time}</p>
                        <p className="font-medium text-foreground">{booking.pickup_time}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t.common.passengers}</p>
                        <p className="font-medium text-foreground">{booking.passengers}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Traffic Alert Banner */}
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <TrafficAlertBanner
                    pickupLocation={booking.pickup_location}
                    dropoffLocation={booking.dropoff_location}
                    pickupTime={booking.pickup_time}
                    bookingReference={booking.booking_reference}
                    className="border-t border-border pt-6"
                  />
                )}

                {/* Ride Time Remaining */}
                {booking.status === 'confirmed' && booking.ride_started_at && !booking.ride_completed_at && (
                  <div className="space-y-4 border-t border-border pt-6">
                    <RideTimeRemaining
                      pickupLocation={booking.pickup_location}
                      dropoffLocation={booking.dropoff_location}
                      rideStartedAt={booking.ride_started_at}
                    />
                  </div>
                )}

                {/* Live Driver Map */}
                {(booking.status === 'confirmed' || booking.status === 'pending') && booking.driver_id && (
                  <div className="space-y-4 border-t border-border pt-6">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      {t.trackPage.driverLocation}
                      {isLive && lastLocationUpdate && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {t.trackPage.updatingEvery3s}
                        </span>
                      )}
                    </h3>
                    <DriverTrackingMap
                      driverLocation={
                        booking.driver_location_lat && booking.driver_location_lng
                          ? { lat: booking.driver_location_lat, lng: booking.driver_location_lng }
                          : null
                      }
                      pickupLocation={booking.pickup_location}
                      estimatedArrival={booking.estimated_arrival}
                      lastUpdated={lastLocationUpdate}
                    />
                  </div>
                )}

                {/* Driver Details */}
                {driver && (
                  <div className="space-y-4 border-t border-border pt-6">
                    <h3 className="font-semibold text-foreground">{t.trackPage.yourDriver}</h3>
                    <div className="flex items-center gap-4 rounded-lg bg-secondary/30 p-4">
                      <Avatar className="h-16 w-16 border-2 border-primary">
                        <AvatarImage src={driver.avatar_url || undefined} alt={`${driver.first_name} ${driver.last_name}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {driver.first_name[0]}{driver.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-foreground">
                          {driver.first_name} {driver.last_name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium text-foreground">
                              {driver.average_rating?.toFixed(1) || '5.0'}
                            </span>
                          </div>
                          <span>{driver.total_rides || 0} {t.common.rides}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Contact Buttons */}
                    <BookingContactButtons />
                  </div>
                )}

                {/* Modify Booking */}
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <div className="space-y-4 border-t border-border pt-6">
                    <ModifyBookingDialog
                      bookingId={booking.id}
                      bookingReference={booking.booking_reference}
                      currentDate={booking.pickup_date}
                      currentTime={booking.pickup_time}
                      status={booking.status}
                      onModified={() => {
                        // Refresh will happen via realtime subscription
                      }}
                    />
                  </div>
                )}

                {/* Driver Rating */}
                {booking.status === 'completed' && booking.driver_id && driver && !hasRated && (
                  <div className="space-y-4 border-t border-border pt-6">
                    <DriverRating
                      bookingId={booking.id}
                      driverId={booking.driver_id}
                      driverName={`${driver.first_name} ${driver.last_name}`}
                      onRatingSubmitted={() => setHasRated(true)}
                    />
                  </div>
                )}

                {/* Vehicle & Price */}
                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">{booking.vehicle_name}</span>
                    </div>
                    {booking.total_price != null && (
                      <span className="text-lg font-bold text-foreground">
                        {formatPrice(booking.total_price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Chat */}
                {(booking.status === 'confirmed' || booking.status === 'pending') && (
                  <LiveChatWidget
                    bookingReference={booking.booking_reference}
                    pickupLocation={booking.pickup_location}
                    dropoffLocation={booking.dropoff_location}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
