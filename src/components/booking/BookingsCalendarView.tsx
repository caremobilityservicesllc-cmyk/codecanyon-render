import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, isBefore, startOfDay, addMinutes, setHours, setMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, MapPin, Clock, Car, Users, X, 
  Navigation, Eye, RefreshCw, DollarSign, GripVertical, CalendarCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TransferType } from '@/types/booking';
import { toast } from 'sonner';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Booking {
  id: string;
  booking_reference: string;
  service_type: string;
  transfer_type: TransferType;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  vehicle_name: string;
  status: string;
  created_at: string;
  total_price: number;
  payment_method?: string;
  notes?: string;
}

interface BookingsCalendarViewProps {
  bookings: Booking[];
  onRebook?: (booking: Booking) => void;
  onReschedule?: (bookingId: string, newDate: string, newTime: string) => Promise<void>;
}

const statusConfig: Record<string, { bg: string; dot: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', dot: 'bg-yellow-500' },
  confirmed: { bg: 'bg-accent/20', dot: 'bg-accent' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', dot: 'bg-green-500' },
  cancelled: { bg: 'bg-destructive/20', dot: 'bg-destructive' },
};

export function BookingsCalendarView({ bookings, onRebook, onReschedule }: BookingsCalendarViewProps) {
  const navigate = useNavigate();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  
  // Drag and drop state
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{ booking: Booking; newDate: string; newTime: string } | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const bc = (t as any).bookingCalendar || {};
  const bcv = (t as any).bookingsCalendar || {};
  const weekdays = [
    bc.sunShort || 'Sun',
    bc.monShort || 'Mon',
    bc.tueShort || 'Tue',
    bc.wedShort || 'Wed',
    bc.thuShort || 'Thu',
    bc.friShort || 'Fri',
    bc.satShort || 'Sat',
  ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t.status.confirmed;
      case 'completed':
        return t.status.completed;
      case 'cancelled':
        return t.status.cancelled;
      default:
        return t.status.pending;
    }
  };

  // Generate time slots (every 15 minutes from 6:00 to 22:00)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 22 && minute > 0) break;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  // Get bookings grouped by date
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(booking => {
      const dateKey = booking.pickup_date;
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, booking]);
    });
    return map;
  }, [bookings]);

  // Get days in current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDayClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayBookings = bookingsByDate.get(dateKey);
    if (dayBookings && dayBookings.length > 0) {
      setSelectedDate(date);
      setShowDayDialog(true);
    }
  };

  const selectedDateBookings = selectedDate 
    ? bookingsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : [];

  const handleTrackRide = (booking: Booking) => {
    navigate(`/track?ref=${booking.booking_reference}`);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/booking-confirmation/${booking.id}`);
  };

  // Drag and drop handlers
  const canReschedule = useCallback((booking: Booking) => {
    return booking.status === 'pending' || booking.status === 'confirmed';
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, booking: Booking) => {
    if (!canReschedule(booking)) {
      e.preventDefault();
      return;
    }
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
    
    // Add a drag image with booking info
    const dragEl = document.createElement('div');
    dragEl.className = 'bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-medium';
    dragEl.textContent = `${booking.vehicle_name} - ${booking.pickup_time}`;
    dragEl.style.position = 'absolute';
    dragEl.style.top = '-1000px';
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 0, 0);
    setTimeout(() => document.body.removeChild(dragEl), 0);
  }, [canReschedule]);

  const handleDragEnd = useCallback(() => {
    setDraggedBooking(null);
    setDragOverDate(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const dateKey = format(date, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    
    // Don't allow dropping on past dates
    if (isBefore(date, today)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const dateKey = format(date, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    
    if (isBefore(date, today) || !draggedBooking) {
      handleDragEnd();
      return;
    }
    
    // If dropping on same date, do nothing
    if (draggedBooking.pickup_date === dateKey) {
      handleDragEnd();
      return;
    }
    
    // Show confirmation dialog with the booking's current time as default
    setPendingReschedule({ booking: draggedBooking, newDate: dateKey, newTime: draggedBooking.pickup_time });
    setShowRescheduleDialog(true);
    handleDragEnd();
  }, [draggedBooking, handleDragEnd]);

  const confirmReschedule = async () => {
    if (!pendingReschedule || !onReschedule) return;
    
    setIsRescheduling(true);
    try {
      await onReschedule(pendingReschedule.booking.id, pendingReschedule.newDate, pendingReschedule.newTime);
      const timeChanged = pendingReschedule.newTime !== pendingReschedule.booking.pickup_time;
      const dateChanged = pendingReschedule.newDate !== pendingReschedule.booking.pickup_date;
      
      let description = '';
      if (dateChanged && timeChanged) {
        description = (bc.movedToWithTime || 'Moved to {date} at {time}')
          .replace('{date}', format(parseISO(pendingReschedule.newDate), 'EEEE, MMMM d, yyyy'))
          .replace('{time}', pendingReschedule.newTime);
      } else if (dateChanged) {
        description = (bc.movedToDate || 'Moved to {date}')
          .replace('{date}', format(parseISO(pendingReschedule.newDate), 'EEEE, MMMM d, yyyy'));
      } else {
        description = (bc.timeChangedTo || 'Time changed to {time}').replace('{time}', pendingReschedule.newTime);
      }
      
      toast.success(t.bookingCalendar.rescheduledSuccessfully, { description });
      setShowRescheduleDialog(false);
      setPendingReschedule(null);
    } catch (error) {
      toast.error(t.bookingCalendar.failedToReschedule);
    } finally {
      setIsRescheduling(false);
    }
  };

  const cancelReschedule = () => {
    setShowRescheduleDialog(false);
    setPendingReschedule(null);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="font-display text-lg font-semibold text-foreground ml-2">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
        </div>
        <Button variant="ghost" size="sm" onClick={goToToday}>
          {bcv.today || 'Today'}
        </Button>
      </div>

      {/* Drag hint */}
      {onReschedule && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <GripVertical className="h-4 w-4" />
          <span>{bcv.dragHint || 'Drag pending or confirmed bookings to reschedule them'}</span>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {weekdays.map(day => (
            <div 
              key={day} 
              className="py-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const hasBookings = dayBookings.length > 0;
            const isPastDate = isBefore(day, startOfDay(new Date()));
            const isDragOver = dragOverDate === dateKey && !isPastDate;
            const isDragging = draggedBooking !== null;

            // Get unique statuses for this day
            const statuses = [...new Set(dayBookings.map(b => b.status))];

            return (
              <motion.div
                key={dateKey}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "relative min-h-[80px] sm:min-h-[100px] p-2 border-b border-r border-border transition-all text-left",
                  !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                  isCurrentMonth && "bg-card",
                  hasBookings && "cursor-pointer hover:bg-primary/5",
                  !hasBookings && !isDragging && "cursor-default",
                  index % 7 === 6 && "border-r-0",
                  isDragOver && "bg-primary/20 ring-2 ring-primary ring-inset",
                  isPastDate && isDragging && "opacity-50 cursor-not-allowed"
                )}
              >
                {/* Day Number */}
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium",
                  isCurrentDay && "bg-primary text-primary-foreground",
                  !isCurrentDay && isCurrentMonth && "text-foreground",
                  !isCurrentDay && !isCurrentMonth && "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </div>

                {/* Drop indicator */}
                {isDragOver && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-medium shadow-lg">
                      {bc.dropHere || 'Drop here'}
                    </div>
                  </motion.div>
                )}

                {/* Booking Indicators */}
                {hasBookings && !isDragOver && (
                  <div className="mt-1 space-y-1">
                    {dayBookings.slice(0, 2).map((booking, i) => {
                      const status = statusConfig[booking.status] || statusConfig.pending;
                      const isDraggable = canReschedule(booking) && !!onReschedule;
                      const isBeingDragged = draggedBooking?.id === booking.id;
                      
                      return (
                        <div 
                          key={booking.id}
                          draggable={isDraggable}
                          onDragStart={(e) => handleDragStart(e, booking)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-0.5",
                            status.bg,
                            isDraggable && "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/50",
                            isBeingDragged && "opacity-50"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isDraggable && (
                            <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
                          )}
                          <span className="hidden sm:inline">{booking.pickup_time} - </span>
                          <span className="truncate">{booking.vehicle_name}</span>
                        </div>
                      );
                    })}
                    {dayBookings.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        {(bc.moreCount || '+{count} more').replace('{count}', String(dayBookings.length - 2))}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Dots for Mobile */}
                {hasBookings && !isDragOver && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 sm:hidden">
                    {statuses.slice(0, 3).map((status, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusConfig[status]?.dot || "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">{bc.legend || 'Legend:'}</span>
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
            <span className="text-muted-foreground">{getStatusLabel(key)}</span>
          </div>
        ))}
      </div>

      {/* Day Details Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <AnimatePresence mode="popLayout">
              {selectedDateBookings.map((booking, index) => {
                const status = statusConfig[booking.status] || statusConfig.pending;
                const canTrack = booking.status === 'confirmed';
                const isDraggable = canReschedule(booking) && !!onReschedule;

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      handleDragStart(e as any, booking);
                      setShowDayDialog(false);
                    }}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "rounded-lg border border-border bg-card p-4 space-y-3",
                      isDraggable && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isDraggable && (
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-foreground">
                          {booking.booking_reference}
                        </span>
                        <Badge className={cn(status.bg, "border-0 text-xs")}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {booking.pickup_time}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-foreground truncate">{booking.pickup_location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="text-foreground truncate">{booking.dropoff_location}</span>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-2 border-t border-border">
                      <div className="flex items-center gap-1">
                        <Car className="h-3.5 w-3.5" />
                        {booking.vehicle_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {booking.passengers}
                      </div>
                      {booking.total_price > 0 && (
                        <div className="flex items-center gap-1 ml-auto font-semibold text-accent">
                          {formatPrice(booking.total_price)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {canTrack && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleTrackRide(booking)}
                          className="gap-1.5"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          {t.bookingCard.track || 'Track'}
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleViewDetails(booking)}
                        className="gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t.bookingCard.details || 'Details'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setShowDayDialog(false);
                          onRebook?.(booking);
                        }}
                        className="gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t.bookingCard.rebook || 'Rebook'}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-accent" />
              {bc.rescheduleBooking || 'Reschedule Booking'}
            </DialogTitle>
            <DialogDescription>
              {bc.rescheduleConfirmation || 'Are you sure you want to reschedule this booking?'}
            </DialogDescription>
          </DialogHeader>

          {pendingReschedule && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {pendingReschedule.booking.booking_reference}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    • {pendingReschedule.booking.vehicle_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t.common.from}:</span>
                  <span className="text-foreground">
                    {format(parseISO(pendingReschedule.booking.pickup_date), 'EEE, MMM d, yyyy')} at {pendingReschedule.booking.pickup_time}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t.common.to}:</span>
                  <span className="text-accent font-medium">
                    {format(parseISO(pendingReschedule.newDate), 'EEE, MMM d, yyyy')} at {pendingReschedule.newTime}
                  </span>
                </div>
              </div>

              {/* Time Picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{bcv.time || 'Time'}</Label>
                <Select
                  value={pendingReschedule.newTime}
                  onValueChange={(newTime) => setPendingReschedule({ ...pendingReschedule, newTime })}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center min-w-0 flex-1">
                      <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate"><SelectValue placeholder={bcv.selectTime || 'Select time'} /></span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelReschedule} disabled={isRescheduling}>
              {t.common.cancel}
            </Button>
            <Button onClick={confirmReschedule} disabled={isRescheduling}>
              {isRescheduling ? (bc.rescheduling || 'Rescheduling...') : (bc.confirmReschedule || 'Confirm Reschedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
