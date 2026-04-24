-- Add total_price column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN total_price numeric DEFAULT 0;