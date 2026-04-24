import { format } from 'date-fns';
import { CalendarClock, MapPin, Clock, Car, Pause, Play, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useRecurringBookings, RecurringBooking, RecurringFrequency } from '@/hooks/useRecurringBookings';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Vehicle {
  id: string;
  name: string;
}

interface RecurringBookingsListProps {
  vehicles: Vehicle[];
}

export function RecurringBookingsList({ vehicles }: RecurringBookingsListProps) {
  const { recurringBookings, isLoading, toggleRecurringBooking, deleteRecurringBooking } = useRecurringBookings();
  const { t } = useLanguage();
  const rl = (t as any).recurringBookingsList || {};

  const frequencyLabels: Record<RecurringFrequency, string> = {
    daily: rl.daily || 'Daily',
    weekly: rl.weekly || 'Weekly',
    weekdays: rl.weekdays || 'Weekdays',
    custom: rl.custom || 'Custom',
  };

  const dayAbbreviations: Record<string, string> = {
    monday: rl.mon || 'Mon',
    tuesday: rl.tue || 'Tue',
    wednesday: rl.wed || 'Wed',
    thursday: rl.thu || 'Thu',
    friday: rl.fri || 'Fri',
    saturday: rl.sat || 'Sat',
    sunday: rl.sun || 'Sun',
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle?.name || (rl.unknownVehicle || 'Unknown Vehicle');
  };

  const getFrequencyDisplay = (booking: RecurringBooking) => {
    if (booking.frequency === 'custom' && booking.custom_days) {
      return booking.custom_days.map(d => dayAbbreviations[d] || d).join(', ');
    }
    return frequencyLabels[booking.frequency];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (recurringBookings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <CalendarClock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
          {rl.noRecurringBookings || 'No recurring bookings'}
        </h3>
        <p className="text-muted-foreground">
          {rl.setupRecurringRides || 'Set up recurring rides for your regular commutes.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recurringBookings.map((booking) => (
        <div
          key={booking.id}
          className={cn(
            "rounded-xl border bg-card p-5 transition-all",
            booking.is_active ? "border-primary/30" : "border-border opacity-60"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={booking.is_active ? "default" : "secondary"} className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {getFrequencyDisplay(booking)}
                </Badge>
                {!booking.is_active && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Pause className="h-3 w-3 mr-1" />
                    {rl.paused || 'Paused'}
                  </Badge>
                )}
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground truncate">{booking.pickup_location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-foreground truncate">{booking.dropoff_location}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{booking.pickup_time}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Car className="h-4 w-4" />
                  <span>{getVehicleName(booking.vehicle_id)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {rl.from || 'From'} {format(new Date(booking.start_date), 'MMM d, yyyy')}
                    {booking.end_date && ` ${rl.to || 'to'} ${format(new Date(booking.end_date), 'MMM d, yyyy')}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {booking.is_active ? (rl.active || 'Active') : (rl.paused || 'Paused')}
                </span>
                <Switch
                  checked={booking.is_active ?? false}
                  onCheckedChange={(checked) => 
                    toggleRecurringBooking.mutate({ id: booking.id, is_active: checked })
                  }
                  disabled={toggleRecurringBooking.isPending}
                />
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{rl.deleteRecurringBooking || 'Delete recurring booking?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {rl.deleteRecurringDesc || 'This will permanently delete this recurring booking schedule. Any rides already created will not be affected.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteRecurringBooking.mutate(booking.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t.common.delete}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
