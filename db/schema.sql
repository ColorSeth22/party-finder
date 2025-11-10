-- QuietLocations PostgreSQL Database Schema
-- Generated: 2025-11-06

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    reputation_score INTEGER DEFAULT 0,
    allow_data_collection BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations table
CREATE TABLE Locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    description TEXT,
    created_by UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE Tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

-- LocationTags junction table (many-to-many between Locations and Tags)
CREATE TABLE LocationTags (
    location_id UUID REFERENCES Locations(location_id) ON DELETE CASCADE,
    tag_id UUID REFERENCES Tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (location_id, tag_id)
);

-- Ratings table
CREATE TABLE Ratings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES Locations(location_id) ON DELETE CASCADE,
    quietness_score INTEGER NOT NULL CHECK (quietness_score >= 1 AND quietness_score <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites table
CREATE TABLE Favorites (
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES Locations(location_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, location_id)
);

-- OccupancyReports table
CREATE TABLE OccupancyReports (
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

-- UserActivities table (for gamification and reputation tracking)
CREATE TABLE UserActivities (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID REFERENCES Locations(location_id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    points_earned INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to award points for user activities
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_activity_type TEXT,
    p_location_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_points INTEGER := 0;
BEGIN
    -- Determine points based on activity type
    CASE p_activity_type
        WHEN 'add_location' THEN v_points := 10;
        WHEN 'edit_location' THEN v_points := 5;
        WHEN 'edit_tags' THEN v_points := 3;
        WHEN 'add_rating' THEN v_points := 5;
        WHEN 'report_occupancy' THEN v_points := 2;
        ELSE v_points := 1;
    END CASE;

    -- Insert activity record
    INSERT INTO UserActivities (user_id, location_id, activity_type, points_earned, metadata)
    VALUES (p_user_id, p_location_id, p_activity_type, v_points, p_metadata);

    -- Update user's reputation score
    UPDATE Users
    SET reputation_score = reputation_score + v_points
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Indexes for better query performance
CREATE INDEX idx_locations_created_by ON Locations(created_by);
CREATE INDEX idx_locations_coords ON Locations(latitude, longitude);
CREATE INDEX idx_ratings_user_id ON Ratings(user_id);
CREATE INDEX idx_ratings_location_id ON Ratings(location_id);
CREATE INDEX idx_location_tags_location ON LocationTags(location_id);
CREATE INDEX idx_location_tags_tag ON LocationTags(tag_id);
CREATE INDEX idx_favorites_user ON Favorites(user_id);
CREATE INDEX idx_favorites_location ON Favorites(location_id);
CREATE INDEX idx_occupancy_location ON OccupancyReports(location_id);
CREATE INDEX idx_occupancy_reported_at ON OccupancyReports(reported_at);
CREATE INDEX idx_occupancy_location_time ON OccupancyReports(location_id, reported_at);
CREATE INDEX idx_activities_user ON UserActivities(user_id);
CREATE INDEX idx_activities_created_at ON UserActivities(created_at);
