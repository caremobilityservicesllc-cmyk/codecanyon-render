import { useState } from 'react';
import { AlertTriangle, Clock, Navigation, X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTrafficData } from '@/hooks/useTrafficData';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrafficAlertBannerProps {
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;
  bookingReference: string;
  className?: string;
}

export function TrafficAlertBanner({
  pickupLocation,
  dropoffLocation,
  pickupTime,
  bookingReference,
  className,
}: TrafficAlertBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { t } = useLanguage();
  const ta = (t as any).trafficAlert || {};

  const { trafficData, isLoading, error } = useTrafficData({
    origin: pickupLocation,
    destination: dropoffLocation,
    enabled: !!pickupLocation && !!dropoffLocation,
  });

  if (isDismissed || isLoading || error) {
    return null;
  }

  if (!trafficData || (trafficData.trafficLevel !== 'heavy' && trafficData.trafficLevel !== 'severe')) {
    return null;
  }

  const delayMinutes = Math.round(trafficData.trafficDelay / 60);
  const isSevere = trafficData.trafficLevel === 'severe';

  const [hours, minutes] = pickupTime.split(':').map(Number);
  const suggestedLeaveMinutes = Math.max(15, delayMinutes + 10);
  const suggestedTime = new Date();
  suggestedTime.setHours(hours, minutes - suggestedLeaveMinutes, 0, 0);
  const suggestedTimeStr = suggestedTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 animate-fade-in",
        isSevere 
          ? "border-red-500/50 bg-red-500/10" 
          : "border-orange-500/50 bg-orange-500/10",
        className
      )}
    >
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            currentColor 10px,
            currentColor 11px
          )`
        }} />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isSevere ? "bg-red-500/20" : "bg-orange-500/20"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                isSevere ? "text-red-500" : "text-orange-500"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-semibold",
                isSevere ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
              )}>
                {isSevere ? (ta.severeAlert || '🚨 Severe Traffic Alert') : (ta.heavyAlert || '⚠️ Heavy Traffic Alert')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {trafficData.congestionDescription}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2">
            <Clock className={cn(
              "h-4 w-4",
              isSevere ? "text-red-500" : "text-orange-500"
            )} />
            <div>
              <p className="text-xs text-muted-foreground">{ta.delay || 'Delay'}</p>
              <p className={cn(
                "text-sm font-semibold",
                isSevere ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
              )}>
                +{delayMinutes} {t.common.min}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2">
            <Navigation className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{ta.leaveBy || 'Leave by'}</p>
              <p className="text-sm font-semibold text-foreground">
                {suggestedTimeStr}
              </p>
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 sm:col-span-1">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{ta.status || 'Status'}</p>
              <p className={cn(
                "text-sm font-semibold",
                isSevere ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
              )}>
                {isSevere ? (ta.critical || 'Critical') : (ta.warning || 'Warning')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-background/50 p-3">
          <p className="text-sm text-foreground">
            <strong>{ta.recommendation || 'Recommendation:'}</strong> {(ta.considerLeaving || 'Consider leaving {mins} minutes earlier than planned to arrive on time for your pickup at').replace('{mins}', String(suggestedLeaveMinutes))} <strong>{pickupTime}</strong>.
          </p>
          {trafficData.bestDepartureWindow && (
            <p className="mt-2 text-xs text-muted-foreground">
              💡 {trafficData.bestDepartureWindow}
            </p>
          )}
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {showDetails ? (ta.hideDetails || 'Hide details') : (ta.showMoreDetails || 'Show more details')}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{ta.trafficMultiplier || 'Traffic multiplier'}</span>
              <span className="font-medium">{(ta.normal || '{multiplier}x normal').replace('{multiplier}', String(trafficData.trafficMultiplier))}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{ta.bookingReference || 'Booking reference'}</span>
              <span className="font-mono font-medium">{bookingReference}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{ta.routeStatus || 'Route status'}</span>
              <span className={cn(
                "font-medium",
                isSevere ? "text-red-500" : "text-orange-500"
              )}>
                {isSevere ? (ta.severeCongestion || 'Severe Congestion') : (ta.heavyTraffic || 'Heavy Traffic')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
