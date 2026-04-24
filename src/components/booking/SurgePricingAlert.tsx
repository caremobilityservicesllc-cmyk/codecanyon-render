import { useState } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  CheckCircle,
  Bell,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SurgePricingData } from '@/hooks/useSurgePricing';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';

interface SurgePricingAlertProps {
  surgeData: SurgePricingData | null;
  isLoading?: boolean;
  onTimeSelect?: (time: string) => void;
  className?: string;
}

const surgeLevelConfig = {
  none: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    alertBg: 'bg-green-50 dark:bg-green-950/30',
  },
  low: {
    icon: TrendingUp,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    alertBg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  moderate: {
    icon: Zap,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    alertBg: 'bg-orange-50 dark:bg-orange-950/30',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    alertBg: 'bg-red-50 dark:bg-red-950/30',
  },
  extreme: {
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/40',
    alertBg: 'bg-red-50 dark:bg-red-950/40',
  },
};

export function SurgePricingAlert({
  surgeData,
  isLoading,
  onTimeSelect,
  className,
}: SurgePricingAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useLanguage();
  const sg = (t as any).surge || {};

  if (!surgeData || isDismissed) return null;

  const config = surgeLevelConfig[surgeData.surgeLevel];
  const Icon = config.icon;
  const showAlert = surgeData.isSurge && surgeData.alertMessage;

  const getSurgeLevelLabel = (level: string) => {
    switch (level) {
      case 'extreme': return sg.extremeSurge || 'Extreme Surge Pricing';
      case 'high': return sg.highDemand || 'High Demand Pricing';
      case 'moderate': return sg.surgeActive || 'Surge Pricing Active';
      default: return sg.slightlyHigher || 'Slightly Higher Prices';
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {showAlert && (
        <div className={cn(
          "relative rounded-lg border p-4",
          config.borderColor,
          config.alertBg
        )}>
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute right-2 top-2 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <div className="flex items-start gap-3 pr-6">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              config.bgColor
            )}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={cn("font-semibold", config.color)}>
                  {getSurgeLevelLabel(surgeData.surgeLevel)}
                </h4>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  config.bgColor,
                  config.color
                )}>
                  +{surgeData.surgePercentage}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {sg.pricesHigherNow 
                  ? sg.pricesHigherNow
                      .replace('{percent}', String(surgeData.surgePercentage))
                      .replace('{window}', surgeData.optimalWindows.length > 0 
                        ? `${surgeData.optimalWindows[0].startTime}-${surgeData.optimalWindows[0].endTime}` 
                        : '')
                  : surgeData.alertMessage}
              </p>
              
              {surgeData.expiresAt && (
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(sg.surgeEndsAround || 'Surge ends around {time}').replace('{time}', surgeData.expiresAt)}
                </p>
              )}

              {surgeData.optimalWindows.length > 0 && onTimeSelect && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {surgeData.optimalWindows.slice(0, 2).map((window, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => onTimeSelect(window.startTime)}
                      className="h-8 text-xs"
                    >
                      {(sg.bookAt || 'Book at {time} • {savings}').replace('{time}', window.startTime).replace('{savings}', window.savings)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            "w-full flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50",
            isExpanded && "rounded-b-none border-b-0"
          )}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {sg.viewHourlyForecast || 'View Hourly Price Forecast'}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="rounded-b-lg border border-t-0 border-border bg-card p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>10 PM</span>
              </div>
              
              <div className="flex gap-0.5 h-12 rounded overflow-hidden">
                {surgeData.hourlyForecast.map((slot, idx) => {
                  const intensity = Math.min(1, (slot.multiplier - 1) / 0.4);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => onTimeSelect?.(slot.time)}
                      className={cn(
                        "flex-1 relative group transition-all",
                        slot.isSurge 
                          ? intensity > 0.7 
                            ? "bg-red-500" 
                            : intensity > 0.4 
                              ? "bg-orange-500" 
                              : "bg-amber-500"
                          : "bg-green-500",
                        "hover:opacity-80"
                      )}
                      title={`${slot.time}: ${slot.label} (${slot.multiplier}x)`}
                    >
                      <div className="absolute inset-x-0 bottom-full mb-2 hidden group-hover:block z-10">
                        <div className="bg-popover border rounded-md shadow-lg p-2 text-xs whitespace-nowrap">
                          <p className="font-medium">{slot.time}</p>
                          <p className="text-muted-foreground">{slot.label}</p>
                          <p className={slot.isSurge ? "text-red-500" : "text-green-500"}>
                            {(sg.pricing || '{multiplier}x pricing').replace('{multiplier}', String(slot.multiplier))}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-muted-foreground">{sg.standard || 'Standard'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-muted-foreground">{sg.busy || 'Busy'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span className="text-muted-foreground">{sg.high || 'High'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="text-muted-foreground">{sg.peak || 'Peak'}</span>
                </div>
              </div>
            </div>

            {surgeData.optimalWindows.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  {sg.bestTimesToBook || 'Best Times to Book'}
                </h5>
                <div className="grid gap-2">
                  {surgeData.optimalWindows.map((window, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTimeSelect?.(window.startTime)}
                      className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-left hover:bg-green-500/15 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-300">
                          {window.startTime} - {window.endTime}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {window.label}
                        </p>
                      </div>
                      <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300">
                        {window.savings}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
