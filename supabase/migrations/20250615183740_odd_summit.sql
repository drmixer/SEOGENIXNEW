/*
  # Add LemonSqueezy subscription fields to user_profiles

  1. Changes
    - Add columns to store LemonSqueezy customer and subscription IDs
    - Add columns to track subscription status and update time
    - Add goals array column for tracking user goals
  
  2. Security
    - No security changes needed as we're just adding columns to existing table
*/

-- Add LemonSqueezy fields to user_profiles table
DO $$
BEGIN
  -- Add lemonsqueezy_customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'lemonsqueezy_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN lemonsqueezy_customer_id text;
  END IF;

  -- Add lemonsqueezy_subscription_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'lemonsqueezy_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN lemonsqueezy_subscription_id text;
  END IF;

  -- Add subscription_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_status text DEFAULT 'none';
  END IF;

  -- Add subscription_updated_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_updated_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_updated_at timestamptz;
  END IF;

  -- Add goals array if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'goals'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN goals text[] DEFAULT '{}';
  END IF;
END $$;