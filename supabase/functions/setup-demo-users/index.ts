import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_USERS = [
  {
    email: 'user@demo.com',
    password: 'User123!',
    fullName: 'Demo User',
    role: 'user' as const,
  },
  {
    email: 'admin@demo.com',
    password: 'Admin123!',
    fullName: 'Demo Admin',
    role: 'admin' as const,
  },
  {
    email: 'driver@demo.com',
    password: 'Driver123!',
    fullName: 'Demo Driver',
    role: 'driver' as const,
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; userId?: string }[] = [];

    for (const demoUser of DEMO_USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === demoUser.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        results.push({ email: demoUser.email, status: 'already exists', userId });
      } else {
        // Create the user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
          user_metadata: {
            full_name: demoUser.fullName,
          },
        });

        if (createError) {
          results.push({ email: demoUser.email, status: `error: ${createError.message}` });
          continue;
        }

        userId = newUser.user.id;
        results.push({ email: demoUser.email, status: 'created', userId });
      }

      // Ensure profile exists
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: demoUser.email,
          full_name: demoUser.fullName,
        }, { onConflict: 'id' });

      if (profileError) {
        console.error(`Profile error for ${demoUser.email}:`, profileError);
      }

      // Ensure role exists (for admin)
      if (demoUser.role === 'admin') {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'admin',
          }, { onConflict: 'user_id,role' });

        if (roleError) {
          console.error(`Role error for ${demoUser.email}:`, roleError);
        }
      }

      // Setup driver account with pre-populated data
      if (demoUser.role === 'driver') {
        await setupDemoDriver(supabaseAdmin, userId, demoUser);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Setup demo users error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function setupDemoDriver(supabaseAdmin: any, userId: string, demoUser: typeof DEMO_USERS[0]) {
  // Check if driver already exists
  const { data: existingDriver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let driverId: string;

  if (existingDriver) {
    driverId = existingDriver.id;
    console.log(`Driver already exists for ${demoUser.email}`);
  } else {
    // Create driver record
    const licenseExpiry = new Date();
    licenseExpiry.setFullYear(licenseExpiry.getFullYear() + 2);

    const { data: newDriver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        user_id: userId,
        first_name: 'Demo',
        last_name: 'Driver',
        email: demoUser.email,
        phone: '+1 555-0123',
        license_number: 'DL-DEMO-12345',
        license_expiry: licenseExpiry.toISOString().split('T')[0],
        is_active: true,
        is_available: true,
        documents_verified: true,
        average_rating: 4.8,
        total_rides: 156,
        completed_rides_this_month: 24,
        earnings_this_month: 1850.00,
        earnings_total: 12500.00,
        onboarding_status: 'approved',
        background_check_status: 'approved',
      })
      .select('id')
      .single();

    if (driverError) {
      console.error(`Driver creation error for ${demoUser.email}:`, driverError);
      return;
    }

    driverId = newDriver.id;
    console.log(`Created driver for ${demoUser.email}`);
  }

  // Get a zone for shifts (create one if needed)
  let zoneId: string;
  const { data: existingZone } = await supabaseAdmin
    .from('zones')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingZone) {
    zoneId = existingZone.id;
  } else {
    const { data: newZone, error: zoneError } = await supabaseAdmin
      .from('zones')
      .insert({
        name: 'Downtown',
        description: 'Central business district',
        multiplier: 1.0,
        is_active: true,
      })
      .select('id')
      .single();

    if (zoneError) {
      console.error('Zone creation error:', zoneError);
      return;
    }
    zoneId = newZone.id;
  }

  // Create demo shifts for this week
  const today = new Date();
  const shifts = [];
  
  for (let i = 0; i < 5; i++) {
    const shiftDate = new Date(today);
    shiftDate.setDate(today.getDate() + i);
    
    shifts.push({
      driver_id: driverId,
      zone_id: zoneId,
      shift_date: shiftDate.toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '16:00',
      status: i === 0 ? 'active' : 'scheduled',
      check_in_at: i === 0 ? new Date().toISOString() : null,
    });
  }

  // Upsert shifts (avoid duplicates)
  for (const shift of shifts) {
    const { error: shiftError } = await supabaseAdmin
      .from('driver_shifts')
      .upsert(shift, { 
        onConflict: 'driver_id,shift_date,start_time',
        ignoreDuplicates: true 
      });

    if (shiftError && !shiftError.message.includes('duplicate')) {
      console.error('Shift creation error:', shiftError);
    }
  }

  // Create demo bookings assigned to this driver
  const bookingStatuses = ['confirmed', 'confirmed', 'pending'];
  const pickupLocations = [
    '123 Main Street, Downtown',
    '456 Oak Avenue, Midtown',
    '789 Park Boulevard, Uptown',
  ];
  const dropoffLocations = [
    'Airport Terminal 1',
    'Central Station',
    'Convention Center',
  ];

  for (let i = 0; i < 3; i++) {
    const pickupDate = new Date(today);
    pickupDate.setDate(today.getDate() + i);
    
    const bookingRef = `DEMO${String(i + 1).padStart(4, '0')}`;
    
    // Check if booking already exists
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('booking_reference', bookingRef)
      .maybeSingle();

    if (!existingBooking) {
      const { error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert({
          booking_reference: bookingRef,
          driver_id: driverId,
          pickup_location: pickupLocations[i],
          dropoff_location: dropoffLocations[i],
          pickup_date: pickupDate.toISOString().split('T')[0],
          pickup_time: `${9 + i * 2}:00`,
          status: bookingStatuses[i],
          vehicle_id: 'sedan-standard',
          vehicle_name: 'Standard Sedan',
          passengers: 2,
          payment_method: 'card',
          total_price: 45.00 + (i * 15),
        });

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
      }
    }
  }

  // Add some earnings records
  const earningTypes = ['ride', 'ride', 'bonus', 'ride'];
  const amounts = [35.50, 42.00, 25.00, 38.75];

  for (let i = 0; i < earningTypes.length; i++) {
    const earnedDate = new Date(today);
    earnedDate.setDate(today.getDate() - i - 1);

    const { error: earningError } = await supabaseAdmin
      .from('driver_earnings')
      .insert({
        driver_id: driverId,
        amount: amounts[i],
        earning_type: earningTypes[i],
        description: earningTypes[i] === 'bonus' ? 'Weekly performance bonus' : `Ride completed`,
        created_at: earnedDate.toISOString(),
      });

    if (earningError && !earningError.message.includes('duplicate')) {
      console.error('Earning creation error:', earningError);
    }
  }

  console.log(`Demo driver setup complete for ${demoUser.email}`);
}
