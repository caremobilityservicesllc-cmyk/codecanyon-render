import { MapPin, Navigation, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface GeofenceIndicatorProps {
  type: 'pickup' | 'dropoff';
  distance: string;
  isApproaching: boolean;
  isArrived: boolean;
}

export function GeofenceIndicator({
  type,
  distance,
  isApproaching,
  isArrived,
}: GeofenceIndicatorProps) {
  const isPickup = type === 'pickup';
  const { t } = useLanguage();
  const gi = (t as any).geofenceIndicator || {};
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-all duration-300',
        isArrived
          ? 'border-green-500/50 bg-green-500/10'
          : isApproaching
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-border bg-muted/30'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          isArrived
            ? 'bg-green-500/20'
            : isApproaching
            ? 'bg-amber-500/20'
            : 'bg-muted'
        )}
      >
        {isArrived ? (
          <CheckCircle2
            className={cn(
              'h-5 w-5',
              isPickup ? 'text-green-500' : 'text-green-500'
            )}
          />
        ) : (
          <MapPin
            className={cn(
              'h-5 w-5',
              isApproaching
                ? 'text-amber-500'
                : isPickup
                ? 'text-accent'
                : 'text-destructive'
            )}
          />
        )}
      </div>

      <div className="flex-1">
        <p
          className={cn(
            'text-sm font-medium',
            isArrived
              ? 'text-green-500'
              : isApproaching
              ? 'text-amber-500'
              : 'text-foreground'
          )}
        >
          {isPickup ? (gi.pickup || 'Pickup') : (gi.dropoff || 'Dropoff')}
        </p>
        <p className="text-xs text-muted-foreground">
          {isArrived
            ? (gi.youHaveArrived || 'You have arrived')
            : isApproaching
            ? (gi.approachingLocation || 'Approaching location')
            : (gi.enRoute || 'En route')}
        </p>
      </div>

      <div className="text-right">
        <p
          className={cn(
            'text-lg font-semibold tabular-nums',
            isArrived
              ? 'text-green-500'
              : isApproaching
              ? 'text-amber-500'
              : 'text-foreground'
          )}
        >
          {distance}
        </p>
        <p className="text-xs text-muted-foreground">
          {isArrived ? (gi.arrived || 'arrived') : (gi.away || 'away')}
        </p>
      </div>

      {/* Animated indicator for approaching */}
      {isApproaching && !isArrived && (
        <div className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </div>
      )}

      {/* Checkmark for arrived */}
      {isArrived && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
          <CheckCircle2 className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
