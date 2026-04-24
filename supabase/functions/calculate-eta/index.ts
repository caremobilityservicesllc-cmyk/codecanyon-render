import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ETARequest {
  bookingId: string;
  driverLat: number;
  driverLng: number;
  destinationAddress: string;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RideFlow/1.0', 'Accept-Language': 'en' },
  });
  const data = await res.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, driverLat, driverLng, destinationAddress }: ETARequest = await req.json();

    if (!bookingId || !driverLat || !driverLng || !destinationAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Geocode the destination address to coordinates
    const destCoords = await geocodeAddress(destinationAddress);

    if (!destCoords) {
      return new Response(
        JSON.stringify({ error: 'Could not geocode destination address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use OSRM (free, open-source) for route calculation
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destCoords.lng},${destCoords.lat}?overview=false`;

    const response = await fetch(osrmUrl, {
      headers: { 'User-Agent': 'RideFlow/1.0' },
    });
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      console.error('OSRM error:', data.code, data.message);
      return new Response(
        JSON.stringify({ error: 'Could not calculate route', details: data.message || data.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    const durationSeconds = Math.round(route.duration);
    const distanceMeters = Math.round(route.distance);

    // Format duration text
    const minutes = Math.round(durationSeconds / 60);
    const durationText = minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;

    // Format distance text
    const distanceKm = distanceMeters / 1000;
    const distanceText = distanceKm >= 1
      ? `${distanceKm.toFixed(1)} km`
      : `${distanceMeters} m`;

    // Calculate ETA
    const etaTimestamp = new Date(Date.now() + durationSeconds * 1000);
    const etaFormatted = etaTimestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Update booking with new ETA
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        estimated_arrival: etaFormatted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Failed to update booking ETA:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        eta: {
          timestamp: etaTimestamp.toISOString(),
          formatted: etaFormatted,
          durationSeconds,
          durationText,
          distanceMeters,
          distanceText,
          hasTrafficData: false,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ETA calculation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
