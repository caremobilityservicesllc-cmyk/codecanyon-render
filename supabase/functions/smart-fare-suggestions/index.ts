import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch admin-configured custom API keys from system_settings
async function getCustomAiConfig(): Promise<{ apiUrl: string; apiKey: string; model: string } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["ai_key_google_gemini", "ai_key_openai"]);

    if (data) {
      for (const s of data) {
        const val = s.value as any;
        if (s.key === "ai_key_google_gemini" && val?.apiKey) {
          return {
            apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            apiKey: val.apiKey,
            model: "gemini-2.5-flash",
          };
        }
        if (s.key === "ai_key_openai" && val?.apiKey) {
          return {
            apiUrl: "https://api.openai.com/v1/chat/completions",
            apiKey: val.apiKey,
            model: "gpt-4o-mini",
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface FareRequest {
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  routeDistanceKm: number;
  passengers: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { 
      pickupLocation, 
      dropoffLocation, 
      pickupDate, 
      pickupTime, 
      routeDistanceKm, 
      passengers 
    }: FareRequest = await req.json();

    // Fetch historical booking data for similar routes
    const { data: historicalBookings } = await supabase
      .from("bookings")
      .select("total_price, vehicle_name, pickup_time, pickup_date, passengers, status")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(100);

    // Fetch active vehicles with pricing
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, name, category, base_price, price_per_km, passengers, luggage")
      .eq("is_active", true)
      .order("base_price", { ascending: true });

    // Fetch time-based pricing rules
    const { data: pricingRules } = await supabase
      .from("pricing_rules")
      .select("name, rule_type, multiplier, flat_fee, start_time, end_time, days_of_week")
      .eq("is_active", true);

    // Analyze time patterns from historical data
    const timeHour = pickupTime ? parseInt(pickupTime.split(":")[0]) : 12;
    const dayOfWeek = pickupDate ? new Date(pickupDate).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() : "monday";
    
    // Determine if it's peak hours based on historical patterns
    const isPeakHour = (timeHour >= 7 && timeHour <= 9) || (timeHour >= 17 && timeHour <= 19);
    const isWeekend = dayOfWeek === "saturday" || dayOfWeek === "sunday";
    const isLateNight = timeHour >= 22 || timeHour <= 5;

    // Calculate average prices from historical data
    const avgHistoricalPrice = historicalBookings?.length 
      ? historicalBookings.reduce((sum, b) => sum + (b.total_price || 0), 0) / historicalBookings.length 
      : 0;

    // Find applicable time rules
    const applicableRules = pricingRules?.filter(rule => {
      if (rule.rule_type !== "time") return false;
      if (rule.days_of_week?.length && !rule.days_of_week.includes(dayOfWeek)) return false;
      if (rule.start_time && rule.end_time) {
        const [startH] = rule.start_time.split(":").map(Number);
        const [endH] = rule.end_time.split(":").map(Number);
        if (startH <= endH) {
          if (timeHour < startH || timeHour >= endH) return false;
        } else {
          if (timeHour < startH && timeHour >= endH) return false;
        }
      }
      return true;
    }) || [];

    // Build context for AI analysis
    const contextData = {
      route: { pickup: pickupLocation, dropoff: dropoffLocation, distanceKm: routeDistanceKm },
      timing: { date: pickupDate, time: pickupTime, dayOfWeek, isPeakHour, isWeekend, isLateNight },
      passengers,
      historicalInsights: {
        avgPrice: avgHistoricalPrice.toFixed(2),
        totalCompletedRides: historicalBookings?.length || 0,
        popularVehicles: getPopularVehicles(historicalBookings),
      },
      activeRules: applicableRules.map(r => ({ name: r.name, multiplier: r.multiplier })),
      availableVehicles: vehicles?.map(v => ({
        name: v.name,
        category: v.category,
        basePrice: v.base_price,
        pricePerKm: v.price_per_km,
        capacity: v.passengers,
        estimatedTotal: ((v.base_price || 0) + (routeDistanceKm * (v.price_per_km || 0))).toFixed(2),
      })),
    };

    // Use custom API key if configured, otherwise Lovable AI
    const customConfig = await getCustomAiConfig();
    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (customConfig) {
      apiUrl = customConfig.apiUrl;
      apiKey = customConfig.apiKey;
      model = customConfig.model;
    } else if (lovableApiKey) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = lovableApiKey;
      model = "google/gemini-3-flash-preview";
    } else {
      // Fallback to rule-based suggestions
      return new Response(JSON.stringify({
        suggestions: generateRuleBasedSuggestions(contextData, vehicles),
        insights: generateInsights(contextData),
        bestValue: findBestValue(vehicles, routeDistanceKm, passengers),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a smart fare advisor for a premium transportation service. Analyze booking data and provide personalized recommendations. Be concise and helpful. Always respond in valid JSON format.`,
          },
          {
            role: "user",
            content: `Analyze this booking request and provide smart fare suggestions:\n\n${JSON.stringify(contextData, null, 2)}\n\nRespond with a JSON object containing:\n1. "suggestions": Array of 3 fare suggestions with { title, description, savings (if any), recommended: boolean }\n2. "insights": Array of 2-3 brief insights about pricing/timing\n3. "bestValue": Object with { vehicleName, reason, estimatedPrice }\n4. "timingSuggestion": Optional suggestion for better timing if applicable`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      // Fallback to rule-based
      return new Response(JSON.stringify({
        suggestions: generateRuleBasedSuggestions(contextData, vehicles),
        insights: generateInsights(contextData),
        bestValue: findBestValue(vehicles, routeDistanceKm, passengers),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let parsedSuggestions;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedSuggestions = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response, using fallback");
      parsedSuggestions = {
        suggestions: generateRuleBasedSuggestions(contextData, vehicles),
        insights: generateInsights(contextData),
        bestValue: findBestValue(vehicles, routeDistanceKm, passengers),
      };
    }

    return new Response(JSON.stringify(parsedSuggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Smart fare suggestions error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestions: [],
      insights: ["Unable to generate suggestions at this time"],
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getPopularVehicles(bookings: any[] | null): string[] {
  if (!bookings?.length) return [];
  const counts: Record<string, number> = {};
  bookings.forEach(b => {
    counts[b.vehicle_name] = (counts[b.vehicle_name] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}

function generateRuleBasedSuggestions(context: any, vehicles: any[] | null): any[] {
  const suggestions = [];
  
  if (context.timing.isPeakHour) {
    suggestions.push({
      title: "Avoid Peak Pricing",
      description: `Consider booking 1-2 hours earlier or later to avoid peak hour surcharges`,
      savings: "Up to 20%",
      recommended: true,
    });
  }

  if (context.timing.isLateNight) {
    suggestions.push({
      title: "Late Night Rates Apply",
      description: "Late night bookings may have adjusted pricing. Book in advance for better rates.",
      recommended: false,
    });
  }

  const economyVehicle = vehicles?.find(v => v.category?.toLowerCase().includes("economy") || v.category?.toLowerCase().includes("standard"));
  if (economyVehicle && context.passengers <= economyVehicle.passengers) {
    suggestions.push({
      title: "Economy Option Available",
      description: `${economyVehicle.name} fits your party size at the best rate`,
      recommended: true,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: "Great Timing!",
      description: "You're booking during standard rates - no surcharges apply",
      recommended: true,
    });
  }

  return suggestions.slice(0, 3);
}

function generateInsights(context: any): string[] {
  const insights = [];
  
  if (context.historicalInsights.totalCompletedRides > 0) {
    insights.push(`Based on ${context.historicalInsights.totalCompletedRides} completed rides`);
  }
  
  if (context.timing.isPeakHour) {
    insights.push("Peak hours typically have 15-25% higher demand");
  } else if (context.timing.isLateNight) {
    insights.push("Late night rides ensure dedicated service availability");
  } else {
    insights.push("Standard pricing applies for your selected time");
  }

  if (context.activeRules.length > 0) {
    const ruleNames = context.activeRules.map((r: any) => r.name).join(", ");
    insights.push(`Active pricing rules: ${ruleNames}`);
  }

  return insights.slice(0, 3);
}

function findBestValue(vehicles: any[] | null, distance: number, passengers: number): any {
  if (!vehicles?.length) return null;
  
  const suitable = vehicles.filter(v => v.passengers >= passengers);
  if (!suitable.length) return null;

  const withPrices = suitable.map(v => ({
    ...v,
    total: (v.base_price || 0) + (distance * (v.price_per_km || 0)),
  }));

  const best = withPrices.sort((a, b) => a.total - b.total)[0];
  
  return {
    vehicleName: best.name,
    reason: `Best value for ${passengers} passenger${passengers > 1 ? "s" : ""} at $${best.total.toFixed(0)}`,
    estimatedPrice: best.total,
  };
}
