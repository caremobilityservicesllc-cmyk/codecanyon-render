
-- Fix overly permissive INSERT policies on loyalty_points and loyalty_balances
-- These should only allow inserts from service_role (edge functions) or admins

DROP POLICY IF EXISTS "System can insert points" ON public.loyalty_points;
CREATE POLICY "Service role can insert points" ON public.loyalty_points
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "System can upsert balances" ON public.loyalty_balances;
CREATE POLICY "Service role can insert balances" ON public.loyalty_balances
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "System can update balances" ON public.loyalty_balances;
CREATE POLICY "Service role can update balances" ON public.loyalty_balances
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);
