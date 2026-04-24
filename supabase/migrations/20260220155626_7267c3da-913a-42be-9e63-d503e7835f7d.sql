
CREATE POLICY "Anon can view guest bookings they just created"
ON public.bookings
AS PERMISSIVE
FOR SELECT
TO anon
USING (user_id IS NULL);
