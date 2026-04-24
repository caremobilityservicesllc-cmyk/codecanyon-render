
-- Create email_logs table for tracking all sent emails
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'booking',
  provider TEXT NOT NULL DEFAULT 'resend',
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  booking_reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role inserts (edge functions use service role)
CREATE POLICY "Service role can insert email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (true);

-- Index for faster queries
CREATE INDEX idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX idx_email_logs_status ON public.email_logs (status);
CREATE INDEX idx_email_logs_recipient ON public.email_logs (recipient_email);
