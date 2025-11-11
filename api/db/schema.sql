-- Campus Party Finder PostgreSQL Database Schema
-- Generated: 2025-11-11

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (retained from QuietLocations)
CREATE TABLE IF NOT EXISTS Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    reputation_score INTEGER DEFAULT 0,
    allow_data_collection BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Host type enum for events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'host_type') THEN
        CREATE TYPE host_type AS ENUM ('fraternity', 'house', 'club');
    END IF;
END;
$$;

-- Events table
CREATE TABLE IF NOT EXISTS Events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    host_type host_type NOT NULL,
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    theme TEXT,
    music_type TEXT,
    cover_charge TEXT,
    is_byob BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity tracking table (still used for future gamification)
CREATE TABLE IF NOT EXISTS UserActivities (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    event_id UUID REFERENCES Events(event_id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    points_earned INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to award points for user activities
-- Drop previous versions to avoid parameter-name mismatch errors
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'award_points'
          AND oid = (
            SELECT p.oid FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE p.proname = 'award_points'
              AND n.nspname = 'public'
              AND pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, jsonb'
          )
    ) THEN
        DROP FUNCTION IF EXISTS award_points(UUID, TEXT, UUID, JSONB);
    END IF;
END$$;

CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_activity_type TEXT,
    p_event_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_points INTEGER := 0;
BEGIN
    CASE p_activity_type
        WHEN 'add_event' THEN v_points := 10;
        WHEN 'edit_event' THEN v_points := 5;
        WHEN 'check_in' THEN v_points := 2;
        WHEN 'favorite_event' THEN v_points := 1;
        ELSE v_points := 1;
    END CASE;

    INSERT INTO UserActivities (user_id, event_id, activity_type, points_earned, metadata)
    VALUES (p_user_id, p_event_id, p_activity_type, v_points, COALESCE(p_metadata, '{}'::jsonb));

    UPDATE Users
    SET reputation_score = reputation_score + v_points
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Check-ins table
CREATE TABLE IF NOT EXISTS CheckIns (
    checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES Events(event_id) ON DELETE CASCADE,
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_checkins_user_event UNIQUE (user_id, event_id)
);

-- Favorites table
CREATE TABLE IF NOT EXISTS Favorites (
    favorite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES Events(event_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_favorites_user_event UNIQUE (user_id, event_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_events_active ON Events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_host_type ON Events(host_type);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON Events(start_time);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON CheckIns(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON CheckIns(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON Favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_event ON Favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user ON UserActivities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_event ON UserActivities(event_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON UserActivities(created_at);
