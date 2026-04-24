import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const FREE_TIER_LIMITS = {
  google: {
    maps_load: 28000,
    directions: 40000,
    places: 11700,
    geocoding: 40000,
  },
  mapbox: {
    map_load: 50000,
    geocoding: 100000,
    directions: 100000,
  }
};

const ALERT_THRESHOLDS = {
  critical: 90,
  warning: 80,
  info: 70,
};

export interface QuotaAlert {
  provider: 'google' | 'mapbox';
  apiType: string;
  current: number;
  limit: number;
  percent: number;
  priority: 'critical' | 'warning' | 'info';
}

export function useApiQuotaAlerts() {
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const { t } = useLanguage();
  const qt = (t as any).quotaAlertToasts || {};

  const checkQuotas = useCallback(async () => {
    setIsChecking(true);
    try {
      // Get start of current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: usageData, error } = await supabase
        .from('map_api_usage')
        .select('provider, api_type, request_count')
        .gte('recorded_at', startOfMonth.toISOString().split('T')[0]);

      if (error) throw error;

      // Aggregate usage
      const usage: Record<string, Record<string, number>> = {
        google: { maps_load: 0, directions: 0, places: 0, geocoding: 0 },
        mapbox: { map_load: 0, geocoding: 0, directions: 0 },
      };

      usageData?.forEach((row) => {
        if (usage[row.provider] && row.api_type in usage[row.provider]) {
          usage[row.provider][row.api_type] += row.request_count;
        }
      });

      // Check thresholds
      const newAlerts: QuotaAlert[] = [];

      // Check Google limits
      for (const [apiType, limit] of Object.entries(FREE_TIER_LIMITS.google)) {
        const current = usage.google[apiType] || 0;
        const percent = (current / limit) * 100;

        if (percent >= ALERT_THRESHOLDS.critical) {
          newAlerts.push({ provider: 'google', apiType, current, limit, percent: Math.round(percent), priority: 'critical' });
        } else if (percent >= ALERT_THRESHOLDS.warning) {
          newAlerts.push({ provider: 'google', apiType, current, limit, percent: Math.round(percent), priority: 'warning' });
        } else if (percent >= ALERT_THRESHOLDS.info) {
          newAlerts.push({ provider: 'google', apiType, current, limit, percent: Math.round(percent), priority: 'info' });
        }
      }

      // Check Mapbox limits
      for (const [apiType, limit] of Object.entries(FREE_TIER_LIMITS.mapbox)) {
        const current = usage.mapbox[apiType] || 0;
        const percent = (current / limit) * 100;

        if (percent >= ALERT_THRESHOLDS.critical) {
          newAlerts.push({ provider: 'mapbox', apiType, current, limit, percent: Math.round(percent), priority: 'critical' });
        } else if (percent >= ALERT_THRESHOLDS.warning) {
          newAlerts.push({ provider: 'mapbox', apiType, current, limit, percent: Math.round(percent), priority: 'warning' });
        } else if (percent >= ALERT_THRESHOLDS.info) {
          newAlerts.push({ provider: 'mapbox', apiType, current, limit, percent: Math.round(percent), priority: 'info' });
        }
      }

      setAlerts(newAlerts);

      // Show toast for critical alerts
      const criticalAlerts = newAlerts.filter(a => a.priority === 'critical');
      if (criticalAlerts.length > 0) {
        criticalAlerts.forEach(alert => {
          const providerName = alert.provider === 'google' ? 'Google Maps' : 'Mapbox';
          const title = (qt.criticalLabel || 'Critical: {provider} {api} at {percent}%')
            .replace('{provider}', providerName)
            .replace('{api}', alert.apiType.replace('_', ' '))
            .replace('{percent}', String(alert.percent));
          toast.error(title, {
            description: qt.quotaNearlyExhausted || 'API quota nearly exhausted. Consider upgrading your plan.',
            duration: 10000,
          });
        });
      }

      // Show toast for warning alerts (only on initial check)
      const warningAlerts = newAlerts.filter(a => a.priority === 'warning');
      if (warningAlerts.length > 0) {
        const title = (qt.warningCount || '{count} API quota warning(s)')
          .replace('{count}', String(warningAlerts.length));
        toast.warning(title, {
          description: qt.approachingLimits || 'Some map APIs are approaching their limits.',
          duration: 5000,
        });
      }

      return newAlerts;
    } catch (err) {
      console.error('Error checking API quotas:', err);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, [qt]);

  useEffect(() => {
    checkQuotas();
  }, [checkQuotas]);

  return { alerts, isChecking, checkQuotas };
}
