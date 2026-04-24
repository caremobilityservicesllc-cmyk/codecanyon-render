import { useMemo, useState, useEffect } from 'react';
import { ArrowRight, CalendarRange, Car, Clock3, HeartHandshake, Mail, MapPin, PhoneCall, ShieldCheck, Star, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { Step1Location } from '@/components/booking/Step1Location';
import { Step2Vehicle } from '@/components/booking/Step2Vehicle';
import { Step3Payment } from '@/components/booking/Step3Payment';
import { LoadingScreen } from '@/components/LoadingScreen';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import { AIChatbot } from '@/components/booking/AIChatbot';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';

import { BookingDetails, initialBillingDetails, initialBankTransferDetails } from '@/types/booking';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { vehicles } from '@/data/vehicles';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sendBookingEmail } from '@/hooks/useBookingEmail';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const Index = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>(initialBookingDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Show splash screen briefly on initial load
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const { user } = useAuth();
  const { toast } = useToast();
  const { bookingPolicies, aiAssistantEnabled, businessInfo, businessHours, formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const { priceBreakdown } = useDynamicPricing(bookingDetails, bookingPolicies.depositPercentage, bookingDetails.routeDistanceKm);
  const logoSrc = '/iconnew.png';

  const navItems = useMemo(() => [
    { label: 'Home', href: '#home' },
    { label: 'About', href: '#about' },
    { label: 'Book Your Ride', href: '/book-now' },
    { label: 'Services', href: '#services' },
    { label: 'Contact', href: '#contact' },
  ], []);

  const serviceCards = useMemo(() => [
    {
      icon: HeartHandshake,
      title: 'Medical appointment transfers',
      description: 'Recurring visits, pickup coordination and comfortable assisted travel from one booking flow.',
    },
    {
      icon: CalendarRange,
      title: 'Wheelchair and accessible service',
      description: 'Front-page scheduling for wheelchair-ready transportation with guided booking steps.',
    },
    {
      icon: Car,
      title: 'Private and family rides',
      description: 'Vehicle selection, fare estimate and payment remain inside the website instead of jumping elsewhere.',
    },
  ], []);

  const stats = useMemo(() => [
    { label: 'Support hours', value: `${businessHours.start} - ${businessHours.end}` },
    { label: 'Starting fare', value: formatPrice(Math.max(bookingDetails.selectedVehicle?.base_price || 35, 35)) },
    { label: 'Booking flow', value: '3 guided steps' },
  ], [businessHours.end, businessHours.start, bookingDetails.selectedVehicle?.base_price, formatPrice]);

  const featurePills = useMemo(() => [
    'Live booking on homepage',
    'Accessible ride positioning',
    'Real booking wizard embedded',
  ], []);

  const goToBookingPage = () => navigate('/book-now');

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
      
      // Calculate discount from promo code validation result
      let discountAmount = 0;
      if (bookingDetails.promoCodeId && priceBreakdown) {
        // The promo code percentage was validated earlier; retrieve it from the DB
        try {
          const { data: promoData } = await supabase
            .from('promo_codes')
            .select('discount_percentage')
            .eq('id', bookingDetails.promoCodeId)
            .single();
          if (promoData) {
            discountAmount = Math.round(subtotalBeforeDiscount * (promoData.discount_percentage / 100) * 100) / 100;
          }
        } catch (e) {
          console.error('Error fetching promo discount:', e);
        }
      }
      const totalPrice = Math.max(0, subtotalBeforeDiscount - discountAmount);
      
      // 1. Create the booking in the database
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
        console.error('Booking error:', error, 'user_id:', user?.id, 'auth uid check');
        toast({
          title: t.bookingFlow.bookingFailed,
          description: t.bookingFlow.bookingFailedDesc,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // 2. Apply promo code if used
      if (bookingDetails.promoCodeId && data?.id) {
        await supabase.rpc('use_promo_code', {
          p_promo_code_id: bookingDetails.promoCodeId,
          p_user_id: user?.id || null,
          p_booking_id: data.id,
        });
      }

      // 3. Process payment via edge function
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
          // Payment failed but booking was created – still navigate to confirmation
          toast({
            title: t.bookingFlow.paymentIssue,
            description: t.bookingFlow.paymentIssueDesc,
            variant: 'destructive',
          });
        } else if (paymentResult) {
          console.log('Payment result:', paymentResult);

          // Handle redirect-based payments (Stripe Checkout, PayPal)
          if (paymentResult.redirectUrl) {
            const gatewayName = paymentResult.gateway === 'stripe' ? 'Stripe' : 'PayPal';
            toast({
              title: t.bookingFlow.redirectingTo.replace('{gateway}', gatewayName),
              description: t.bookingFlow.redirectingToDesc.replace('{gateway}', gatewayName),
            });
            window.location.href = paymentResult.redirectUrl;
            return; // Don't navigate to confirmation yet
          }

          // Bank transfer – show success with bank details info
          if (paymentResult.bankDetails) {
            toast({
              title: t.bookingFlow.bankTransferInstructions,
              description: `Please transfer the amount to ${paymentResult.bankDetails.bankName || 'our bank account'} using reference: ${reference}`,
              duration: 10000,
            });
          }

          // Stripe/PayPal demo mode or direct success
          if (paymentResult.status === 'succeeded' || paymentResult.isDemo) {
            await supabase
              .from('bookings')
              .update({ status: 'confirmed' })
              .eq('id', data.id);
          }
        }
      } catch (paymentErr) {
        console.error('Payment processing failed:', paymentErr);
        // Don't block the flow – booking is saved
      }

      // 4. Auto-dispatch driver
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
        } catch (dispatchErr) {
          console.error('Auto-dispatch failed:', dispatchErr);
        }
      }

      toast({
        title: bookingDetails.paymentMethod === 'bank' ? t.bookingFlow.bookingSubmitted : t.bookingFlow.bookingConfirmed,
        description: bookingDetails.paymentMethod === 'bank' 
          ? t.bookingFlow.paymentPendingVerification.replace('{ref}', reference)
          : t.bookingFlow.bookingRefIs.replace('{ref}', reference),
      });

      // 5. Send confirmation email
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
    } catch (err) {
      console.error('Booking error:', err);
      toast({
        title: t.bookingFlow.bookingFailed,
        description: t.bookingFlow.bookingFailedDesc,
        variant: 'destructive',
      });
    }
    
    setIsSubmitting(false);
  };

  if (showSplash) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-emerald-500/20 bg-[linear-gradient(90deg,rgba(16,185,129,0.9),rgba(16,185,129,0.78))] text-[hsl(var(--primary-foreground))]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="truncate text-[10px] font-medium sm:text-xs">{businessInfo.tagline || 'Medical and wheelchair transportation with guided online booking'}</div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <PhoneCall className="h-3.5 w-3.5" />
            <span>{businessInfo.phone}</span>
          </div>
        </div>
      </div>

      <main>
        <section id="home" className="border-b border-black/10 bg-background">
          <div className="mx-auto max-w-[1440px] px-0 sm:px-0">
            <div className="mx-4 -mb-1 overflow-hidden rounded-t-[38px] border border-b-0 border-emerald-500/15 bg-[#232323] shadow-elevated sm:mx-6 lg:mx-8">
              <header className="grid lg:grid-cols-[220px_1fr_auto]">
                <div className="flex items-center justify-center border-b border-emerald-500/18 px-6 py-3 lg:border-b-0">
                  <img src={logoSrc} alt={`${businessInfo.companyName || 'RideFlow'} logo`} className="h-16 w-auto object-contain sm:h-20" />
                </div>
                <nav className="hidden items-center justify-center gap-2 px-8 lg:flex">
                  {navItems.map((item, index) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(event) => {
                        if (item.href.startsWith('/')) {
                          event.preventDefault();
                          navigate(item.href);
                        }
                      }}
                      className={cn(
                        'relative flex min-w-[88px] items-center justify-center px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400 transition-colors duration-200 hover:text-emerald-400',
                        'after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-emerald-500 after:transition-all after:duration-200 hover:after:w-7',
                        item.href === '#home' && 'text-emerald-400 after:w-8'
                      )}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6">
                  {user ? (
                    <>
                      <Button variant="ghost" className="rounded-full border border-emerald-500/45 bg-transparent px-3.5 py-2 text-sm text-emerald-300 shadow-none hover:bg-emerald-500 hover:text-white" onClick={() => navigate('/admin')}>
                        Admin Login
                      </Button>
                      <Button variant="ghost" className="gap-2 rounded-full border border-emerald-500/45 bg-transparent px-3.5 py-2 text-sm text-emerald-300 shadow-none hover:bg-emerald-500 hover:text-white" onClick={() => navigate('/account')}>
                        <UserRound className="h-3.5 w-3.5" />
                        Account
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" className="rounded-full border border-emerald-500/45 bg-transparent px-3.5 py-2 text-sm text-emerald-300 shadow-none hover:bg-emerald-500 hover:text-white" onClick={() => navigate('/admin')}>
                        Admin Login
                      </Button>
                      <Button variant="ghost" className="rounded-full border border-emerald-500/45 bg-transparent px-3.5 py-2 text-sm text-emerald-300 shadow-none hover:bg-emerald-500 hover:text-white" onClick={() => navigate('/auth')}>
                        Sign In
                      </Button>
                    </div>
                  )}
                </div>
              </header>
            </div>

            <div className="mx-4 overflow-hidden rounded-b-[38px] border border-emerald-500/12 bg-[linear-gradient(180deg,#f8fbfa_0%,#eef4f1_100%)] shadow-elevated sm:mx-6 lg:mx-8">
              <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
                <div className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-elevated">
                  <div className="relative min-h-[520px] bg-[linear-gradient(135deg,#061411_0%,#0d221d_42%,#e8f3ee_100%)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(47,214,108,0.18),transparent_20%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.26),transparent_22%)]" />
                    <div className="absolute right-[-5%] top-[14%] hidden h-[360px] w-[360px] rounded-full border border-white/10 bg-white/6 blur-3xl xl:block" />
                    <div className="relative flex min-h-[520px] p-6 text-white sm:p-8 xl:p-10">
                      <div className="flex flex-col justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/78">
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm">Medical Transport</span>
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm">Wheelchair Ready</span>
                        </div>

                        <div className="mt-10 max-w-[600px]">
                          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-emerald-200/80">Safe scheduled rides</p>
                          <h1 className="mt-4 max-w-[10ch] font-display text-4xl font-extrabold leading-[0.95] text-white sm:text-5xl xl:text-[4.25rem]">
                            Medical transportation that feels organized and calm.
                          </h1>
                          <p className="mt-5 max-w-[50ch] text-base leading-7 text-white/82 sm:text-lg">
                            {businessInfo.companyName || 'RideFlow'} helps patients, families and care teams coordinate reliable rides for appointments, discharge pickups and accessible transportation from one professional website.
                          </p>

                          <div className="mt-7 flex flex-wrap gap-3">
                            <Button className="rounded-full px-6" onClick={goToBookingPage}>
                              Book a ride
                            </Button>
                            <Button variant="outline" className="rounded-full border-white/30 bg-white/8 px-6 text-white hover:bg-white/14 hover:text-white" onClick={() => navigate('/contact')}>
                              Talk to support
                            </Button>
                          </div>

                          <div className="mt-8 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Dispatch</p>
                              <p className="mt-2 text-lg font-semibold text-white">Same-day coordination</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Access</p>
                              <p className="mt-2 text-lg font-semibold text-white">Wheelchair-capable trips</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Families</p>
                              <p className="mt-2 text-lg font-semibold text-white">Clear booking and updates</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto grid max-w-[1440px] gap-4 px-4 pb-8 sm:px-6 lg:px-8 lg:pb-12 xl:grid-cols-5">
                <div className="rounded-[24px] border border-emerald-500/18 bg-card/90 p-5 shadow-soft backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trusted service</p>
                      <p className="mt-1 text-xl font-bold text-foreground">Coordinated care rides</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-emerald-500/18 bg-card/90 p-5 shadow-soft backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Service area</p>
                      <p className="mt-1 truncate text-xl font-bold text-foreground">{businessInfo.address || 'Configured locally'}</p>
                    </div>
                  </div>
                </div>

                {stats.map((stat, index) => {
                  const statIcons = [Clock3, Star, HeartHandshake];
                  const Icon = statIcons[index] || Clock3;

                  return (
                    <div key={stat.label} className="rounded-[24px] border border-emerald-500/18 bg-card/90 p-5 shadow-soft backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                          <p className="mt-1 text-xl font-bold text-foreground">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">About the service</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              A real business homepage with the booking experience built inside it.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              This first page now behaves like a transportation company website instead of a product landing page. The header, hero, service presentation and contact blocks frame the brand, while the live booking flow remains embedded in the main screen.
            </p>
          </div>

          <div id="services" className="grid gap-4 lg:grid-cols-3">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className="rounded-[8px] border border-emerald-500/18 bg-card p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-medium">
                  <div className="inline-flex rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-foreground">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="contact" className="border-y border-emerald-500/12 bg-background">
          <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr_0.9fr] lg:px-8">
            <div className="rounded-[8px] border border-emerald-500/18 bg-card p-6 shadow-soft sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">Website contact block</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-foreground">Use this as the real front page and keep booking active inside it.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The key change was structural: this page now feels like a service business website first, with booking integrated into the hero instead of the whole experience looking like a wizard shell.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="gap-2 rounded-none" onClick={goToBookingPage}>
                  Start booking
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="rounded-none" onClick={() => navigate('/contact')}>
                  Visit contact page
                </Button>
              </div>
            </div>

            <div className="rounded-[8px] border border-emerald-500/18 bg-card p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
              <p className="mt-3 text-2xl font-bold text-foreground">{businessInfo.phone}</p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <PhoneCall className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Call for immediate scheduling support
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[8px] border border-emerald-500/18 bg-card p-6 shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Email</p>
                <p className="mt-3 break-all text-lg font-bold text-foreground">{businessInfo.email}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Booking confirmations and support
                </p>
              </div>
              <div className="rounded-[8px] border border-emerald-500/18 bg-card p-6 shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Location</p>
                <p className="mt-3 text-lg font-bold text-foreground">{businessInfo.address || 'Service area configured from admin settings'}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Service website section ready
                </p>
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

export default Index;
