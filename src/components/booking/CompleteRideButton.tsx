import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';


interface CompleteRideButtonProps {
  bookingId: string;
  bookingReference: string;
  onComplete?: () => void;
}

export function CompleteRideButton({ 
  bookingId, 
  bookingReference,
  onComplete 
}: CompleteRideButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const handleCompleteRide = async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          ride_completed_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast.success(t.driver.rideCompleted, {
        description: t.driver.rideCompletedDescription.replace('{ref}', bookingReference),
      });

      setIsOpen(false);
      onComplete?.();
    } catch (err) {
      console.error('Error completing ride:', err);
      toast.error(t.driver.failedToCompleteRide, {
        description: t.driver.failedToCompleteDescription,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="default" 
          className="w-full gap-2 bg-green-600 hover:bg-green-700"
        >
           <CheckCircle className="h-4 w-4" />
          {t.driver.completeRide}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.driver.completeRideTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.driver.completeRideDescription.replace('{ref}', bookingReference)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCompleteRide}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.driver.completing}
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t.driver.yesCompleteRide}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
