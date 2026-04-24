

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrafficRequest {
  origin: string;
  destination: string;
  departureTime?: string;
}

interface TrafficResponse {
  durationWithTraffic: number;
  durationWithoutTraffic: number;
  trafficDelay: number;
  trafficLevel: "low" | "moderate" | "heavy" | "severe";
  trafficMultiplier: number;
  congestionDescription: string;
  bestDepartureWindow?: string;
}

// Geocode an address to coordinates using Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "en");

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "RideFlow/1.0" },
    });
    const data = await response.json();

    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.error("Geocode error:", err);
  }
  return null;
}

// Get route duration from OSRM
async function getOSRMRoute(
  originCoords: { lat: number; lon: number },
  destCoords: { lat: number; lon: number }
): Promise<{ durationSeconds: number; distanceMeters: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "Ok" && data.routes?.[0]) {
      return {
        durationSeconds: data.routes[0].duration,
        distanceMeters: data.routes[0].distance,
      };
    }
  } catch (err) {
    console.error("OSRM error:", err);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination }: TrafficRequest = await req.json();

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: "Origin and destination are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Geocode both addresses
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);

    if (!originCoords || !destCoords) {
      return new Response(
        JSON.stringify({
          error: "Could not geocode addresses",
          trafficLevel: "unknown",
          trafficMultiplier: 1.0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get route from OSRM
    const route = await getOSRMRoute(originCoords, destCoords);

    if (!route) {
      return new Response(
        JSON.stringify({
          error: "Could not calculate route",
          trafficLevel: "unknown",
          trafficMultiplier: 1.0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // OSRM doesn't provide real-time traffic data, so we estimate based on
    // time of day and day of week as a heuristic
    const now = new Date();
    const hour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    let trafficMultiplier = 1.0;
    let trafficLevel: TrafficResponse["trafficLevel"] = "low";
    let congestionDescription = "Traffic is flowing smoothly";

    if (isWeekday) {
      // Morning rush: 7-9 AM
      if (hour >= 7 && hour <= 9) {
        trafficMultiplier = 1.35;
        trafficLevel = "heavy";
        congestionDescription = "Morning rush hour — expect delays";
      }
      // Evening rush: 16-19
      else if (hour >= 16 && hour <= 19) {
        trafficMultiplier = 1.4;
        trafficLevel = "heavy";
        congestionDescription = "Evening rush hour — expect delays";
      }
      // Midday moderate
      else if (hour >= 11 && hour <= 14) {
        trafficMultiplier = 1.15;
        trafficLevel = "moderate";
        congestionDescription = "Light traffic, minor delays expected";
      }
    } else {
      // Weekend midday
      if (hour >= 10 && hour <= 16) {
        trafficMultiplier = 1.1;
        trafficLevel = "moderate";
        congestionDescription = "Light weekend traffic";
      }
    }

    const durationWithoutTraffic = route.durationSeconds;
    const durationWithTraffic = Math.round(durationWithoutTraffic * trafficMultiplier);
    const trafficDelay = durationWithTraffic - durationWithoutTraffic;

    let bestDepartureWindow: string | undefined;
    if (trafficLevel === "heavy") {
      if (hour >= 7 && hour <= 9) {
        bestDepartureWindow = "Consider departing before 7 AM or after 10 AM";
      } else if (hour >= 16 && hour <= 19) {
        bestDepartureWindow = "Consider departing before 4 PM or after 8 PM";
      }
    }

    const trafficResponse: TrafficResponse = {
      durationWithTraffic,
      durationWithoutTraffic,
      trafficDelay,
      trafficLevel,
      trafficMultiplier: Math.round(trafficMultiplier * 100) / 100,
      congestionDescription,
      bestDepartureWindow,
    };

    return new Response(JSON.stringify(trafficResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Traffic data error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        trafficLevel: "unknown",
        trafficMultiplier: 1.0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});