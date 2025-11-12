-- Migration: Add Friends System and Event Visibility
-- Created: 2025-11-12

-- Add visibility column to Events table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE Events 
        ADD COLUMN visibility TEXT DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'friends'));
    END IF;
END $$;

-- Create Friendships table
CREATE TABLE IF NOT EXISTS Friendships (
    friendship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure users can't be friends with themselves
    CONSTRAINT chk_different_users CHECK (user_id_1 != user_id_2)
);

-- Create unique index to prevent duplicate friendships regardless of order
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique 
ON Friendships (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2));

-- Create Friend Requests table
CREATE TABLE IF NOT EXISTS FriendRequests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure users can't send requests to themselves
    CONSTRAINT chk_different_users_request CHECK (from_user_id != to_user_id),
    -- Only one active request between two users at a time
    CONSTRAINT uq_friend_request UNIQUE (from_user_id, to_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON Friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON Friendships(user_id_2);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON FriendRequests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON FriendRequests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON FriendRequests(status);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON Events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON Events(created_by);

-- Function to check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM Friendships
        WHERE (user_id_1 = p_user_id_1 AND user_id_2 = p_user_id_2)
           OR (user_id_1 = p_user_id_2 AND user_id_2 = p_user_id_1)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's friends
CREATE OR REPLACE FUNCTION get_user_friends(p_user_id UUID)
RETURNS TABLE (
    friendship_id UUID,
    user_id UUID,
    email TEXT,
    display_name TEXT,
    reputation_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.friendship_id,
        u.user_id,
        u.email,
        u.display_name,
        u.reputation_score,
        f.created_at
    FROM Friendships f
    JOIN Users u ON (
        CASE 
            WHEN f.user_id_1 = p_user_id THEN u.user_id = f.user_id_2
            ELSE u.user_id = f.user_id_1
        END
    )
    WHERE f.user_id_1 = p_user_id OR f.user_id_2 = p_user_id
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on FriendRequests
CREATE OR REPLACE FUNCTION update_friend_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_friend_request_timestamp ON FriendRequests;
CREATE TRIGGER trg_update_friend_request_timestamp
    BEFORE UPDATE ON FriendRequests
    FOR EACH ROW
    EXECUTE FUNCTION update_friend_request_timestamp();
