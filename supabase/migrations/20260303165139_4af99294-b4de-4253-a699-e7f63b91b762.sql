
-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to auto-send SMS on booking events
CREATE OR REPLACE FUNCTION public.send_sms_on_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
  v_sms_enabled BOOLEAN;
  v_sms_type TEXT;
  v_sms_data JSONB;
  v_provider TEXT;
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_driver_name TEXT;
BEGIN
  -- Skip if no user_id
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's phone from profiles
  SELECT phone INTO v_phone
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Skip if no phone number
  IF v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Check user's notification preferences for SMS
  SELECT sms_ride_updates INTO v_sms_enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id;

  -- Default to true if no preferences set
  IF v_sms_enabled IS NULL THEN
    v_sms_enabled := true;
  END IF;

  IF NOT v_sms_enabled THEN
    RETURN NEW;
  END IF;

  -- Get configured SMS provider from system_settings
  SELECT COALESCE(value->>'provider', 'nexmo') INTO v_provider
  FROM public.system_settings
  WHERE key = 'sms_provider';

  IF v_provider IS NULL THEN
    v_provider := 'nexmo';
  END IF;

  -- Determine which event occurred
  v_sms_type := NULL;

  -- Booking confirmed
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed' THEN
    v_sms_type := 'booking_confirmed';
    v_sms_data := jsonb_build_object(
      'bookingReference', NEW.booking_reference,
      'pickupTime', NEW.pickup_time::text
    );
  END IF;

  -- Driver assigned
  IF OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL AND v_sms_type IS NULL THEN
    -- Get driver name
    SELECT first_name || ' ' || last_name INTO v_driver_name
    FROM public.drivers
    WHERE id = NEW.driver_id;

    v_sms_type := 'driver_assigned';
    v_sms_data := jsonb_build_object(
      'bookingReference', NEW.booking_reference,
      'driverName', COALESCE(v_driver_name, 'Your driver'),
      'eta', COALESCE(NEW.estimated_arrival::text, 'Soon')
    );
  END IF;

  -- Driver arriving (estimated_arrival within 5 minutes)
  IF NEW.estimated_arrival IS NOT NULL AND NEW.driver_id IS NOT NULL 
     AND NEW.status = 'confirmed' AND v_sms_type IS NULL THEN
    DECLARE
      v_minutes INTEGER;
      v_already_sent BOOLEAN;
    BEGIN
      v_minutes := EXTRACT(EPOCH FROM (NEW.estimated_arrival::time - CURRENT_TIME)) / 60;
      IF v_minutes >= 0 AND v_minutes <= 5 THEN
        -- Check if we already sent this type recently
        SELECT EXISTS (
          SELECT 1 FROM public.notifications
          WHERE booking_id = NEW.id
          AND type = 'driver_arriving'
          AND channel = 'sms'
          AND created_at > NOW() - INTERVAL '30 minutes'
        ) INTO v_already_sent;

        IF NOT v_already_sent THEN
          v_sms_type := 'driver_arriving';
          v_sms_data := jsonb_build_object(
            'bookingReference', NEW.booking_reference,
            'minutes', GREATEST(1, v_minutes)
          );
        END IF;
      END IF;
    END;
  END IF;

  -- Ride completed
  IF OLD.ride_completed_at IS NULL AND NEW.ride_completed_at IS NOT NULL AND v_sms_type IS NULL THEN
    v_sms_type := 'ride_completed';
    v_sms_data := jsonb_build_object(
      'bookingReference', NEW.booking_reference
    );
  END IF;

  -- If no event matched, exit
  IF v_sms_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and anon key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Fallback: use the project URL pattern
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Try to get from vault or use a known pattern
    SELECT COALESCE(value->>'supabase_url', '') INTO v_supabase_url
    FROM public.system_settings
    WHERE key = 'api_config';
  END IF;

  -- Record the SMS notification in the notifications table
  INSERT INTO public.notifications (user_id, title, message, type, channel, booking_id)
  VALUES (
    NEW.user_id,
    'SMS Sent',
    'SMS notification sent for ' || v_sms_type,
    CASE v_sms_type
      WHEN 'booking_confirmed' THEN 'booking_confirmed'::notification_type
      WHEN 'driver_assigned' THEN 'driver_assigned'::notification_type
      WHEN 'driver_arriving' THEN 'driver_arriving'::notification_type
      WHEN 'ride_completed' THEN 'ride_completed'::notification_type
    END,
    'sms',
    NEW.id
  );

  -- Call the send-sms edge function via pg_net
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    ),
    body := jsonb_build_object(
      'phoneNumber', v_phone,
      'type', v_sms_type,
      'data', v_sms_data,
      'provider', v_provider
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS trigger_sms_on_booking_change ON public.bookings;
CREATE TRIGGER trigger_sms_on_booking_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_sms_on_booking_change();
