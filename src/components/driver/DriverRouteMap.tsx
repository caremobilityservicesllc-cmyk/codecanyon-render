import { useEffect, useState, useCallback } from 'react';
import { Navigation, MapPin, ChevronRight, AlertCircle, Loader2, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LeafletMap } from '@/components/booking/LeafletMap';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

interface DriverRouteMapProps {
  driverLocation: { lat: number; lng: number } | null;
  pickupLocation: string;
  dropoffLocation: string;
  isActive: boolean;
}

interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
}

interface RouteData {
  steps: RouteStep[];
  totalDistance: string;
  totalDuration: string;
  routeCoordinates: [number, number][];
}

export function DriverRouteMap({
  driverLocation,
  pickupLocation,
  dropoffLocation,
  isActive,
}: DriverRouteMapProps) {
  const { t } = useLanguage();
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showDirections, setShowDirections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculateRoute = useCallback(async () => {
    if (!driverLocation || !pickupLocation) return;

    setIsLoading(true);
    try {
      const destination = isActive ? dropoffLocation : pickupLocation;
      const destCoords = await geocodeAddress(destination);
      if (!destCoords) {
        setError((t as any).mapErrors?.couldNotGeocodeDestination || 'Could not geocode destination');
        return;
      }

      // OSRM uses lng,lat
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&steps=true`
      );
      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const distanceKm = route.distance / 1000;
        const durationMins = Math.round(route.duration / 60);

        const steps: RouteStep[] = (leg.steps || []).map((step: any) => ({
          instruction: step.name || step.maneuver?.type || 'Continue',
          distance: step.distance < 1000
            ? `${Math.round(step.distance)} m`
            : `${(step.distance / 1000).toFixed(1)} km`,
          duration: `${Math.round(step.duration / 60)} min`,
        }));

        const routeCoordinates: [number, number][] = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );

        setRouteData({
          steps,
          totalDistance: `${distanceKm.toFixed(1)} km`,
          totalDuration: durationMins < 60
            ? `${durationMins} min`
            : `${Math.floor(durationMins / 60)} hr ${durationMins % 60} min`,
          routeCoordinates,
        });
        setError(null);
      }
    } catch (err) {
      console.error('Route calculation error:', err);
      setError((t as any).mapErrors?.couldNotCalculateRoute || 'Could not calculate route');
    } finally {
      setIsLoading(false);
    }
  }, [driverLocation, pickupLocation, dropoffLocation, isActive]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  if (!driverLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Navigation className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{(t as any).driverRouteMap?.waitingForLocation || 'Waiting for location...'}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map */}
      <Card className="overflow-hidden">
        <div className="relative h-48">
          <LeafletMap
            driverLocation={driverLocation}
            pickupLocation={isActive ? undefined : pickupLocation}
            dropoffLocation={isActive ? dropoffLocation : undefined}
            routeCoordinates={routeData?.routeCoordinates}
            showLiveIndicator={true}
            height="100%"
          />

          {/* Route Summary Overlay */}
          {routeData && (
            <div className="absolute bottom-2 left-2 right-2 z-[1000]">
              <div className="flex items-center justify-between rounded-lg bg-background/95 backdrop-blur-sm border border-border px-3 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{routeData.totalDistance}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{routeData.totalDuration}</span>
                </div>
                <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                  {isActive ? 'To Dropoff' : 'To Pickup'}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Turn-by-Turn Directions */}
      {routeData && routeData.steps.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-primary" />
                Turn-by-Turn Directions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDirections(!showDirections)}
                className="text-xs"
              >
                {showDirections ? 'Hide' : 'Show All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {routeData.steps[currentStepIndex] && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                  →
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {routeData.steps[currentStepIndex].instruction}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {routeData.steps[currentStepIndex].distance} • {routeData.steps[currentStepIndex].duration}
                  </p>
                </div>
              </div>
            )}

            {showDirections && (
              <ScrollArea className="h-40 mt-2">
                <div className="space-y-2">
                  {routeData.steps.map((step, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                        index === currentStepIndex
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setCurrentStepIndex(index)}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                        index === currentStepIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground line-clamp-2">
                          {step.instruction}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.distance}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
