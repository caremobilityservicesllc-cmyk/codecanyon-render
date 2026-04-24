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

interface ZoneDeployment {
  zoneId: string;
  zoneName: string;
  currentDrivers: number;
  recommendedDrivers: number;
  demandScore: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  action: 'maintain' | 'increase' | 'decrease' | 'urgent-increase';
  reasoning: string;
}

interface HourlyRecommendation {
  hour: number;
  displayTime: string;
  totalDemand: number;
  totalDriversNeeded: number;
  zones: ZoneDeployment[];
}

interface DeploymentResponse {
  generatedAt: string;
  forecastPeriod: { start: string; end: string };
  currentStatus: {
    totalDrivers: number;
    availableDrivers: number;
    activeRides: number;
    utilizationRate: number;
  };
  hourlyRecommendations: HourlyRecommendation[];
  immediateActions: { action: string; priority: 'high' | 'medium' | 'low'; zone?: string }[];
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
    const { data: zones } = await supabase
      .from("zones")
      .select("id, name, multiplier, is_active")
      .eq("is_active", true)
      .order("name");

    // Fetch drivers
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, first_name, last_name, is_active, is_available, current_location_lat, current_location_lng, average_rating")
      .eq("is_active", true);

    // Fetch active bookings (today and tomorrow)
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id, pickup_time, pickup_date, status, driver_id, pickup_location")
      .in("pickup_date", [today, tomorrow])
      .in("status", ["pending", "confirmed"]);

    // Fetch historical bookings for pattern analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalBookings } = await supabase
      .from("bookings")
      .select("pickup_time, pickup_date, status")
      .gte("pickup_date", thirtyDaysAgo.toISOString().split("T")[0])
      .eq("status", "completed");

    // Calculate current status
    const totalDrivers = drivers?.length || 0;
    const availableDrivers = drivers?.filter(d => d.is_available)?.length || 0;
    const activeRides = activeBookings?.filter(b => b.status === "confirmed" && b.driver_id)?.length || 0;
    const utilizationRate = totalDrivers > 0 ? Math.round((activeRides / totalDrivers) * 100) : 0;

    // Calculate hourly demand patterns
    const hourlyDemand: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyDemand[h] = 0;

    historicalBookings?.forEach(booking => {
      if (booking.pickup_time) {
        const hour = parseInt(booking.pickup_time.split(":")[0], 10);
        if (!isNaN(hour)) hourlyDemand[hour]++;
      }
    });

    const avgDailyBookings = (historicalBookings?.length || 1) / 30;
    const currentHour = new Date().getHours();
    const currentDayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const isWeekend = currentDayOfWeek === "saturday" || currentDayOfWeek === "sunday";

    // Generate hourly recommendations for next 12 hours
    const hourlyRecommendations: HourlyRecommendation[] = [];

    for (let i = 0; i < 12; i++) {
      const hour = (currentHour + i) % 24;
      const baseHourlyDemand = hourlyDemand[hour] / 30; // Average per day
      
      // Apply day-of-week and time modifiers
      let demandModifier = 1;
      if (isWeekend) demandModifier *= 0.85;
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) demandModifier *= 1.4; // Rush hours
      if (hour >= 22 || hour <= 5) demandModifier *= 0.5; // Night hours

      const adjustedDemand = Math.max(1, Math.round(baseHourlyDemand * demandModifier));
      
      // Calculate zone-specific deployments
      const zoneDeployments: ZoneDeployment[] = (zones || []).map((zone, idx) => {
        const zoneMultiplier = zone.multiplier || 1;
        const zoneDemand = Math.round(adjustedDemand * zoneMultiplier * (0.8 + Math.random() * 0.4));
        
        // Estimate drivers needed (1 driver can handle ~2-3 rides per hour avg)
        const ridesPerDriverPerHour = 2.5;
        const driversNeeded = Math.max(1, Math.ceil(zoneDemand / ridesPerDriverPerHour));
        
        // Simulate current allocation (distribute available drivers)
        const currentAllocation = Math.floor(availableDrivers / (zones?.length || 1));
        
        const gap = driversNeeded - currentAllocation;
        let urgency: ZoneDeployment['urgency'] = 'low';
        let action: ZoneDeployment['action'] = 'maintain';
        
        if (gap > 3) { urgency = 'critical'; action = 'urgent-increase'; }
        else if (gap > 1) { urgency = 'high'; action = 'increase'; }
        else if (gap > 0) { urgency = 'medium'; action = 'increase'; }
        else if (gap < -2) { urgency = 'low'; action = 'decrease'; }

        return {
          zoneId: zone.id,
          zoneName: zone.name,
          currentDrivers: currentAllocation,
          recommendedDrivers: driversNeeded,
          demandScore: Math.min(100, Math.round(zoneDemand * 10)),
          urgency,
          action,
          reasoning: gap > 0 
            ? `${gap} more driver${gap > 1 ? 's' : ''} needed to meet expected demand`
            : gap < 0 
              ? `${Math.abs(gap)} driver${Math.abs(gap) > 1 ? 's' : ''} can be reassigned`
              : 'Current allocation is optimal',
        };
      });

