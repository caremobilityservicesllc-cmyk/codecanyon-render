-- Drop existing functions first
DROP FUNCTION IF EXISTS validate_promo_code(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS validate_promo_code(TEXT, NUMERIC, UUID);

-- Recreate the function with properly qualified column references
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code TEXT,
  p_booking_amount NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  valid BOOLEAN,
  discount_percentage NUMERIC,
  message TEXT,
  promo_code_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_user_uses INTEGER;
BEGIN
  -- Find the promo code
  SELECT * INTO v_promo
  FROM promo_codes pc
  WHERE UPPER(pc.code) = UPPER(p_code)
  AND pc.is_active = true;

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

  -- Check global usage limit
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'This promo code has reached its usage limit'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check per-user usage limit (if user is logged in and limit is set)
  IF p_user_id IS NOT NULL AND v_promo.max_uses_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
    FROM promo_code_uses pcu
    WHERE pcu.promo_code_id = v_promo.id
    AND pcu.user_id = p_user_id;

    IF v_user_uses >= v_promo.max_uses_per_user THEN
      IF v_promo.max_uses_per_user = 1 THEN
        RETURN QUERY SELECT false, 0::NUMERIC, 'You have already used this promo code'::TEXT, NULL::UUID;
      ELSE
        RETURN QUERY SELECT false, 0::NUMERIC, format('You have reached the maximum of %s uses for this promo code', v_promo.max_uses_per_user)::TEXT, NULL::UUID;
      END IF;
      RETURN;
    END IF;
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