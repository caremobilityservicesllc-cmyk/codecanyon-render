import { useState } from 'react';
import { CalendarClock, MapPin, Clock, Users, Car, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRecurringBookings, RecurringFrequency } from '@/hooks/useRecurringBookings';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Vehicle {
  id: string;
  name: string;
}

interface RecurringBookingDialogProps {
  vehicles: Vehicle[];
  trigger?: React.ReactNode;
}

function getDaysOfWeek(t: any) {
  const ds = (t as any).daysShort || {};
  return [
    { id: 'monday', label: ds.mon || 'Mon' },
    { id: 'tuesday', label: ds.tue || 'Tue' },
    { id: 'wednesday', label: ds.wed || 'Wed' },
    { id: 'thursday', label: ds.thu || 'Thu' },
    { id: 'friday', label: ds.fri || 'Fri' },
    { id: 'saturday', label: ds.sat || 'Sat' },
    { id: 'sunday', label: ds.sun || 'Sun' },
  ];
}

export function RecurringBookingDialog({ vehicles, trigger }: RecurringBookingDialogProps) {
  const { user } = useAuth();
  const { createRecurringBooking } = useRecurringBookings();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const [frequency, setFrequency] = useState<RecurringFrequency>('weekdays');
  const [customDays, setCustomDays] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState('');

  if (!user) return null;

  const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; description: string }[] = [
    { value: 'daily', label: t.recurringBooking.daily, description: t.recurringBooking.everyDay },
    { value: 'weekdays', label: t.recurringBooking.weekdays, description: t.recurringBooking.mondayToFriday },
    { value: 'weekly', label: t.recurringBooking.weekly, description: t.recurringBooking.onceAWeek },
    { value: 'custom', label: t.recurringBooking.custom, description: t.recurringBooking.chooseSpecificDays },
  ];

  const handleCustomDayToggle = (day: string) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!startDate || !pickupLocation || !dropoffLocation || !pickupTime || !vehicleId) return;

    await createRecurringBooking.mutateAsync({
      frequency,
      custom_days: frequency === 'custom' ? customDays : undefined,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      pickup_time: pickupTime,
      vehicle_id: vehicleId,
      passengers,
      notes: notes || undefined,
    });

    setFrequency('weekdays');
    setCustomDays([]);
    setStartDate(undefined);
    setEndDate(undefined);
    setPickupLocation('');
    setDropoffLocation('');
    setPickupTime('');
    setVehicleId('');
    setPassengers(1);
    setNotes('');
    setIsOpen(false);
  };

  const isValid = startDate && pickupLocation && dropoffLocation && pickupTime && vehicleId && 
    (frequency !== 'custom' || customDays.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            {t.recurringBooking.scheduleRecurringRide}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-accent" />
            {t.recurringBooking.scheduleRecurringRide}
          </DialogTitle>
          <DialogDescription>
            {t.recurringBooking.setupAutoBookings}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label>{t.recurringBooking.frequency}</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground ml-2 text-sm">({option.description})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {frequency === 'custom' && (
            <div className="space-y-2">
              <Label>{t.recurringBooking.selectDays}</Label>
              <div className="flex flex-wrap gap-2">
                {getDaysOfWeek(t).map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleCustomDayToggle(day.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                      customDays.includes(day.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.recurringBooking.startDate}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PP') : t.recurringBooking.pickADate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} disabled={(date) => date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t.recurringBooking.endDateOptional}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PP') : t.recurringBooking.noEndDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => startDate ? date < startDate : date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup-time">{t.recurringBooking.pickupTime}</Label>
            <div className="relative">
              <Clock className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pickup-time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="ps-10" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pickup">{t.recurringBooking.pickupLocation}</Label>
              <div className="relative">
                <MapPin className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
                <Input id="pickup" placeholder={t.recurringBooking.enterPickupAddress} value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className="ps-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dropoff">{t.recurringBooking.dropoffLocation}</Label>
              <div className="relative">
                <MapPin className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                <Input id="dropoff" placeholder={t.recurringBooking.enterDropoffAddress} value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} className="ps-10" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.recurringBooking.vehicle}</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder={t.recurringBooking.selectVehicle} /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passengers">{t.recurringBooking.passengers}</Label>
              <div className="relative">
                <Users className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="passengers" type="number" min={1} max={10} value={passengers} onChange={(e) => setPassengers(parseInt(e.target.value) || 1)} className="ps-10" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t.recurringBooking.notesOptional}</Label>
            <Textarea id="notes" placeholder={t.recurringBooking.specialInstructions} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={!isValid || createRecurringBooking.isPending} className="w-full">
            {createRecurringBooking.isPending ? t.recurringBooking.creating : t.recurringBooking.createRecurringBooking}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
