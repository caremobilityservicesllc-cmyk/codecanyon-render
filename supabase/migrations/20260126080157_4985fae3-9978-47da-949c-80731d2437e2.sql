-- Add document verification fields to drivers table
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS license_front_url TEXT,
ADD COLUMN IF NOT EXISTS license_back_url TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS vehicle_registration_url TEXT,
ADD COLUMN IF NOT EXISTS insurance_url TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'approved', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS background_check_date DATE,
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'documents_submitted', 'under_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS earnings_total DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS earnings_this_month DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_rides_this_month INTEGER DEFAULT 0;

-- Create driver_documents table for document tracking
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('license_front', 'license_back', 'profile_photo', 'vehicle_registration', 'insurance', 'background_check', 'other')),
  document_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on driver_documents
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_documents
CREATE POLICY "Admins can manage all documents"
  ON public.driver_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can view their own documents"
  ON public.driver_documents
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can upload their own documents"
  ON public.driver_documents
  FOR INSERT
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Create driver_earnings table for detailed earnings tracking
CREATE TABLE IF NOT EXISTS public.driver_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  earning_type TEXT NOT NULL DEFAULT 'ride' CHECK (earning_type IN ('ride', 'tip', 'bonus', 'adjustment')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on driver_earnings
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_earnings
CREATE POLICY "Admins can manage all earnings"
  ON public.driver_earnings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can view their own earnings"
  ON public.driver_earnings
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Create function to update driver earnings summary
CREATE OR REPLACE FUNCTION public.update_driver_earnings_summary()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.drivers
  SET 
    earnings_total = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.driver_earnings
      WHERE driver_id = NEW.driver_id
    ),
    earnings_this_month = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.driver_earnings
      WHERE driver_id = NEW.driver_id
      AND created_at >= date_trunc('month', CURRENT_DATE)
    ),
    completed_rides_this_month = (
      SELECT COUNT(*)
      FROM public.driver_earnings
      WHERE driver_id = NEW.driver_id
      AND earning_type = 'ride'
      AND created_at >= date_trunc('month', CURRENT_DATE)
    )
  WHERE id = NEW.driver_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update earnings summary
CREATE TRIGGER update_driver_earnings_after_insert
AFTER INSERT ON public.driver_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_driver_earnings_summary();

-- Add updated_at trigger for driver_documents
CREATE TRIGGER update_driver_documents_updated_at
BEFORE UPDATE ON public.driver_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for driver documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver documents bucket
CREATE POLICY "Admins can manage driver documents storage"
ON storage.objects FOR ALL
USING (bucket_id = 'driver-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can upload their own documents storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can view their own documents storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);