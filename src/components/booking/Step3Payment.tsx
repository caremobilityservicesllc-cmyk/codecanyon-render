import { useState, useMemo, useCallback, useEffect } from 'react';
import { AIBookingSummary } from './AIBookingSummary';
import { CreditCard, Building2, Wallet, ChevronDown, ChevronUp, Mail, Star, Plus, Loader2, FileCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BookingDetails, PaymentMethod, BillingDetails, BankTransferDetails } from '@/types/booking';
import { BankTransferForm } from './BankTransferForm';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { cn } from '@/lib/utils';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useAuth } from '@/contexts/AuthContext';
import { CardPaymentForm, CardDetails, initialCardDetails } from './CardPaymentForm';
import { useSavedPaymentMethods } from '@/hooks/useSavedPaymentMethods';
import { OrderSummaryCard } from './OrderSummaryCard';
import { PaymentValidationFeedback } from './PaymentValidationFeedback';
import { useBookingValidation } from '@/hooks/useBookingValidation';
import { PromoCodeInput } from './PromoCodeInput';
import { Step3PaymentSkeleton } from './Step3PaymentSkeleton';
import { BillingDetailsForm } from './BillingDetailsForm';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Step3PaymentProps {
  bookingDetails: BookingDetails;
  onUpdate: (updates: Partial<BookingDetails>) => void;
  onComplete: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function Step3Payment({ bookingDetails, onUpdate, onComplete, onBack, isSubmitting }: Step3PaymentProps) {
  const { t } = useLanguage();
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardDetails>(initialCardDetails);
  const [useNewCard, setUseNewCard] = useState(false);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percentage: number; description: string } | null>(null);
  const [enabledGateways, setEnabledGateways] = useState<Set<string>>(new Set(['card', 'bank']));
  const [touched, setTouched] = useState({
    paymentMethod: false,
    email: false,
    terms: false,
    cardDetails: false,
  });

  const allPaymentMethods = useMemo(() => [
    {
      id: 'card' as PaymentMethod,
      name: t.booking.creditDebitCard,
      description: t.booking.creditCardDescription,
      icon: CreditCard,
      settingsKey: 'stripe_settings',
    },
    {
      id: 'paypal' as PaymentMethod,
      name: t.booking.paypal,
      description: t.booking.paypalDescription,
      icon: Wallet,
      settingsKey: 'paypal_settings',
    },
    {
      id: 'bank' as PaymentMethod,
      name: t.booking.bankTransfer,
      description: t.booking.bankTransferDescription,
      icon: Building2,
      settingsKey: 'bank_settings',
    },
  ], [t]);

  // Fetch enabled payment gateways from system settings
  useEffect(() => {
    const fetchGatewaySettings = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['stripe_settings', 'paypal_settings', 'bank_settings']);

      if (data) {
        const enabled = new Set<string>();
        data.forEach((s) => {
          const val = s.value as any;
          if (val?.enabled) {
            if (s.key === 'stripe_settings') enabled.add('card');
            else if (s.key === 'paypal_settings') enabled.add('paypal');
            else if (s.key === 'bank_settings') enabled.add('bank');
          }
        });
        if (enabled.size === 0) enabled.add('card');
        setEnabledGateways(enabled);
      }
    };
    fetchGatewaySettings();
  }, []);

  const paymentMethods = useMemo(() => {
    return allPaymentMethods.filter(m => enabledGateways.has(m.id));
  }, [enabledGateways, allPaymentMethods]);
  
  const { user, loading: isAuthLoading } = useAuth();
  const { bookingPolicies, formatPrice, aiAssistantEnabled } = useSystemSettings();
  const { paymentMethods: savedCards, isLoading: isLoadingSavedCards } = useSavedPaymentMethods();
  const { priceBreakdown, isLoading: isPricingLoading } = useDynamicPricing(
    bookingDetails,
    bookingPolicies.depositPercentage
  );
  const { step3Errors, validateStep3 } = useBookingValidation(bookingDetails);

  // Pre-fill billing details from user profile when logged in
  useEffect(() => {
    const fetchProfileForBilling = async () => {
      if (!user) return;
      
      const { fullName, address, city } = bookingDetails.billingDetails;
      if (fullName || address || city) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .single();

        if (profile?.full_name) {
          onUpdate({
            billingDetails: {
              ...bookingDetails.billingDetails,
              fullName: profile.full_name || '',
            }
          });
        }
      } catch (error) {
        console.error('Error fetching profile for billing:', error);
      }
    };

    fetchProfileForBilling();
  }, [user]);

  const handleApplyPromoCode = useCallback(async (code: string): Promise<{ valid: boolean; discount?: number; message?: string }> => {
    try {
      const bookingAmount = priceBreakdown?.total ?? 0;
      
      const { data, error } = await supabase
        .rpc('validate_promo_code', { 
          p_code: code.toUpperCase(),
          p_booking_amount: bookingAmount,
          p_user_id: user?.id || null
        });
      
      if (error) {
        console.error('Promo code validation error:', error);
        setAppliedDiscount(null);
        return { valid: false, message: 'Failed to validate promo code' };
      }
      
      const result = data?.[0];
      
      if (result?.valid) {
        setAppliedDiscount({ 
          code: code.toUpperCase(), 
          percentage: Number(result.discount_percentage), 
          description: result.message 
        });
        onUpdate({ 
          promoCode: code.toUpperCase(),
          promoCodeId: result.promo_code_id
        });
        return { 
          valid: true, 
          discount: Number(result.discount_percentage), 
          message: `${result.message} - ${result.discount_percentage}% off!` 
        };
      }
      
      setAppliedDiscount(null);
      return { valid: false, message: result?.message || 'Invalid promo code' };
    } catch (err) {
      console.error('Promo code validation error:', err);
      setAppliedDiscount(null);
      return { valid: false, message: 'Failed to validate promo code' };
    }
  }, [priceBreakdown?.total, onUpdate, user?.id]);

  const handlePromoCodeChange = useCallback((value: string) => {
    onUpdate({ promoCode: value });
    if (appliedDiscount && value !== appliedDiscount.code) {
      setAppliedDiscount(null);
    }
  }, [onUpdate, appliedDiscount]);

  const handlePaymentMethodChange = useCallback((method: PaymentMethod) => {
    onUpdate({ paymentMethod: method });
    setTouched(prev => ({ ...prev, paymentMethod: true }));
    if (method === 'card' && savedCards.length > 0) {
      const defaultCard = savedCards.find(c => c.is_default);
      if (defaultCard) {
        setSelectedSavedCard(defaultCard.id);
        setUseNewCard(false);
      }
    }
  }, [onUpdate, savedCards]);

  const handleSelectSavedCard = useCallback((cardId: string) => {
    setSelectedSavedCard(cardId);
    setUseNewCard(false);
    setTouched(prev => ({ ...prev, cardDetails: true }));
  }, []);

  const handleUseNewCard = useCallback(() => {
    setSelectedSavedCard(null);
    setUseNewCard(true);
  }, []);

  const handleCardDetailsChange = useCallback((details: CardDetails) => {
    setCardDetails(details);
    setTouched(prev => ({ ...prev, cardDetails: true }));
  }, []);

  const handleEmailChange = useCallback((value: string) => {
    onUpdate({ guestEmail: value });
  }, [onUpdate]);

  const handleEmailBlur = useCallback(() => {
    setTouched(prev => ({ ...prev, email: true }));
  }, []);

  const handleTermsChange = useCallback((checked: boolean) => {
    onUpdate({ agreedToTerms: checked });
    setTouched(prev => ({ ...prev, terms: true }));
  }, [onUpdate]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasValidEmail = !!user?.email || (bookingDetails.guestEmail && emailRegex.test(bookingDetails.guestEmail));
  const emailError = !user && touched.email && bookingDetails.guestEmail && !emailRegex.test(bookingDetails.guestEmail)
    ? t.booking.pleaseEnterValidEmail
    : !user && touched.email && !bookingDetails.guestEmail
    ? t.booking.emailIsRequired
    : null;
  
  const isCardPaymentValid = true;

  const isBankTransferValid = bookingDetails.paymentMethod === 'bank'
    ? !!(bookingDetails.bankTransferDetails.senderName.trim() && 
          bookingDetails.bankTransferDetails.bankName.trim() && 
          bookingDetails.bankTransferDetails.transferReference.trim() &&
          bookingDetails.bankTransferDetails.transferDate)
    : true;
  
  const isValid = bookingDetails.paymentMethod !== null && 
    hasValidEmail && 
    isBankTransferValid &&
    bookingDetails.agreedToTerms;

  const validationItems = useMemo(() => {
    const items = [
      {
        id: 'payment',
        label: t.booking.selectPaymentMethod,
        isValid: bookingDetails.paymentMethod !== null,
        errorMessage: t.booking.selectPaymentMethodHint,
        isTouched: touched.paymentMethod,
      },
    ];

    if (bookingDetails.paymentMethod === 'card') {
      items.push({
        id: 'card',
        label: t.booking.payViaStripe,
        isValid: true,
        errorMessage: '',
        isTouched: true,
      });
    }

    if (bookingDetails.paymentMethod === 'bank') {
      items.push({
        id: 'bank',
        label: t.booking.provideBankDetails,
        isValid: isBankTransferValid,
        errorMessage: t.booking.bankDetailsHint,
        isTouched: true,
      });
    }

    if (!user) {
      items.push({
        id: 'email',
        label: t.booking.provideEmail,
        isValid: hasValidEmail,
        errorMessage: emailError || t.booking.emailRequired,
        isTouched: touched.email,
      });
    }

    items.push({
      id: 'terms',
      label: t.booking.acceptTerms,
      isValid: bookingDetails.agreedToTerms,
      errorMessage: t.booking.youMustAgree,
      isTouched: touched.terms,
    });

    return items;
  }, [bookingDetails.paymentMethod, bookingDetails.agreedToTerms, bookingDetails.bankTransferDetails, isCardPaymentValid, isBankTransferValid, hasValidEmail, emailError, touched, user, useNewCard, t]);

  const cardBrandColors: Record<string, string> = {
    visa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    mastercard: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    amex: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    discover: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };

  if (isAuthLoading || (isLoadingSavedCards && user)) {
    return <Step3PaymentSkeleton />;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t.booking.completeBooking}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t.booking.reviewAndPay}
        </p>
      </div>

      {aiAssistantEnabled && bookingDetails.paymentMethod && (
        <AIBookingSummary
          bookingDetails={bookingDetails}
          totalPrice={priceBreakdown?.total || 0}
        />
      )}

      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Column - Payment Methods */}
          <div className="space-y-6 lg:col-span-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
                {t.booking.selectPaymentMethod}
              </h3>
              <div className={cn("grid grid-cols-1 gap-3", paymentMethods.length <= 2 ? "sm:grid-cols-2" : paymentMethods.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = bookingDetails.paymentMethod === method.id;

                  return (
                    <div
                      key={method.id}
                      className={cn(
                        'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 text-center',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-muted-foreground/50 hover:shadow-sm'
                      )}
                      onClick={() => handlePaymentMethodChange(method.id)}
                    >
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm text-foreground">{method.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{method.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {bookingDetails.paymentMethod === 'card' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ExternalLink className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.booking.secureStripeCheckout}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.booking.stripeCheckoutDescription}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {bookingDetails.paymentMethod === 'paypal' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ExternalLink className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.booking.paypalCheckout}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.booking.paypalCheckoutDescription}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {bookingDetails.paymentMethod === 'bank' && (
                <BankTransferForm
                  details={bookingDetails.bankTransferDetails}
                  onChange={(details: BankTransferDetails) => onUpdate({ bankTransferDetails: details })}
                />
              )}
            </div>

            {/* Guest Email */}
            {!user && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 font-display text-lg font-semibold text-foreground flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {t.booking.contactInformation}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">{t.booking.emailAddress} *</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    placeholder="your@email.com"
                    value={bookingDetails.guestEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={handleEmailBlur}
                    className={cn(
                      emailError && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {emailError ? (
                    <p className="text-xs text-destructive">{emailError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t.booking.emailConfirmationHint}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Promo Code */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
                {t.booking.promoCode}
              </h3>
              <PromoCodeInput
                value={bookingDetails.promoCode}
                onChange={handlePromoCodeChange}
                onApply={handleApplyPromoCode}
              />
            </div>

            {/* Terms and Conditions */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={bookingDetails.agreedToTerms}
                  onCheckedChange={(checked) => handleTermsChange(checked === true)}
                  className={cn(
                    "mt-0.5",
                    touched.terms && !bookingDetails.agreedToTerms && "border-destructive"
                  )}
                />
                <div className="space-y-1">
                  <Label 
                    htmlFor="terms" 
                    className={cn(
                      "text-sm font-medium cursor-pointer",
                      touched.terms && !bookingDetails.agreedToTerms && "text-destructive"
                    )}
                  >
                    {t.booking.termsAndConditions} *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t.booking.termsDescription}{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">{t.booking.termsOfService}</a>
                    {' '}{t.common.and}{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">{t.booking.privacyPolicy}</a>
                  </p>
                  {touched.terms && !bookingDetails.agreedToTerms && (
                    <p className="text-xs text-destructive">{t.booking.mustAgreeToTerms}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Feedback */}
            <PaymentValidationFeedback items={validationItems} />

            {/* Billing Details Toggle */}
            <div className="rounded-xl border border-border bg-card">
              <button
                className="flex w-full items-center justify-between p-4"
                onClick={() => setShowBillingDetails(!showBillingDetails)}
              >
                <span className="font-medium text-foreground">{t.booking.billingDetails}</span>
                {showBillingDetails ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              {showBillingDetails && (
                <div className="animate-fade-in border-t border-border p-6">
                  <BillingDetailsForm
                    billingDetails={bookingDetails.billingDetails}
                    onChange={(details: BillingDetails) => onUpdate({ billingDetails: details })}
                    pickupLocation={bookingDetails.pickupLocation}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <OrderSummaryCard 
                bookingDetails={bookingDetails}
                priceBreakdown={priceBreakdown}
                isPricingLoading={isPricingLoading}
                appliedDiscount={appliedDiscount}
              />
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack} className="order-2 h-14 text-base sm:order-1" disabled={isSubmitting}>
            {t.booking.backToVehicle}
          </Button>
          <Button
            variant="booking"
            disabled={!isValid || isSubmitting}
            onClick={onComplete}
            className="order-1 h-14 text-base sm:order-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.common.processing}
              </>
            ) : bookingDetails.paymentMethod === 'card' ? (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.booking.payWithStripe}
                {priceBreakdown && (
                  <span className="ml-2 opacity-80">
                    ({formatPrice(priceBreakdown.total)})
                  </span>
                )}
              </>
            ) : bookingDetails.paymentMethod === 'paypal' ? (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.booking.payWithPayPal}
                {priceBreakdown && (
                  <span className="ml-2 opacity-80">
                    ({formatPrice(priceBreakdown.total)})
                  </span>
                )}
              </>
            ) : (
              <>
                <FileCheck className="mr-2 h-4 w-4" />
                {bookingDetails.paymentMethod === 'bank' ? t.booking.submitBooking : t.booking.confirmBooking}
                {priceBreakdown && (
                  <span className="ml-2 opacity-80">
                    ({formatPrice(priceBreakdown.deposit)} {t.booking.deposit})
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
