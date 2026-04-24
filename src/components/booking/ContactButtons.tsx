import { Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface ContactButtonsProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export function ContactButtons({ variant = 'default', className }: ContactButtonsProps) {
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const cb = (t as any).contactButtons || {};
  const appName = businessInfo.companyName || 'RideFlow';
  const phoneNumber = businessInfo.phone || '+1 (555) 000-0000';
  const whatsappNumber = phoneNumber.replace(/\D/g, '');

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(`Hi! I would like to book a ride with ${appName}.`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  if (variant === 'compact') {
    return (
      <div className={`flex gap-2 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCall}
              className="border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{cb.callToBook || 'Call to Book'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleWhatsApp}
              className="border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{cb.bookViaWhatsApp || 'Book via WhatsApp'}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <Button
        variant="outline"
        onClick={handleCall}
        className="flex-1 gap-2 border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950"
      >
        <Phone className="h-4 w-4" />
        {cb.callToBook || 'Call to Book'}
      </Button>

      <Button
        variant="outline"
        onClick={handleWhatsApp}
        className="flex-1 gap-2 border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950"
      >
        <MessageCircle className="h-4 w-4" />
        {cb.bookViaWhatsApp || 'Book via WhatsApp'}
      </Button>
    </div>
  );
}
