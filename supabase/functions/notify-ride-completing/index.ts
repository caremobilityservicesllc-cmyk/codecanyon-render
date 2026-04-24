import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification cooldown in minutes to prevent duplicates
const NOTIFICATION_COOLDOWN_MINUTES = 30;
// Minutes before completion to send notification
const NOTIFY_BEFORE_MINUTES = 5;

interface RouteEstimate {
  durationMinutes: number;
}

// Geocode an address using Nominatim
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

// Get route estimate using OSRM
async function getRouteEstimate(
  origin: string,
  destination: string
): Promise<RouteEstimate | null> {
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);

    if (!originCoords || !destCoords) return null;

    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "Ok" && data.routes?.[0]) {
      return {
        durationMinutes: Math.ceil(data.routes[0].duration / 60),
      };
    }
  } catch (error) {
    console.error('Error fetching route estimate:', error);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all in-progress rides
    const { data: inProgressRides, error: ridesError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        user_id,
        pickup_location,
        dropoff_location,
        ride_started_at,
        driver_id
      `)
      .eq('status', 'confirmed')
      .not('ride_started_at', 'is', null)
      .is('ride_completed_at', null)
      .not('user_id', 'is', null);

    if (ridesError) {
      console.error('Error fetching in-progress rides:', ridesError);
      throw ridesError;
    }

    if (!inProgressRides || inProgressRides.length === 0) {
      console.log('No in-progress rides to check');
      return new Response(
        JSON.stringify({ message: 'No in-progress rides', checked: 0, notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${inProgressRides.length} in-progress rides`);

    const cooldownTime = new Date(Date.now() - NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000).toISOString();
    
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('booking_id')
      .eq('type', 'ride_completed')
      .gte('created_at', cooldownTime);

    const recentlyNotifiedBookingIds = new Set(
      recentNotifications?.map(n => n.booking_id) || []
    );

    let notifiedCount = 0;

    for (const ride of inProgressRides) {
      if (recentlyNotifiedBookingIds.has(ride.id)) {
        console.log(`Skipping ${ride.booking_reference} - recently notified`);
        continue;
      }

      const startTime = new Date(ride.ride_started_at).getTime();
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 1000 / 60);

      let estimatedTotalMinutes: number | null = null;

      const estimate = await getRouteEstimate(
        ride.pickup_location,
        ride.dropoff_location
      );
      if (estimate) {
        estimatedTotalMinutes = estimate.durationMinutes;
      }

      // Default to 30 minutes if no estimate available
      if (!estimatedTotalMinutes) {
        estimatedTotalMinutes = 30;
      }

      const remainingMinutes = estimatedTotalMinutes - elapsedMinutes;

      console.log(`Ride ${ride.booking_reference}: elapsed=${elapsedMinutes}m, estimated=${estimatedTotalMinutes}m, remaining=${remainingMinutes}m`);

      if (remainingMinutes <= NOTIFY_BEFORE_MINUTES && remainingMinutes >= 0) {
        console.log(`Sending completion notification for ${ride.booking_reference}`);

        try {
          const notificationResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-push-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                userId: ride.user_id,
                title: '🚗 Arriving Soon!',
                body: `Your ride ${ride.booking_reference} is about to arrive at the destination in approximately ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
                data: {
                  bookingId: ride.id,
                  type: 'ride_completing',
                },
              }),
            }
          );

          if (notificationResponse.ok) {
            notifiedCount++;

            await supabase.from('notifications').insert({
              user_id: ride.user_id,
              booking_id: ride.id,
              title: 'Arriving Soon!',
              message: `Your ride is about to arrive at the destination.`,
              type: 'ride_completed',
              channel: 'push',
            });
          } else {
            console.error(`Failed to send notification for ${ride.booking_reference}`);
          }
        } catch (err) {
          console.error('Error sending notification:', err);
        }
      }
    }

    console.log(`Checked ${inProgressRides.length} rides, sent ${notifiedCount} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: inProgressRides.length, 
        notified: notifiedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-ride-completing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});