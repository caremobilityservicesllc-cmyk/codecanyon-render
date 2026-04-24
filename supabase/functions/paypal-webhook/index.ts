import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayPal IPN verification URL
const PAYPAL_IPN_VERIFY_URL_SANDBOX = "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr";
const PAYPAL_IPN_VERIFY_URL_LIVE = "https://ipnpb.paypal.com/cgi-bin/webscr";

async function verifyIPNMessage(body: string, isTestMode: boolean): Promise<boolean> {
  const verifyUrl = isTestMode ? PAYPAL_IPN_VERIFY_URL_SANDBOX : PAYPAL_IPN_VERIFY_URL_LIVE;
  
  try {
    const verifyBody = `cmd=_notify-validate&${body}`;
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody,
    });
    
    const result = await response.text();
    return result === "VERIFIED";
  } catch (error) {
    console.error("IPN verification error:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    // Parse IPN message
    const ipnData: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      ipnData[key] = value;
    }

    console.log("Received PayPal IPN:", JSON.stringify(ipnData, null, 2));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch PayPal settings to determine test/live mode
    const { data: paypalSettings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "paypal_settings")
      .single();

    if (!paypalSettings?.value) {
      console.error("PayPal settings not configured");
      return new Response("PayPal not configured", { status: 500 });
    }

    const settings = paypalSettings.value as {
      enabled: boolean;
      mode: string;
    };

    if (!settings.enabled) {
      console.error("PayPal is not enabled");
      return new Response("PayPal is disabled", { status: 400 });
    }

    const isTestMode = settings.mode === "test";

    // Verify IPN message with PayPal
    const isVerified = await verifyIPNMessage(body, isTestMode);
    
    if (!isVerified) {
      console.error("IPN verification failed");
      return new Response("IPN verification failed", { status: 400 });
    }

    console.log("IPN verified successfully");

    // Extract payment details
    const paymentStatus = ipnData.payment_status;
    const txnId = ipnData.txn_id;
    const bookingReference = ipnData.custom || ipnData.invoice;
    const payerEmail = ipnData.payer_email;
    const mcGross = ipnData.mc_gross;
    const mcCurrency = ipnData.mc_currency;

    console.log(`Processing payment: ${paymentStatus} for booking ${bookingReference}`);

    if (!bookingReference) {
      console.log("No booking reference in IPN, skipping");
      return new Response("OK", { status: 200 });
    }

    // Handle different payment statuses
    switch (paymentStatus) {
      case "Completed": {
        console.log(`Payment completed for booking: ${bookingReference}`);
        
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
          
          // Get booking to create notification
          const { data: booking } = await supabase
            .from("bookings")
            .select("user_id, id")
            .eq("booking_reference", bookingReference)
            .single();

          if (booking?.user_id) {
            await supabase.from("notifications").insert({
              user_id: booking.user_id,
              title: "Payment Confirmed",
              message: `Your PayPal payment of ${mcGross} ${mcCurrency} for booking ${bookingReference} has been confirmed.`,
              type: "booking_confirmed",
              channel: "in_app",
              booking_id: booking.id,
            });
          }

          // Log the transaction
          await supabase.from("settings_audit_log").insert({
            setting_key: "paypal_payment",
            action: "payment_completed",
            new_value: {
              booking_reference: bookingReference,
              transaction_id: txnId,
              payer_email: payerEmail,
              amount: mcGross,
              currency: mcCurrency,
            },
          });
        }
        break;
      }

      case "Pending": {
        console.log(`Payment pending for booking: ${bookingReference}, reason: ${ipnData.pending_reason}`);
        
        // Get booking to create notification
        const { data: booking } = await supabase
          .from("bookings")
          .select("user_id, id")
          .eq("booking_reference", bookingReference)
          .single();

        if (booking?.user_id) {
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            title: "Payment Pending",
            message: `Your PayPal payment for booking ${bookingReference} is pending. Reason: ${ipnData.pending_reason || "Processing"}`,
            type: "booking_confirmed",
            channel: "in_app",
            booking_id: booking.id,
          });
        }
        break;
      }

      case "Failed":
      case "Denied": {
        console.log(`Payment ${paymentStatus.toLowerCase()} for booking: ${bookingReference}`);
        
        // Get booking to create notification
        const { data: booking } = await supabase
          .from("bookings")
          .select("user_id, id")
          .eq("booking_reference", bookingReference)
          .single();

        if (booking?.user_id) {
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            title: "Payment Failed",
            message: `Your PayPal payment for booking ${bookingReference} has failed. Please try again or use a different payment method.`,
            type: "booking_confirmed",
            channel: "in_app",
            booking_id: booking.id,
          });
        }
        break;
      }

      case "Refunded":
      case "Reversed": {
        console.log(`Payment ${paymentStatus.toLowerCase()} for booking: ${bookingReference}`);
        
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

        // Get booking to create notification
        const { data: booking } = await supabase
          .from("bookings")
          .select("user_id, id")
          .eq("booking_reference", bookingReference)
          .single();

        if (booking?.user_id) {
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            title: paymentStatus === "Refunded" ? "Payment Refunded" : "Payment Reversed",
            message: `Your PayPal payment for booking ${bookingReference} has been ${paymentStatus.toLowerCase()}.`,
            type: "booking_confirmed",
            channel: "in_app",
            booking_id: booking.id,
          });
        }

        // Log the refund/reversal
        await supabase.from("settings_audit_log").insert({
          setting_key: "paypal_payment",
          action: paymentStatus.toLowerCase(),
          new_value: {
            booking_reference: bookingReference,
            transaction_id: txnId,
            parent_txn_id: ipnData.parent_txn_id,
            amount: mcGross,
            currency: mcCurrency,
          },
        });
        break;
      }

      default:
        console.log(`Unhandled payment status: ${paymentStatus}`);
    }

    // PayPal expects 200 OK response
    return new Response("OK", { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "text/plain" } 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("PayPal webhook error:", error);
    return new Response(errorMessage, { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "text/plain" } 
    });
  }
});
