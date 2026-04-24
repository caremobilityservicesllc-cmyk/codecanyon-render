import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AiProviderConfig {
  provider: "lovable" | "google_gemini" | "openai";
  apiKey: string;
  endpoint: string;
  model: string;
}

async function resolveAiProvider(supabase: any, preferredProvider?: string): Promise<AiProviderConfig> {
  // Check for custom AI keys in system_settings
  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["ai_key_google_gemini", "ai_key_openai"]);

  let geminiKey: string | null = null;
  let openaiKey: string | null = null;

  if (settings) {
    for (const s of settings) {
      const val = s.value as any;
      if (s.key === "ai_key_google_gemini" && val?.apiKey) geminiKey = val.apiKey;
      if (s.key === "ai_key_openai" && val?.apiKey) openaiKey = val.apiKey;
    }
  }

  // If a preferred provider is specified and its key exists, use it
  if (preferredProvider === "openai" && openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
    };
  }
  if (preferredProvider === "google_gemini" && geminiKey) {
    return {
      provider: "google_gemini",
      apiKey: geminiKey,
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-2.5-flash",
    };
  }

  // Default priority: Google Gemini > OpenAI > Lovable AI gateway
  if (geminiKey) {
    return {
      provider: "google_gemini",
      apiKey: geminiKey,
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-2.5-flash",
    };
  }

  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
    };
  }

  // Fallback to Lovable AI gateway
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("No AI provider configured. Add a Google Gemini or OpenAI API key in Settings → Integrations, or ensure LOVABLE_API_KEY is available.");

  return {
    provider: "lovable",
    apiKey: lovableKey,
    endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: "google/gemini-2.5-flash",
  };
}

async function callAIWithRetry(config: AiProviderConfig, prompt: string, systemPrompt: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (response.status === 429) {
        await response.text();
        if (attempt < retries) {
          console.log(`Rate limited (${config.provider}), waiting ${5 * (attempt + 1)}s before retry ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        throw new Error("rate_limited");
      }

      if (response.status === 402) {
        await response.text();
        throw new Error("credits_exhausted");
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`AI error (${config.provider}):`, response.status, text);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`AI error (${config.provider}): ${response.status}`);
      }

      const aiData = await response.json();
      return aiData.choices?.[0]?.message?.content || "";
    } catch (err) {
      if (err instanceof Error && (err.message === "rate_limited" || err.message === "credits_exhausted")) {
        throw err;
      }
      if (attempt < retries) {
        console.log(`Attempt ${attempt + 1} failed (${config.provider}), retrying...`, err);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All retry attempts failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleCheck } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleCheck) throw new Error("Admin access required");

    const { targetLanguage, targetLanguageName, entries, preferredProvider } = await req.json();

    // Resolve which AI provider to use
    const aiConfig = await resolveAiProvider(supabase, preferredProvider);
    console.log(`Using AI provider: ${aiConfig.provider} (model: ${aiConfig.model})`);

    if (!targetLanguage || !entries || !Array.isArray(entries) || entries.length === 0) {
      throw new Error("Missing targetLanguage or entries");
    }

    const CHUNK_SIZE = 15;
    const allTranslated: { key: string; value: string }[] = [];
    let chunkErrors = 0;
    let consecutiveRateLimits = 0;

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      
      const keysPayload = chunk.map((e: { key: string; englishValue: string }) => 
        `"${e.key}": "${e.englishValue.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
      ).join(",\n");

      const prompt = `Translate the following UI text strings from English to ${targetLanguageName} (language code: ${targetLanguage}).
Return ONLY a valid JSON object with the same keys and translated values. Do not add explanations.
Preserve any placeholders like {count}, {name}, {ref}, {distance}, {pct}, {amount}, {time}, {eta}, etc. exactly as-is.
Keep translations concise and natural for a ride-booking/transport application UI.

{
${keysPayload}
}`;

      try {
        const content = await callAIWithRetry(
          aiConfig,
          prompt,
          "You are a professional translator for UI/UX text. Return only valid JSON.",
          3
        );
        
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1];
        
        const parsed = JSON.parse(jsonStr.trim());
        for (const entry of chunk) {
          const translated = parsed[entry.key];
          if (translated && typeof translated === "string") {
            allTranslated.push({ key: entry.key, value: translated });
          }
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message === "rate_limited") {
          consecutiveRateLimits++;
          if (consecutiveRateLimits >= 5) {
            console.log("Rate limited 5 times consecutively, returning partial results");
            break;
          }
          console.log(`Rate limited (${consecutiveRateLimits}/5), waiting ${8 * consecutiveRateLimits}s before next chunk...`);
          await new Promise(r => setTimeout(r, 8000 * consecutiveRateLimits));
          i -= CHUNK_SIZE;
          continue;
        }
        if (parseErr instanceof Error && parseErr.message === "credits_exhausted") {
          if (allTranslated.length > 0) {
            const rows = allTranslated.map((t) => ({
              language_code: targetLanguage,
              translation_key: t.key,
              translation_value: t.value,
            }));
            await supabase
              .from("translation_overrides")
              .upsert(rows, { onConflict: "language_code,translation_key" });
          }
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later.", translated: allTranslated.length }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("Failed to process chunk:", parseErr);
        chunkErrors++;
      }

      consecutiveRateLimits = 0;
      if (i + CHUNK_SIZE < entries.length) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    if (allTranslated.length > 0) {
      const rows = allTranslated.map((t) => ({
        language_code: targetLanguage,
        translation_key: t.key,
        translation_value: t.value,
      }));

      const { error: upsertError } = await supabase
        .from("translation_overrides")
        .upsert(rows, { onConflict: "language_code,translation_key" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error("Failed to save translations");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        translated: allTranslated.length, 
        total: entries.length,
        errors: chunkErrors,
        provider: aiConfig.provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate-batch error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "rate_limited" ? 429 : msg === "credits_exhausted" ? 402 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
