-- Create a function to send push notification on booking events
CREATE OR REPLACE FUNCTION public.notify_booking_changes()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  notification_type public.notification_type;
BEGIN
  -- Only notify if user_id exists
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check for booking confirmation (status changed to confirmed)
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed' THEN
    notification_title := 'Booking Confirmed!';
    notification_body := format('Your booking %s has been confirmed. Pickup: %s at %s', 
      NEW.booking_reference, NEW.pickup_location, NEW.pickup_time);
    notification_type := 'booking_confirmed';
    
    INSERT INTO public.notifications (user_id, title, message, type, channel, booking_id)
    VALUES (NEW.user_id, notification_title, notification_body, notification_type, 'push', NEW.id);
  END IF;

  -- Check for driver assignment
  IF OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL THEN
    notification_title := 'Driver Assigned!';
    notification_body := format('A driver has been assigned to your booking %s. Track your ride for live updates.', 
      NEW.booking_reference);
    notification_type := 'driver_assigned';
    
    INSERT INTO public.notifications (user_id, title, message, type, channel, booking_id)
    VALUES (NEW.user_id, notification_title, notification_body, notification_type, 'push', NEW.id);
  END IF;

  -- Check for ride started
  IF OLD.ride_started_at IS NULL AND NEW.ride_started_at IS NOT NULL THEN
    notification_title := 'Ride Started!';
    notification_body := format('Your ride %s has started. Enjoy your trip!', NEW.booking_reference);
    notification_type := 'ride_started';
    
    INSERT INTO public.notifications (user_id, title, message, type, channel, booking_id)
    VALUES (NEW.user_id, notification_title, notification_body, notification_type, 'push', NEW.id);
  END IF;

  -- Check for ride completed
  IF OLD.ride_completed_at IS NULL AND NEW.ride_completed_at IS NOT NULL THEN
    notification_title := 'Ride Completed!';
    notification_body := format('Your ride %s is complete. Thank you for riding with RideFlow!', NEW.booking_reference);
    notification_type := 'ride_completed';
    
    INSERT INTO public.notifications (user_id, title, message, type, channel, booking_id)
    VALUES (NEW.user_id, notification_title, notification_body, notification_type, 'push', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for booking changes
DROP TRIGGER IF EXISTS booking_notification_trigger ON public.bookings;
CREATE TRIGGER booking_notification_trigger
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_changes();