import { useMemo, useState } from 'react';
import { ArrowLeft, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { Step1Location } from '@/components/booking/Step1Location';
import { Step2Vehicle } from '@/components/booking/Step2Vehicle';
import { Step3Payment } from '@/components/booking/Step3Payment';
import { AIChatbot } from '@/components/booking/AIChatbot';
import { Footer } from '@/components/Footer';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import { Button } from '@/components/ui/button';
import { BookingDetails, initialBankTransferDetails, initialBillingDetails } from '@/types/booking';
import { vehicles } from '@/data/vehicles';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { supabase } from '@/integrations/supabase/client';
import { sendBookingEmail } from '@/hooks/useBookingEmail';
import { format } from 'date-fns';

const initialBookingDetails: BookingDetails = {
  serviceType: 'flat-rate',
  transferType: 'one-way',
  pickupLocation: '',
  dropoffLocation: '',
  stops: [],
  pickupDate: null,
  pickupTime: '',
  passengers: 1,
  luggageCount: 0,
  childSeats: 0,
  notes: '',
  flightNumber: '',
  bookingHours: 2,
  routeDistanceKm: null,
  routeDurationMinutes: null,
  selectedVehicle: vehicles[0] || null,
  paymentMethod: null,
  guestEmail: '',
  promoCode: '',
  promoCodeId: null,
  billingDetails: initialBillingDetails,
  bankTransferDetails: initialBankTransferDetails,
  agreedToTerms: false,
};

const BookNow = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>(initialBookingDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { bookingPolicies, aiAssistantEnabled, businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const { priceBreakdown } = useDynamicPricing(bookingDetails, bookingPolicies.depositPercentage, bookingDetails.routeDistanceKm);

  const quickFacts = useMemo(() => [
    'Dedicated ride booking page',
    'Same guided 3-step flow',
    'Pickup, vehicle and payment in one place',
  ], []);

  const handleUpdate = (updates: Partial<BookingDetails>) => {
    setBookingDetails((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    if (!bookingDetails.pickupDate || !bookingDetails.selectedVehicle || !bookingDetails.paymentMethod) {
      return;
    }

    setIsSubmitting(true);

    const reference = `RF-${Date.now().toString(36).toUpperCase()}`;

    try {
      const subtotalBeforeDiscount = priceBreakdown?.total || 0;

      let discountAmount = 0;
      if (bookingDetails.promoCodeId && priceBreakdown) {
        try {
          const { data: promoData } = await supabase
            .from('promo_codes')
            .select('discount_percentage')
            .eq('id', bookingDetails.promoCodeId)
            .single();
          if (promoData) {
            discountAmount = Math.round(subtotalBeforeDiscount * (promoData.discount_percentage / 100) * 100) / 100;
          }
        } catch (error) {
          console.error('Error fetching promo discount:', error);
        }
      }

      const totalPrice = Math.max(0, subtotalBeforeDiscount - discountAmount);

      const { data, error } = await supabase.from('bookings').insert({
        user_id: user?.id || null,
        booking_reference: reference,
        service_type: bookingDetails.serviceType,
        transfer_type: bookingDetails.transferType,
        pickup_location: bookingDetails.pickupLocation,
        dropoff_location: bookingDetails.dropoffLocation,
        pickup_date: format(bookingDetails.pickupDate, 'yyyy-MM-dd'),
        pickup_time: bookingDetails.pickupTime,
        passengers: bookingDetails.passengers,
        notes: bookingDetails.notes || null,
        bank_transfer_details: bookingDetails.paymentMethod === 'bank' ? bookingDetails.bankTransferDetails as any : null,
        vehicle_id: bookingDetails.selectedVehicle.id,
        vehicle_name: bookingDetails.selectedVehicle.name,
        contact_email: (user?.email || bookingDetails.guestEmail || '').trim().toLowerCase(),
        payment_method: bookingDetails.paymentMethod,
        status: 'pending',
        total_price: totalPrice,
        promo_code_id: bookingDetails.promoCodeId || null,
        discount_amount: discountAmount,
      } as any).select('id').single();

      if (error) {
        console.error('Booking error:', error, 'user_id:', user?.id);
        toast({
          title: t.bookingFlow.bookingFailed,
          description: t.bookingFlow.bookingFailedDesc,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (bookingDetails.promoCodeId && data?.id) {
        await supabase.rpc('use_promo_code', {
          p_promo_code_id: bookingDetails.promoCodeId,
          p_user_id: user?.id || null,
          p_booking_id: data.id,
        });
      }

      const confirmationUrl = `${window.location.origin}/booking-confirmation/${data?.id}`;
      try {
        const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('process-payment', {
          body: {
            paymentMethod: bookingDetails.paymentMethod,
            amount: totalPrice,
            currency: 'USD',
            bookingReference: reference,
            customerEmail: user?.email || bookingDetails.guestEmail,
            returnUrl: confirmationUrl,
          },
        });

        if (paymentError) {
          console.error('Payment processing error:', paymentError);
          toast({
            title: t.bookingFlow.paymentIssue,
            description: t.bookingFlow.paymentIssueDesc,
            variant: 'destructive',
          });
        } else if (paymentResult) {
          if (paymentResult.redirectUrl) {
            const gatewayName = paymentResult.gateway === 'stripe' ? 'Stripe' : 'PayPal';
            toast({
              title: t.bookingFlow.redirectingTo.replace('{gateway}', gatewayName),
              description: t.bookingFlow.redirectingToDesc.replace('{gateway}', gatewayName),
            });
            window.location.href = paymentResult.redirectUrl;
            return;
          }

          if (paymentResult.bankDetails) {
            toast({
              title: t.bookingFlow.bankTransferInstructions,
              description: `Please transfer the amount to ${paymentResult.bankDetails.bankName || 'our bank account'} using reference: ${reference}`,
              duration: 10000,
            });
          }

          if (paymentResult.status === 'succeeded' || paymentResult.isDemo) {
            await supabase
              .from('bookings')
              .update({ status: 'confirmed' })
              .eq('id', data.id);
          }
        }
      } catch (paymentError) {
        console.error('Payment processing failed:', paymentError);
      }

      if (data?.id) {
        try {
          const { data: dispatchResult, error: dispatchError } = await supabase.functions.invoke('auto-dispatch', {
            body: { bookingId: data.id, action: 'confirm_and_dispatch', paymentMethod: bookingDetails.paymentMethod },
          });

          if (dispatchError) {
            console.error('Auto-dispatch error:', dispatchError);
          } else if (dispatchResult?.driver) {
            toast({
              title: t.bookingFlow.driverAssigned,
              description: `${dispatchResult.driver.name} will be your driver. ETA: ${dispatchResult.estimatedArrival}`,
            });
          }
        } catch (dispatchError) {
          console.error('Auto-dispatch failed:', dispatchError);
        }
      }

      toast({
        title: bookingDetails.paymentMethod === 'bank' ? t.bookingFlow.bookingSubmitted : t.bookingFlow.bookingConfirmed,
        description: bookingDetails.paymentMethod === 'bank'
          ? t.bookingFlow.paymentPendingVerification.replace('{ref}', reference)
          : t.bookingFlow.bookingRefIs.replace('{ref}', reference),
      });

      const emailToSend = user?.email || bookingDetails.guestEmail;
      if (emailToSend) {
        sendBookingEmail({
          type: 'created',
          email: emailToSend,
          bookingReference: reference,
          pickupLocation: bookingDetails.pickupLocation,
          dropoffLocation: bookingDetails.dropoffLocation,
          pickupDate: format(bookingDetails.pickupDate, 'MMMM d, yyyy'),
          pickupTime: bookingDetails.pickupTime,
          vehicleName: bookingDetails.selectedVehicle.name,
          passengers: bookingDetails.passengers,
        });
      }

      navigate(`/booking-confirmation/${data?.id}`);
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: t.bookingFlow.bookingFailed,
        description: t.bookingFlow.bookingFailedDesc,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-emerald-500/20 bg-[linear-gradient(90deg,rgba(16,185,129,0.9),rgba(16,185,129,0.78))] text-[hsl(var(--primary-foreground))]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-1.5 text-[10px] font-medium sm:px-6 sm:text-xs lg:px-8">
          <div className="truncate">{businessInfo.tagline || 'Medical and wheelchair transportation with guided online booking'}</div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <PhoneCall className="h-3.5 w-3.5" />
            <span>{businessInfo.phone}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[38px] border border-emerald-500/15 bg-[#232323] shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400">Book your ride now</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Dedicated booking page</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">Use the same complete booking flow in a page focused only on scheduling the ride.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickFacts.map((fact) => (
                <span key={fact} className="rounded-full border border-emerald-500/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                  {fact}
                </span>
              ))}
            </div>
            <Button variant="ghost" className="rounded-full border border-emerald-500/45 bg-transparent px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500 hover:text-white" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </div>
        </div>

        <section className="pb-16">
          <div className="overflow-hidden rounded-[38px] border border-emerald-500/18 bg-card shadow-elevated">
            <div className="border-b border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] px-6 py-7 text-foreground sm:px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">Full booking flow</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-foreground">Schedule the ride step by step</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter trip details, choose the right vehicle and complete payment in one guided flow.</p>
            </div>

            <div className="border-b border-emerald-500/15 bg-muted/20 px-5 py-4 sm:px-6">
              <div className="rounded-[26px] border border-emerald-500/12 bg-background/70 px-4 py-4 sm:px-6">
                <StepIndicator currentStep={currentStep} totalSteps={3} />
              </div>
            </div>

            <div className="bg-card px-4 py-4 sm:px-5 sm:py-5">
              <div className="rounded-[30px] border border-emerald-500/15 bg-background p-3 text-foreground shadow-soft sm:p-5">
                {currentStep === 1 && (
                  <Step1Location
                    bookingDetails={bookingDetails}
                    onUpdate={handleUpdate}
                    onNext={handleNext}
                  />
                )}

                {currentStep === 2 && (
                  <Step2Vehicle
                    bookingDetails={bookingDetails}
                    onUpdate={handleUpdate}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}

                {currentStep === 3 && (
                  <Step3Payment
                    bookingDetails={bookingDetails}
                    onUpdate={handleUpdate}
                    onComplete={handleComplete}
                    onBack={handleBack}
                    isSubmitting={isSubmitting}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <InstallPromptBanner />
      {aiAssistantEnabled && <AIChatbot />}
    </div>
  );
};

export default BookNow;