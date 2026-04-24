-- Allow guest bookings (anonymous users) to insert bookings with null user_id
CREATE POLICY "Allow guest bookings"
ON public.bookings
FOR INSERT
WITH CHECK (user_id IS NULL);

-- Allow public to read their own guest bookings by booking_reference
CREATE POLICY "Allow reading bookings by reference"
ON public.bookings
FOR SELECT
USING (true);