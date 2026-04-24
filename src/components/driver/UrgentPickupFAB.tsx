import { useState, useMemo } from 'react';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';
import { Clock, MapPin, ChevronUp, ChevronDown, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeafletMap } from '@/components/booking/LeafletMap';
import { useLanguage } from '@/contexts/LanguageContext';
interface Booking {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  status: string;
  ride_started_at: string | null;
}

interface UrgentPickupFABProps {
  bookings: Booking[];
  currentLocation: { lat: number; lng: number } | null;
  onStartRide: (bookingId: string) => void;
  pendingStartId: string | null;
  hasActiveRide?: boolean;
}

export function UrgentPickupFAB({
  bookings,
  currentLocation,
  onStartRide,
  pendingStartId,
  hasActiveRide = false,
}: UrgentPickupFABProps) {
  const { t } = useLanguage();
  const up = (t as any).urgentPickup || {};
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Find the most urgent pickup (not started yet, confirmed status)
  const urgentPickup = useMemo(() => {
    const pendingPickups = bookings.filter(
      b => b.status === 'confirmed' && !b.ride_started_at
    );

    if (pendingPickups.length === 0) return null;

    // Sort by pickup date and time
    const sorted = pendingPickups.sort((a, b) => {
      const dateTimeA = new Date(`${a.pickup_date}T${a.pickup_time}`);
      const dateTimeB = new Date(`${b.pickup_date}T${b.pickup_time}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    return sorted[0];
  }, [bookings]);

  // Calculate time until pickup
  const timeUntilPickup = useMemo(() => {
    if (!urgentPickup) return null;
    
    const pickupDateTime = new Date(`${urgentPickup.pickup_date}T${urgentPickup.pickup_time}`);
    const now = new Date();
    const minutes = differenceInMinutes(pickupDateTime, now);
    
    if (minutes < 0) return { text: up.overdue || 'Overdue', urgent: true, minutes };
    if (minutes <= 5) return { text: `${minutes}m`, urgent: true, minutes };
    if (minutes <= 15) return { text: `${minutes}m`, urgent: true, minutes };
    if (minutes <= 60) return { text: `${minutes}m`, urgent: false, minutes };
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return { 
      text: remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`, 
      urgent: false,
      minutes 
    };
  }, [urgentPickup]);

  const [showMap, setShowMap] = useState(false);

  const handleStartRide = () => {
    if (urgentPickup) {
      onStartRide(urgentPickup.id);
      setIsExpanded(false);
    }
  };

  // Don't show if no urgent pickup or dismissed
  if (!urgentPickup || isDismissed) return null;

  // Only show for today's pickups or overdue
  const pickupDate = parseISO(urgentPickup.pickup_date);
  if (!isToday(pickupDate) && timeUntilPickup && timeUntilPickup.minutes > 0) return null;

  const truncateAddress = (address: string, maxLength: number = 30) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + '...';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-[60] max-w-sm mx-auto pointer-events-auto"
      >
        <div
          className={cn(
            "rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300",
            "bg-card/95 backdrop-blur-lg",
            timeUntilPickup?.urgent && "border-destructive/50 shadow-destructive/20"
          )}
        >
          {/* Collapsed Header - Always Visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            {/* Urgency Indicator */}
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                timeUntilPickup?.urgent 
                  ? "bg-destructive text-destructive-foreground animate-pulse" 
                  : "bg-primary text-primary-foreground"
              )}
            >
              <Clock className="h-5 w-5" />
            </div>

            {/* Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{up.nextPickup || 'Next Pickup'}</span>
                <Badge 
                  variant={timeUntilPickup?.urgent ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {timeUntilPickup?.text}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {truncateAddress(urgentPickup.pickup_location)}
              </p>
            </div>

            {/* Expand/Collapse Icon */}
            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDismissed(true);
              }}
              className="shrink-0 p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border"
              >
                <div className="p-3 space-y-3">
                  {/* Leaflet Map Preview */}
                  <div className="h-40 rounded-lg overflow-hidden border border-border">
                    <LeafletMap
                      pickupLocation={urgentPickup.pickup_location}
                      driverLocation={currentLocation}
                      showLiveIndicator={true}
                      height="100%"
                    />
                  </div>

                  {/* Full Address */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{up.pickup || 'Pickup'}</p>
                      <p className="text-sm">{urgentPickup.pickup_location}</p>
                    </div>
                  </div>

                  {/* Booking Info */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{urgentPickup.booking_reference}</span>
                    <span>•</span>
                    <span>{urgentPickup.passengers} {urgentPickup.passengers !== 1 ? (up.passengers || 'passengers') : (up.passenger || 'passenger')}</span>
                    <span>•</span>
                    <span>{urgentPickup.pickup_time.slice(0, 5)}</span>
                  </div>

                  {/* Start Ride Action */}
                  <div>
                    {hasActiveRide ? (
                      <div className="flex items-center justify-center gap-1 h-9 px-3 rounded-md bg-muted text-muted-foreground text-xs w-full">
                        <Clock className="h-3 w-3" />
                        <span>{up.completeCurrentRideFirst || 'Complete current ride first'}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-2 w-full"
                        onClick={handleStartRide}
                        disabled={pendingStartId !== null}
                      >
                        <Play className="h-4 w-4" />
                        {up.startRide || 'Start Ride'}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
