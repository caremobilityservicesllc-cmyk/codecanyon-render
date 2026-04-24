import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bookingId, action, paymentMethod } = await req.json();

    if (action === "confirm_and_dispatch") {
      // Get the booking details
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error("Booking not found");
      }

      // Determine effective payment method from request or booking
      const effectivePaymentMethod = paymentMethod || booking.payment_method;

      // Find the best available driver
      const { data: drivers, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .eq("is_available", true)
        .order("average_rating", { ascending: false })
        .order("total_rides", { ascending: false })
        .limit(1);

      if (driverError) {
        console.error("Error finding driver:", driverError);
      }

      const assignedDriver = drivers && drivers.length > 0 ? drivers[0] : null;

      // Calculate estimated arrival (simulated: 10-30 minutes from now)
      const estimatedMinutes = Math.floor(Math.random() * 20) + 10;
      const estimatedArrival = new Date();
      estimatedArrival.setMinutes(estimatedArrival.getMinutes() + estimatedMinutes);
      const arrivalTime = estimatedArrival.toTimeString().slice(0, 8);

      // Bank transfers should NOT be auto-confirmed — payment must be verified first
      const shouldConfirm = effectivePaymentMethod !== "bank";

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only set confirmed status for non-bank payment methods
      if (shouldConfirm) {
        updateData.status = "confirmed";
      }

      if (assignedDriver) {
        updateData.driver_id = assignedDriver.id;
        updateData.estimated_arrival = arrivalTime;
        
        // Mark driver as unavailable
        await supabase
          .from("drivers")
          .update({ is_available: false })
          .eq("id", assignedDriver.id);
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (updateError) {
        throw new Error("Failed to update booking");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: assignedDriver 
            ? `Booking confirmed! Driver ${assignedDriver.first_name} assigned.`
            : "Booking confirmed! Driver will be assigned shortly.",
          driver: assignedDriver ? {
            id: assignedDriver.id,
            name: `${assignedDriver.first_name} ${assignedDriver.last_name}`,
            rating: assignedDriver.average_rating,
            phone: assignedDriver.phone,
          } : null,
          estimatedArrival: assignedDriver ? arrivalTime : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "release_driver") {
      // When a ride is completed or cancelled, release the driver
      const { data: booking } = await supabase
        .from("bookings")
        .select("driver_id")
        .eq("id", bookingId)
        .single();

      if (booking?.driver_id) {
        await supabase
          .from("drivers")
          .update({ is_available: true })
          .eq("id", booking.driver_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Driver released" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-dispatch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
