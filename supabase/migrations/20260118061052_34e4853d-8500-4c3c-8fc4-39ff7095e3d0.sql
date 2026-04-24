-- Add payment_type column to distinguish between different payment methods
ALTER TABLE public.payment_methods 
ADD COLUMN payment_type text NOT NULL DEFAULT 'card';

-- Make card-specific columns nullable for non-card payment methods
ALTER TABLE public.payment_methods 
ALTER COLUMN card_brand DROP NOT NULL,
ALTER COLUMN card_last_four DROP NOT NULL,
ALTER COLUMN card_expiry_month DROP NOT NULL,
ALTER COLUMN card_expiry_year DROP NOT NULL,
ALTER COLUMN cardholder_name DROP NOT NULL;

-- Add PayPal-specific columns
ALTER TABLE public.payment_methods 
ADD COLUMN paypal_email text;

-- Add bank transfer specific columns
ALTER TABLE public.payment_methods 
ADD COLUMN bank_name text,
ADD COLUMN account_holder_name text,
ADD COLUMN account_last_four text;

-- Add check constraint to ensure payment_type is valid
ALTER TABLE public.payment_methods 
ADD CONSTRAINT valid_payment_type CHECK (payment_type IN ('card', 'paypal', 'bank'));

-- Add constraint to ensure card fields are present for card type
ALTER TABLE public.payment_methods
ADD CONSTRAINT card_fields_required CHECK (
  payment_type != 'card' OR (
    card_brand IS NOT NULL AND 
    card_last_four IS NOT NULL AND 
    card_expiry_month IS NOT NULL AND 
    card_expiry_year IS NOT NULL AND 
    cardholder_name IS NOT NULL
  )
);

-- Add constraint to ensure PayPal email is present for PayPal type
ALTER TABLE public.payment_methods
ADD CONSTRAINT paypal_fields_required CHECK (
  payment_type != 'paypal' OR paypal_email IS NOT NULL
);

-- Add constraint to ensure bank fields are present for bank type
ALTER TABLE public.payment_methods
ADD CONSTRAINT bank_fields_required CHECK (
  payment_type != 'bank' OR (
    bank_name IS NOT NULL AND 
    account_holder_name IS NOT NULL AND 
    account_last_four IS NOT NULL
  )
);