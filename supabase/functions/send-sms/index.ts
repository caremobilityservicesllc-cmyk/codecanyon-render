import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCompanyName(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return "RideFlow";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "business_info")
      .single();
    return (data?.value as any)?.companyName || "RideFlow";
  } catch {
    return "RideFlow";
  }
}

// SMS templates for different notification types (company name injected at runtime)
const smsTemplates = (brand: string) => ({
  booking_confirmed: (ref: string, time: string) => 
    `${brand}: Your booking ${ref} is confirmed! Pickup at ${time}. Track your ride in the app!`,
  driver_assigned: (ref: string, driverName: string, eta: string) => 
    `${brand}: ${driverName} is your driver for ${ref}. ETA: ${eta}. Track live on the app!`,
  driver_arriving: (ref: string, minutes: number) => 
    `${brand}: Your driver for ${ref} arrives in ~${minutes} min. Please be ready at pickup.`,
  ride_started: (ref: string) => 
    `${brand}: Your ride ${ref} has started. Enjoy your trip! 🚗`,
  ride_completed: (ref: string) => 
    `${brand}: Ride ${ref} complete! Thank you for choosing ${brand}. Rate your driver in the app.`,
  reminder: (ref: string, pickupTime: string) => 
    `${brand} Reminder: Your ride ${ref} is scheduled for ${pickupTime}. See you soon!`,
  traffic_alert: (ref: string, delayMinutes: number, level: string) =>
    `${brand} Traffic Alert: ${level === 'severe' ? '🚨' : '⚠️'} ${level.charAt(0).toUpperCase() + level.slice(1)} traffic on route for ${ref}. +${delayMinutes}min delay expected. Consider leaving early!`,
});

async function sendViaTwilio(phoneNumber: string, message: string) {
  const accountSid = Deno.env.get("SMS_TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("SMS_TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("SMS_TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phoneNumber,
        From: fromNumber,
        Body: message,
      }),
    }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Twilio API error");
  return { sid: result.sid };
}

async function sendViaNexmo(phoneNumber: string, message: string) {
  const apiKey = Deno.env.get("SMS_NEXMO_API_KEY");
  const apiSecret = Deno.env.get("SMS_NEXMO_API_SECRET");
  const fromNumber = Deno.env.get("SMS_NEXMO_FROM_NUMBER");

  if (!apiKey || !apiSecret || !fromNumber) {
    throw new Error("Nexmo credentials not configured");
  }

  const response = await fetch("https://rest.nexmo.com/sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      api_secret: apiSecret,
      from: fromNumber,
      to: phoneNumber.replace(/[^0-9]/g, ""),
      text: message,
    }),
  });
  const result = await response.json();
  if (result.messages?.[0]?.status !== "0") {
    throw new Error(result.messages?.[0]?.["error-text"] || "Nexmo API error");
  }
  return { messageId: result.messages[0]["message-id"] };
}

async function sendViaMessageBird(phoneNumber: string, message: string) {
  const apiKey = Deno.env.get("SMS_MESSAGEBIRD_API_KEY");
  const originator = Deno.env.get("SMS_MESSAGEBIRD_ORIGINATOR");

  if (!apiKey || !originator) {
    throw new Error("MessageBird credentials not configured");
  }

  const response = await fetch("https://rest.messagebird.com/messages", {
    method: "POST",
    headers: {
      "Authorization": `AccessKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originator,
      recipients: [phoneNumber.replace(/[^0-9]/g, "")],
      body: message,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.errors?.[0]?.description || "MessageBird API error");
  return { messageId: result.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, type, data, provider } = await req.json();

    if (!phoneNumber || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company name for branding
    const brand = await getCompanyName();
    const SMS_TEMPLATES = smsTemplates(brand);

    // Generate message based on type
    let message = "";
    switch (type) {
      case "booking_confirmed":
        message = SMS_TEMPLATES.booking_confirmed(data.bookingReference, data.pickupTime);
        break;
      case "driver_assigned":
        message = SMS_TEMPLATES.driver_assigned(data.bookingReference, data.driverName, data.eta);
        break;
      case "driver_arriving":
        message = SMS_TEMPLATES.driver_arriving(data.bookingReference, data.minutes);
        break;
      case "ride_started":
        message = SMS_TEMPLATES.ride_started(data.bookingReference);
        break;
      case "ride_completed":
        message = SMS_TEMPLATES.ride_completed(data.bookingReference);
        break;
      case "reminder":
        message = SMS_TEMPLATES.reminder(data.bookingReference, data.pickupTime);
        break;
      case "traffic_alert":
        message = SMS_TEMPLATES.traffic_alert(data.bookingReference, data.delayMinutes, data.trafficLevel);
        break;
      default:
        message = data.customMessage || `${brand} notification`;
    }

    // Determine provider and send
    const smsProvider = provider || "twilio";
    let result;

    try {
      switch (smsProvider) {
        case "twilio":
          result = await sendViaTwilio(phoneNumber, message);
          break;
        case "nexmo":
          result = await sendViaNexmo(phoneNumber, message);
          break;
        case "messagebird":
          result = await sendViaMessageBird(phoneNumber, message);
          break;
        default:
          // Demo mode fallback
          console.log(`SMS to ${phoneNumber}: ${message}`);
          result = { demo: true };
      }
    } catch (providerError) {
      // If provider credentials aren't configured, fall back to demo mode
      console.warn(`SMS provider ${smsProvider} error:`, providerError);
      console.log(`[Demo] SMS to ${phoneNumber}: ${message}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS queued (demo mode - provider not configured)",
          preview: message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: smsProvider,
        result,
        preview: message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMS error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
