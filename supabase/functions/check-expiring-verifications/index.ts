import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for expiring payment verifications...");

    // Get payment methods expiring in the next 4 hours
    const fourHoursFromNow = new Date();
    fourHoursFromNow.setHours(fourHoursFromNow.getHours() + 4);
    
    const now = new Date();

    // Find unverified methods expiring soon (within 4 hours)
    const { data: expiringMethods, error: expiringError } = await supabase
      .from("payment_methods")
      .select("id, user_id, payment_type, card_brand, card_last_four, bank_name, account_last_four, paypal_email, verification_expires_at")
      .eq("is_verified", false)
      .not("verification_amount_cents", "is", null)
      .gte("verification_expires_at", now.toISOString())
      .lte("verification_expires_at", fourHoursFromNow.toISOString());

    if (expiringError) {
      console.error("Error fetching expiring methods:", expiringError);
      throw expiringError;
    }

    console.log(`Found ${expiringMethods?.length || 0} expiring payment methods`);

    // Send reminders for expiring methods
    for (const method of expiringMethods || []) {
      // Get user email from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", method.user_id)
        .single();

      if (!profile?.email) {
        console.log(`No email found for user ${method.user_id}, skipping`);
        continue;
      }

      // Determine payment method label
      let paymentMethodLabel = "your payment method";
      if (method.payment_type === "card") {
        paymentMethodLabel = `${method.card_brand || "Card"} ending in ${method.card_last_four}`;
      } else if (method.payment_type === "bank") {
        paymentMethodLabel = `${method.bank_name} account ending in ${method.account_last_four}`;
      } else if (method.payment_type === "paypal") {
        paymentMethodLabel = `PayPal (${method.paypal_email})`;
      }

      // Send expiring soon email
      try {
        await supabase.functions.invoke("send-verification-email", {
          body: {
            type: "expiring_soon",
            userId: method.user_id,
            paymentMethodId: method.id,
            email: profile.email,
            paymentMethodLabel,
          },
        });
        console.log(`Sent expiring soon email for method ${method.id}`);
      } catch (emailError) {
        console.error(`Failed to send email for method ${method.id}:`, emailError);
      }
    }

    // Also check for recently expired methods (expired within last hour) to notify
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: expiredMethods, error: expiredError } = await supabase
      .from("payment_methods")
      .select("id, user_id, payment_type, card_brand, card_last_four, bank_name, account_last_four, paypal_email")
      .eq("is_verified", false)
      .not("verification_amount_cents", "is", null)
      .gte("verification_expires_at", oneHourAgo.toISOString())
      .lt("verification_expires_at", now.toISOString());

    if (!expiredError && expiredMethods) {
      console.log(`Found ${expiredMethods.length} recently expired payment methods`);

      for (const method of expiredMethods) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", method.user_id)
          .single();

        if (!profile?.email) continue;

        let paymentMethodLabel = "your payment method";
        if (method.payment_type === "card") {
          paymentMethodLabel = `${method.card_brand || "Card"} ending in ${method.card_last_four}`;
        } else if (method.payment_type === "bank") {
          paymentMethodLabel = `${method.bank_name} account ending in ${method.account_last_four}`;
        } else if (method.payment_type === "paypal") {
          paymentMethodLabel = `PayPal (${method.paypal_email})`;
        }

        try {
          await supabase.functions.invoke("send-verification-email", {
            body: {
              type: "expired",
              userId: method.user_id,
              paymentMethodId: method.id,
              email: profile.email,
              paymentMethodLabel,
            },
          });
          console.log(`Sent expired email for method ${method.id}`);
        } catch (emailError) {
          console.error(`Failed to send expired email for method ${method.id}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiringCount: expiringMethods?.length || 0,
        expiredCount: expiredMethods?.length || 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error checking expiring verifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
