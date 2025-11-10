-- Migration to add missing tables and columns
-- Run this in your Neon SQL Editor

-- Add missing column to Users table
ALTER TABLE Users ADD COLUMN IF NOT EXISTS allow_data_collection BOOLEAN DEFAULT false;

-- Create OccupancyReports table
CREATE TABLE IF NOT EXISTS OccupancyReports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES Locations(location_id) ON DELETE CASCADE,
    occupancy_level INTEGER NOT NULL CHECK (occupancy_level >= 1 AND occupancy_level <= 5),
    report_latitude DOUBLE PRECISION,
    report_longitude DOUBLE PRECISION,
    device_type TEXT DEFAULT 'web',
    session_duration INTEGER,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create UserActivities table
CREATE TABLE IF NOT EXISTS UserActivities (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID REFERENCES Locations(location_id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    points_earned INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to award points
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_activity_type TEXT,
    p_location_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_points INTEGER := 0;
BEGIN
    CASE p_activity_type
        WHEN 'add_location' THEN v_points := 10;
        WHEN 'edit_location' THEN v_points := 5;
        WHEN 'edit_tags' THEN v_points := 3;
        WHEN 'add_rating' THEN v_points := 5;
        WHEN 'report_occupancy' THEN v_points := 2;
        ELSE v_points := 1;
    END CASE;

    INSERT INTO UserActivities (user_id, location_id, activity_type, points_earned, metadata)
    VALUES (p_user_id, p_location_id, p_activity_type, v_points, p_metadata);

    UPDATE Users
    SET reputation_score = reputation_score + v_points
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_occupancy_location ON OccupancyReports(location_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_reported_at ON OccupancyReports(reported_at);
CREATE INDEX IF NOT EXISTS idx_occupancy_location_time ON OccupancyReports(location_id, reported_at);
CREATE INDEX IF NOT EXISTS idx_activities_user ON UserActivities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON UserActivities(created_at);
