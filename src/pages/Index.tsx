import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/booking/Navbar';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { Step1Location } from '@/components/booking/Step1Location';
import { Step2Vehicle } from '@/components/booking/Step2Vehicle';
import { Step3Payment } from '@/components/booking/Step3Payment';
import { LoadingScreen } from '@/components/LoadingScreen';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import { AIChatbot } from '@/components/booking/AIChatbot';
import { Footer } from '@/components/Footer';

import { BookingDetails, initialBillingDetails, initialBankTransferDetails } from '@/types/booking';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useBookingCheckout } from '@/hooks/useBookingCheckout';

const HOME_SPLASH_SEEN_KEY = 'rideflow-home-splash-seen';

function hasSeenHomeSplash() {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return sessionStorage.getItem(HOME_SPLASH_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
}

function markHomeSplashSeen() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(HOME_SPLASH_SEEN_KEY, 'true');
  } catch {
    // Ignore storage failures so the home route never crashes.
  }
}

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
  selectedVehicle: null,
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
  const [showSplash, setShowSplash] = useState(() => !hasSeenHomeSplash());

  useEffect(() => {
    if (!showSplash) {
      return;
    }

    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash && typeof window !== 'undefined') {
      markHomeSplashSeen();
    }
  }, [showSplash]);

  const { bookingPolicies, aiAssistantEnabled } = useSystemSettings();
  const { priceBreakdown } = useDynamicPricing(bookingDetails, bookingPolicies.depositPercentage, bookingDetails.routeDistanceKm);
  const { submitBooking } = useBookingCheckout();

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

    await submitBooking({ bookingDetails, priceBreakdown });
    setIsSubmitting(false);
  };

  if (showSplash) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-[960px] px-4 py-8">
        <StepIndicator currentStep={currentStep} totalSteps={3} />

        <div className="w-full">
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
      </main>

      <Footer />

      <InstallPromptBanner />
      {aiAssistantEnabled && <AIChatbot />}
    </div>
  );
};

export default Index;
