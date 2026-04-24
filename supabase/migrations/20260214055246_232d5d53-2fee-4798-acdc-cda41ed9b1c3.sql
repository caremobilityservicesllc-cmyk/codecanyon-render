
-- Add commission-related fields to system_settings (will store commission_percentage)
-- We'll use system_settings with key 'commission_settings'

-- Add commission tracking fields to driver_earnings
ALTER TABLE public.driver_earnings 
ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0;

-- Add additional fee fields to bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS booking_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS toll_charges numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS airport_charges numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- Create loyalty_points table
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  points_type text NOT NULL DEFAULT 'earned', -- 'earned', 'redeemed', 'bonus', 'expired'
  source text, -- 'ride_completed', 'referral', 'bonus', 'signup', 'redemption'
  reference_id uuid, -- booking_id or promo_id
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points" ON public.loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all points" ON public.loyalty_points
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert points" ON public.loyalty_points
  FOR INSERT WITH CHECK (true);

-- Create loyalty_balances view-like table for quick lookups
CREATE TABLE IF NOT EXISTS public.loyalty_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  lifetime_points integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balance" ON public.loyalty_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all balances" ON public.loyalty_balances
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can upsert balances" ON public.loyalty_balances
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update balances" ON public.loyalty_balances
  FOR UPDATE USING (true);

-- Driver loyalty/bonus tracking
CREATE TABLE IF NOT EXISTS public.driver_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  bonus_type text NOT NULL DEFAULT 'performance', -- 'performance', 'milestone', 'referral', 'streak'
  amount numeric NOT NULL DEFAULT 0,
  description text,
  rides_required integer,
  rides_completed integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own bonuses" ON public.driver_bonuses
  FOR SELECT USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all bonuses" ON public.driver_bonuses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to calculate and record driver earnings with commission
CREATE OR REPLACE FUNCTION public.record_driver_earning_with_commission(
  p_driver_id uuid,
  p_booking_id uuid,
  p_gross_amount numeric,
  p_commission_rate numeric DEFAULT 15,
  p_description text DEFAULT 'Ride completed'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission numeric;
  v_net_amount numeric;
  v_earning_id uuid;
BEGIN
  v_commission := ROUND(p_gross_amount * (p_commission_rate / 100), 2);
  v_net_amount := p_gross_amount - v_commission;
  
  INSERT INTO driver_earnings (driver_id, booking_id, amount, gross_amount, commission_rate, commission_amount, earning_type, description)
  VALUES (p_driver_id, p_booking_id, v_net_amount, p_gross_amount, p_commission_rate, v_commission, 'ride', p_description)
  RETURNING id INTO v_earning_id;
  
  RETURN v_earning_id;
END;
$$;
