-- Add verification columns to payment_methods
ALTER TABLE public.payment_methods
ADD COLUMN is_verified boolean DEFAULT false,
ADD COLUMN verification_amount_cents integer,
ADD COLUMN verification_attempts integer DEFAULT 0,
ADD COLUMN verification_expires_at timestamp with time zone,
ADD COLUMN verified_at timestamp with time zone;

-- Add index for unverified payment methods
CREATE INDEX idx_payment_methods_unverified ON public.payment_methods (user_id, is_verified) WHERE is_verified = false;