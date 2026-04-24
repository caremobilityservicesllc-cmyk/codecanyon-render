
CREATE POLICY "Anyone can insert guest bookings"
ON public.bookings
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can insert their own bookings"
ON public.bookings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
