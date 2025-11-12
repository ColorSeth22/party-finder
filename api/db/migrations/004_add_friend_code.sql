-- Migration: Add friend_code to Users for invite/friend adding
-- Created: 2025-11-12

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'friend_code'
    ) THEN
        ALTER TABLE Users ADD COLUMN friend_code TEXT;
        UPDATE Users SET friend_code = substr(md5(user_id::text), 1, 8) WHERE friend_code IS NULL;
        ALTER TABLE Users ALTER COLUMN friend_code SET NOT NULL;
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_users_friend_code'
        ) THEN
            CREATE UNIQUE INDEX uq_users_friend_code ON Users(friend_code);
        END IF;
        ALTER TABLE Users ALTER COLUMN friend_code SET DEFAULT lower(encode(gen_random_bytes(4), 'hex'));
    END IF;
END;
$$;