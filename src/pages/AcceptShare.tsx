import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, XCircle, MapPin, Calendar, Clock, Car, Users, Percent, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useRideSharing, RideShare } from '@/hooks/useRideSharing';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface BookingDetails {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  passengers: number;
  total_price: number;
}

export default function AcceptShare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { acceptShare, counterPropose, getShareByToken } = useRideSharing();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const as = t.acceptShare;
  
  const [share, setShare] = useState<RideShare | null>(null);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isCounterProposeSent, setIsCounterProposeSent] = useState(false);
  const [showCounterProposal, setShowCounterProposal] = useState(false);
  const [proposedPercentage, setProposedPercentage] = useState(50);

  useEffect(() => {
    async function loadShareDetails() {
      if (!token) {
        setError(as.invalidShareLink);
        setIsLoading(false);
        return;
      }

      const shareData = await getShareByToken(token);
      
      if (!shareData) {
        setError(as.shareNotFound);
        setIsLoading(false);
        return;
      }

      if (shareData.is_accepted) {
        setIsAccepted(true);
      }

      setShare(shareData);
      setProposedPercentage(shareData.cost_split_percentage);

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, booking_reference, pickup_location, dropoff_location, pickup_date, pickup_time, vehicle_name, passengers, total_price')
        .eq('id', shareData.booking_id)
        .single();

      if (bookingError || !bookingData) {
        setError((as as any).bookingNotFound || 'Booking not found');
        setIsLoading(false);
        return;
      }

      setBooking(bookingData);
      setIsLoading(false);
    }

    loadShareDetails();
  }, [token]);

  const handleAccept = async () => {
    if (!token || !user) return;
    try {
      await acceptShare.mutateAsync(token);
      setIsAccepted(true);
    } catch (err) {
      setError(as.failedToAccept);
    }
  };

  const handleCounterPropose = async () => {
    if (!token || !user || !share || proposedPercentage === share.cost_split_percentage) return;
    try {
      await counterPropose.mutateAsync({ shareToken: token, proposedPercentage });
      setIsCounterProposeSent(true);
    } catch (err) {
      setError((as as any).failedToSend || 'Failed to send counter-proposal. Please try again.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Card className="mx-auto max-w-md text-center">
            <CardContent className="pt-6">
              <XCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
              <h2 className="mb-2 font-display text-xl font-semibold">
                {as.unableToLoadShare}
              </h2>
              <p className="mb-6 text-muted-foreground">{error}</p>
              <Button onClick={() => navigate('/')}>{as.goToHome}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Card className="mx-auto max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                {as.rideShareInvitation}
              </CardTitle>
              <CardDescription>
                {as.invitedToShare}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {booking && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    <span>{booking.pickup_location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-destructive" />
                    <span>{booking.dropoff_location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(booking.pickup_date), 'PPP')}</span>
                  </div>
                  {share && (
                    <div className="flex items-center gap-2 font-medium text-accent">
                      <Percent className="h-4 w-4" />
                      <span>{as.yourShare}: {share.cost_split_percentage}%</span>
                    </div>
                  )}
                </div>
              )}
              <Button 
                className="w-full" 
                onClick={() => navigate(`/auth?redirect=/share/${token}`)}
              >
                {as.signInToAccept}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isCounterProposeSent) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Card className="mx-auto max-w-md text-center">
            <CardContent className="pt-6">
              <MessageSquare className="mx-auto mb-4 h-16 w-16 text-accent" />
              <h2 className="mb-2 font-display text-xl font-semibold">
                {as.counterProposalSent}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {(as.counterProposalDesc || '').replace('{percent}', String(proposedPercentage))}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={() => navigate('/my-bookings')}>
                  {as.viewMyBookings}
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  {as.goToHome}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20">
          <Card className="mx-auto max-w-md text-center">
            <CardContent className="pt-6">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-accent" />
              <h2 className="mb-2 font-display text-xl font-semibold">
                {as.shareAccepted}
              </h2>
              <p className="mb-6 text-muted-foreground">
                {(as as any).shareAcceptedDesc || "You're now sharing this ride. You can view it in your bookings."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={() => navigate('/my-bookings')}>
                  {as.viewMyBookings}
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                  {as.goToHome}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const yourShareAmount = booking?.total_price && share
    ? ((booking.total_price * (showCounterProposal ? proposedPercentage : share.cost_split_percentage)) / 100).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20">
        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              {showCounterProposal ? as.proposeDifferentSplit : as.acceptRideShare}
            </CardTitle>
            <CardDescription>
              {showCounterProposal 
                ? as.suggestDifferentSplit
                : (as as any).invitedToShareRide || "You've been invited to share this ride"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {booking && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">
                    {booking.booking_reference}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t.common.from}</p>
                      <p className="font-medium">{booking.pickup_location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t.common.to}</p>
                      <p className="font-medium">{booking.dropoff_location}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(booking.pickup_date), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.pickup_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.vehicle_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.passengers} {t.common.passengers}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {share && showCounterProposal ? (
              <div className="rounded-lg border border-muted bg-muted/30 p-4 space-y-4">
                {booking?.total_price != null && booking.total_price > 0 && (
                  <div className="text-center pb-3 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-1">{as.totalFare}</p>
                    <p className="text-xl font-bold text-foreground">{formatPrice(booking.total_price)}</p>
                  </div>
                )}
                
                <div className="space-y-3">
                  <p className="text-sm font-medium text-center">{as.yourProposedShare}: {proposedPercentage}%</p>
                  <Slider
                    value={[proposedPercentage]}
                    onValueChange={([value]) => setProposedPercentage(value)}
                    min={10}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span>90%</span>
                  </div>
                </div>

                {yourShareAmount && (
                  <div className="text-center pt-2">
                    <p className="text-2xl font-bold text-accent">{formatPrice(Number(yourShareAmount))}</p>
                    <p className="text-xs text-muted-foreground">{as.yourProposedAmount}</p>
                  </div>
                )}

                {proposedPercentage === share.cost_split_percentage && (
                  <p className="text-xs text-muted-foreground text-center">
                    {as.adjustSlider}
                  </p>
                )}
              </div>
            ) : share && (
              <div className="rounded-lg bg-accent/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">{as.yourCostShare}</p>
                <p className="text-2xl font-bold text-accent">
                  {share.cost_split_percentage}%
                  {yourShareAmount && <span className="text-lg ml-2">({formatPrice(Number(yourShareAmount))})</span>}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {showCounterProposal ? (
                <>
                  <Button 
                    onClick={handleCounterPropose} 
                    disabled={counterPropose.isPending || proposedPercentage === share?.cost_split_percentage}
                    className="w-full"
                  >
                    {counterPropose.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {as.sending}
                      </>
                    ) : (
                      as.sendCounterProposal
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCounterProposal(false);
                      setProposedPercentage(share?.cost_split_percentage || 50);
                    }}
                  >
                    {t.common.back}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleAccept} 
                    disabled={acceptShare.isPending}
                    className="w-full"
                  >
                    {acceptShare.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {as.accepting}
                      </>
                    ) : (
                      as.acceptShare
                    )}
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCounterProposal(true)}
                      className="flex-1 gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {as.counterPropose}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/')}
                      className="flex-1"
                    >
                      {as.decline}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
