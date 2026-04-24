-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_booking_amount NUMERIC DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promo_code_uses table to track individual uses
CREATE TABLE public.promo_code_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID,
  booking_id UUID,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Promo codes policies
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active promo codes for validation"
ON public.promo_codes
FOR SELECT
USING (is_active = true AND valid_from <= now() AND (valid_until IS NULL OR valid_until > now()));

-- Promo code uses policies
CREATE POLICY "Admins can view all promo code uses"
ON public.promo_code_uses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own promo code uses"
ON public.promo_code_uses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert promo code uses"
ON public.promo_code_uses
FOR INSERT
WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code TEXT, p_booking_amount NUMERIC DEFAULT 0)
RETURNS TABLE (
  valid BOOLEAN,
  discount_percentage NUMERIC,
  message TEXT,
  promo_code_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
  AND is_active = true;

  -- Check if code exists
  IF v_promo IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Invalid promo code'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if code is valid (date range)
  IF v_promo.valid_from > now() THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'This promo code is not yet active'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < now() THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'This promo code has expired'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check usage limit
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'This promo code has reached its usage limit'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check minimum booking amount
  IF v_promo.min_booking_amount > 0 AND p_booking_amount < v_promo.min_booking_amount THEN
    RETURN QUERY SELECT false, 0::NUMERIC, format('Minimum booking amount of $%s required', v_promo.min_booking_amount)::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT true, v_promo.discount_percentage, COALESCE(v_promo.description, 'Promo code applied!')::TEXT, v_promo.id;
END;
$$;

-- Function to increment promo code usage
CREATE OR REPLACE FUNCTION public.use_promo_code(p_promo_code_id UUID, p_user_id UUID DEFAULT NULL, p_booking_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment current_uses
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = p_promo_code_id;

  -- Record the use
  INSERT INTO promo_code_uses (promo_code_id, user_id, booking_id)
  VALUES (p_promo_code_id, p_user_id, p_booking_id);
END;
$$;

-- Insert some default promo codes
INSERT INTO public.promo_codes (code, description, discount_percentage, max_uses, valid_until)
VALUES 
  ('WELCOME10', 'Welcome discount for new customers', 10, 100, now() + interval '1 year'),
  ('SUMMER20', 'Summer special discount', 20, 50, now() + interval '3 months'),
  ('VIP25', 'VIP customer discount', 25, 25, now() + interval '6 months'),
  ('FIRST15', 'First ride discount', 15, 200, now() + interval '1 year');