import { useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { User, Navigation, CheckCircle, Play, MapPin, Loader2, Clock, ExternalLink, Route, Copy, AlertTriangle, Map } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeafletMap } from '@/components/booking/LeafletMap';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useGeofencingAlerts } from '@/hooks/useGeofencingAlerts';
import { useConfetti } from '@/hooks/useConfetti';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { DriverLocationTracker } from './DriverLocationTracker';
import { DriverRouteMap } from './DriverRouteMap';
import { DriverPickupLocationsMap } from './DriverPickupLocationsMap';
import { GeofenceIndicator } from './GeofenceIndicator';
import { getPreferredNavigationApp } from '@/utils/navigationUtils';
import { UrgentPickupFAB } from './UrgentPickupFAB';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
import { openNavigation, copyAddressToClipboard } from '@/utils/navigationUtils';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';

interface AssignedBooking {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  passengers: number;
  status: string;
  total_price: number | null;
  ride_started_at: string | null;
  ride_completed_at: string | null;
}

interface DriverAssignedBookingsProps {
  driverId: string;
}

// Helper component for ride duration timer
function RideDurationTimer({ startedAt }: { startedAt: string }) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    
    const updateDuration = () => {
      const now = Date.now();
      setDuration(Math.floor((now - startTime) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  const formatTime = () => {
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <Clock className="h-4 w-4 text-primary animate-pulse" />
      <span className="font-semibold">{formatTime()}</span>
    </div>
  );
}

// Active booking card component with enhanced UI
interface ActiveBookingCardProps {
  booking: AssignedBooking;
  isActive: boolean;
  hasActiveRide: boolean;
  pendingStartId: string | null;
  pendingCompleteId: string | null;
  currentLocation: { lat: number; lng: number } | null;
  preferredApp: 'google' | 'apple' | 'waze';
  onStartRide: () => void;
  onCompleteRide: () => void;
  onNavigateToLocation: (address: string) => void;
  getDateLabel: (date: string) => string;
}

function ActiveBookingCard({
  booking,
  isActive,
  hasActiveRide,
  pendingStartId,
  pendingCompleteId,
  currentLocation,
  preferredApp,
  onStartRide,
  onCompleteRide,
  onNavigateToLocation,
  getDateLabel,
}: ActiveBookingCardProps) {
  const [showMap, setShowMap] = useState(false);
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();

  const handleExternalNavigation = useCallback((destination: string) => {
    openNavigation(destination, currentLocation, preferredApp);
  }, [currentLocation, preferredApp]);

  // Check if this booking cannot start because another ride is in progress
  const isBlockedByActiveRide = hasActiveRide && !isActive;

  return (
    <Card 
      className={cn(
        "transition-all duration-300",
        isActive && "border-primary ring-2 ring-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {getDateLabel(booking.pickup_date)} at {booking.pickup_time.slice(0, 5)}
            </p>
            <CardTitle className="text-base mt-1">
              {booking.booking_reference}
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isActive ? (
              <Badge className="bg-primary text-primary-foreground animate-pulse gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                {t.driverRides.rideInProgress}
              </Badge>
            ) : (
              <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                {booking.status}
              </Badge>
            )}
            {booking.total_price && (
              <span className="text-sm font-semibold text-primary">
                {formatPrice(booking.total_price)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Ride Duration Timer for Active Rides */}
        {isActive && booking.ride_started_at && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-xs text-muted-foreground">{t.driverRides.rideDuration}</span>
            <RideDurationTimer startedAt={booking.ride_started_at} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center mt-0.5",
              isActive ? "bg-muted" : "bg-primary/20"
            )}>
              <div className={cn(
                "h-2 w-2 rounded-full",
                isActive ? "bg-muted-foreground" : "bg-primary"
              )} />
            </div>
            <div className="flex-1">
              <p className={cn("text-sm", isActive && "text-muted-foreground line-through")}>
                {booking.pickup_location}
              </p>
              {isActive && (
                <span className="text-xs text-primary font-medium">✓ {t.driverRides.pickedUp}</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center mt-0.5",
              isActive ? "bg-destructive/20" : "bg-muted"
            )}>
              <div className={cn(
                "h-2 w-2 rounded-full",
                isActive ? "bg-destructive animate-pulse" : "bg-muted-foreground"
              )} />
            </div>
            <p className={cn("text-sm flex-1", isActive && "font-medium")}>
              {booking.dropoff_location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {booking.passengers} {booking.passengers !== 1 ? t.driverRides.passengers : t.driverRides.passenger}
          </span>
          <span>{booking.vehicle_name}</span>
        </div>

        {/* Active Ride Actions */}
        {isActive && (
          <div className="space-y-2 pt-2 border-t border-border">
            {/* Navigation Row */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowMap(prev => !prev)}
                variant={showMap ? 'default' : 'outline'}
                className="flex-1 gap-2 h-10"
              >
                <Map className="h-4 w-4" />
                {(t as any).driverRidesExtra?.map || 'Map'}
              </Button>
              
              <Button
                onClick={() => copyAddressToClipboard(booking.dropoff_location)}
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                title={(t as any).driverRidesExtra?.copyDropoffAddress || 'Copy dropoff address'}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {/* Inline Map Preview */}
            {showMap && (
              <div className="h-48 rounded-lg overflow-hidden border border-border">
                <LeafletMap
                  driverLocation={currentLocation}
                  pickupLocation={booking.pickup_location}
                  dropoffLocation={booking.dropoff_location}
                  showLiveIndicator={true}
                  height="100%"
                />
              </div>
            )}

            {/* Complete Ride Button */}
            <Button
              onClick={onCompleteRide}
              disabled={pendingCompleteId !== null}
              className="w-full gap-2 h-12 text-base font-semibold"
            >
              {pendingCompleteId === booking.id ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.driverRides.completing}
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  {t.driverRides.completeRide}
                  {booking.total_price && (
                    <Badge variant="secondary" className="ml-2 bg-primary-foreground/20">
                      +{formatPrice(booking.total_price)}
                    </Badge>
                  )}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pre-ride Actions */}
        {booking.status === 'confirmed' && !booking.ride_started_at && (
          <div className="flex gap-2">
            {/* Show pickup on map */}
            <Button
              onClick={() => onNavigateToLocation(booking.pickup_location)}
              variant="outline"
              className="flex-1 gap-2"
            >
              <MapPin className="h-4 w-4" />
              {(t as any).driverRidesExtra?.map || 'Map'}
            </Button>

            {/* Start Ride Button or Blocked State */}
            {isBlockedByActiveRide ? (
              <div className="flex-[2] flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-muted text-muted-foreground text-sm">
                <Clock className="h-4 w-4" />
                <span>{t.driverRides.completeCurrentFirst}</span>
              </div>
            ) : (
              <Button
                onClick={onStartRide}
                disabled={pendingStartId !== null}
                className="flex-[2] gap-2 h-10 font-semibold"
              >
                {pendingStartId === booking.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.driverRides.starting}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {t.driverRides.startRide}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DriverAssignedBookings({ driverId }: DriverAssignedBookingsProps) {
  const queryClient = useQueryClient();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const { fireCelebration } = useConfetti();
  const preferredApp = getPreferredNavigationApp();
  const [pendingStartId, setPendingStartId] = useState<string | null>(null);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const [confirmCompleteBooking, setConfirmCompleteBooking] = useState<AssignedBooking | null>(null);
  const focusLocationRef = useRef<((address: string) => void) | null>(null);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings', driverId] });
    await queryClient.invalidateQueries({ queryKey: ['driver-pickup-map-bookings', driverId] });
    toast.success(t.driverRides.ridesRefreshed, { duration: 2000 });
  }, [queryClient, driverId]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
  });

  const handleMapReady = useCallback((focusFn: (address: string) => void) => {
    focusLocationRef.current = focusFn;
  }, []);

  const handleNavigateToLocation = useCallback((address: string) => {
    if (focusLocationRef.current) {
      focusLocationRef.current(address);
      toast.success(`📍 ${t.driverRides.showingLocation}`);
    } else {
      toast.error(t.driverRides.mapNotReady);
    }
  }, []);

  // Fetch assigned bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['driver-assigned-bookings', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          pickup_location,
          dropoff_location,
          pickup_date,
          pickup_time,
          vehicle_name,
          passengers,
          status,
          total_price,
          ride_started_at,
          ride_completed_at
        `)
        .eq('driver_id', driverId)
        .in('status', ['confirmed', 'pending'])
        .order('pickup_date', { ascending: true })
        .order('pickup_time', { ascending: true });

      if (error) throw error;
      return data as AssignedBooking[];
    },
    enabled: !!driverId,
  });

  // Find active ride for location tracking
  const activeBooking = bookings.find(b => b.ride_started_at && !b.ride_completed_at);

  // GPS location tracking for active ride with ETA calculation
  const { 
    isTracking, 
    currentLocation, 
    error: locationError,
    eta,
    lastUpdateTime,
    startTracking 
  } = useDriverLocationTracking({
    bookingId: activeBooking?.id || null,
    driverId,
    pickupLocation: activeBooking?.pickup_location,
    dropoffLocation: activeBooking?.dropoff_location,
    enabled: !!activeBooking,
    updateIntervalMs: 3000, // Push to DB every 3 seconds
  });

  // Geofencing alerts for approaching pickup/dropoff
  const {
    distanceToPickup,
    distanceToDropoff,
    formatDistance,
    isApproachingPickup,
    isAtPickup,
    isApproachingDropoff,
    isAtDropoff,
  } = useGeofencingAlerts({
    currentLocation: currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null,
    pickupAddress: activeBooking?.pickup_location,
    dropoffAddress: activeBooking?.dropoff_location,
    isRideStarted: !!activeBooking?.ride_started_at,
    enabled: !!activeBooking,
  });

  const startRideMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      setPendingStartId(bookingId);
      // Start location tracking immediately for smoother UX
      startTracking();
      
      const { error } = await supabase
        .from('bookings')
        .update({
          ride_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      setPendingStartId(null);
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
      fireCelebration();
      toast.success(`🚀 ${t.driverRides.rideStarted}`, { duration: 4000 });
    },
    onError: () => {
      setPendingStartId(null);
      toast.error(t.driverRides.failedToStartRide);
    },
  });

  const completeRideMutation = useMutation({
    mutationFn: async (booking: AssignedBooking) => {
      setPendingCompleteId(booking.id);
      // Update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          ride_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Record earnings if there's a price
      if (booking.total_price && booking.total_price > 0) {
        const { error: earningsError } = await supabase
          .from('driver_earnings')
          .insert({
            driver_id: driverId,
            booking_id: booking.id,
            amount: booking.total_price,
            earning_type: 'ride',
            description: `Completed ride ${booking.booking_reference}`,
          });

        if (earningsError) {
          console.error('Failed to record earnings:', earningsError);
        }
      }

      return booking;
    },
    onSuccess: (booking) => {
      setPendingCompleteId(null);
      queryClient.invalidateQueries({ queryKey: ['driver-assigned-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['driver-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['driver-completed-shifts'] });
      
      fireCelebration();
      
      if (booking.total_price && booking.total_price > 0) {
        toast.success(`🎉 ${t.driverRides.rideCompletedEarned.replace('{amount}', formatPrice(booking.total_price))}`, {
          duration: 5000,
        });
      } else {
        toast.success(`🎉 ${t.driverRides.rideCompletedSimple}`);
      }
    },
    onError: () => {
      setPendingCompleteId(null);
      toast.error(t.driverRides.failedToCompleteRide);
    },
  });

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return t.driverRides.today;
    if (isTomorrow(date)) return t.driverRides.tomorrow;
    return format(date, 'EEE, MMM d');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Navigation className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t.driverRides.noAssignedRides}</p>
          <p className="text-sm">{t.driverRides.newBookingsAppear}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-4 -mx-4 px-4 min-h-[200px] overflow-auto"
    >
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />

      {/* Pickup Locations Map - Always visible */}
      <DriverPickupLocationsMap 
        driverId={driverId} 
        onMapReady={handleMapReady}
        activeRideDestination={activeBooking?.dropoff_location}
        isRideInProgress={!!activeBooking}
      />

      {/* Route Map for Active Ride */}
      {activeBooking && currentLocation && (
        <DriverRouteMap
          driverLocation={{ lat: currentLocation.lat, lng: currentLocation.lng }}
          pickupLocation={activeBooking.pickup_location}
          dropoffLocation={activeBooking.dropoff_location}
          isActive={!!activeBooking.ride_started_at}
        />
      )}

      {/* Location Tracking Status with ETA */}
      {activeBooking && (
        <>
          <DriverLocationTracker
            isTracking={isTracking}
            currentLocation={currentLocation}
            error={locationError}
            eta={eta}
            lastUpdateTime={lastUpdateTime}
            onRequestPermission={startTracking}
          />

          {/* Geofencing Status Indicators */}
          <div className="grid gap-3 sm:grid-cols-2">
            {!activeBooking.ride_started_at && (
              <GeofenceIndicator
                type="pickup"
                distance={formatDistance(distanceToPickup)}
                isApproaching={isApproachingPickup}
                isArrived={isAtPickup}
              />
            )}
            {activeBooking.ride_started_at && (
              <GeofenceIndicator
                type="dropoff"
                distance={formatDistance(distanceToDropoff)}
                isApproaching={isApproachingDropoff}
                isArrived={isAtDropoff}
              />
            )}
          </div>
        </>
      )}

      {bookings.map((booking) => {
        const isActive = booking.ride_started_at && !booking.ride_completed_at;
        
        return (
          <ActiveBookingCard
            key={booking.id}
            booking={booking}
            isActive={isActive}
            hasActiveRide={!!activeBooking}
            pendingStartId={pendingStartId}
            pendingCompleteId={pendingCompleteId}
            currentLocation={currentLocation}
            preferredApp={preferredApp}
            onStartRide={() => startRideMutation.mutate(booking.id)}
            onCompleteRide={() => setConfirmCompleteBooking(booking)}
            onNavigateToLocation={handleNavigateToLocation}
            getDateLabel={getDateLabel}
          />
        );
      })}

      {/* Complete Ride Confirmation Dialog */}
      <AlertDialog open={!!confirmCompleteBooking} onOpenChange={(open) => !open && setConfirmCompleteBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.driverRides.completeThisRide}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.driverRides.willMarkCompleted.replace('{ref}', confirmCompleteBooking?.booking_reference || '')}
              {confirmCompleteBooking?.total_price ? ` ${t.driverRides.andRecordEarnings.replace('{amount}', formatPrice(confirmCompleteBooking.total_price))}` : ''}.
              {' '}{t.driverRides.cannotBeUndone}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingCompleteId !== null}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCompleteBooking) {
                  completeRideMutation.mutate(confirmCompleteBooking);
                  setConfirmCompleteBooking(null);
                }
              }}
              disabled={pendingCompleteId !== null}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t.driverRides.yesCompleteRide}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Urgent Pickup Button */}
      <UrgentPickupFAB
        bookings={bookings}
        currentLocation={currentLocation}
        onStartRide={(id) => startRideMutation.mutate(id)}
        pendingStartId={pendingStartId}
        hasActiveRide={!!activeBooking}
      />
    </div>
  );
}
