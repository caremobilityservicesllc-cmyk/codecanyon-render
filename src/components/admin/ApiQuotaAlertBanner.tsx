import { AlertTriangle, AlertCircle, Info, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiQuotaAlerts, QuotaAlert } from '@/hooks/useApiQuotaAlerts';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const priorityConfig = {
  critical: {
    icon: AlertTriangle,
    bgClass: 'bg-destructive/10 border-destructive/30',
    textClass: 'text-destructive',
  },
  warning: {
    icon: AlertCircle,
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
};

export function ApiQuotaAlertBanner() {
  const { alerts, isChecking, checkQuotas } = useApiQuotaAlerts();
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const { t } = useLanguage();
  const qa = (t as any).quotaAlert || {};

  // Only show critical and warning alerts in banner
  const visibleAlerts = alerts.filter(
    alert => 
      (alert.priority === 'critical' || alert.priority === 'warning') &&
      !dismissedAlerts.includes(`${alert.provider}-${alert.apiType}`)
  );

  const dismissAlert = (alert: QuotaAlert) => {
    setDismissedAlerts(prev => [...prev, `${alert.provider}-${alert.apiType}`]);
  };

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleAlerts.map((alert) => {
        const config = priorityConfig[alert.priority];
        const Icon = config.icon;
        const providerName = alert.provider === 'google' ? 'Google Maps' : 'Mapbox';
        const apiName = alert.apiType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

        return (
          <div
            key={`${alert.provider}-${alert.apiType}`}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${config.bgClass}`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${config.textClass}`} />
              <div>
                <p className={`font-medium ${config.textClass}`}>
                  {(qa.quotaUsed || '{provider} {api} - {percent}% of quota used')
                    .replace('{provider}', providerName)
                    .replace('{api}', apiName)
                    .replace('{percent}', String(alert.percent))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(qa.requestsThisMonth || '{current} / {limit} requests this month')
                    .replace('{current}', alert.current.toLocaleString())
                    .replace('{limit}', alert.limit.toLocaleString())}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => checkQuotas()}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => dismissAlert(alert)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
