import { useState, useEffect } from 'react';
import { Sparkles, Loader2, ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BookingDetails } from '@/types/booking';
import { useLanguage } from '@/contexts/LanguageContext';

interface SmartVehicleRecommendationProps {
  bookingDetails: BookingDetails;
}

export function SmartVehicleRecommendation({ bookingDetails }: SmartVehicleRecommendationProps) {
  const [recommendation, setRecommendation] = useState<{ recommendedCategory: string; reason: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!bookingDetails.pickupLocation || !bookingDetails.dropoffLocation) {
      setRecommendation(null);
      setHasQueried(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasQueried(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-booking-features', {
          body: {
            feature: 'vehicle_recommendation',
            context: {
              passengers: bookingDetails.passengers,
              luggage: bookingDetails.luggageCount,
              pickup: bookingDetails.pickupLocation,
              dropoff: bookingDetails.dropoffLocation,
              serviceType: bookingDetails.serviceType,
              distance: bookingDetails.routeDistanceKm?.toFixed(1) || 'unknown',
            },
          },
        });
        if (!error && data?.result) {
          setRecommendation(data.result);
        } else {
          setRecommendation(null);
        }
      } catch {
        setRecommendation(null);
      } finally {
        setIsLoading(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    bookingDetails.pickupLocation,
    bookingDetails.dropoffLocation,
    bookingDetails.passengers,
    bookingDetails.luggageCount,
    bookingDetails.serviceType,
  ]);

  if (!hasQueried && !recommendation) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
        <Sparkles className="h-4 w-4" />
        {t.smartVehicle.aiVehicleRecommendation}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t.smartVehicle.analyzingTrip}
        </div>
      ) : recommendation ? (
        <div className="flex items-start gap-2 text-sm">
          <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-foreground">
            <span className="font-semibold">{recommendation.recommendedCategory}</span>
            {' — '}
            {recommendation.reason}
          </p>
        </div>
      ) : hasQueried ? (
        <p className="text-xs text-muted-foreground">{t.smartVehicle.unableToGenerate}</p>
      ) : null}
    </div>
  );
}
