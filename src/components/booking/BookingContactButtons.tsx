import { Phone, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface BookingDetails {
  bookingReference: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  vehicleName: string;
  totalPrice: number | null;
  driverName?: string;
  driverPhone?: string;
}

interface BookingContactButtonsProps {
  variant?: 'default' | 'compact';
  className?: string;
  booking?: BookingDetails;
  onLiveChatClick?: () => void;
}

export function BookingContactButtons({ 
  variant = 'default', 
  className,
  booking,
  onLiveChatClick 
}: BookingContactButtonsProps) {
  const { t } = useLanguage();
  const handleCallDriver = () => {
    if (booking?.driverPhone) {
      window.location.href = `tel:${booking.driverPhone}`;
    } else {
      toast.error(t.bookingContact.driverPhoneNotAvailable);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {onLiveChatClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onLiveChatClick}
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <Headphones className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{(t as any).bookingContactButtons?.liveChat || 'Live Chat'}</TooltipContent>
          </Tooltip>
        )}

        {booking?.driverPhone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                onClick={handleCallDriver}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{(t as any).bookingContactButtons?.callDriver || 'Call Driver'}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      {onLiveChatClick && (
        <Button
          variant="outline"
          onClick={onLiveChatClick}
          className="flex-1 gap-2"
        >
          <Headphones className="h-4 w-4" />
          {(t as any).bookingContactButtons?.liveChat || 'Live Chat'}
        </Button>
      )}

      {booking?.driverPhone && (
        <Button
          onClick={handleCallDriver}
          className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Phone className="h-4 w-4" />
          {(t as any).bookingContactButtons?.callDriver || 'Call Driver'}
        </Button>
      )}
    </div>
  );
}
