
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shiftId } = await req.json();

    if (!shiftId) {
      return new Response(
        JSON.stringify({ error: 'Missing shiftId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Notifying driver about new shift: ${shiftId}`);

    // Fetch the shift details
    const { data: shift, error: shiftError } = await supabase
      .from('driver_shifts')
      .select(`
        id,
        shift_date,
        start_time,
        end_time,
        notes,
        driver:drivers(id, user_id, first_name, last_name),
        zone:zones(name)
      `)
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      console.error('Error fetching shift:', shiftError);
      return new Response(
        JSON.stringify({ error: 'Shift not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const driver = (Array.isArray(shift.driver) ? shift.driver[0] : shift.driver) as { id: string; user_id: string | null; first_name: string; last_name: string } | null;
    const zone = (Array.isArray(shift.zone) ? shift.zone[0] : shift.zone) as { name: string } | null;

    if (!driver?.user_id) {
      console.log('Driver has no user_id, skipping notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Driver has no user account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the date nicely
    const shiftDate = new Date(shift.shift_date);
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    const formattedDate = shiftDate.toLocaleDateString('en-US', dateOptions);

    const title = 'New Shift Assigned!';
    const body = `You have a new shift on ${formattedDate} from ${shift.start_time.slice(0, 5)} to ${shift.end_time.slice(0, 5)} in ${zone?.name || 'your zone'}.`;

    // Send push notification
    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        userId: driver.user_id,
        title,
        body,
        data: { type: 'new_shift', shiftId: shift.id },
      }),
    });

    const pushResult = await pushResponse.json();
    console.log('Push notification result:', pushResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        driverName: `${driver.first_name} ${driver.last_name}`,
        pushResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-new-shift:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
