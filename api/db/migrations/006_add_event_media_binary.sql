-- Add EventMedia table with binary storage
-- Migration: 006_add_event_media_binary.sql

-- Add archival columns to Events if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'is_archived') THEN
        ALTER TABLE Events ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'archived_at') THEN
        ALTER TABLE Events ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'visibility') THEN
        ALTER TABLE Events ADD COLUMN visibility TEXT DEFAULT 'everyone';
    END IF;
END;
$$;

-- Backfill existing events
UPDATE Events SET is_archived = FALSE WHERE is_archived IS NULL;
UPDATE Events SET visibility = 'everyone' WHERE visibility IS NULL;

-- Create EventMedia table with binary storage
CREATE TABLE IF NOT EXISTS EventMedia (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES Events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    media_data BYTEA NOT NULL,  -- Binary data stored in DB
    mime_type TEXT NOT NULL,     -- e.g., 'image/jpeg', 'video/mp4'
    file_size INTEGER NOT NULL,  -- Size in bytes
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create EventRatings table if not exists
CREATE TABLE IF NOT EXISTS EventRatings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES Events(event_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_event_rating_user UNIQUE (event_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_archived ON Events(is_archived);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON Events(visibility);
CREATE INDEX IF NOT EXISTS idx_event_media_event ON EventMedia(event_id);
CREATE INDEX IF NOT EXISTS idx_event_media_user ON EventMedia(user_id);
CREATE INDEX IF NOT EXISTS idx_event_media_created ON EventMedia(created_at);
CREATE INDEX IF NOT EXISTS idx_event_ratings_event ON EventRatings(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ratings_user ON EventRatings(user_id);
