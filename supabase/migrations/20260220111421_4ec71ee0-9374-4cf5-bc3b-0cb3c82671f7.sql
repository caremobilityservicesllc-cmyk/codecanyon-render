
-- 1. Remove the dangerous public SELECT policy on bookings
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;

-- 2. Remove the dangerous public SELECT policy on drivers
DROP POLICY IF EXISTS "Users can view active drivers" ON public.drivers;

-- 3. Add a policy so users can view drivers assigned to their bookings (for ride tracking)
CREATE POLICY "Users can view their assigned driver"
ON public.drivers FOR SELECT
USING (
  id IN (
    SELECT driver_id FROM public.bookings
    WHERE user_id = auth.uid()
    AND driver_id IS NOT NULL
  )
);

-- 4. Add admin-only ALL policy for payment_methods management
CREATE POLICY "Admins can manage all payment methods"
ON public.payment_methods FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
