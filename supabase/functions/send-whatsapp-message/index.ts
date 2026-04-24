

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingDetails {
  reference: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  vehicleName: string;
  totalPrice: number | null;
  driverName?: string;
}

interface WhatsAppRequest {
  to: string;
  type: 'booking_confirmation' | 'driver_assigned' | 'ride_reminder' | 'assistance';
  booking?: BookingDetails;
  customMessage?: string;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `1${digits}`;
  }
  return digits;
}

function generateBookingConfirmationMessage(booking: BookingDetails): string {
  let message = `🚗 *RideFlow Booking Confirmed!*\n\n`;
  message += `📋 *Reference:* ${booking.reference}\n\n`;
  message += `📍 *Pickup:* ${booking.pickupLocation}\n`;
  message += `🏁 *Dropoff:* ${booking.dropoffLocation}\n\n`;
  message += `📅 *Date:* ${booking.pickupDate}\n`;
  message += `⏰ *Time:* ${booking.pickupTime}\n\n`;
  message += `🚘 *Vehicle:* ${booking.vehicleName}\n`;
  
  if (booking.totalPrice !== null) {
    message += `💰 *Total:* $${booking.totalPrice.toFixed(2)}\n`;
  }
  
  if (booking.driverName) {
    message += `\n👤 *Your Driver:* ${booking.driverName}\n`;
  }
  
  message += `\n---\n`;
  message += `Track your ride: rideflow.app/track\n`;
  message += `Need help? Call 1-800-RIDEFLOW`;
  
  return message;
}

function generateDriverAssignedMessage(booking: BookingDetails): string {
  let message = `🎉 *Driver Assigned!*\n\n`;
  message += `Your driver *${booking.driverName || 'has been assigned'}* is preparing for your ride.\n\n`;
  message += `📋 *Booking:* ${booking.reference}\n`;
  message += `📍 *Pickup:* ${booking.pickupLocation}\n`;
  message += `⏰ *Time:* ${booking.pickupDate} at ${booking.pickupTime}\n\n`;
  message += `Track your driver live at: rideflow.app/track`;
  
  return message;
}

function generateReminderMessage(booking: BookingDetails): string {
  let message = `⏰ *Ride Reminder*\n\n`;
  message += `Your ride is scheduled for tomorrow!\n\n`;
  message += `📋 *Booking:* ${booking.reference}\n`;
  message += `📍 *Pickup:* ${booking.pickupLocation}\n`;
  message += `⏰ *Time:* ${booking.pickupTime}\n`;
  message += `🚘 *Vehicle:* ${booking.vehicleName}\n\n`;
  message += `See you soon! 🚗`;
  
  return message;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    
    const { to, type, booking, customMessage }: WhatsAppRequest = await req.json();
    
    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(to);
    let message = customMessage || '';
    
    if (booking) {
      switch (type) {
        case 'booking_confirmation':
          message = generateBookingConfirmationMessage(booking);
          break;
        case 'driver_assigned':
          message = generateDriverAssignedMessage(booking);
          break;
        case 'ride_reminder':
          message = generateReminderMessage(booking);
          break;
        default:
          message = customMessage || `Hi! This is RideFlow regarding booking ${booking.reference}`;
      }
    }

    // Check if Evolution API is configured
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      console.log('Evolution API not configured, using fallback wa.me link generation');
      
      const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'fallback',
          message: 'Evolution API not configured. Use the link to send manually.',
          waLink,
          formattedMessage: message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending WhatsApp message via Evolution API to ${formattedPhone}`);

    // Send via Evolution API
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${evolutionInstance}`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      }
    );

    const result = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error('Evolution API error:', result);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message',
          details: result.message || result.error || 'Unknown error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('WhatsApp message sent successfully via Evolution API:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: 'evolution_api',
        messageId: result.key?.id,
        to: formattedPhone,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-whatsapp-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
