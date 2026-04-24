import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export interface TrafficData {
  durationWithTraffic: number;
  durationWithoutTraffic: number;
  trafficDelay: number;
  trafficLevel: 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';
  trafficMultiplier: number;
  congestionDescription: string;
  bestDepartureWindow?: string;
}

interface UseTrafficDataProps {
  origin: string;
  destination: string;
  enabled?: boolean;
}

export function useTrafficData({ origin, destination, enabled = true }: UseTrafficDataProps) {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const tf = (t as any).trafficFallback || {};

  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setTrafficData(null);
      return;
    }

    const fetchTrafficData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-traffic-data', {
          body: {
            origin,
            destination,
            departureTime: 'now',
          },
        });

        if (fnError) throw fnError;

        if (data?.error) {
          setTrafficData({
            durationWithTraffic: 0,
            durationWithoutTraffic: 0,
            trafficDelay: 0,
            trafficLevel: 'unknown',
            trafficMultiplier: 1.0,
            congestionDescription: tf.unavailable || 'Traffic data unavailable',
          });
        } else {
          setTrafficData(data);
        }
      } catch (err) {
        console.error('Failed to fetch traffic data:', err);
        setError(tf.unableToLoad || 'Unable to load traffic data');
        setTrafficData(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the fetch
    const timer = setTimeout(fetchTrafficData, 800);
    return () => clearTimeout(timer);
  }, [origin, destination, enabled]);

  return { trafficData, isLoading, error };
}
