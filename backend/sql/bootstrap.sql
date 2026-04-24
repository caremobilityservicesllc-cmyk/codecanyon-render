create extension if not exists pgcrypto;

create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('card', 'paypal', 'bank', 'crypto');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type service_type as enum ('hourly', 'flat-rate');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type transfer_type as enum ('one-way', 'return', 'return-new-ride');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type recurring_frequency as enum ('daily', 'weekly', 'weekdays', 'custom');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type pricing_rule_type as enum ('time', 'distance', 'zone', 'vehicle');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type day_of_week as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth_users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  preferred_vehicle_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  passengers integer not null default 1,
  luggage integer not null default 0,
  base_price numeric,
  price_per_km numeric,
  hourly_rate numeric,
  min_hours integer,
  max_hours integer,
  image text,
  features text[] default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  multiplier numeric not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  origin text not null,
  destination text not null,
  origin_zone_id uuid references zones(id) on delete set null,
  destination_zone_id uuid references zones(id) on delete set null,
  base_price numeric not null default 0,
  distance_km numeric,
  estimated_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table routes add column if not exists origin_name text;
alter table routes add column if not exists destination_name text;
alter table routes add column if not exists sort_order integer not null default 0;
alter table routes add column if not exists estimated_distance_km numeric;

update routes
set origin_name = coalesce(origin_name, origin),
    destination_name = coalesce(destination_name, destination),
    estimated_distance_km = coalesce(estimated_distance_km, distance_km)