      const totalDriversNeeded = zoneDeployments.reduce((sum, z) => sum + z.recommendedDrivers, 0);

      hourlyRecommendations.push({
        hour,
        displayTime: `${hour.toString().padStart(2, "0")}:00`,
        totalDemand: adjustedDemand,
        totalDriversNeeded,
        zones: zoneDeployments,
      });
    }

    // Generate immediate actions
    const immediateActions: DeploymentResponse['immediateActions'] = [];
    const nextHour = hourlyRecommendations[0];
    
    if (nextHour) {
      const criticalZones = nextHour.zones.filter(z => z.urgency === 'critical');
      const highZones = nextHour.zones.filter(z => z.urgency === 'high');
      
      criticalZones.forEach(zone => {
        immediateActions.push({
          action: `Deploy ${zone.recommendedDrivers - zone.currentDrivers} additional drivers to ${zone.zoneName} immediately`,
          priority: 'high',
          zone: zone.zoneName,
        });
      });

      highZones.forEach(zone => {
        immediateActions.push({
          action: `Consider adding ${zone.recommendedDrivers - zone.currentDrivers} drivers to ${zone.zoneName} within the hour`,
          priority: 'medium',
          zone: zone.zoneName,
        });
      });

      if (utilizationRate > 85) {
        immediateActions.push({
          action: 'Driver utilization is high. Consider activating off-duty drivers.',
          priority: 'high',
        });
      }

      if (availableDrivers < 3) {
        immediateActions.push({
          action: 'Low driver availability. Send notifications to available drivers.',
          priority: 'high',
        });
      }
    }

    // Use AI for enhanced insights
    let insights: string[] = [];
    let modelConfidence = 0.75;

    {
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
        aiModel = "google/gemini-3-flash-preview";
      }

      if (aiApiUrl && aiApiKey && aiModel) {
      try {
        const summaryData = {
          currentHour,
          totalDrivers,
          availableDrivers,
          activeRides,
          utilizationRate,
          upcomingDemand: hourlyRecommendations.slice(0, 3).map(h => ({ hour: h.hour, demand: h.totalDemand })),
          zoneCount: zones?.length || 0,
          isWeekend,
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
                content: "You are a fleet management analyst. Provide brief, actionable driver deployment recommendations.",
              },
              {
                role: "user",
                content: `Analyze this driver deployment data and provide 3 brief insights:
                
Current Status:
- Time: ${currentHour}:00, ${currentDayOfWeek}
- Drivers: ${totalDrivers} total, ${availableDrivers} available
- Active rides: ${activeRides}
- Utilization: ${utilizationRate}%
- Zones: ${summaryData.zoneCount}

Upcoming demand (next 3 hours): ${JSON.stringify(summaryData.upcomingDemand)}

Return JSON: { "insights": ["insight1", "insight2", "insight3"], "confidence": 0.8 }`,
              },
            ],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.insights)) insights = parsed.insights;
              if (typeof parsed.confidence === "number") modelConfidence = Math.min(0.95, parsed.confidence);
            } catch { insights = [content.slice(0, 200)]; }
          }
        }
      } catch (e) {
        console.error("AI analysis error:", e);
      }
      }
    }

    // Default insights if AI didn't provide any
    if (insights.length === 0) {
      insights = [
        `Current driver utilization is ${utilizationRate}% - ${utilizationRate > 70 ? 'consider adding capacity' : 'operating efficiently'}`,
        `Peak demand expected at ${hourlyRecommendations.sort((a, b) => b.totalDemand - a.totalDemand)[0]?.displayTime || 'N/A'}`,
        `${availableDrivers} of ${totalDrivers} drivers currently available for dispatch`,
      ];
    }

    const now = new Date();
    const response: DeploymentResponse = {
      generatedAt: now.toISOString(),
      forecastPeriod: {
        start: now.toISOString(),
        end: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      },
      currentStatus: {
        totalDrivers,
        availableDrivers,
        activeRides,
        utilizationRate,
      },
      hourlyRecommendations,
      immediateActions: immediateActions.slice(0, 5),
      insights,
      modelConfidence,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Driver deployment prediction error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        generatedAt: new Date().toISOString(),
        currentStatus: { totalDrivers: 0, availableDrivers: 0, activeRides: 0, utilizationRate: 0 },
        hourlyRecommendations: [],
        immediateActions: [],
        insights: ["Unable to generate predictions"],
        modelConfidence: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
