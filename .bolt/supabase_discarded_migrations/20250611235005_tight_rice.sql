/*
  # Fix duplicate user profiles issue

  1. Changes
     - Add a unique constraint to user_profiles.user_id to prevent duplicates
     - Add a migration to clean up existing duplicates
  
  2. Security
     - No changes to RLS policies
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

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);

-- Drop the temporary table
DROP TABLE profiles_to_keep;