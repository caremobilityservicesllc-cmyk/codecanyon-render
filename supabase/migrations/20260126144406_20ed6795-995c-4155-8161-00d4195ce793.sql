-- Fix ride share acceptance: avoid referencing auth.users in RLS (causes "permission denied for table users")

DROP POLICY IF EXISTS "Recipients can update ride shares" ON public.ride_shares;

CREATE POLICY "Recipients can update ride shares"
ON public.ride_shares
FOR UPDATE
USING (
  auth.uid() = shared_with_user_id
  OR lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  auth.uid() = shared_with_user_id
  OR lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
