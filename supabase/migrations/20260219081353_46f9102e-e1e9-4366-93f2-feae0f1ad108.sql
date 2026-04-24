
-- Add hourly pricing fields to vehicles table
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_hours integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_hours integer DEFAULT 12;

-- Add return_trip_discount_percentage to system_settings if not exists
INSERT INTO public.system_settings (key, value, category, description)
VALUES 
  ('hourly_pricing', '{"defaultMinHours": 2, "defaultMaxHours": 12, "overtimeMultiplier": 1.5}', 'pricing', 'Hourly service pricing configuration'),
  ('stop_surcharges', '{"enabled": true, "perStopFee": 10, "maxStops": 5}', 'pricing', 'Per-stop surcharge configuration for flat-rate bookings'),
  ('return_trip_discount', '{"enabled": true, "discountPercentage": 10}', 'pricing', 'Discount applied to return/round-trip bookings')
ON CONFLICT (key) DO NOTHING;
