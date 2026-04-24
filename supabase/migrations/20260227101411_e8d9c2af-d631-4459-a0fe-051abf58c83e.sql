
-- Drop the restrictive setup policies that block admin inserts
DROP POLICY IF EXISTS "Setup can insert settings when no admin exists" ON public.system_settings;
DROP POLICY IF EXISTS "Setup can update settings when no admin exists" ON public.system_settings;

-- Recreate as PERMISSIVE so they don't block admin access
CREATE POLICY "Setup can insert settings when no admin exists"
ON public.system_settings FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin'::app_role)
);

CREATE POLICY "Setup can update settings when no admin exists"
ON public.system_settings FOR UPDATE
TO authenticated
USING (
  NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin'::app_role)
);
