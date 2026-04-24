
-- Allow authenticated users to insert their own driver application (self-registration)
CREATE POLICY "Users can apply as drivers"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow drivers to view their own driver record (even if not yet active)
CREATE POLICY "Drivers can view their own record"
ON public.drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow drivers to update their own record (for onboarding document URLs etc.)
CREATE POLICY "Drivers can update their own record"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());
