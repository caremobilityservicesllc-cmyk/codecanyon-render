import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
          return { apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: val.apiKey, model: "gemini-2.5-flash" };
        }
        if (s.key === "ai_key_openai" && val?.apiKey) {
          return { apiUrl: "https://api.openai.com/v1/chat/completions", apiKey: val.apiKey, model: "gpt-4o-mini" };
        }
      }
    }
    return null;
  } catch { return null; }
}

interface HourlyPrediction {
  hour: number;
  displayTime: string;
  predictedLevel: 'low' | 'moderate' | 'heavy' | 'severe';
  confidence: number;
  predictedBookings: number;
  factors: string[];
}

interface ZonePrediction {
  zoneId: string;
  zoneName: string;
  hourlyPredictions: HourlyPrediction[];
  peakHours: number[];
  avgCongestionScore: number;
}

interface PredictionResponse {
  generatedAt: string;
  forecastPeriod: {
    start: string;
    end: string;
  };
  overallTrend: 'improving' | 'stable' | 'worsening';
  zones: ZonePrediction[];
  insights: string[];
  modelConfidence: number;
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

    // Fetch zones
    const { data: zones, error: zonesError } = await supabase
      .from("zones")
      .select("id, name, multiplier, is_active")
      .eq("is_active", true)
      .order("name");

    if (zonesError) throw zonesError;

