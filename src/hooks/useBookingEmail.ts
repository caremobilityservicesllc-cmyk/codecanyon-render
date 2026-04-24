import { supabase } from '@/integrations/supabase/client';

interface BookingEmailData {
  type: 'created' | 'updated' | 'cancelled' | 'reminder' | 'bank_payment_confirmed';
  email: string;
  bookingReference: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  vehicleName: string;
  passengers: number;
  status?: string;
}

export const sendBookingEmail = async (data: BookingEmailData): Promise<boolean> => {
  try {
    console.log('Sending booking email:', data);
    
    const { data: response, error } = await supabase.functions.invoke('send-booking-email', {
      body: data,
    });

    if (error) {
      console.error('Error sending booking email:', error);
      return false;
    }

    console.log('Booking email sent successfully:', response);
    return true;
  } catch (err) {
    console.error('Failed to send booking email:', err);
    return false;
  }
};

export const useBookingEmail = () => {
  return { sendBookingEmail };
};
