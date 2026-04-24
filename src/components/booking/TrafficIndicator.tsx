import { AlertTriangle, CheckCircle, Clock, CloudRain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrafficData } from '@/hooks/useTrafficData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrafficIndicatorProps {
  trafficData: TrafficData | null;
  isLoading?: boolean;
  className?: string;
  showDetails?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function TrafficIndicator({ 
  trafficData, 
  isLoading, 
  className,
  showDetails = false,
}: TrafficIndicatorProps) {
  const { t } = useLanguage();

  const trafficConfig = {
    low: {
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      label: t.trafficIndicator.lowTraffic,
    },
    moderate: {
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      label: t.trafficIndicator.moderateTraffic,
    },
    heavy: {
      icon: AlertTriangle,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      label: t.trafficIndicator.heavyTraffic,
    },
    severe: {
      icon: CloudRain,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: t.trafficIndicator.severeCongestion,
    },
    unknown: {
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-secondary',
      borderColor: 'border-border',
      label: t.trafficIndicator.trafficUnknown,
    },
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t.trafficIndicator.checkingTraffic}</span>
      </div>
    );
  }

  if (!trafficData || trafficData.trafficLevel === 'unknown') {
    return null;
  }

  const config = trafficConfig[trafficData.trafficLevel];
  const Icon = config.icon;
  const delayMins = Math.round(trafficData.trafficDelay / 60);

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border",
                config.bgColor,
                config.borderColor,
                className
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", config.color)} />
              <span className={cn("text-xs font-medium", config.color)}>
                {config.label}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{trafficData.congestionDescription}</p>
            {delayMins > 0 && (
              <p className="text-muted-foreground">{t.trafficIndicator.minDelay.replace('{mins}', String(delayMins))}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border p-3",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          config.bgColor
        )}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h5 className={cn("font-medium", config.color)}>{config.label}</h5>
            {trafficData.trafficMultiplier > 1 && (
              <span className={cn("text-xs font-medium", config.color)}>
                {t.trafficIndicator.travelTime.replace('{pct}', String(Math.round((trafficData.trafficMultiplier - 1) * 100)))}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {trafficData.congestionDescription}
          </p>
          
          {delayMins > 0 && (
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {t.trafficIndicator.normal} {formatDuration(trafficData.durationWithoutTraffic)}
              </span>
              <span>→</span>
              <span className={config.color}>
                {t.trafficIndicator.withTraffic} {formatDuration(trafficData.durationWithTraffic)}
              </span>
            </div>
          )}
          
          {trafficData.bestDepartureWindow && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              💡 {trafficData.bestDepartureWindow}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
