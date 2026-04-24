import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, MapPin, Car, Mail, Users, ArrowRight, RotateCcw, RefreshCw, Loader2, Search, AlertCircle, FileText, Copy, Building2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ShareRideDialog } from '@/components/booking/ShareRideDialog';
import { ModifyBookingDialog } from '@/components/booking/ModifyBookingDialog';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { CompletedJourneyIndicator } from '@/components/booking/CompletedJourneyIndicator';
import { PaymentStatusTracker } from '@/components/booking/PaymentStatusTracker';
import { downloadReceipt } from '@/utils/receiptGenerator';
import { useToast } from '@/hooks/use-toast';
import { useConfetti } from '@/hooks/useConfetti';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BookingConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { formatPrice, businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { fireCelebration } = useConfetti();
  
  const hasFireConfetti = useRef(false);

  const transferTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    'one-way': { label: t.booking.oneWay, icon: <ArrowRight className="h-4 w-4" /> },
    'return': { label: t.booking.return, icon: <RotateCcw className="h-4 w-4" /> },
    'return-new-ride': { label: t.booking.newReturn, icon: <RefreshCw className="h-4 w-4" /> },
  };

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      if (!id) throw new Error('No booking ID provided');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Real-time subscription for booking updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`booking-confirmation-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['booking', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Handle payment status change from tracker
  const handlePaymentStatusChange = useCallback((newStatus: string) => {
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
  }, [id, queryClient]);

  // Fire confetti when booking loads successfully
  useEffect(() => {
    if (booking && !hasFireConfetti.current) {
      hasFireConfetti.current = true;
      setTimeout(() => {
        fireCelebration();
      }, 300);
    }
  }, [booking, fireCelebration]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {t.confirmation.bookingNotFound}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t.confirmation.bookingNotFoundDesc}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate('/')}>
              {t.confirmation.bookNewRide}
            </Button>
            <Button variant="outline" onClick={() => navigate('/track')} className="gap-2">
              <Search className="h-4 w-4" />
              {t.confirmation.trackBooking}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const transferInfo = transferTypeLabels[booking.transfer_type] || transferTypeLabels['one-way'];

  const handleDownloadReceipt = () => {
    downloadReceipt({
      bookingReference: booking.booking_reference,
      pickupLocation: booking.pickup_location,
      dropoffLocation: booking.dropoff_location,
      pickupDate: booking.pickup_date,
      pickupTime: booking.pickup_time,
      passengers: booking.passengers,
      vehicleName: booking.vehicle_name,
      totalPrice: booking.total_price,
      serviceType: booking.service_type,
      transferType: booking.transfer_type,
      paymentMethod: booking.payment_method,
      notes: booking.notes,
      createdAt: booking.created_at,
      formatPrice,
      businessInfo,
    });
    toast({
      title: t.confirmation.downloadReceipt,
      description: t.confirmation.downloadReceipt,
    });
  };

  const handleEmailReceipt = async () => {
    const receiptEmail = (booking.contact_email || user?.email || '').trim().toLowerCase();

    if (!receiptEmail) {
      toast({
        title: t.confirmation.emailConfirmation,
        description: t.auth.signInRequired,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-booking-email', {
        body: {
          email: receiptEmail,
          type: 'created',
          bookingReference: booking.booking_reference,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          pickupDate: booking.pickup_date,
          pickupTime: booking.pickup_time,
          passengers: booking.passengers,
          vehicleName: booking.vehicle_name,
          totalPrice: booking.total_price,
          serviceType: booking.service_type,
          notes: booking.notes,
        },
      });

      if (error) throw error;

      toast({
        title: t.confirmation.emailConfirmation,
        description: t.confirmation.emailConfirmation,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: t.common.error,
        description: t.errors.generic,
        variant: "destructive",
      });
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-4 py-12">
        {/* Completed Journey Indicator */}
        <CompletedJourneyIndicator />
        
        <div className="animate-fade-in text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <CheckCircle className="h-12 w-12 text-accent" />
            </div>
          </div>

          <h2 className="font-display text-3xl font-bold text-foreground">
            {booking.payment_method === 'bank' ? t.confirmation.bookingSubmitted : t.confirmation.bookingConfirmed}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {booking.payment_method === 'bank'
              ? t.confirmation.pendingBankTransfer
              : t.confirmation.rideBooked}
          </p>

          {/* Booking Reference */}
          <motion.div 
            className="mt-6 inline-flex items-center gap-3 rounded-lg bg-secondary px-6 py-3 relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <motion.div
              className="absolute inset-0 rounded-lg bg-accent/20"
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.02, 1],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="relative text-left">
              <p className="text-sm text-muted-foreground">{t.confirmation.bookingReference}</p>
              <p className="font-display text-2xl font-bold tracking-wider text-foreground">
                {booking.booking_reference}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                navigator.clipboard.writeText(booking.booking_reference);
                toast({
                  title: t.common.success,
                  description: t.confirmation.bookingReference,
                });
              }}
            >
              <Copy className="h-5 w-5" />
            </Button>
          </motion.div>

          {/* Trip Details Card */}
          <motion.div 
            className="mt-8 rounded-xl border border-border bg-card p-6 text-left"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          >
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              {t.confirmation.tripDetails}
            </h3>

            {/* Service & Transfer Type */}
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {booking.service_type === 'hourly' ? t.booking.hourly : t.booking.flatRate}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {transferInfo.icon}
                {transferInfo.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                booking.status === 'confirmed' ? 'bg-green-500/10 text-green-500' :
                booking.status === 'completed' ? 'bg-blue-500/10 text-blue-500' :
                booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                'bg-yellow-500/10 text-yellow-500'
              }`}>
                {(t.status as any)[booking.status] || booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <MapPin className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t.confirmation.route}</p>
                  <p className="font-medium text-foreground">
                    {booking.pickup_location}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.confirmation.to}</p>
                  <p className="font-medium text-foreground">
                    {booking.dropoff_location}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Calendar className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.confirmation.date}</p>
                    <p className="font-medium text-foreground">
                      {format(parseISO(booking.pickup_date), 'PPP')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Clock className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.confirmation.time}</p>
                    <p className="font-medium text-foreground">{booking.pickup_time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Users className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.confirmation.passengers}</p>
                    <p className="font-medium text-foreground">{booking.passengers}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-border pt-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Car className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t.confirmation.vehicle}</p>
                  <p className="font-medium text-foreground">
                    {booking.vehicle_name}
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              {booking.total_price != null && booking.total_price > 0 && (() => {
                const tollCharges = Number(booking.toll_charges) || 0;
                const airportCharges = Number(booking.airport_charges) || 0;
                const bookingFee = Number(booking.booking_fee) || 0;
                const discount = Number(booking.discount_amount) || 0;
                const cancellationFee = Number(booking.cancellation_fee) || 0;
                const total = Number(booking.total_price);
                const baseFare = total - tollCharges - airportCharges - bookingFee - cancellationFee + discount;
                const hasExtras = tollCharges > 0 || airportCharges > 0 || bookingFee > 0 || discount > 0 || cancellationFee > 0;

                return (
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-sm font-medium text-foreground mb-2">{t.confirmation.costBreakdown}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.confirmation.baseFare}</span>
                      <span className="text-foreground">{formatPrice(baseFare)}</span>
                    </div>
                    {bookingFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.confirmation.bookingFee}</span>
                        <span className="text-foreground">{formatPrice(bookingFee)}</span>
                      </div>
                    )}
                    {tollCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.confirmation.tollCharges}</span>
                        <span className="text-foreground">{formatPrice(tollCharges)}</span>
                      </div>
                    )}
                    {airportCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.confirmation.airportCharges}</span>
                        <span className="text-foreground">{formatPrice(airportCharges)}</span>
                      </div>
                    )}
                    {cancellationFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.confirmation.cancellationFee}</span>
                        <span className="text-foreground">{formatPrice(cancellationFee)}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.confirmation.discount}</span>
                        <span className="text-accent">-{formatPrice(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <span className="font-medium text-foreground">{t.confirmation.total}</span>
                      <span className="font-display text-lg font-bold text-accent">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {booking.notes && (
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">{t.confirmation.notes}</p>
                  <p className="mt-1 text-foreground">{booking.notes}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Payment Status Tracker */}
          <PaymentStatusTracker
            bookingId={booking.id}
            bookingReference={booking.booking_reference}
            paymentMethod={booking.payment_method as 'card' | 'paypal' | 'bank'}
            bookingStatus={booking.status}
            totalPrice={booking.total_price}
            onStatusChange={handlePaymentStatusChange}
          />

          {/* Bank Transfer Receipt */}
          {booking.payment_method === 'bank' && booking.bank_transfer_details && (() => {
            const details = booking.bank_transfer_details as Record<string, string>;
            const hasDetails = details.senderName || details.bankName || details.transferReference;
            if (!hasDetails) return null;

            const handlePrintReceipt = () => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              printWindow.document.write(`
                <html><head><title>${t.paymentTracker.bankTransfer} - ${booking.booking_reference}</title>
                <style>
                  body { font-family: Arial, sans-serif; max-width: 500px; margin: 40px auto; color: #1e293b; }
                  h2 { margin-bottom: 4px; } .ref { color: #64748b; margin-bottom: 24px; }
                  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; } 
                  td:first-child { font-weight: 600; color: #475569; width: 40%; }
                  .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; }
                </style></head><body>
                <h2>${t.paymentTracker.bankTransfer}</h2>
                <p class="ref">${booking.booking_reference}</p>
                <table>
                  ${details.senderName ? `<tr><td>${t.paymentTracker.senderName}</td><td>${details.senderName}</td></tr>` : ''}
                  ${details.bankName ? `<tr><td>${t.paymentTracker.bankName}</td><td>${details.bankName}</td></tr>` : ''}
                  ${details.transferReference ? `<tr><td>${t.paymentTracker.transferRef}</td><td>${details.transferReference}</td></tr>` : ''}
                  ${details.transferDate ? `<tr><td>${t.paymentTracker.transferDate}</td><td>${details.transferDate}</td></tr>` : ''}
                  ${details.amountTransferred ? `<tr><td>${t.paymentTracker.amount}</td><td>${details.amountTransferred}</td></tr>` : ''}
                  <tr><td>${t.confirmation.total}</td><td>${formatPrice(booking.total_price || 0)}</td></tr>
                </table>
                ${details.notes ? `<p><strong>${t.paymentTracker.notes}:</strong> ${details.notes}</p>` : ''}
                <p class="footer">${format(new Date(), 'PPP')}</p>
                </body></html>
              `);
              printWindow.document.close();
              printWindow.print();
            };

            return (
              <motion.div
                className="mt-6 rounded-xl border border-border bg-card p-6 text-left"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {t.paymentTracker.bankTransfer}
                    </h3>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrintReceipt}>
                    <Printer className="h-3.5 w-3.5" />
                    {t.features.printSavePdf}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.senderName && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentTracker.senderName}</p>
                      <p className="text-sm font-medium text-foreground">{details.senderName}</p>
                    </div>
                  )}
                  {details.bankName && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentTracker.bankName}</p>
                      <p className="text-sm font-medium text-foreground">{details.bankName}</p>
                    </div>
                  )}
                  {details.transferReference && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentTracker.transferRef}</p>
                      <p className="text-sm font-medium text-foreground font-mono">{details.transferReference}</p>
                    </div>
                  )}
                  {details.transferDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentTracker.transferDate}</p>
                      <p className="text-sm font-medium text-foreground">{details.transferDate}</p>
                    </div>
                  )}
                  {details.amountTransferred && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t.paymentTracker.amount}</p>
                      <p className="text-sm font-medium text-foreground">{details.amountTransferred}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">{t.common.status}</p>
                    <p className={`text-sm font-medium ${
                      booking.status === 'confirmed' || booking.status === 'completed'
                        ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {booking.status === 'confirmed' || booking.status === 'completed' ? `✅ ${t.paymentTracker.verified}` : `⏳ ${t.paymentTracker.awaitingVerification}`}
                    </p>
                  </div>
                </div>

                {details.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">{t.paymentTracker.notes}</p>
                    <p className="text-sm text-foreground">{details.notes}</p>
                  </div>
                )}
              </motion.div>
            );
          })()}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:flex-wrap">
            <ModifyBookingDialog
              bookingId={booking.id}
              bookingReference={booking.booking_reference}
              currentDate={booking.pickup_date}
              currentTime={booking.pickup_time}
              status={booking.status}
              onModified={() => queryClient.invalidateQueries({ queryKey: ['booking', id] })}
            />
            <Button variant="outline" className="gap-2" onClick={handleDownloadReceipt}>
              <FileText className="h-4 w-4" />
              {t.confirmation.downloadReceipt}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleEmailReceipt}>
              <Mail className="h-4 w-4" />
              {t.confirmation.emailConfirmation}
            </Button>
            {user && (
              <ShareRideDialog bookingId={booking.id} bookingReference={booking.booking_reference} />
            )}
          </div>

          {user ? (
            <div className="mt-4">
              <Button variant="ghost" onClick={() => navigate('/my-bookings')}>
                {t.confirmation.viewAllBookings}
              </Button>
            </div>
          ) : (
            <motion.div 
              className="mt-6 rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <p className="mb-3 text-sm text-muted-foreground">
                {t.confirmation.trackThisBooking}
              </p>
              <Button 
                variant="default" 
                size="lg" 
                onClick={() => navigate('/track')} 
                className="gap-2 w-full sm:w-auto"
              >
                <Search className="h-5 w-5" />
                {t.confirmation.trackBooking}
              </Button>
            </motion.div>
          )}

          <div className="mt-6">
            <Button variant="booking" className="h-14 text-base" onClick={() => navigate('/')}>
              {t.confirmation.bookAnotherRide}
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
