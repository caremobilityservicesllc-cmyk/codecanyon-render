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

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 8);
    
    // Calculate time 30 minutes from now
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
    const reminderTime = thirtyMinutesLater.toTimeString().slice(0, 8);

    console.log(`Checking for shifts starting between ${currentTime} and ${reminderTime} on ${currentDate}`);

    // Find shifts starting in the next 30 minutes that haven't been notified
    const { data: upcomingShifts, error: shiftsError } = await supabase
      .from('driver_shifts')
      .select(`
        id,
        shift_date,
        start_time,
        end_time,
        status,
        notes,
        driver:drivers(id, user_id, first_name, last_name),
        zone:zones(name)
      `)
      .eq('shift_date', currentDate)
      .eq('status', 'scheduled')
      .gte('start_time', currentTime)
      .lte('start_time', reminderTime);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      throw shiftsError;
    }

    console.log(`Found ${upcomingShifts?.length || 0} upcoming shifts`);

    let notificationsSent = 0;

    for (const shift of upcomingShifts || []) {
      const driver = shift.driver as { id: string; user_id: string | null; first_name: string; last_name: string } | null;
      const zone = shift.zone as { name: string } | null;

      if (!driver?.user_id) {
        console.log(`Skipping shift ${shift.id} - driver has no user_id`);
        continue;
      }

      // Check if we already sent a reminder for this shift
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', driver.user_id)
        .eq('type', 'reminder')
        .ilike('message', `%shift in ${zone?.name || 'your zone'}%`)
        .gte('created_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingNotif) {
        console.log(`Already sent reminder for shift ${shift.id}`);
        continue;
      }

      // Calculate minutes until shift
      const shiftStartParts = shift.start_time.split(':');
      const shiftStartDate = new Date(now);
      shiftStartDate.setHours(parseInt(shiftStartParts[0]), parseInt(shiftStartParts[1]), 0, 0);
      const minutesUntil = Math.round((shiftStartDate.getTime() - now.getTime()) / 60000);

      const title = 'Shift Starting Soon!';
      const body = `Your shift in ${zone?.name || 'your zone'} starts in ${minutesUntil} minutes (${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})`;

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
          data: { type: 'shift_reminder', shiftId: shift.id },
        }),
      });

      if (pushResponse.ok) {
        notificationsSent++;
        console.log(`Sent shift reminder to driver ${driver.first_name} ${driver.last_name}`);
      } else {
        console.error(`Failed to send push notification: ${await pushResponse.text()}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        shiftsChecked: upcomingShifts?.length || 0,
        notificationsSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-driver-shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
