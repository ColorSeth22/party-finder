-- Migration: Add occupancy tracking and user data collection opt-in
-- Date: 2025-11-09

-- Add opt-in preference to Users table
ALTER TABLE Users ADD COLUMN IF NOT EXISTS allow_data_collection BOOLEAN DEFAULT FALSE;

-- Occupancy reports table for crowd-sourced data
CREATE TABLE IF NOT EXISTS OccupancyReports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES Locations(location_id) ON DELETE CASCADE,
    occupancy_level INTEGER NOT NULL CHECK (occupancy_level >= 1 AND occupancy_level <= 5),
    -- 1 = Empty, 2 = Few people, 3 = Moderate, 4 = Busy, 5 = Very crowded
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Optional: GPS coords when report was made (for proximity verification)
    report_latitude DOUBLE PRECISION,
    report_longitude DOUBLE PRECISION,
    -- Metadata for analytics
    device_type TEXT, -- web, ios, android
    session_duration INTEGER -- how long user was there (minutes)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_occupancy_location ON OccupancyReports(location_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_reported_at ON OccupancyReports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_user ON OccupancyReports(user_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_location_time ON OccupancyReports(location_id, reported_at DESC);

-- Materialized view for current occupancy (last 30 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS CurrentOccupancy AS
SELECT 
    location_id,
    AVG(occupancy_level) as avg_occupancy,
    COUNT(*) as report_count,
    MAX(reported_at) as last_report_time
FROM OccupancyReports
WHERE reported_at > NOW() - INTERVAL '30 minutes'
GROUP BY location_id;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_current_occupancy_location ON CurrentOccupancy(location_id);

-- Function to refresh current occupancy view
CREATE OR REPLACE FUNCTION refresh_current_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY CurrentOccupancy;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-refresh when new reports come in (can be removed for performance)
-- DROP TRIGGER IF EXISTS trigger_refresh_occupancy ON OccupancyReports;
-- CREATE TRIGGER trigger_refresh_occupancy
-- AFTER INSERT ON OccupancyReports
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION refresh_current_occupancy();

-- Function to get historical occupancy patterns (by hour and day of week)
CREATE OR REPLACE FUNCTION get_occupancy_pattern(p_location_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    day_of_week INTEGER,
    hour_of_day INTEGER,
    avg_occupancy NUMERIC,
    report_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(DOW FROM reported_at)::INTEGER as day_of_week,
        EXTRACT(HOUR FROM reported_at)::INTEGER as hour_of_day,
        AVG(occupancy_level) as avg_occupancy,
        COUNT(*) as report_count
    FROM OccupancyReports
    WHERE location_id = p_location_id
      AND reported_at > NOW() - (p_days_back || ' days')::INTERVAL
    GROUP BY day_of_week, hour_of_day
    ORDER BY day_of_week, hour_of_day;
END;
$$ LANGUAGE plpgsql;

-- Add points for submitting occupancy reports
-- Update the award_points check constraint to include new activity type
ALTER TABLE UserActivities DROP CONSTRAINT IF EXISTS useractivities_activity_type_check;
ALTER TABLE UserActivities ADD CONSTRAINT useractivities_activity_type_check 
    CHECK (activity_type IN ('add_location', 'edit_location', 'edit_tags', 'add_rating', 'report_occupancy'));

-- Update award_points function to handle occupancy reports
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
        WHEN 'report_occupancy' THEN 1
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

-- Privacy note comment
COMMENT ON TABLE OccupancyReports IS 'Crowd-sourced occupancy data. Users must opt-in via allow_data_collection. GPS coordinates are optional and only used for proximity verification.';
COMMENT ON COLUMN Users.allow_data_collection IS 'User consent for collecting anonymous location occupancy data to help the community.';
