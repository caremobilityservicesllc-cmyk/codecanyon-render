import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(appName: string) {
  return `You are ${appName} AI, a helpful booking assistant for a premium transportation service. You help users:

1. **Book rides** - Ask for pickup location, dropoff location, date, time, and number of passengers
2. **Get fare estimates** - Provide rough estimates based on distance (base fare $15 + $2.50/km)
3. **Answer questions** - About service hours (6AM-10PM), vehicle types (Sedan, SUV, Van, Luxury), payment methods (Card, PayPal, Bank Transfer)
4. **Provide smart suggestions** - Recommend vehicle types based on passenger count and luggage needs

When helping with bookings:
- Always confirm all details before suggesting they complete the booking
- If they mention airports, suggest adding flight numbers for tracking
- Recommend SUV for 4+ passengers or lots of luggage
- Recommend Van for 6+ passengers
- Luxury vehicles are great for special occasions

Keep responses friendly, concise, and helpful. Use emojis sparingly for a modern feel.
If users want to complete a booking, direct them to click "Book Now" on the main page with their details.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

async function getAppName(): Promise<string> {
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

    const name = (data?.value as any)?.companyName;
    return name || "RideFlow";
  } catch {
    return "RideFlow";
  }
}

async function trackAiUsage(model: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const provider = model.startsWith("openai/") ? "openai" : model.startsWith("google/") ? "gemini" : "lovable_ai";

    await supabase.rpc("increment_map_api_usage", {
      p_provider: provider,
      p_api_type: "chat_completion",
      p_count: 1,
    });
  } catch (err) {
    console.error("Failed to track AI usage:", err);
  }
}

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
        if (s.key === "ai_key_google_gemini" && val?.apiKey) {
          keys.google_gemini = val.apiKey;
        }
        if (s.key === "ai_key_openai" && val?.apiKey) {
          keys.openai = val.apiKey;
        }
      }
    }
    return keys;
  } catch (err) {
    console.error("Failed to fetch custom AI keys:", err);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();

    // Check for admin-configured custom keys
    const customKeys = await getCustomAiKeys();

    const appName = await getAppName();
    let enhancedPrompt = buildSystemPrompt(appName);
    if (context?.currentBooking) {
      enhancedPrompt += `\n\nUser's current booking details:\n${JSON.stringify(context.currentBooking, null, 2)}`;
    }

    // Build ordered list of providers to try (fallback chain)
    const providers: Array<{ apiUrl: string; apiKey: string; model: string; name: string }> = [];

    if (customKeys.google_gemini) {
      providers.push({
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: customKeys.google_gemini,
        model: "gemini-2.5-flash",
        name: "Google Gemini",
      });
    }
    if (customKeys.openai) {
      providers.push({
        apiUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: customKeys.openai,
        model: "gpt-4o-mini",
        name: "OpenAI",
      });
    }
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      providers.push({
        apiUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
        apiKey: lovableKey,
        model: "google/gemini-3-flash-preview",
        name: "Lovable AI",
      });
    }

    if (providers.length === 0) {
      return new Response(JSON.stringify({ error: "No AI API key configured. Please ask an admin to add a Gemini or OpenAI key in Admin Settings → Integrations." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatMessages = [
      { role: "system", content: enhancedPrompt },
      ...messages,
    ];

    // Try each provider with retries, fall back to next on persistent 429
    let lastResponse: Response | null = null;
    let usedModel = "";

    for (const provider of providers) {
      console.log(`Trying provider: ${provider.name}`);
      const body = JSON.stringify({ model: provider.model, messages: chatMessages, stream: true });

      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        lastResponse = await fetch(provider.apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        });

        if (lastResponse.ok) {
          usedModel = provider.model;
          success = true;
          break;
        }

        if (lastResponse.status !== 429) break; // non-retryable error, try next provider

        await lastResponse.text(); // consume body
        const delay = (attempt + 1) * 2000 + Math.random() * 1000;
        console.log(`${provider.name} rate limited, retry ${attempt + 1}/3 in ${Math.round(delay / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      if (success) break;
      console.log(`${provider.name} failed, trying next provider...`);
    }

    if (!lastResponse || !lastResponse.ok) {
      const status = lastResponse?.status ?? 500;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "All AI providers are busy right now. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = lastResponse ? await lastResponse.text() : "No response";
      console.error("All AI providers failed:", status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    trackAiUsage(usedModel);

    return new Response(lastResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
