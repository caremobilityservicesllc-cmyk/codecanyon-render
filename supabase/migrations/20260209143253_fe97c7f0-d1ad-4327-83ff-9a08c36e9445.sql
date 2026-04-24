
-- Allow the setup process to insert system_settings when no admin exists yet
CREATE POLICY "Setup can insert settings when no admin exists"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
);

-- Allow the setup process to update system_settings when no admin exists yet
CREATE POLICY "Setup can update settings when no admin exists"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
);
