
-- Add bank transfer details column to bookings
ALTER TABLE public.bookings ADD COLUMN bank_transfer_details jsonb DEFAULT NULL;

COMMENT ON COLUMN public.bookings.bank_transfer_details IS 'Stores bank transfer proof: sender_name, bank_name, transfer_reference, transfer_date, amount_transferred, notes';
