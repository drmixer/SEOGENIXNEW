/*
  # User Data and Onboarding Schema - Fixed

  1. New Tables
    - `user_profiles` - Store user onboarding data and preferences
    - `audit_history` - Store historical audit results for tracking progress
    - `user_activity` - Track user actions for Genie personalization
    - `reports` - Store generated reports

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data

  3. Changes
    - Complete user onboarding workflow support
    - Historical performance tracking
    - Personalized AI assistant data
*/

-- Create tables only if they don't exist
DO $$
BEGIN
  -- User profiles table for onboarding data
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    CREATE TABLE user_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      websites jsonb DEFAULT '[]'::jsonb,
      competitors jsonb DEFAULT '[]'::jsonb,
      industry text,
      business_description text,
      plan text DEFAULT 'free',
      onboarding_completed_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;

  -- Audit history for tracking performance over time
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_history') THEN
    CREATE TABLE audit_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      website_url text NOT NULL,
      overall_score integer NOT NULL,
      ai_understanding integer NOT NULL,
      citation_likelihood integer NOT NULL,
      conversational_readiness integer NOT NULL,
      content_structure integer NOT NULL,
      recommendations jsonb DEFAULT '[]'::jsonb,
      issues jsonb DEFAULT '[]'::jsonb,
      audit_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- User activity tracking for Genie personalization
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity') THEN
    CREATE TABLE user_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      activity_type text NOT NULL,
      activity_data jsonb DEFAULT '{}'::jsonb,
      tool_id text,
      website_url text,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- Reports storage
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
    CREATE TABLE reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      report_type text NOT NULL,
      report_name text NOT NULL,
      report_data jsonb NOT NULL,
      file_url text,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Enable RLS only if not already enabled
DO $$
BEGIN
  -- Enable RLS on user_profiles if not already enabled
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = 'user_profiles' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;

  -- Enable RLS on audit_history if not already enabled
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_history') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = 'audit_history' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE audit_history ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;

  -- Enable RLS on user_activity if not already enabled
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = 'user_activity' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;

  -- Enable RLS on reports if not already enabled
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = 'reports' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Policies for user_profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can read own profile') THEN
    CREATE POLICY "Users can read own profile"
      ON user_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile"
      ON user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON user_profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Policies for audit_history
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_history' AND policyname = 'Users can read own audit history') THEN
    CREATE POLICY "Users can read own audit history"
      ON audit_history
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_history' AND policyname = 'Users can insert own audit history') THEN
    CREATE POLICY "Users can insert own audit history"
      ON audit_history
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policies for user_activity
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_activity' AND policyname = 'Users can read own activity') THEN
    CREATE POLICY "Users can read own activity"
      ON user_activity
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_activity' AND policyname = 'Users can insert own activity') THEN
    CREATE POLICY "Users can insert own activity"
      ON user_activity
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policies for reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Users can read own reports') THEN
    CREATE POLICY "Users can read own reports"
      ON reports
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Users can insert own reports') THEN
    CREATE POLICY "Users can insert own reports"
      ON reports
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Users can update own reports') THEN
    CREATE POLICY "Users can update own reports"
      ON reports
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Users can delete own reports') THEN
    CREATE POLICY "Users can delete own reports"
      ON reports
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_profiles_user_id') THEN
    CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_history_user_id') THEN
    CREATE INDEX idx_audit_history_user_id ON audit_history(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_audit_history_created_at') THEN
    CREATE INDEX idx_audit_history_created_at ON audit_history(created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_activity_user_id') THEN
    CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_activity_created_at') THEN
    CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_reports_user_id') THEN
    CREATE INDEX idx_reports_user_id ON reports(user_id);
  END IF;
END $$;