where origin_name is null
   or destination_name is null
   or estimated_distance_km is null;

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rule_type pricing_rule_type not null,
  priority integer not null default 0,
  vehicle_id uuid references vehicles(id) on delete cascade,
  zone_id uuid references zones(id) on delete cascade,
  day_of_week day_of_week,
  start_time text,
  end_time text,
  multiplier numeric not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth_users(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  status booking_status not null default 'pending',
  pickup_location text,
  dropoff_location text,
  pickup_date timestamptz,
  return_date timestamptz,
  passenger_count integer,
  luggage_count integer,
  total_amount numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bookings add column if not exists booking_reference text;
alter table bookings add column if not exists service_type service_type not null default 'flat-rate';
alter table bookings add column if not exists transfer_type transfer_type not null default 'one-way';
alter table bookings add column if not exists pickup_time text;
alter table bookings add column if not exists passengers integer not null default 1;
alter table bookings add column if not exists payment_method payment_method;
alter table bookings add column if not exists total_price numeric;
alter table bookings add column if not exists vehicle_name text;
alter table bookings add column if not exists contact_email text;
alter table bookings add column if not exists driver_id uuid;
alter table bookings add column if not exists promo_code_id uuid;
alter table bookings add column if not exists discount_amount numeric;
alter table bookings add column if not exists bank_transfer_details jsonb;
alter table bookings add column if not exists booking_fee numeric;
alter table bookings add column if not exists airport_charges numeric;
alter table bookings add column if not exists toll_charges numeric;
alter table bookings add column if not exists cancellation_fee numeric;
alter table bookings add column if not exists cancelled_at timestamptz;
alter table bookings add column if not exists cancelled_by text;
alter table bookings add column if not exists driver_location_lat numeric;
alter table bookings add column if not exists driver_location_lng numeric;
alter table bookings add column if not exists estimated_arrival timestamptz;
alter table bookings add column if not exists ride_started_at timestamptz;
alter table bookings add column if not exists ride_completed_at timestamptz;

update bookings
set passengers = coalesce(passengers, passenger_count, 1),
    total_price = coalesce(total_price, total_amount),
    pickup_time = coalesce(pickup_time, to_char(pickup_date, 'HH24:MI')),
    contact_email = coalesce(contact_email, auth_users.email),
    vehicle_name = coalesce(vehicle_name, ''),
    booking_reference = coalesce(booking_reference, upper(substring(replace(bookings.id::text, '-', '') from 1 for 8)))
from auth_users
where bookings.user_id = auth_users.id
  and (
    booking_reference is null
    or total_price is null
    or passengers is null
    or pickup_time is null
    or vehicle_name is null
    or contact_email is null
  );

update bookings
set passengers = coalesce(passengers, passenger_count, 1),
    total_price = coalesce(total_price, total_amount),
    pickup_time = coalesce(pickup_time, to_char(pickup_date, 'HH24:MI')),
    vehicle_name = coalesce(vehicle_name, ''),
    booking_reference = coalesce(booking_reference, upper(substring(replace(id::text, '-', '') from 1 for 8)))
where booking_reference is null
   or total_price is null
   or passengers is null
   or pickup_time is null
   or vehicle_name is null;

create unique index if not exists bookings_booking_reference_key on bookings (booking_reference);

create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default 'null'::jsonb,
  category text not null default 'system',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth_users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'in_app',
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notifications add column if not exists booking_id uuid references bookings(id) on delete set null;
alter table notifications add column if not exists channel text not null default 'in_app';
alter table notifications add column if not exists is_read boolean not null default false;
alter table notifications add column if not exists sent_at timestamptz;

update notifications
set is_read = coalesce(is_read, read),
    sent_at = coalesce(sent_at, created_at)
where is_read is null
   or sent_at is null;

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percentage',
  discount_value numeric not null default 0,
  minimum_booking_amount numeric not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promo_codes add column if not exists discount_percentage numeric not null default 0;

update promo_codes
set discount_percentage = case
  when discount_percentage = 0 and discount_type = 'percentage' then discount_value
  else discount_percentage
end;

create table if not exists promo_code_uses (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  user_id uuid references auth_users(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth_users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  license_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table drivers add column if not exists first_name text;
alter table drivers add column if not exists last_name text;
alter table drivers add column if not exists avatar_url text;
alter table drivers add column if not exists average_rating numeric not null default 0;
alter table drivers add column if not exists total_rides integer not null default 0;
alter table drivers add column if not exists license_expiry date;
alter table drivers add column if not exists insurance_expiry date;
alter table drivers add column if not exists is_available boolean not null default true;
alter table drivers add column if not exists documents_verified boolean not null default false;
alter table drivers add column if not exists onboarding_status text not null default 'pending';
alter table drivers add column if not exists background_check_status text not null default 'pending';
alter table drivers add column if not exists earnings_total numeric not null default 0;
alter table drivers add column if not exists earnings_this_month numeric not null default 0;
alter table drivers add column if not exists verification_notes text;
alter table drivers add column if not exists rejection_reason text;
alter table drivers add column if not exists completed_rides_this_month integer not null default 0;

update drivers
set first_name = coalesce(first_name, split_part(full_name, ' ', 1), ''),
    last_name = coalesce(last_name, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''), ''),
    full_name = coalesce(nullif(trim(full_name), ''), trim(concat_ws(' ', first_name, last_name)), 'Driver')
where first_name is null
   or last_name is null
   or full_name is null
   or trim(full_name) = '';

do $$ begin
  alter table bookings
    add constraint bookings_driver_id_fkey
    foreign key (driver_id) references drivers(id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table bookings
    add constraint bookings_promo_code_id_fkey
    foreign key (promo_code_id) references promo_codes(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  document_type text not null,
  file_url text,
  status text not null default 'pending',
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table driver_documents add column if not exists document_url text;
alter table driver_documents add column if not exists expires_at timestamptz;
alter table driver_documents add column if not exists rejection_reason text;
alter table driver_documents add column if not exists uploaded_at timestamptz not null default now();
alter table driver_documents add column if not exists verified_at timestamptz;
alter table driver_documents add column if not exists verified_by uuid references auth_users(id) on delete set null;

update driver_documents
set document_url = coalesce(document_url, file_url),
    expires_at = coalesce(expires_at, expiry_date::timestamptz),
    uploaded_at = coalesce(uploaded_at, created_at)
where document_url is null
   or expires_at is null
   or uploaded_at is null;

create table if not exists driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  zone_id uuid references zones(id) on delete set null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table driver_shifts add column if not exists shift_date date;
alter table driver_shifts add column if not exists notes text;
alter table driver_shifts add column if not exists created_by uuid references auth_users(id) on delete set null;
alter table driver_shifts add column if not exists check_in_at timestamptz;
alter table driver_shifts add column if not exists check_out_at timestamptz;

update driver_shifts
set shift_date = coalesce(shift_date, start_time::date)
where shift_date is null;

create table if not exists driver_ratings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  user_id uuid not null references auth_users(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists recurring_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  template_booking_id uuid references bookings(id) on delete set null,
  pickup_location text not null,
  dropoff_location text not null,
  pickup_time text not null,
  passengers integer default 1,
  notes text,
  frequency recurring_frequency not null,
  custom_days text[] default '{}',
  start_date date not null,
  end_date date,
  last_generated_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ride_shares (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  shared_by_user_id uuid not null references auth_users(id) on delete cascade,
  shared_with_email text not null,
  shared_with_user_id uuid references auth_users(id) on delete set null,
  share_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  is_accepted boolean default false,
  cost_split_percentage numeric,
  proposed_cost_split_percentage numeric,
  proposed_by_user_id uuid references auth_users(id) on delete set null,
  proposed_at timestamptz,
  accepted_at timestamptz,
  counter_proposal_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists driver_earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  gross_amount numeric not null default 0,
  net_amount numeric not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists driver_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  amount numeric not null default 0,
  status text not null default 'pending',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists page_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  footer_section text not null default 'quick_links',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists translation_overrides (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  translation_key text not null,
  translation_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_code, translation_key)
);

create table if not exists map_api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  api_type text not null,
  request_count integer not null default 0,
  recorded_at timestamptz not null default now()
);

create table if not exists saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  label text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists favorite_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, vehicle_id)
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_methods add column if not exists payment_type text not null default 'card';
alter table payment_methods add column if not exists card_last_four text;
alter table payment_methods add column if not exists card_brand text;
alter table payment_methods add column if not exists card_expiry_month integer;
alter table payment_methods add column if not exists card_expiry_year integer;
alter table payment_methods add column if not exists cardholder_name text;
alter table payment_methods add column if not exists paypal_email text;
alter table payment_methods add column if not exists bank_name text;
alter table payment_methods add column if not exists account_holder_name text;
alter table payment_methods add column if not exists account_last_four text;
alter table payment_methods add column if not exists is_verified boolean not null default false;
alter table payment_methods add column if not exists verification_amount_cents integer;
alter table payment_methods add column if not exists verification_attempts integer not null default 0;
alter table payment_methods add column if not exists verification_expires_at timestamptz;
alter table payment_methods add column if not exists verified_at timestamptz;

update payment_methods
set payment_type = coalesce(payment_type, case when paypal_email is not null then 'paypal' when bank_name is not null then 'bank' else 'card' end),
    card_last_four = coalesce(card_last_four, last4),
    card_brand = coalesce(card_brand, brand),
    card_expiry_month = coalesce(card_expiry_month, exp_month),
    card_expiry_year = coalesce(card_expiry_year, exp_year)
where payment_type is null
   or card_last_four is null
   or card_brand is null
   or card_expiry_month is null
   or card_expiry_year is null;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into system_settings (key, value, category, description)
values
  ('setup_completed', 'false'::jsonb, 'system', 'Whether the initial setup wizard has been completed')
on conflict (key) do nothing;