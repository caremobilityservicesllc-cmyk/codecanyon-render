import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface TimeSlot {
  time: string;
  multiplier: number;
  label: string;
  isSurge: boolean;
}

interface OptimalWindow {
  startTime: string;
  endTime: string;
  savings: string;
  label: string;
}

export interface SurgePricingData {
  currentMultiplier: number;
  isSurge: boolean;
  surgeLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  surgePercentage: number;
  reason: string;
  optimalWindows: OptimalWindow[];
  hourlyForecast: TimeSlot[];
  alertMessage?: string;
  expiresAt?: string;
}

interface UseSurgePricingProps {
  pickupDate: Date | null;
  pickupTime: string;
  routeDistanceKm?: number | null;
  enabled?: boolean;
}

export function useSurgePricing({ 
  pickupDate, 
  pickupTime, 
  routeDistanceKm,
  enabled = true 
}: UseSurgePricingProps) {
  const [surgeData, setSurgeData] = useState<SurgePricingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const sp = (t as any).surgePricingErrors || {};

  useEffect(() => {
    if (!enabled || !pickupDate || !pickupTime) {
      setSurgeData(null);
      return;
    }

    const fetchSurgeData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('analyze-surge-pricing', {
          body: {
            pickupDate: pickupDate.toISOString(),
            pickupTime,
            routeDistanceKm,
          },
        });

        if (fnError) throw fnError;
        setSurgeData(data);
      } catch (err) {
        console.error('Failed to fetch surge pricing data:', err);
        setError(sp.unableToAnalyze || 'Unable to analyze pricing');
        setSurgeData(null);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSurgeData, 300);
    return () => clearTimeout(timer);
  }, [pickupDate, pickupTime, routeDistanceKm, enabled]);

  return { surgeData, isLoading, error };
}
