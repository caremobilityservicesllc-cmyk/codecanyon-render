import bcrypt from 'bcryptjs';
import { signUp, makeUserAdmin } from '../auth.js';
import { query, pool } from '../db.js';

async function findUserByEmail(email) {
  const result = await query('select id, email from auth_users where lower(email) = lower($1) limit 1', [email]);
  return result.rows[0] || null;
}

async function ensureUser({ email, password, fullName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `update auth_users
       set password_hash = $1,
           metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $3`,
      [passwordHash, JSON.stringify({ full_name: fullName }), existing.id],
    );

    await query(
      `insert into profiles (id, email, full_name)
       values ($1, $2, $3)
       on conflict (id) do update
       set email = excluded.email,
           full_name = excluded.full_name,
           updated_at = now()`,
      [existing.id, email, fullName],
    );

    return existing;
  }

  const created = await signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  return created.user;
}

async function ensureSetupCompleted() {
  await query(
    `insert into system_settings (key, value, category, description)
     values ($1, $2::jsonb, $3, $4)
     on conflict (key) do update
     set value = excluded.value,
         category = excluded.category,
         description = excluded.description,
         updated_at = now()`,
    ['setup_completed', JSON.stringify(true), 'system', 'Whether the initial setup wizard has been completed'],
  );
}

async function ensureDriverProfile(userId) {
  await query(
    `insert into drivers (
      user_id,
      full_name,
      first_name,
      last_name,
      email,
      phone,
      license_number,
      onboarding_status,
      is_active,
      is_available,
      documents_verified
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, true, true, true)
    on conflict (user_id) do update
    set full_name = excluded.full_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        email = excluded.email,
        phone = excluded.phone,
        license_number = excluded.license_number,
        onboarding_status = excluded.onboarding_status,
        is_active = true,
        is_available = true,
        documents_verified = true,
        updated_at = now()`,
    [
      userId,
      'Demo Driver',
      'Demo',
      'Driver',
      'driver@demo.com',
      '+1 (555) 100-0001',
      'DRV-DEMO-001',
      'approved',
    ],
  );
}

async function ensureSampleBooking(userId) {
  const existing = await query(
    'select id, booking_reference from bookings where booking_reference = $1 limit 1',
    ['DEMO-0001'],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const driverResult = await query('select id from drivers where lower(email) = lower($1) limit 1', ['driver@demo.com']);
  const driverId = driverResult.rows[0]?.id || null;

  const result = await query(
    `insert into bookings (
      user_id,
      driver_id,
      booking_reference,
      service_type,
      transfer_type,
      status,
      pickup_location,
      dropoff_location,
      pickup_date,
      pickup_time,
      passengers,
      total_price,
      vehicle_name,
      contact_email,
      notes
    )
    values (
      $1, $2, $3, 'flat-rate', 'one-way', 'confirmed', $4, $5,
      now() + interval '1 day', $6, 1, 55, $7, $8, $9
    )
    returning id, booking_reference`,
    [
      userId,
      driverId,
      'DEMO-0001',
      '123 Main St, Demo City',
      '456 Clinic Ave, Demo City',
      '10:30',
      'Medical Sedan',
      'user@demo.com',
      'Local migration seed booking',
    ],
  );

  return result.rows[0];
}

try {
  const admin = await ensureUser({
    email: 'admin@demo.com',
    password: 'Admin123!',
    fullName: 'Demo Admin',
  });

  await makeUserAdmin('admin@demo.com');

  const customer = await ensureUser({
    email: 'user@demo.com',
    password: 'User123!',
    fullName: 'Demo User',
  });

  const driver = await ensureUser({
    email: 'driver@demo.com',
    password: 'Driver123!',
    fullName: 'Demo Driver',
  });

  await ensureDriverProfile(driver.id);
  await ensureSetupCompleted();
  const booking = await ensureSampleBooking(customer.id);

  console.log(
    JSON.stringify(
      {
        seeded: true,
        admin: admin.email,
        customer: customer.email,
        driver: driver.email,
        bookingReference: booking.booking_reference,
      },
      null,
      2,
    ),
  );

  await pool.end();
} catch (error) {
  console.error(error);
  await pool.end();
  process.exit(1);
}