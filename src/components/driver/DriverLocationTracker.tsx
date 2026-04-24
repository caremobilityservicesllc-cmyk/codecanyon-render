import { MapPin, Navigation, Loader2, AlertCircle, MapPinOff, Clock, Radio, Gauge, Settings, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface ETAData {
  formatted: string;
  durationText: string;
  distanceText: string;
  hasTrafficData: boolean;
}

interface LocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: number;
}

interface DriverLocationTrackerProps {
  isTracking: boolean;
  currentLocation: LocationData | null;
  error: string | null;
  eta?: ETAData | null;
  lastUpdateTime?: Date | null;
  onRequestPermission?: () => void;
}

export function DriverLocationTracker({
  isTracking,
  currentLocation,
  error,
  eta,
  lastUpdateTime,
  onRequestPermission,
}: DriverLocationTrackerProps) {
  const { t } = useLanguage();
  const dl = (t as any).driverLocationTracker || {};

  if (error) {
    const isPermissionDenied = error.toLowerCase().includes('permission denied');
    
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-destructive">{dl.locationAccessRequired || 'Location Access Required'}</p>
            <p className="text-xs text-destructive/80">{error}</p>
            
            {isPermissionDenied && (
              <div className="mt-3 rounded-md bg-background/50 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">{dl.toEnableLocation || 'To enable location:'}</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>{dl.step1 || "Tap the lock/info icon in your browser's address bar"}</li>
                  <li>{dl.step2 || 'Find "Location" and set it to "Allow"'}</li>
                  <li>{dl.step3 || 'Refresh the page or tap retry below'}</li>
                </ol>
              </div>
            )}
            
            <div className="flex items-center gap-2 pt-1">
              {onRequestPermission && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onRequestPermission}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {dl.retry || 'Retry'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => window.location.reload()}
              >
                {dl.refreshPage || 'Refresh Page'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isTracking) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border p-3">
        <MapPinOff className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {dl.locationSharingWillStart || 'Location sharing will start when you begin a ride'}
        </p>
      </div>
    );
  }

  const speedKmh = currentLocation?.speed ? Math.round(currentLocation.speed * 3.6) : null;

  return (
    <div className="space-y-2">
      <div className={cn(
        "flex items-center gap-3 rounded-lg p-3 border",
        currentLocation 
          ? "bg-accent/10 border-accent/30" 
          : "bg-primary/10 border-primary/30"
      )}>
        <div className="relative">
          {currentLocation ? (
            <>
              <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
              <div className="relative h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Navigation className="h-4 w-4 text-accent-foreground" />
              </div>
            </>
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-sm font-medium",
              currentLocation ? "text-accent" : "text-primary"
            )}>
              {currentLocation 
                ? (dl.sharingLocation || 'Sharing Location') 
                : (dl.gettingLocation || 'Getting Location...')}
            </p>
            {currentLocation && (
              <Badge variant="outline" className="text-xs bg-accent/10 border-accent/30 text-accent gap-1">
                <Radio className="h-3 w-3 animate-pulse" />
                {dl.live || 'Live'}
              </Badge>
            )}
          </div>
          {currentLocation && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}</span>
              {speedKmh !== null && speedKmh > 0 && (
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" />
                  {speedKmh} {t.common.km}/h
                </span>
              )}
              {lastUpdateTime && (
                <span className="text-muted-foreground/70">
                  {formatDistanceToNow(lastUpdateTime, { addSuffix: true, includeSeconds: true })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {eta && (
        <div className="flex items-center gap-3 rounded-lg p-3 border bg-primary/5 border-primary/20">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {(dl.etaToPickup || 'ETA to pickup: {eta}').replace('{eta}', eta.formatted)}
              </p>
              {eta.hasTrafficData && (
                <Badge variant="outline" className="text-xs">
                  {dl.liveTraffic || 'Live Traffic'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {eta.distanceText} • {eta.durationText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
