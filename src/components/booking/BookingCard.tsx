import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Car, ArrowRight, RotateCcw, RefreshCw, 
  Users, Eye, X, Copy, Navigation, DollarSign, MoreVertical, 
  Download, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShareRideDialog } from '@/components/booking/ShareRideDialog';
import { supabase } from '@/integrations/supabase/client';
import { TransferType } from '@/types/booking';
import { toast } from 'sonner';
import { 
  generateICalEvent, 
  downloadICalFile, 
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl 
 } from '@/utils/calendarExport';
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
  discount_amount?: number;
}

interface BookingCardProps {
  booking: Booking;
  index: number;
  onCancelled?: () => void;
  onRebook?: (booking: Booking) => void;
}

export function BookingCard({ booking, index, onCancelled, onRebook }: BookingCardProps) {
  const navigate = useNavigate();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const transferTypeLabels: Record<TransferType, { label: string; icon: React.ReactNode }> = {
    'one-way': { label: t.bookingCard.oneWay, icon: <ArrowRight className="h-3 w-3" /> },
    'return': { label: t.bookingCard.returnTrip, icon: <RotateCcw className="h-3 w-3" /> },
    'return-new-ride': { label: t.bookingCard.returnNew, icon: <RefreshCw className="h-3 w-3" /> },
  };

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: t.bookingCard.pending },
    confirmed: { bg: 'bg-primary/20', text: 'text-primary', label: t.bookingCard.confirmed },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: t.bookingCard.completed },
    cancelled: { bg: 'bg-destructive/20', text: 'text-destructive', label: t.bookingCard.cancelled },
  };

  const paymentMethodLabels: Record<string, string> = {
    card: t.bookingCard.creditCard,
    paypal: t.bookingCard.paypal,
    bank: t.bookingCard.bankTransfer,
  };

  const transferInfo = transferTypeLabels[booking.transfer_type];
  const status = statusConfig[booking.status] || statusConfig.pending;
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const canTrack = booking.status === 'confirmed';
  const isActive = booking.status !== 'cancelled' && booking.status !== 'completed';

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      toast.success(t.bookingCard.bookingCancelled);
      onCancelled?.();
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error(t.bookingCard.failedToCancel);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCopyReference = () => {
    navigator.clipboard.writeText(booking.booking_reference);
    toast.success(t.bookingCard.referenceCopied);
  };

  const handleTrackRide = () => {
    navigate(`/track?ref=${booking.booking_reference}`);
  };

  const handleRebook = () => {
    onRebook?.(booking);
  };

  const handleExportICal = () => {
    const icsContent = generateICalEvent(booking);
    downloadICalFile(icsContent, `rideflow-${booking.booking_reference}.ics`);
    toast.success(t.bookingCard.calendarDownloaded);
  };

  const handleAddToGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl(booking);
    window.open(url, '_blank');
  };

  const handleAddToOutlookCalendar = () => {
    const url = generateOutlookCalendarUrl(booking);
    window.open(url, '_blank');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-medium hover:border-accent/30"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleCopyReference}
              className="font-display text-lg font-bold text-foreground hover:text-accent transition-colors flex items-center gap-1.5"
              title={t.bookingCard.clickToCopy || 'Click to copy'}
            >
              {booking.booking_reference}
              <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
            </button>
            <Badge className={`${status.bg} ${status.text} border-0`}>
              {status.label}
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              {transferInfo.icon}
              {transferInfo.label}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowDetailsDialog(true)}>
                <Eye className="h-4 w-4 mr-2" />
                {t.bookingCard.viewDetails}
              </DropdownMenuItem>
              {canTrack && (
                <DropdownMenuItem onClick={handleTrackRide}>
                  <Navigation className="h-4 w-4 mr-2" />
                  {t.bookingCard.trackRide}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleCopyReference}>
                <Copy className="h-4 w-4 mr-2" />
                {t.bookingCard.copyReference}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  {t.bookingCard.addToCalendar}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={handleExportICal}>
                    <Download className="h-4 w-4 mr-2" />
                    {t.bookingCard.downloadIcs}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAddToGoogleCalendar}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.bookingCard.googleCalendar}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleAddToOutlookCalendar}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.bookingCard.outlookCalendar}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleRebook}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t.bookingCard.rebook}
              </DropdownMenuItem>
              {canCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowCancelDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t.bookingCard.cancelBooking}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Route Info */}
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <MapPin className="h-3 w-3 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.bookingCard.pickup}</p>
              <p className="text-sm font-medium text-foreground truncate">{booking.pickup_location}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
              <MapPin className="h-3 w-3 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.bookingCard.dropoff}</p>
              <p className="text-sm font-medium text-foreground truncate">{booking.dropoff_location}</p>
            </div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(booking.pickup_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{booking.pickup_time}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Car className="h-4 w-4" />
            <span>{booking.vehicle_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{booking.passengers}</span>
          </div>
          
          {/* Price Display */}
          {booking.total_price > 0 && (
            <div className="ml-auto flex items-center gap-1.5 font-semibold text-foreground">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-accent">{formatPrice(booking.total_price)}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isActive && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
             {canTrack && (
              <Button size="sm" variant="outline" onClick={handleTrackRide} className="gap-1.5">
                <Navigation className="h-3.5 w-3.5" />
                {t.bookingCard.track}
              </Button>
            )}
            <ShareRideDialog 
              bookingId={booking.id} 
              bookingReference={booking.booking_reference}
              totalPrice={booking.total_price}
            />
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setShowDetailsDialog(true)} 
              className="gap-1.5 ml-auto"
            >
              <Eye className="h-3.5 w-3.5" />
              {t.bookingCard.details}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bookingCard.cancelThisBooking}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.bookingCard.cancelConfirmation} <strong>{booking.booking_reference}</strong>? 
              {t.bookingCard.cannotBeUndone}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{t.bookingCard.keepBooking}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? t.bookingCard.cancelling : t.bookingCard.cancelBooking}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t.bookingCard.bookingDetails}
              <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                {status.label}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {t.bookingCard.reference}: {booking.booking_reference}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Route */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t.confirmation.route}</h4>
              <div className="space-y-2 pl-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.bookingCard.pickup}</p>
                    <p className="text-sm text-foreground">{booking.pickup_location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.bookingCard.dropoff}</p>
                    <p className="text-sm text-foreground">{booking.dropoff_location}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t.bookingCard.schedule}</h4>
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.common.date}</p>
                    <p className="text-sm text-foreground">{format(new Date(booking.pickup_date), 'PPP')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.common.time}</p>
                    <p className="text-sm text-foreground">{booking.pickup_time}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle & Passengers */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t.bookingCard.vehicleAndPassengers}</h4>
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.confirmation.vehicle}</p>
                    <p className="text-sm text-foreground">{booking.vehicle_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.confirmation.passengers}</p>
                    <p className="text-sm text-foreground">{booking.passengers}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t.bookingCard.payment}</h4>
              <div className="grid grid-cols-2 gap-3 pl-2">
                {booking.payment_method && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t.bookingCard.method}</p>
                    <p className="text-sm text-foreground">{paymentMethodLabels[booking.payment_method] || booking.payment_method}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">{t.common.total}</p>
                  <p className="text-lg font-bold text-accent">{formatPrice(booking.total_price || 0)}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.common.notes}</h4>
                <p className="text-sm text-muted-foreground pl-2">{booking.notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {canTrack && (
              <Button onClick={handleTrackRide} className="flex-1 gap-2">
                <Navigation className="h-4 w-4" />
                {t.bookingCard.trackRide}
              </Button>
            )}
            <Button variant="outline" onClick={handleRebook} className="flex-1 gap-2">
              <RefreshCw className="h-4 w-4" />
              {t.bookingCard.rebook}
            </Button>
            {canCancel && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDetailsDialog(false);
                  setShowCancelDialog(true);
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
