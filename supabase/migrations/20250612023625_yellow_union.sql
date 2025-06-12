-- This migration ensures that user_profiles table has a unique constraint on user_id
-- and cleans up any duplicate profiles that might exist

-- First, create a temporary table to store the IDs of profiles to keep
CREATE TEMP TABLE profiles_to_keep AS
WITH ranked_profiles AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY COALESCE(updated_at, created_at) DESC) as row_num
  FROM user_profiles
)
SELECT id FROM ranked_profiles WHERE row_num = 1;

-- Delete duplicates (keeping only the newest profile for each user)
DELETE FROM user_profiles
WHERE id NOT IN (SELECT id FROM profiles_to_keep);

-- Add unique constraint only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_user_id_key' AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Make sure we have proper indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_profiles_user_id'
  ) THEN
    CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
  END IF;
END $$;

-- Drop the temporary table
DROP TABLE profiles_to_keep;