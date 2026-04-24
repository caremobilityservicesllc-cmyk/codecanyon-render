import { useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, MapPin, Car, Mail, Users, ArrowRight, RotateCcw, RefreshCw, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingDetails, TransferType } from '@/types/booking';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { ShareRideDialog } from './ShareRideDialog';
import { downloadReceipt } from '@/utils/receiptGenerator';

interface BookingConfirmationProps {
  bookingDetails: BookingDetails;
  onNewBooking: () => void;
  bookingRef: string;
  bookingId?: string;
}

export function BookingConfirmation({ bookingDetails, onNewBooking, bookingRef, bookingId }: BookingConfirmationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice, businessInfo } = useSystemSettings();
  const { t } = useLanguage();

  const transferTypeLabels: Record<TransferType, { label: string; icon: React.ReactNode }> = {
    'one-way': { label: t.bookingConfirmationToasts.oneWay, icon: <ArrowRight className="h-4 w-4" /> },
    'return': { label: t.bookingConfirmationToasts.return, icon: <RotateCcw className="h-4 w-4" /> },
    'return-new-ride': { label: t.bookingConfirmationToasts.returnNewRide, icon: <RefreshCw className="h-4 w-4" /> },
  };
  const transferInfo = transferTypeLabels[bookingDetails.transferType];

  const handleDownloadReceipt = () => {
    downloadReceipt({
      bookingReference: bookingRef,
      pickupLocation: bookingDetails.pickupLocation,
      dropoffLocation: bookingDetails.dropoffLocation,
      pickupDate: bookingDetails.pickupDate || new Date(),
      pickupTime: bookingDetails.pickupTime,
      passengers: bookingDetails.passengers,
      vehicleName: bookingDetails.selectedVehicle?.name || 'Standard Vehicle',
      totalPrice: bookingDetails.selectedVehicle?.base_price || null,
      serviceType: bookingDetails.serviceType,
      transferType: bookingDetails.transferType,
      paymentMethod: bookingDetails.paymentMethod || 'card',
      notes: bookingDetails.notes,
      formatPrice,
      businessInfo,
    });
    toast({
      title: t.bookingConfirmationToasts.receiptReady,
      description: t.bookingConfirmationToasts.receiptReadyDesc,
    });
  };

  const handleEmailReceipt = async () => {
    if (!user?.email) {
      toast({
        title: t.bookingConfirmationToasts.emailRequired,
        description: t.bookingConfirmationToasts.emailRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-booking-email', {
        body: {
          email: user.email,
          type: 'created',
          bookingReference: bookingRef,
          pickupLocation: bookingDetails.pickupLocation,
          dropoffLocation: bookingDetails.dropoffLocation,
          pickupDate: bookingDetails.pickupDate ? format(bookingDetails.pickupDate, 'yyyy-MM-dd') : '',
          pickupTime: bookingDetails.pickupTime,
          passengers: bookingDetails.passengers,
          vehicleName: bookingDetails.selectedVehicle?.name || 'Standard Vehicle',
          totalPrice: bookingDetails.selectedVehicle?.base_price,
          serviceType: bookingDetails.serviceType,
          notes: bookingDetails.notes,
        },
      });

      if (error) throw error;

      toast({
        title: t.bookingConfirmationToasts.emailSent,
        description: t.bookingConfirmationToasts.emailSentDesc,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: t.bookingConfirmationToasts.emailFailed,
        description: t.bookingConfirmationToasts.emailFailedDesc,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-2xl text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle className="h-12 w-12 text-accent" />
          </div>
        </div>

        <h2 className="font-display text-3xl font-bold text-foreground">
          {bookingDetails.paymentMethod === 'bank' ? t.bookingConfirmation.bookingSubmitted : t.bookingConfirmation.bookingConfirmed}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {bookingDetails.paymentMethod === 'bank'
            ? t.bookingConfirmation.pendingBankTransfer
            : t.bookingConfirmation.rideBooked}
        </p>

        {/* Booking Reference */}
        <div className="mt-6 inline-block rounded-lg bg-secondary px-6 py-3">
          <p className="text-sm text-muted-foreground">{t.bookingConfirmation.bookingReference}</p>
          <p className="font-display text-2xl font-bold tracking-wider text-foreground">
            {bookingRef}
          </p>
        </div>

        {/* Trip Details Card */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-left">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            {t.bookingConfirmation.tripDetails}
          </h3>

          {/* Service & Transfer Type */}
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {bookingDetails.serviceType === 'hourly' ? t.orderSummary.hourly : t.orderSummary.flatRate}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {transferInfo.icon}
              {transferInfo.label}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t.bookingConfirmation.route}</p>
                <p className="font-medium text-foreground">
                  {bookingDetails.pickupLocation}
                </p>
                <p className="text-sm text-muted-foreground">{t.bookingConfirmation.to}</p>
                <p className="font-medium text-foreground">
                  {bookingDetails.dropoffLocation}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Calendar className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.bookingConfirmation.date}</p>
                  <p className="font-medium text-foreground">
                    {bookingDetails.pickupDate && format(bookingDetails.pickupDate, 'PPP')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.bookingConfirmation.time}</p>
                  <p className="font-medium text-foreground">{bookingDetails.pickupTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.bookingConfirmation.passengers}</p>
                  <p className="font-medium text-foreground">{bookingDetails.passengers}</p>
                </div>
              </div>
            </div>

            {bookingDetails.selectedVehicle && (
              <div className="flex items-center gap-4 border-t border-border pt-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Car className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t.bookingConfirmation.vehicle}</p>
                  <p className="font-medium text-foreground">
                    {bookingDetails.selectedVehicle.name}
                  </p>
                </div>
              </div>
            )}

            {bookingDetails.notes && (
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">{t.orderSummary.notes}</p>
                <p className="mt-1 text-foreground">{bookingDetails.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" className="gap-2" onClick={handleDownloadReceipt}>
            <FileText className="h-4 w-4" />
            {t.bookingConfirmation.downloadReceipt}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleEmailReceipt}>
            <Mail className="h-4 w-4" />
            {t.bookingConfirmation.emailConfirmation}
          </Button>
          {user && bookingId && (
            <ShareRideDialog bookingId={bookingId} bookingReference={bookingRef} />
          )}
        </div>

        {user ? (
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/my-bookings')}>
              {t.bookingConfirmation.viewAllBookings}
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/track')} className="gap-2">
              <Search className="h-4 w-4" />
              {t.bookingConfirmation.trackThisBooking}
            </Button>
          </div>
        )}

        <div className="mt-6">
          <Button variant="booking" onClick={onNewBooking}>
            {t.bookingConfirmation.bookAnotherRide}
          </Button>
        </div>
      </div>
    </div>
  );
}
