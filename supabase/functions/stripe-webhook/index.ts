import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("No Stripe signature found");
      return new Response(
        JSON.stringify({ error: "No signature provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    
    // Get Stripe configuration from system_settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Stripe webhook secret from system_settings
    const { data: stripeSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "stripe_settings")
      .single();

    if (!stripeSettings?.value) {
      console.error("Stripe settings not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = stripeSettings.value as {
      enabled: boolean;
      mode: string;
      webhookSecret: string;
      secretKey: string;
    };

    if (!settings.enabled) {
      console.error("Stripe is not enabled");
      return new Response(
        JSON.stringify({ error: "Stripe is disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe with the configured secret key
    const stripe = new Stripe(settings.secretKey, {
      apiVersion: "2023-10-16",
    });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        settings.webhookSecret
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${errorMessage}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingReference = paymentIntent.metadata?.booking_reference;
        
        if (bookingReference) {
          console.log(`Payment succeeded for booking: ${bookingReference}`);
          
          // Update booking status to confirmed
          const { error: updateError } = await supabase
            .from("bookings")
            .update({ 
              status: "confirmed",
              updated_at: new Date().toISOString()
            })
            .eq("booking_reference", bookingReference);

          if (updateError) {
            console.error("Failed to update booking:", updateError);
          } else {
            console.log(`Booking ${bookingReference} confirmed`);
            
            // Create notification for user
            const { data: booking } = await supabase
              .from("bookings")
              .select("user_id")
              .eq("booking_reference", bookingReference)
              .single();

            if (booking?.user_id) {
              await supabase.from("notifications").insert({
                user_id: booking.user_id,
                title: "Payment Confirmed",
                message: `Your payment for booking ${bookingReference} has been confirmed.`,
                type: "booking_confirmed",
                channel: "in_app",
              });
            }
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingReference = paymentIntent.metadata?.booking_reference;
        
        if (bookingReference) {
          console.log(`Payment failed for booking: ${bookingReference}`);
          
          // Get booking to notify user
          const { data: booking } = await supabase
            .from("bookings")
            .select("user_id")
            .eq("booking_reference", bookingReference)
            .single();

          if (booking?.user_id) {
            await supabase.from("notifications").insert({
              user_id: booking.user_id,
              title: "Payment Failed",
              message: `Your payment for booking ${bookingReference} failed. Please try again.`,
              type: "booking_confirmed",
              channel: "in_app",
            });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const bookingReference = charge.metadata?.booking_reference;
        
        if (bookingReference) {
          console.log(`Refund processed for booking: ${bookingReference}`);
          
          // Update booking status to cancelled
          const { error: updateError } = await supabase
            .from("bookings")
            .update({ 
              status: "cancelled",
              updated_at: new Date().toISOString()
            })
            .eq("booking_reference", bookingReference);

          if (updateError) {
            console.error("Failed to update booking for refund:", updateError);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true, type: event.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
