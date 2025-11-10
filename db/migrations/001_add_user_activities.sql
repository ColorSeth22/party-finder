-- Migration: Add user_activities table to track contributions and award points
-- Date: 2025-11-09

-- Activity types: add_location, edit_location, add_tags, edit_tags, add_rating
CREATE TABLE IF NOT EXISTS UserActivities (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('add_location', 'edit_location', 'edit_tags', 'add_rating')),
    location_id UUID REFERENCES Locations(location_id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL DEFAULT 0,
    metadata JSONB, -- Store additional details like old/new tags, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying user's activity history
CREATE INDEX idx_user_activities_user_id ON UserActivities(user_id);
CREATE INDEX idx_user_activities_created_at ON UserActivities(created_at DESC);
CREATE INDEX idx_user_activities_location_id ON UserActivities(location_id);

-- Function to calculate and award points based on activity type
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_activity_type TEXT,
    p_location_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_points INTEGER;
BEGIN
    -- Define points for each activity type
    v_points := CASE p_activity_type
        WHEN 'add_location' THEN 10
        WHEN 'edit_location' THEN 5
        WHEN 'edit_tags' THEN 3
        WHEN 'add_rating' THEN 2
        ELSE 0
    END;
    
    -- Record the activity
    INSERT INTO UserActivities (user_id, activity_type, location_id, points_earned, metadata)
    VALUES (p_user_id, p_activity_type, p_location_id, v_points, p_metadata);
    
    -- Update user's reputation score
    UPDATE Users
    SET reputation_score = reputation_score + v_points
    WHERE user_id = p_user_id;
    
    RETURN v_points;
END;
$$ LANGUAGE plpgsql;