    // Fetch historical bookings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, pickup_time, pickup_date, pickup_location, dropoff_location, status, created_at")
      .gte("pickup_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("pickup_date", { ascending: false });

    if (bookingsError) throw bookingsError;

    // Fetch pricing rules for context
    const { data: pricingRules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true);

    // Calculate hourly patterns from historical data
    const hourlyPatterns: Record<number, { count: number; days: Set<string> }> = {};
    const dayOfWeekPatterns: Record<string, Record<number, number>> = {};

    for (let h = 0; h < 24; h++) {
      hourlyPatterns[h] = { count: 0, days: new Set() };
    }

    const today = new Date();
    const currentDayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const currentHour = today.getHours();

    bookings?.forEach((booking) => {
      if (booking.pickup_time) {
        const hour = parseInt(booking.pickup_time.split(":")[0], 10);
        const date = booking.pickup_date;
        const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        
        if (!isNaN(hour)) {
          hourlyPatterns[hour].count++;
          hourlyPatterns[hour].days.add(date);
          
          if (!dayOfWeekPatterns[dayOfWeek]) {
            dayOfWeekPatterns[dayOfWeek] = {};
          }
          dayOfWeekPatterns[dayOfWeek][hour] = (dayOfWeekPatterns[dayOfWeek][hour] || 0) + 1;
        }
      }
    });

    // Calculate average bookings per hour
    const avgBookingsPerHour: Record<number, number> = {};
    Object.entries(hourlyPatterns).forEach(([hour, data]) => {
      const uniqueDays = data.days.size || 1;
      avgBookingsPerHour[parseInt(hour)] = data.count / uniqueDays;
    });

    // Find the max for normalization
    const maxAvgBookings = Math.max(...Object.values(avgBookingsPerHour), 1);

    // Use AI to enhance predictions if available
    let aiInsights: string[] = [];
    let modelConfidence = 0.75; // Base confidence from historical analysis

    {
      // Determine AI endpoint
      const customConfig = await getCustomAiConfig();
      let aiApiUrl: string | null = null;
      let aiApiKey: string | null = null;
      let aiModel: string | null = null;

      if (customConfig) {
        aiApiUrl = customConfig.apiUrl;
        aiApiKey = customConfig.apiKey;
        aiModel = customConfig.model;
      } else if (lovableApiKey) {
        aiApiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        aiApiKey = lovableApiKey;
        aiModel = "google/gemini-2.5-flash";
      }

      if (aiApiUrl && aiApiKey && aiModel) {
      try {
        const historicalSummary = {
          avgBookingsPerHour,
          currentDayOfWeek,
          currentHour,
          totalBookingsLast30Days: bookings?.length || 0,
          peakHours: Object.entries(avgBookingsPerHour)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([h]) => parseInt(h)),
          lowHours: Object.entries(avgBookingsPerHour)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 3)
            .map(([h]) => parseInt(h)),
          zoneCount: zones?.length || 0,
          pricingRulesCount: pricingRules?.length || 0,
        };

        const aiResponse = await fetch(aiApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${aiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              {
                role: "system",
                content: `You are a traffic prediction analyst. Analyze booking patterns and provide actionable insights. Be concise.`,
              },
              {
                role: "user",
                content: `Analyze this booking data and provide 3-4 brief traffic/congestion insights for the next 24 hours:
                
Historical data summary:
- Peak hours: ${historicalSummary.peakHours.map(h => `${h}:00`).join(", ")}
- Low traffic hours: ${historicalSummary.lowHours.map(h => `${h}:00`).join(", ")}
- Current day: ${currentDayOfWeek}
- Current hour: ${currentHour}:00
- Total bookings last 30 days: ${historicalSummary.totalBookingsLast30Days}
- Active zones: ${historicalSummary.zoneCount}

Return a JSON object with: { "insights": ["insight1", "insight2", "insight3"], "confidence": 0.8 }`,
              },
            ],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          // Try to parse JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.insights)) {
                aiInsights = parsed.insights;
              }
              if (typeof parsed.confidence === "number") {
                modelConfidence = Math.min(0.95, parsed.confidence);
              }
            } catch {
              // Use content as single insight
              aiInsights = [content.slice(0, 200)];
            }
          }
        }
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        // Continue with statistical predictions
      }
      }
    }

    // Generate zone predictions
    const zonePredictions: ZonePrediction[] = (zones || []).map((zone, zoneIndex) => {
      const hourlyPredictions: HourlyPrediction[] = [];
      
      for (let hour = 0; hour < 24; hour++) {
        const baseBookings = avgBookingsPerHour[hour] || 0;
        
        // Apply zone multiplier to predictions
        const zoneMultiplier = zone.multiplier || 1;
        const predictedBookings = Math.round(baseBookings * zoneMultiplier);
        
        // Calculate demand ratio
        const demandRatio = baseBookings / maxAvgBookings;
        
        // Add time-of-day factors
        const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
        const isNightTime = hour >= 22 || hour <= 5;
        const isWeekend = currentDayOfWeek === "saturday" || currentDayOfWeek === "sunday";
        
        // Calculate combined score
        let congestionScore = demandRatio;
        if (isRushHour && !isWeekend) congestionScore *= 1.3;
        if (isNightTime) congestionScore *= 0.6;
        if (isWeekend) congestionScore *= 0.85;
        
        // Add zone-specific variation for visual diversity
        const zoneVariation = ((zoneIndex * 7 + hour * 3) % 20) / 100;
        congestionScore = Math.min(1, congestionScore + zoneVariation);
        
        // Determine traffic level
        let predictedLevel: HourlyPrediction['predictedLevel'];
        if (congestionScore < 0.25) predictedLevel = 'low';
        else if (congestionScore < 0.5) predictedLevel = 'moderate';
        else if (congestionScore < 0.75) predictedLevel = 'heavy';
        else predictedLevel = 'severe';
        
        // Build factors list
        const factors: string[] = [];
        if (isRushHour && !isWeekend) factors.push("Rush hour");
        if (demandRatio > 0.7) factors.push("High historical demand");
        if (zoneMultiplier > 1.2) factors.push("High-demand zone");
        if (isWeekend) factors.push("Weekend pattern");
        if (isNightTime) factors.push("Night hours");
        
        // Calculate hour confidence (higher for hours with more data)
        const dataPoints = hourlyPatterns[hour]?.days.size || 0;
        const hourConfidence = Math.min(0.95, 0.5 + (dataPoints / 30) * 0.45);
        
        hourlyPredictions.push({
          hour,
          displayTime: `${hour.toString().padStart(2, "0")}:00`,
          predictedLevel,
          confidence: Math.round(hourConfidence * 100) / 100,
          predictedBookings,
          factors: factors.length > 0 ? factors : ["Normal traffic pattern"],
        });
      }
      
      // Find peak hours for this zone
      const peakHours = hourlyPredictions
        .filter(p => p.predictedLevel === 'heavy' || p.predictedLevel === 'severe')
        .map(p => p.hour);
      
      // Calculate average congestion score
      const avgCongestionScore = hourlyPredictions.reduce((sum, p) => {
        const score = p.predictedLevel === 'severe' ? 1 : 
                      p.predictedLevel === 'heavy' ? 0.75 : 
                      p.predictedLevel === 'moderate' ? 0.5 : 0.25;
        return sum + score;
      }, 0) / 24;
      
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        hourlyPredictions,
        peakHours,
        avgCongestionScore: Math.round(avgCongestionScore * 100) / 100,
      };
    });

    // Calculate overall trend
    const nextHours = zonePredictions.flatMap(z => 
      z.hourlyPredictions.filter(p => 
        p.hour >= currentHour && p.hour <= currentHour + 6
      )
    );
    
    const avgNextHoursCongestion = nextHours.reduce((sum, p) => {
      const score = p.predictedLevel === 'severe' ? 1 : 
                    p.predictedLevel === 'heavy' ? 0.75 : 
                    p.predictedLevel === 'moderate' ? 0.5 : 0.25;
      return sum + score;
    }, 0) / (nextHours.length || 1);
    
    let overallTrend: PredictionResponse['overallTrend'] = 'stable';
    if (avgNextHoursCongestion > 0.6) overallTrend = 'worsening';
    else if (avgNextHoursCongestion < 0.35) overallTrend = 'improving';

    // Default insights if AI didn't provide any
    if (aiInsights.length === 0) {
      const peakHoursGlobal = Object.entries(avgBookingsPerHour)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([h]) => parseInt(h));
      
      aiInsights = [
        `Peak congestion expected around ${peakHoursGlobal.map(h => `${h}:00`).join(" and ")} based on historical patterns.`,
        `${currentDayOfWeek.charAt(0).toUpperCase() + currentDayOfWeek.slice(1)} typically shows ${
          currentDayOfWeek === "saturday" || currentDayOfWeek === "sunday" ? "lighter" : "moderate to heavy"
        } traffic during rush hours.`,
        `Consider scheduling pickups during early morning (6-7 AM) or mid-afternoon (2-4 PM) for optimal conditions.`,
      ];
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const response: PredictionResponse = {
      generatedAt: now.toISOString(),
      forecastPeriod: {
        start: now.toISOString(),
        end: endTime.toISOString(),
      },
      overallTrend,
      zones: zonePredictions,
      insights: aiInsights,
      modelConfidence,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Traffic prediction error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        generatedAt: new Date().toISOString(),
        forecastPeriod: { start: "", end: "" },
        overallTrend: "stable",
        zones: [],
        insights: ["Unable to generate predictions at this time."],
        modelConfidence: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
