import { Route, Clock, Loader2, MapPin } from 'lucide-react';
import type { RouteInfo } from '@/hooks/useRouteCalculation';
import { cn } from '@/lib/utils';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface RouteInfoCardProps {
  routeInfo: RouteInfo | null;
  isLoading: boolean;
  error?: string | null;
  className?: string;
}

function truncateLabel(label: string, maxLen = 25): string {
  return label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
}

export function RouteInfoCard({ routeInfo, isLoading, error, className }: RouteInfoCardProps) {
  const { formatDistance } = useSystemSettings();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-3",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t.routeInfo.calculatingRoute}</span>
      </div>
    );
  }

  if (error || !routeInfo) {
    return null;
  }

  return (
    <div className={cn(
      "rounded-lg border border-primary/30 bg-primary/5 overflow-hidden",
      className
    )}>
      <div className="flex items-center gap-4 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Route className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.routeInfo.distance}</p>
            <p className="text-sm font-semibold text-foreground">
              {routeInfo.distanceMeters 
                ? formatDistance(routeInfo.distanceMeters / 1000) 
                : routeInfo.distance}
            </p>
          </div>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.routeInfo.duration}</p>
            <p className="text-sm font-semibold text-foreground">{routeInfo.duration}</p>
          </div>
        </div>
      </div>

      {routeInfo.legs && routeInfo.legs.length > 1 && (
        <div className="border-t border-primary/20 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.routeInfo.routeSegments}</p>
          {routeInfo.legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="truncate font-medium text-foreground/80">
                {truncateLabel(leg.from)} → {truncateLabel(leg.to)}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-foreground/70">
                {leg.distance} · {leg.duration}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
