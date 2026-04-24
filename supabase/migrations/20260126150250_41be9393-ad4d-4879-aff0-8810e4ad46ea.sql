-- Add a new notification type for ride share invitations
-- First check if the type already exists, and add if needed
DO $$
BEGIN
  -- Add 'share_invitation' to notification_type enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'share_invitation' 
    AND enumtypid = 'notification_type'::regtype
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'share_invitation';
  END IF;
  
  -- Add 'share_accepted' to notification_type enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'share_accepted' 
    AND enumtypid = 'notification_type'::regtype
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'share_accepted';
  END IF;
END $$;