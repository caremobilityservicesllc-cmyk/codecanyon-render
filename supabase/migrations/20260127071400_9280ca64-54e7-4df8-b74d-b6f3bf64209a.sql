-- Create settings audit log table
CREATE TABLE public.settings_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  action TEXT NOT NULL DEFAULT 'update',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.settings_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON public.settings_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_settings_audit_log_created_at ON public.settings_audit_log(created_at DESC);
CREATE INDEX idx_settings_audit_log_setting_key ON public.settings_audit_log(setting_key);