/*
  # Fix duplicate user profiles

  1. New Functions
    - Create a function to identify and remove duplicate user profiles
  
  2. Changes
    - Add a unique constraint on user_id to prevent future duplicates
    - Clean up existing duplicate profiles by keeping only the most recently updated one
*/

-- First, create a temporary function to clean up duplicates
DO $$
BEGIN
  -- Find duplicate user_id entries and keep only the most recently updated one
  CREATE TEMP TABLE user_profiles_to_delete AS
  SELECT id
  FROM (
    SELECT id,
           user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as row_num
    FROM user_profiles
  ) t
  WHERE row_num > 1;

  -- Delete the duplicates
  DELETE FROM user_profiles
  WHERE id IN (SELECT id FROM user_profiles_to_delete);

  -- Drop the temporary table
  DROP TABLE user_profiles_to_delete;
END $$;

-- Add a unique constraint on user_id to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;