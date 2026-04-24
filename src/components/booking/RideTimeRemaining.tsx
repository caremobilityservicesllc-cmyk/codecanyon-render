import { useEffect, useState } from 'react';
import { Clock, MapPin, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

interface RideTimeRemainingProps {
  pickupLocation: string;
  dropoffLocation: string;
  rideStartedAt: string;
  estimatedDurationMinutes?: number | null;
}

export function RideTimeRemaining({
  pickupLocation,
  dropoffLocation,
  rideStartedAt,
  estimatedDurationMinutes,
}: RideTimeRemainingProps) {
  const { t } = useLanguage();
  const rt = (t as any).rideTime || {};
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(
    estimatedDurationMinutes || null
  );
  const [isCalculating, setIsCalculating] = useState(!estimatedDurationMinutes);

  // Calculate estimated duration via OSRM if not provided
  useEffect(() => {
    if (estimatedTotal) return;

    const calculateDuration = async () => {
      try {
        const [pickupCoords, dropoffCoords] = await Promise.all([
          geocodeAddress(pickupLocation),
          geocodeAddress(dropoffLocation),
        ]);

        if (pickupCoords && dropoffCoords) {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropoffCoords[1]},${dropoffCoords[0]}?overview=false`
          );
          const data = await response.json();

          if (data.routes?.[0]) {
            const durationMinutes = Math.ceil(data.routes[0].duration / 60);
            setEstimatedTotal(durationMinutes);
          }
        }
      } catch (error) {
        console.error('Failed to calculate route duration:', error);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateDuration();
  }, [pickupLocation, dropoffLocation, estimatedTotal]);

  // Update elapsed time every second
  useEffect(() => {
    const startTime = new Date(rideStartedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000 / 60);
      setTimeElapsed(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [rideStartedAt]);

  const timeRemaining = estimatedTotal ? Math.max(0, estimatedTotal - timeElapsed) : null;
  const progress = estimatedTotal ? Math.min(100, (timeElapsed / estimatedTotal) * 100) : 0;
  const isOvertime = timeRemaining === 0 && timeElapsed > 0;

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isCalculating) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">{rt.calculatingRoute || 'Calculating route time...'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isOvertime ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/30 bg-primary/5'}>
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isOvertime ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
              <Timer className={`h-4 w-4 ${isOvertime ? 'text-amber-500' : 'text-primary'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{rt.rideInProgress || 'Ride in Progress'}</p>
              <p className={`font-semibold ${isOvertime ? 'text-amber-500' : 'text-primary'}`}>
                {isOvertime
                  ? (rt.arrivingSoon || 'Arriving Soon')
                  : timeRemaining !== null
                    ? (rt.remaining || '{time} remaining').replace('{time}', formatTime(timeRemaining))
                    : (rt.enRoute || 'En Route')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{rt.elapsed || 'Elapsed'}</p>
            <p className="font-medium">{formatTime(timeElapsed)}</p>
          </div>
        </div>

        {estimatedTotal && (
          <div className="space-y-2">
            <Progress 
              value={progress} 
              className={`h-2 ${isOvertime ? '[&>div]:bg-amber-500' : ''}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-accent" />
                {rt.started || 'Started'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-destructive" />
                {estimatedTotal && (rt.estTotal || 'Est. {time}').replace('{time}', formatTime(estimatedTotal))}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="text-xs">
            <p className="text-muted-foreground mb-0.5">{rt.from || 'From'}</p>
            <p className="font-medium truncate">{pickupLocation}</p>
          </div>
          <div className="text-xs">
            <p className="text-muted-foreground mb-0.5">{rt.to || 'To'}</p>
            <p className="font-medium truncate">{dropoffLocation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
