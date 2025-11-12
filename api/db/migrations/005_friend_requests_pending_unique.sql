-- Migration: Make friend request uniqueness apply only to pending requests
-- Allows multiple requests over time after accept/reject or friendship removal

-- Drop existing simple unique constraint if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'friendrequests' AND constraint_name = 'uq_friend_request'
    ) THEN
        ALTER TABLE FriendRequests DROP CONSTRAINT uq_friend_request;
    END IF;
END;
$$;

-- Create a partial unique index across user pairs regardless of direction, only for pending
CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_requests_pending_unique
ON FriendRequests (LEAST(from_user_id, to_user_id), GREATEST(from_user_id, to_user_id))
WHERE status = 'pending';