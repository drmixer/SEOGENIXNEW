/*
  # Fix duplicate user profiles

  1. Changes
     - Removes duplicate user profiles, keeping only the most recent one per user
     - Adds a unique constraint on user_id if it doesn't already exist
  
  2. Security
     - No security changes
*/

-- First, create a temporary table to store the IDs of profiles to keep
CREATE TEMP TABLE profiles_to_keep AS
WITH ranked_profiles AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
  FROM user_profiles
)
SELECT id FROM ranked_profiles WHERE row_num = 1;

-- Delete duplicates (keeping only the newest profile for each user)
DELETE FROM user_profiles
WHERE id NOT IN (SELECT id FROM profiles_to_keep);

-- Add unique constraint only if it doesn't already exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_user_id_key' AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Drop the temporary table
DROP TABLE profiles_to_keep;