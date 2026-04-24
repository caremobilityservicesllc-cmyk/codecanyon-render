-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Recipients can update ride shares" ON public.ride_shares;

-- Create a new policy that allows accepting shares by email match
CREATE POLICY "Recipients can update ride shares"
ON public.ride_shares
FOR UPDATE
USING (
  auth.uid() = shared_with_user_id
  OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  auth.uid() = shared_with_user_id
  OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);