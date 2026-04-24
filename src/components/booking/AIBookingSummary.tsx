import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BookingDetails } from '@/types/booking';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';

interface AIBookingSummaryProps {
  bookingDetails: BookingDetails;
  totalPrice: number;
}

export function AIBookingSummary({ bookingDetails, totalPrice }: AIBookingSummaryProps) {
  const [summary, setSummary] = useState<{ summary: string; tip: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();

  useEffect(() => {
    if (
      !bookingDetails.pickupLocation ||
      !bookingDetails.dropoffLocation ||
      !bookingDetails.selectedVehicle ||
      !bookingDetails.paymentMethod ||
      !bookingDetails.pickupDate
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasQueried(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-booking-features', {
          body: {
            feature: 'booking_summary',
            context: {
              pickup: bookingDetails.pickupLocation,
              dropoff: bookingDetails.dropoffLocation,
              date: format(bookingDetails.pickupDate!, 'MMMM d, yyyy'),
              time: bookingDetails.pickupTime,
              vehicle: bookingDetails.selectedVehicle!.name,
              passengers: bookingDetails.passengers,
              paymentMethod: bookingDetails.paymentMethod,
              totalPrice: formatPrice(totalPrice),
            },
          },
        });
        if (!error && data?.result) {
          setSummary(data.result);
        } else {
          setSummary(null);
        }
      } catch {
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    bookingDetails.pickupLocation,
    bookingDetails.dropoffLocation,
    bookingDetails.selectedVehicle?.id,
    bookingDetails.paymentMethod,
    bookingDetails.pickupDate,
    totalPrice,
  ]);

  if (!hasQueried && !summary) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" />
        {t.aiBookingSummary.aiBookingSummary}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t.aiBookingSummary.generatingSummary}
        </div>
      ) : summary ? (
        <>
          <p className="text-sm text-foreground">{summary.summary}</p>
          {summary.tip && (
            <div className="flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span>{summary.tip}</span>
            </div>
          )}
        </>
      ) : hasQueried ? (
        <p className="text-xs text-muted-foreground">{t.aiBookingSummary.unableToGenerate}</p>
      ) : null}
    </div>
  );
}
