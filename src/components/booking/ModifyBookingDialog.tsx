import { useState } from 'react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { Calendar as CalendarIcon, Clock, Edit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ModifyBookingDialogProps {
  bookingId: string;
  bookingReference: string;
  currentDate: string;
  currentTime: string;
  status: string;
  onModified?: () => void;
}

// Generate time slots in 15-minute intervals
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

export function ModifyBookingDialog({
  bookingId,
  bookingReference,
  currentDate,
  currentTime,
  status,
  onModified,
}: ModifyBookingDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [newTime, setNewTime] = useState(currentTime);

  // Only allow modification for pending or confirmed bookings
  const canModify = status === 'pending' || status === 'confirmed';

  if (!canModify) {
    return null;
  }

  const handleSubmit = async () => {
    if (!newDate || !newTime) {
      toast.error(t.modifyBooking.selectBothDateAndTime);
      return;
    }

    const formattedDate = format(newDate, 'yyyy-MM-dd');
    
    // Check if anything changed
    if (formattedDate === currentDate && newTime === currentTime) {
      toast.info(t.modifyBooking.noChangesMade);
      setOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          pickup_date: formattedDate,
          pickup_time: newTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast.success(t.modifyBooking.updatedSuccessfully, {
        description: t.modifyBooking.newPickupDesc.replace('{date}', format(newDate, 'PPP')).replace('{time}', newTime),
      });

      setOpen(false);
      onModified?.();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error(t.modifyBooking.failedToUpdate, {
        description: t.modifyBooking.failedToUpdateDesc,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          {t.modifyBooking.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.modifyBooking.title}</DialogTitle>
          <DialogDescription>
            {t.modifyBooking.description.replace('{ref}', bookingReference)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Booking Info */}
          <div className="rounded-lg bg-secondary/50 p-3 text-sm">
            <p className="text-muted-foreground">{t.modifyBooking.currentPickup}</p>
            <p className="font-medium text-foreground">
              {format(new Date(currentDate), 'PPP')} at {currentTime}
            </p>
          </div>

          {/* New Date */}
          <div className="space-y-2">
            <Label>{t.modifyBooking.newPickupDate}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !newDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, 'PPP') : t.modifyBooking.selectDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* New Time */}
          <div className="space-y-2">
            <Label>{t.modifyBooking.newPickupTime}</Label>
            <Select value={newTime} onValueChange={setNewTime}>
              <SelectTrigger className="w-full">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t.modifyBooking.selectTime} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.modifyBooking.saving}
              </>
            ) : (
              t.common.saveChanges
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
