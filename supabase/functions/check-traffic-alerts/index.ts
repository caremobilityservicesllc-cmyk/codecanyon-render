import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingWithTraffic {
  id: string;
  user_id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
}

interface TrafficData {
  trafficLevel: 'low' | 'moderate' | 'heavy' | 'severe';
  trafficDelay: number;
  trafficMultiplier: number;
  congestionDescription: string;
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

// Get route duration via OSRM and estimate traffic based on time of day
async function getTrafficConditions(
  origin: string,
  destination: string
): Promise<TrafficData | null> {
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);

    if (!originCoords || !destCoords) return null;

    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const durationWithoutTraffic = data.routes[0].duration;

    // Estimate traffic based on time of day
    const now = new Date();
    const hour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    let trafficMultiplier = 1.0;
    let trafficLevel: TrafficData['trafficLevel'] = 'low';
    let congestionDescription = 'Traffic is flowing smoothly';

    if (isWeekday) {
      if (hour >= 7 && hour <= 9) {
        trafficMultiplier = 1.35;
        trafficLevel = 'heavy';
        congestionDescription = 'Morning rush hour — expect delays';
      } else if (hour >= 16 && hour <= 19) {
        trafficMultiplier = 1.4;
        trafficLevel = 'heavy';
        congestionDescription = 'Evening rush hour — expect delays';
      } else if (hour >= 11 && hour <= 14) {
        trafficMultiplier = 1.15;
        trafficLevel = 'moderate';
        congestionDescription = 'Light traffic, minor delays expected';
      }
    } else {
      if (hour >= 10 && hour <= 16) {
        trafficMultiplier = 1.1;
        trafficLevel = 'moderate';
        congestionDescription = 'Light weekend traffic';
      }
    }

    const durationWithTraffic = Math.round(durationWithoutTraffic * trafficMultiplier);
    const trafficDelay = durationWithTraffic - durationWithoutTraffic;

    return {
      trafficLevel,
      trafficDelay,
      trafficMultiplier: Math.round(trafficMultiplier * 100) / 100,
      congestionDescription,
    };
  } catch (error) {
    console.error('Error fetching traffic data:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get upcoming confirmed bookings (within next 2 hours)
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, pickup_location, dropoff_location, pickup_date, pickup_time, status')
      .eq('status', 'confirmed')
      .eq('pickup_date', today)
      .order('pickup_time', { ascending: true });

    if (bookingsError) {
      throw bookingsError;
    }

    console.log(`Found ${upcomingBookings?.length || 0} confirmed bookings for today`);

    const alertsSent: string[] = [];
    const bookingsToCheck = upcomingBookings?.filter((booking: BookingWithTraffic) => {
      const [hours, minutes] = booking.pickup_time.split(':').map(Number);
      const pickupTime = new Date(now);
      pickupTime.setHours(hours, minutes, 0, 0);
      
      const timeUntilPickup = pickupTime.getTime() - now.getTime();
      const minutesUntilPickup = timeUntilPickup / (1000 * 60);
      
      return minutesUntilPickup >= 30 && minutesUntilPickup <= 120;
    }) || [];

    console.log(`Checking traffic for ${bookingsToCheck.length} upcoming bookings`);

    for (const booking of bookingsToCheck) {
      // Check if we already sent a traffic alert recently
      const { data: recentAlerts } = await supabase
        .from('notifications')
        .select('id')
        .eq('booking_id', booking.id)
        .eq('type', 'reminder')
        .like('message', '%traffic%')
        .gte('created_at', new Date(now.getTime() - 30 * 60 * 1000).toISOString());

      if (recentAlerts && recentAlerts.length > 0) {
        console.log(`Skipping ${booking.booking_reference} - alert sent recently`);
        continue;
      }

      const trafficData = await getTrafficConditions(
        booking.pickup_location,
        booking.dropoff_location
      );

      if (!trafficData) {
        console.log(`Could not get traffic data for ${booking.booking_reference}`);
        continue;
      }

      if (trafficData.trafficLevel === 'heavy' || trafficData.trafficLevel === 'severe') {
        const delayMinutes = Math.round(trafficData.trafficDelay / 60);
        
        const title = trafficData.trafficLevel === 'severe' 
          ? '🚨 Severe Traffic Alert!'
          : '⚠️ Heavy Traffic Alert';
        
        const body = `Traffic on your route for booking ${booking.booking_reference} has worsened. ` +
          `Expected delay: +${delayMinutes} min. ${trafficData.congestionDescription}. ` +
          `Consider leaving ${Math.max(15, delayMinutes)} minutes earlier.`;

        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('push_enabled, sms_ride_updates')
          .eq('user_id', booking.user_id)
          .single();

        if (prefs?.push_enabled !== false) {
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: booking.user_id,
                title,
                body,
                data: {
                  type: 'traffic_alert',
                  bookingId: booking.id,
                  bookingReference: booking.booking_reference,
                  trafficLevel: trafficData.trafficLevel,
                  delayMinutes,
                },
              },
            });
            console.log(`Push alert sent for ${booking.booking_reference}`);
          } catch (err) {
            console.error(`Failed to send push for ${booking.booking_reference}:`, err);
          }
        }

        if (prefs?.sms_ride_updates !== false) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', booking.user_id)
            .single();

          if (profile?.phone) {
            try {
              await supabase.functions.invoke('send-sms', {
                body: {
                  phoneNumber: profile.phone,
                  type: 'traffic_alert',
                  data: {
                    bookingReference: booking.booking_reference,
                    delayMinutes,
                    trafficLevel: trafficData.trafficLevel,
                    customMessage: `Traffic Alert: Heavy traffic on your route for ${booking.booking_reference}. Expected +${delayMinutes}min delay. Leave early!`,
                  },
                },
              });
              console.log(`SMS alert sent for ${booking.booking_reference}`);
            } catch (err) {
              console.error(`Failed to send SMS for ${booking.booking_reference}:`, err);
            }
          }
        }

        await supabase
          .from('notifications')
          .insert({
            user_id: booking.user_id,
            booking_id: booking.id,
            title,
            message: body,
            type: 'reminder',
            channel: 'push',
          });

        alertsSent.push(booking.booking_reference);
      }
    }

    console.log(`Traffic alerts complete. Sent ${alertsSent.length} alerts.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: bookingsToCheck.length,
        alertsSent: alertsSent.length,
        bookings: alertsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Traffic alert error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});