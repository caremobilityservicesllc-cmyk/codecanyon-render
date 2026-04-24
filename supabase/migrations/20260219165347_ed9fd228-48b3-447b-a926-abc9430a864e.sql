-- Allow drivers to update bookings assigned to them (for start/complete ride)
CREATE POLICY "Drivers can update their assigned bookings"
ON public.bookings
FOR UPDATE
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
);

-- Allow drivers to insert their own earnings
CREATE POLICY "Drivers can insert their own earnings"
ON public.driver_earnings
FOR INSERT
WITH CHECK (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
);