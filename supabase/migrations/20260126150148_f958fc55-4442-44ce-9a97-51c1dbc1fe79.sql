-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view shares they created or received" ON public.ride_shares;

-- Create updated SELECT policy that also checks shared_with_email
CREATE POLICY "Users can view shares they created or received" 
ON public.ride_shares 
FOR SELECT 
USING (
  auth.uid() = shared_by_user_id 
  OR auth.uid() = shared_with_user_id 
  OR lower(shared_with_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''))
);