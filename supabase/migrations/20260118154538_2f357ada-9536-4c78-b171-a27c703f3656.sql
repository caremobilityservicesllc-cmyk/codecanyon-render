-- Add promo_code_id column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL;

-- Add discount_amount column to store the actual discount applied
ALTER TABLE public.bookings 
ADD COLUMN discount_amount NUMERIC DEFAULT 0;

-- Add index for faster lookups
CREATE INDEX idx_bookings_promo_code ON public.bookings(promo_code_id) WHERE promo_code_id IS NOT NULL;