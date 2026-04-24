-- Create system_settings table to store admin-configurable settings
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view settings (for frontend to use)
CREATE POLICY "Anyone can view system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (key, value, description, category) VALUES
('business_info', '{"companyName": "RideFlow", "email": "support@rideflow.com", "phone": "+1 (555) 000-0000", "address": "", "timezone": "UTC"}', 'Business contact information', 'general'),
('business_hours', '{"start": "06:00", "end": "22:00", "daysOfWeek": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}', 'Operating hours configuration', 'general'),
('booking_policies', '{"depositPercentage": 30, "cancellationHours": 24, "minAdvanceBookingHours": 2, "maxAdvanceBookingDays": 30, "pickupTimeInterval": 15}', 'Booking policy settings', 'booking'),
('currency', '{"code": "USD", "symbol": "$", "position": "before"}', 'Currency configuration', 'general'),
('email_settings', '{"senderName": "RideFlow", "senderEmail": "noreply@rideflow.com", "sendConfirmations": true, "sendReminders": true, "reminderHoursBefore": 24}', 'Email notification settings', 'notifications'),
('sms_settings', '{"enabled": false, "provider": "", "sendDriverArriving": true, "sendRideUpdates": true}', 'SMS notification settings', 'notifications');