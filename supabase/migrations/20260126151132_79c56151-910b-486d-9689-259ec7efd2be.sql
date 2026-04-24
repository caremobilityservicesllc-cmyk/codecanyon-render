-- Add 'share_counter_proposal' to the notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'share_counter_proposal';