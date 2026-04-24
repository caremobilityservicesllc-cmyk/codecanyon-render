
-- Drop the restrictive INSERT policies
DROP POLICY IF EXISTS "Anyone can insert guest bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert their own bookings" ON public.bookings;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Anyone can insert guest bookings"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can insert their own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
