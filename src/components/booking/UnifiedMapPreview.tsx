import { LeafletMap } from './LeafletMap';
import { Navigation, Clock, MapPin } from 'lucide-react';
import type { RouteInfo } from '@/hooks/useRouteCalculation';
import { useLanguage } from '@/contexts/LanguageContext';

interface UnifiedMapPreviewProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  routeInfo?: RouteInfo | null;
  routeCoordinates?: [number, number][];
  stops?: string[];
}

function truncateLabel(label: string, maxLen = 20): string {
  return label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
}

export function UnifiedMapPreview({
  pickupLocation,
  dropoffLocation,
  routeInfo,
  routeCoordinates,
  stops,
}: UnifiedMapPreviewProps) {
  const { t } = useLanguage();
  const mp = (t as any).mapPreview || {};
  return (
    <div className="relative h-full">
      <LeafletMap
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        routeCoordinates={routeCoordinates || routeInfo?.routeCoordinates}
        stops={stops}
        height="100%"
      />
      
      {/* Route Info Overlay */}
      {routeInfo && (
        <div className="absolute bottom-3 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 z-[1000]">
          <div className="rounded-xl bg-background/90 backdrop-blur-md border border-border shadow-lg overflow-hidden">
            {/* Total route summary */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 px-2 sm:px-4 md:px-6 py-2 sm:py-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/20">
                  <Navigation className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{mp.distance || 'Distance'}</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{routeInfo.distance}</p>
                </div>
              </div>
              
              <div className="h-6 sm:h-8 w-px bg-border shrink-0" />
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/20">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{mp.duration || 'Duration'}</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{routeInfo.duration}</p>
                </div>
              </div>
            </div>

            {/* Per-leg breakdown */}
            {routeInfo.legs && routeInfo.legs.length > 1 && (
              <div className="border-t border-border px-2 sm:px-4 py-1.5 sm:py-2 space-y-1">
                {routeInfo.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                    <span className="truncate font-medium text-foreground/80">
                      {truncateLabel(leg.from)} → {truncateLabel(leg.to)}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums">
                      {leg.distance} · {leg.duration}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
