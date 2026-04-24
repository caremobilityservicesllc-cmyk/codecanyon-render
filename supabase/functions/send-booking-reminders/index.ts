import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting booking reminder check...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tomorrow's date in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log("Checking for bookings on:", tomorrowStr);

    // Fetch confirmed bookings for tomorrow that have a user_id
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*")
      .eq("pickup_date", tomorrowStr)
      .in("status", ["pending", "confirmed"])
      .not("user_id", "is", null);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      throw bookingsError;
    }

    console.log(`Found ${bookings?.length || 0} bookings for tomorrow`);

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No bookings to remind", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user emails from profiles
    const userIds = bookings.map((b) => b.user_id).filter(Boolean);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const emailMap = new Map(profiles?.map((p) => [p.id, p.email]) || []);

    let sentCount = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      const email = emailMap.get(booking.user_id);
      if (!email) {
        console.log(`No email found for user ${booking.user_id}, skipping`);
        continue;
      }

      const pickupDate = new Date(booking.pickup_date);
      const formattedDate = pickupDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const bookingDetails = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Booking Reference</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.booking_reference}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Pickup Location</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.pickup_location}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Dropoff Location</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.dropoff_location}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Date</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${formattedDate}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Time</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.pickup_time}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Vehicle</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.vehicle_name}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Passengers</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${booking.passengers}</td>
          </tr>
        </table>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "RideFlow <onboarding@resend.dev>",
          to: [email],
          subject: `Reminder: Your Ride Tomorrow - ${booking.booking_reference}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center;">
                <h1 style="color: #2dd4bf; margin: 0;">RideFlow</h1>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #1e293b; margin-top: 0;">Your Ride is Tomorrow! 🚗</h2>
                <p style="color: #64748b; line-height: 1.6;">
                  This is a friendly reminder that your ride is scheduled for <strong>tomorrow</strong>. 
                  Please make sure you're ready at the pickup location on time.
                </p>
                ${bookingDetails}
                <div style="background-color: #f0fdfa; border-left: 4px solid #2dd4bf; padding: 15px; margin: 20px 0;">
                  <p style="color: #0f766e; margin: 0; font-weight: 500;">
                    📍 Be ready at: ${booking.pickup_location}<br>
                    🕐 Time: ${booking.pickup_time}
                  </p>
                </div>
                <p style="color: #64748b; line-height: 1.6;">
                  If you need to make any changes to your booking, please contact us as soon as possible.
                </p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
                <p style="margin: 0;">© ${new Date().getFullYear()} RideFlow. All rights reserved.</p>
              </div>
            </div>
          `,
        });

        console.log(`Reminder sent to ${email} for booking ${booking.booking_reference}:`, emailResponse);
        sentCount++;
      } catch (emailError: any) {
        console.error(`Failed to send reminder for booking ${booking.booking_reference}:`, emailError);
        errors.push(`${booking.booking_reference}: ${emailError.message}`);
      }
    }

    console.log(`Sent ${sentCount} reminder emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} reminder emails`, 
        count: sentCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-booking-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
