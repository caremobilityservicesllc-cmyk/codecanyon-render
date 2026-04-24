import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random booking reference
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RF-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get day of week as lowercase string
function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

// Check if a date should have a booking based on frequency
function shouldGenerateForDate(
  recurringBooking: any,
  targetDate: Date
): boolean {
  const startDate = new Date(recurringBooking.start_date);
  const endDate = recurringBooking.end_date ? new Date(recurringBooking.end_date) : null;
  
  // Check if target date is within valid range
  if (targetDate < startDate) return false;
  if (endDate && targetDate > endDate) return false;
  
  const dayOfWeek = getDayOfWeek(targetDate);
  
  switch (recurringBooking.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      // Weekly means same day of week as start date
      return getDayOfWeek(startDate) === dayOfWeek;
    case 'weekdays':
      return !['saturday', 'sunday'].includes(dayOfWeek);
    case 'custom':
      return recurringBooking.custom_days?.includes(dayOfWeek) ?? false;
    default:
      return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`Processing recurring bookings for date: ${todayStr}`);
    
    // Fetch all active recurring bookings that haven't generated for today
    const { data: recurringBookings, error: fetchError } = await supabase
      .from('recurring_bookings')
      .select('*')
      .eq('is_active', true)
      .or(`last_generated_date.is.null,last_generated_date.lt.${todayStr}`);
    
    if (fetchError) {
      console.error('Error fetching recurring bookings:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${recurringBookings?.length || 0} recurring bookings to process`);
    
    let generatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    
    for (const recurring of recurringBookings || []) {
      try {
        // Check if we should generate a booking for today
        if (!shouldGenerateForDate(recurring, today)) {
          console.log(`Skipping ${recurring.id} - not scheduled for ${getDayOfWeek(today)}`);
          skippedCount++;
          continue;
        }
        
        // Check if booking already exists for this date
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', recurring.user_id)
          .eq('pickup_date', todayStr)
          .eq('pickup_time', recurring.pickup_time)
          .eq('pickup_location', recurring.pickup_location)
          .single();
        
        if (existingBooking) {
          console.log(`Booking already exists for recurring ${recurring.id} on ${todayStr}`);
          skippedCount++;
          continue;
        }
        
        // Get vehicle name from vehicles table
        let vehicleName = 'Standard Vehicle';
        if (recurring.vehicle_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('name')
            .eq('id', recurring.vehicle_id)
            .single();
          if (vehicle?.name) vehicleName = vehicle.name;
        }
        
        // Create the booking
        const { error: insertError } = await supabase
          .from('bookings')
          .insert({
            user_id: recurring.user_id,
            booking_reference: generateBookingReference(),
            pickup_location: recurring.pickup_location,
            dropoff_location: recurring.dropoff_location,
            pickup_date: todayStr,
            pickup_time: recurring.pickup_time,
            vehicle_id: recurring.vehicle_id,
            vehicle_name: vehicleName,
            passengers: recurring.passengers || 1,
            notes: recurring.notes ? `[Auto-generated] ${recurring.notes}` : '[Auto-generated from recurring schedule]',
            payment_method: 'card',
            status: 'pending',
            service_type: 'flat-rate',
            transfer_type: 'one-way',
          });
        
        if (insertError) {
          console.error(`Error creating booking for recurring ${recurring.id}:`, insertError);
          errors.push(`Failed to create booking for recurring ${recurring.id}: ${insertError.message}`);
          continue;
        }
        
        // Update last_generated_date
        await supabase
          .from('recurring_bookings')
          .update({ last_generated_date: todayStr })
          .eq('id', recurring.id);
        
        console.log(`Created booking for recurring ${recurring.id}`);
        generatedCount++;
        
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing recurring booking ${recurring.id}:`, err);
        errors.push(`Error processing ${recurring.id}: ${errorMessage}`);
      }
    }
    
    const summary = {
      date: todayStr,
      processed: recurringBookings?.length || 0,
      generated: generatedCount,
      skipped: skippedCount,
      errors: errors,
    };
    
    console.log('Generation complete:', summary);
    
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (error: any) {
    console.error("Error in generate-recurring-bookings:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
