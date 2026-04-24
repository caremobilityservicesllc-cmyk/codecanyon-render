-- Add columns to store counter-proposal details
ALTER TABLE public.ride_shares 
ADD COLUMN IF NOT EXISTS proposed_cost_split_percentage integer,
ADD COLUMN IF NOT EXISTS proposed_at timestamptz,
ADD COLUMN IF NOT EXISTS proposed_by_user_id uuid;