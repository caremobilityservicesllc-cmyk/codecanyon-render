-- Add column to track when a counter-proposal was accepted by the sharer
ALTER TABLE public.ride_shares 
ADD COLUMN IF NOT EXISTS counter_proposal_accepted_at timestamptz;