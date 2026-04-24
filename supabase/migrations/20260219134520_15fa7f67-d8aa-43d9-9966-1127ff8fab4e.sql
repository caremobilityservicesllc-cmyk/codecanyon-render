-- Only create business logic triggers that are missing (use DROP IF EXISTS + CREATE to be safe)

-- 1. Booking change notifications
DROP TRIGGER IF EXISTS on_booking_change ON public.bookings;
CREATE TRIGGER on_booking_change
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_changes();

-- 2. Update driver average rating after new rating
DROP TRIGGER IF EXISTS on_new_driver_rating ON public.driver_ratings;
CREATE TRIGGER on_new_driver_rating
AFTER INSERT ON public.driver_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_driver_average_rating();

-- 3. Update driver earnings summary after new earning
DROP TRIGGER IF EXISTS on_new_driver_earning ON public.driver_earnings;
CREATE TRIGGER on_new_driver_earning
AFTER INSERT ON public.driver_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_driver_earnings_summary();

-- 4. Auto-record driver earning when ride is completed
DROP TRIGGER IF EXISTS on_ride_completed ON public.bookings;
CREATE TRIGGER on_ride_completed
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_record_driver_earning_on_completion();