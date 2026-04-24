
-- Create a trigger function that records driver earnings when a ride is completed
CREATE OR REPLACE FUNCTION public.auto_record_driver_earning_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_rate numeric;
  v_gross_amount numeric;
BEGIN
  -- Only fire when ride_completed_at changes from NULL to a value
  IF OLD.ride_completed_at IS NOT NULL OR NEW.ride_completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Must have a driver assigned
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Must have a total price
  IF NEW.total_price IS NULL OR NEW.total_price <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get commission rate from system_settings, default to 15%
  SELECT COALESCE((value->>'commissionPercentage')::numeric, 15)
  INTO v_commission_rate
  FROM public.system_settings
  WHERE key = 'booking_policies'
  LIMIT 1;

  IF v_commission_rate IS NULL THEN
    v_commission_rate := 15;
  END IF;

  -- Gross amount is total_price (base fare before additional rider fees)
  v_gross_amount := NEW.total_price;

  -- Record the earning using the existing function
  PERFORM public.record_driver_earning_with_commission(
    NEW.driver_id,
    NEW.id,
    v_gross_amount,
    v_commission_rate,
    'Ride completed - ' || NEW.booking_reference
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on the bookings table
CREATE TRIGGER trg_auto_record_driver_earning
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_driver_earning_on_completion();
