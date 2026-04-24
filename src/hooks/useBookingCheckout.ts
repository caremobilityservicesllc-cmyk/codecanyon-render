import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendBookingEmail } from '@/hooks/useBookingEmail';
import type { BookingDetails } from '@/types/booking';
import type { PriceBreakdown } from '@/hooks/useDynamicPricing';

interface SubmitBookingParams {
  bookingDetails: BookingDetails;
  priceBreakdown: PriceBreakdown | null;
}

export function useBookingCheckout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const submitBooking = async ({ bookingDetails, priceBreakdown }: SubmitBookingParams) => {
    if (!bookingDetails.pickupDate || !bookingDetails.selectedVehicle || !bookingDetails.paymentMethod) {
      return { ok: false };
    }

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
      const normalizedEmail = (user?.email || bookingDetails.guestEmail || '').trim().toLowerCase();

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
        contact_email: normalizedEmail,
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
        return { ok: false, error };
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
            return { ok: true, redirected: true };
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

      if (normalizedEmail) {
        sendBookingEmail({
          type: 'created',
          email: normalizedEmail,
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
      return { ok: true, bookingId: data?.id };
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        title: t.bookingFlow.bookingFailed,
        description: t.bookingFlow.bookingFailedDesc,
        variant: 'destructive',
      });
      return { ok: false, error };
    }
  };

  return { submitBooking };
}