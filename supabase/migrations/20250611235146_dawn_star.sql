/*
  # Fix duplicate user profiles

  1. Changes
    - Safely removes duplicate user profiles while keeping the most recent one
    - Adds unique constraint on user_id if it doesn't exist
  2. Security
    - No security changes
*/

-- First, check if we need to clean up duplicates
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  -- Count how many users have multiple profiles
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, COUNT(*) as profile_count
    FROM user_profiles
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) as duplicates;
  
  -- Only run the cleanup if duplicates exist
  IF duplicate_count > 0 THEN
    -- Create temp table with IDs to keep (most recent profile per user)
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
    
    -- Drop the temporary table
    DROP TABLE profiles_to_keep;
    
    RAISE NOTICE 'Removed % duplicate user profiles', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate user profiles found';
  END IF;
END $$;

-- Check if the unique constraint exists before trying to add it
DO $$ 
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_user_id_key' AND conrelid = 'user_profiles'::regclass
  ) THEN
    -- Add the constraint only if it doesn't exist
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
    RAISE NOTICE 'Added unique constraint on user_id';
  ELSE
    RAISE NOTICE 'Unique constraint on user_id already exists';
  END IF;
END $$;