import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { geocodeAddress } from '@/utils/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

interface RideTimeRemainingCompactProps {
  pickupLocation: string;
  dropoffLocation: string;
  rideStartedAt: string;
  estimatedDurationMinutes?: number | null;
}

export function RideTimeRemainingCompact({
  pickupLocation,
  dropoffLocation,
  rideStartedAt,
  estimatedDurationMinutes,
}: RideTimeRemainingCompactProps) {
  const { t } = useLanguage();
  const rt = (t as any).rideTime || {};
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(
    estimatedDurationMinutes || null
  );
  const [isCalculating, setIsCalculating] = useState(!estimatedDurationMinutes);

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
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins}m`;
  };

  if (isCalculating) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs">...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 min-w-[100px]">
          <Timer className={`h-3.5 w-3.5 flex-shrink-0 ${isOvertime ? 'text-amber-500' : 'text-primary'}`} />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${isOvertime ? 'text-amber-500' : 'text-primary'}`}>
                {isOvertime ? (rt.arriving || 'Arriving') : timeRemaining !== null ? formatTime(timeRemaining) : '—'}
              </span>
              <span className="text-muted-foreground">{formatTime(timeElapsed)}</span>
            </div>
            {estimatedTotal && (
              <Progress 
                value={progress} 
                className={`h-1 ${isOvertime ? '[&>div]:bg-amber-500' : ''}`}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div className="text-xs space-y-1">
          <p className="font-medium">
            {isOvertime
              ? (rt.arrivingSoon || 'Arriving soon')
              : timeRemaining !== null
                ? (rt.remaining || '{time} remaining').replace('{time}', formatTime(timeRemaining))
                : (rt.inProgress || 'In progress')}
          </p>
          <p className="text-muted-foreground">{rt.elapsed || 'Elapsed'}: {formatTime(timeElapsed)}</p>
          {estimatedTotal && (
            <p className="text-muted-foreground">{(rt.estTotal || 'Est. {time}').replace('{time}', formatTime(estimatedTotal))}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
