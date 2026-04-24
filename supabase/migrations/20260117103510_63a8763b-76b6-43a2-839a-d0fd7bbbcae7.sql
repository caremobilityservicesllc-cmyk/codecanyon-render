-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can insert guest bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow guest bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow reading bookings by reference" ON public.bookings;

-- Create permissive policy for guest bookings (user_id IS NULL)
CREATE POLICY "Anyone can insert guest bookings"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL);

-- Allow guests to read bookings (for confirmation page)
CREATE POLICY "Anyone can view bookings"
ON public.bookings
FOR SELECT
TO anon, authenticated
USING (true);