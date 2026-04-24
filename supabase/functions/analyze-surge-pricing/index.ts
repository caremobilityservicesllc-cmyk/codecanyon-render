import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SurgeRequest {
  pickupDate: string;
  pickupTime: string;
  routeDistanceKm?: number;
}

interface TimeSlot {
  time: string;
  multiplier: number;
  label: string;
  isSurge: boolean;
}

interface SurgeResponse {
  currentMultiplier: number;
  isSurge: boolean;
  surgeLevel: "none" | "low" | "moderate" | "high" | "extreme";
  surgePercentage: number;
  reason: string;
  optimalWindows: { startTime: string; endTime: string; savings: string; label: string }[];
  hourlyForecast: TimeSlot[];
  alertMessage?: string;
  expiresAt?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pickupDate, pickupTime, routeDistanceKm }: SurgeRequest = await req.json();

    if (!pickupDate || !pickupTime) {
      return new Response(
        JSON.stringify({ error: "pickupDate and pickupTime are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const date = new Date(pickupDate);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const [requestedHour, requestedMinute] = pickupTime.split(":").map(Number);

    // Fetch all active time-based pricing rules
    const { data: pricingRules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true)
      .eq("rule_type", "time");

    // Fetch historical booking patterns for demand analysis
    const { data: historicalBookings } = await supabase
      .from("bookings")
      .select("pickup_time, pickup_date, status")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(500);

    // Analyze demand patterns by hour
    const hourlyDemand: Record<number, number> = {};
    historicalBookings?.forEach((booking) => {
      const hour = parseInt(booking.pickup_time?.split(":")[0] || "0");
      hourlyDemand[hour] = (hourlyDemand[hour] || 0) + 1;
    });

    const avgDemand = Object.values(hourlyDemand).length > 0
      ? Object.values(hourlyDemand).reduce((a, b) => a + b, 0) / Object.values(hourlyDemand).length
      : 10;

    // Build hourly forecast for the day
    const hourlyForecast: TimeSlot[] = [];
    const optimalWindows: SurgeResponse["optimalWindows"] = [];

    for (let hour = 6; hour <= 22; hour++) {
      const timeStr = `${hour.toString().padStart(2, "0")}:00`;
      const timeMinutes = hour * 60;

      // Check which rules apply to this hour
      let multiplier = 1.0;
      let appliedRules: string[] = [];

      pricingRules?.forEach((rule) => {
        // Check day of week
        if (rule.days_of_week?.length && !rule.days_of_week.includes(dayOfWeek)) {
          return;
        }

        // Check time range
        if (rule.start_time && rule.end_time) {
          const [startH, startM] = rule.start_time.split(":").map(Number);
          const [endH, endM] = rule.end_time.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          // Handle overnight ranges
          let inRange = false;
          if (startMinutes > endMinutes) {
            inRange = timeMinutes >= startMinutes || timeMinutes < endMinutes;
          } else {
            inRange = timeMinutes >= startMinutes && timeMinutes < endMinutes;
          }

          if (inRange) {
            multiplier = Math.max(multiplier, rule.multiplier);
            appliedRules.push(rule.name);
          }
        }
      });

      // Add demand-based surge
      const demandMultiplier = hourlyDemand[hour] 
        ? Math.min(1.3, 1 + (hourlyDemand[hour] - avgDemand) / (avgDemand * 3))
        : 1.0;
      
      const finalMultiplier = Math.max(1, multiplier * demandMultiplier);
      const isSurge = finalMultiplier > 1.05;

      let label = "Standard";
      if (finalMultiplier >= 1.4) label = "Peak Demand";
      else if (finalMultiplier >= 1.2) label = "High Demand";
      else if (finalMultiplier >= 1.1) label = "Busy";
      else if (finalMultiplier < 0.95) label = "Off-Peak Savings";

      hourlyForecast.push({
        time: timeStr,
        multiplier: Math.round(finalMultiplier * 100) / 100,
        label,
        isSurge,
      });
    }

    // Find optimal windows (lowest multipliers)
    const sortedByMultiplier = [...hourlyForecast].sort((a, b) => a.multiplier - b.multiplier);
    const lowestMultiplier = sortedByMultiplier[0]?.multiplier || 1;

    // Group consecutive low-multiplier hours into windows
    let windowStart: string | null = null;
    let prevMultiplier = 999;

    hourlyForecast.forEach((slot, idx) => {
      const isLow = slot.multiplier <= lowestMultiplier * 1.05;
      
      if (isLow && !windowStart) {
        windowStart = slot.time;
      } else if (!isLow && windowStart) {
        const prevSlot = hourlyForecast[idx - 1];
        const savings = Math.round((1 - lowestMultiplier) * 100);
        optimalWindows.push({
          startTime: windowStart,
          endTime: prevSlot.time,
          savings: savings > 0 ? `Save ${savings}%` : "Best rates",
          label: "Recommended",
        });
        windowStart = null;
      }
    });

    // Close any open window
    if (windowStart) {
      const lastSlot = hourlyForecast[hourlyForecast.length - 1];
      optimalWindows.push({
        startTime: windowStart,
        endTime: lastSlot.time,
        savings: "Best rates",
        label: "Recommended",
      });
    }

    // Get current time's analysis
    const currentSlot = hourlyForecast.find((slot) => {
      const slotHour = parseInt(slot.time.split(":")[0]);
      return slotHour === requestedHour;
    }) || hourlyForecast[0];

    const currentMultiplier = currentSlot?.multiplier || 1;
    const surgePercentage = Math.round((currentMultiplier - 1) * 100);

    let surgeLevel: SurgeResponse["surgeLevel"] = "none";
    if (surgePercentage >= 40) surgeLevel = "extreme";
    else if (surgePercentage >= 25) surgeLevel = "high";
    else if (surgePercentage >= 15) surgeLevel = "moderate";
    else if (surgePercentage >= 5) surgeLevel = "low";

    // Generate alert message
    let alertMessage: string | undefined;
    let reason = "Standard pricing applies";

    if (surgeLevel !== "none") {
      const betterWindow = optimalWindows[0];
      reason = currentSlot?.label || "High demand period";
      
      if (betterWindow && surgePercentage >= 10) {
        alertMessage = `Prices are ${surgePercentage}% higher right now. Book between ${betterWindow.startTime}-${betterWindow.endTime} to save!`;
      } else if (surgePercentage >= 20) {
        alertMessage = `Peak pricing in effect (+${surgePercentage}%). Consider adjusting your pickup time.`;
      }
    }

    // Calculate when surge expires
    let expiresAt: string | undefined;
    if (surgeLevel !== "none") {
      const nextNonSurge = hourlyForecast.find((slot) => {
        const slotHour = parseInt(slot.time.split(":")[0]);
        return slotHour > requestedHour && !slot.isSurge;
      });
      if (nextNonSurge) {
        expiresAt = nextNonSurge.time;
      }
    }

    const response: SurgeResponse = {
      currentMultiplier,
      isSurge: surgeLevel !== "none",
      surgeLevel,
      surgePercentage,
      reason,
      optimalWindows: optimalWindows.slice(0, 3),
      hourlyForecast,
      alertMessage,
      expiresAt,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Surge pricing analysis error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        isSurge: false,
        surgeLevel: "none",
        currentMultiplier: 1,
        surgePercentage: 0,
        reason: "Unable to analyze pricing",
        optimalWindows: [],
        hourlyForecast: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
