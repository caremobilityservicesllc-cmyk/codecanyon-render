-- Add billing details columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS billing_full_name text,
ADD COLUMN IF NOT EXISTS billing_company_name text,
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS billing_state text,
ADD COLUMN IF NOT EXISTS billing_postal_code text,
ADD COLUMN IF NOT EXISTS billing_country text,
ADD COLUMN IF NOT EXISTS billing_vat_number text;