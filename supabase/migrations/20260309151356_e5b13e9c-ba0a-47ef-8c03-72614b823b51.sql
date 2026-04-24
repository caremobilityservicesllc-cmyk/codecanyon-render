
-- Fix: the "Anyone can read" policy is RESTRICTIVE, which blocks all reads since no PERMISSIVE policy exists.
-- Drop it and recreate as PERMISSIVE.
DROP POLICY IF EXISTS "Anyone can read translation overrides" ON public.translation_overrides;
CREATE POLICY "Anyone can read translation overrides"
  ON public.translation_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);
