import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch admin-configured custom API keys from system_settings
async function getCustomAiKeys(): Promise<{ google_gemini?: string; openai?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return {};
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["ai_key_google_gemini", "ai_key_openai"]);
    const keys: { google_gemini?: string; openai?: string } = {};
    if (data) {
      for (const s of data) {
        const val = s.value as any;
        if (s.key === "ai_key_google_gemini" && val?.apiKey) keys.google_gemini = val.apiKey;
        if (s.key === "ai_key_openai" && val?.apiKey) keys.openai = val.apiKey;
      }
    }
    return keys;
  } catch {
    return {};
  }
}

function getAiConfig(customKeys: { google_gemini?: string; openai?: string }) {
  if (customKeys.google_gemini) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: customKeys.google_gemini,
      model: "gemini-2.5-flash",
    };
  }
  if (customKeys.openai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: customKeys.openai,
      model: "gpt-4o-mini",
    };
  }
  throw new Error("no_api_key");
}

async function callAi(systemPrompt: string, userPrompt: string, customKeys: { google_gemini?: string; openai?: string }) {
  const config = getAiConfig(customKeys);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("AI API error:", response.status, text);
    if (response.status === 429) throw new Error("rate_limited");
    if (response.status === 402) throw new Error("payment_required");
    throw new Error("ai_error");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feature, context } = await req.json();
    const customKeys = await getCustomAiKeys();

    let result: any;

    switch (feature) {
      case "route_suggestions": {
        const systemPrompt = `You are a smart route suggestion assistant for a premium transportation service. Based on the user's partial pickup or dropoff location, suggest 3 popular routes or destinations. Return ONLY valid JSON array of objects with "pickup" and "dropoff" fields. No markdown, no code fences. Example: [{"pickup":"Airport Terminal 1","dropoff":"Downtown Hotel District"},{"pickup":"Airport Terminal 2","dropoff":"Convention Center"},{"pickup":"Airport","dropoff":"University Campus"}]`;
        const userPrompt = `Pickup: "${context.pickup || ""}", Dropoff: "${context.dropoff || ""}". Suggest 3 popular routes based on what the user has entered so far.`;
        const text = await callAi(systemPrompt, userPrompt, customKeys);
        try {
          // Extract JSON from response, handling potential markdown wrapping
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          result = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
          result = [];
        }
        break;
      }

      case "vehicle_recommendation": {
        const systemPrompt = `You are a vehicle recommendation assistant for a premium transportation service. Based on the trip details, recommend the best vehicle and explain why in 1-2 sentences. Return ONLY valid JSON with "recommendedCategory" (one of: Economy, Comfort, Business, Premium, SUV, Van, Luxury) and "reason" fields. No markdown, no code fences. Example: {"recommendedCategory":"SUV","reason":"With 4 passengers and luggage, an SUV provides ample space and comfort for your airport transfer."}`;
        const userPrompt = `Trip details: ${context.passengers} passengers, ${context.luggage || 0} bags, route: ${context.pickup} → ${context.dropoff}, service type: ${context.serviceType}, distance: ${context.distance || "unknown"}km`;
        const text = await callAi(systemPrompt, userPrompt, customKeys);
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          result = null;
        }
        break;
      }

      case "booking_summary": {
        const systemPrompt = `You are a booking summary assistant. Generate a friendly, concise natural-language summary of the booking details. Include a brief tip or note relevant to the trip. Keep it to 2-3 sentences. Return ONLY valid JSON with "summary" and "tip" fields. No markdown, no code fences.`;
        const userPrompt = `Booking: ${context.pickup} → ${context.dropoff}, Date: ${context.date}, Time: ${context.time}, Vehicle: ${context.vehicle}, Passengers: ${context.passengers}, Payment: ${context.paymentMethod}, Total: ${context.totalPrice}`;
        const text = await callAi(systemPrompt, userPrompt, customKeys);
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          result = null;
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown feature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "no_api_key") {
      return new Response(JSON.stringify({ error: "No AI API key configured. Please ask an admin to add a Gemini or OpenAI key in Admin Settings → Integrations." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const status = message === "rate_limited" ? 429 : message === "payment_required" ? 402 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
