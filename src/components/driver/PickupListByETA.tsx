import { useMemo, useCallback } from 'react';
import { Clock, MapPin, Navigation, AlertTriangle, Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openNavigation, getPreferredNavigationApp, getNavigationAppName } from '@/utils/navigationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PickupBooking {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
  ride_started_at: string | null;
}

interface MarkerData {
  booking: PickupBooking;
  position: { lat: number; lng: number };
  eta?: string;
  etaMinutes?: number;
}

interface PickupListByETAProps {
  markers: MarkerData[];
  onPickupClick: (address: string) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  voiceSupported: boolean;
  driverLocation?: { lat: number; lng: number } | null;
}

const getDateLabel = (dateStr: string) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
};

const getUrgencyLevel = (etaMinutes?: number) => {
  if (etaMinutes === undefined) return 'unknown';
  if (etaMinutes <= 5) return 'critical';
  if (etaMinutes <= 10) return 'urgent';
  if (etaMinutes <= 20) return 'soon';
  return 'normal';
};

const getUrgencyStyles = (urgency: string) => {
  switch (urgency) {
    case 'critical':
      return {
        border: 'border-l-4 border-l-destructive',
        badge: 'bg-destructive text-destructive-foreground',
        text: 'text-destructive',
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    case 'urgent':
      return {
        border: 'border-l-4 border-l-amber-500',
        badge: 'bg-amber-500 text-white',
        text: 'text-amber-500',
        icon: null,
      };
    case 'soon':
      return {
        border: 'border-l-4 border-l-primary',
        badge: 'bg-primary text-primary-foreground',
        text: 'text-primary',
        icon: null,
      };
    default:
      return {
        border: 'border-l-4 border-l-muted',
        badge: 'bg-muted text-muted-foreground',
        text: 'text-muted-foreground',
        icon: null,
      };
  }
};

export function PickupListByETA({
  markers,
  onPickupClick,
  voiceEnabled,
  onToggleVoice,
  voiceSupported,
  driverLocation,
}: PickupListByETAProps) {
  const { t } = useLanguage();
  const pl = (t as any).pickupList || {};
  const preferredApp = getPreferredNavigationApp();
  const appName = getNavigationAppName(preferredApp);

  const handleNavigate = useCallback((e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    openNavigation(address, driverLocation, preferredApp);
  }, [driverLocation, preferredApp]);

  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => {
      const aActive = a.booking.ride_started_at && a.booking.status === 'confirmed';
      const bActive = b.booking.ride_started_at && b.booking.status === 'confirmed';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (a.etaMinutes === undefined && b.etaMinutes === undefined) return 0;
      if (a.etaMinutes === undefined) return 1;
      if (b.etaMinutes === undefined) return -1;
      return a.etaMinutes - b.etaMinutes;
    });
  }, [markers]);

  if (markers.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{pl.noAssignedPickups || 'No assigned pickups'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{pl.sortedByArrival || 'Sorted by arrival time'}</span>
        </div>
        {voiceSupported && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs gap-1.5", voiceEnabled && "text-primary")}
            onClick={onToggleVoice}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                {pl.voiceOn || 'Voice On'}
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                {pl.voiceOff || 'Voice Off'}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {sortedMarkers.map((marker, index) => {
          const { booking, eta, etaMinutes } = marker;
          const isActive = booking.ride_started_at && booking.status === 'confirmed';
          const urgency = getUrgencyLevel(etaMinutes);
          const styles = getUrgencyStyles(urgency);

          return (
            <div
              key={booking.id}
              className={cn(
                "p-3 rounded-lg bg-card border transition-all",
                styles.border,
                isActive && "ring-2 ring-primary/50"
              )}
            >
              <button
                onClick={() => onPickupClick(booking.pickup_location)}
                className="w-full text-left hover:bg-accent/30 -m-1 p-1 rounded transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {booking.booking_reference}
                      </span>
                      {isActive && (
                        <Badge variant="default" className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5">
                          {pl.inProgress || 'IN PROGRESS'}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-1">
                      {getDateLabel(booking.pickup_date)} at {booking.pickup_time.slice(0, 5)}
                    </p>
                    
                    <div className="flex items-start gap-1.5 text-xs">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                      <span className="line-clamp-2">{booking.pickup_location}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {eta ? (
                      <>
                        <Badge className={cn("text-xs font-semibold", styles.badge)}>
                          <div className="flex items-center gap-1">
                            {styles.icon}
                            {eta}
                          </div>
                        </Badge>
                        {etaMinutes !== undefined && etaMinutes <= 5 && (
                          <span className={cn("text-[10px] font-medium", styles.text)}>
                            {pl.almostThere || 'Almost there!'}
                          </span>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {pl.calculating || 'Calculating...'}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-8 text-xs gap-2"
                  onClick={(e) => handleNavigate(e, booking.pickup_location)}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  {(pl.navigateWith || 'Navigate with {app}').replace('{app}', appName)}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 px-1 text-[10px] text-muted-foreground border-t border-border">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span>≤5 {t.common.min}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>≤10 {t.common.min}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>≤20 {t.common.min}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span>&gt;20 {t.common.min}</span>
        </div>
      </div>
    </div>
  );
}
