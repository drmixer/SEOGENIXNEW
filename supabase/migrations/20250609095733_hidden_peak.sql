/*
  # User Data Tracking and Historical Performance

  1. New Tables
    - `user_profiles` - Store user onboarding data and preferences
    - `audit_history` - Store historical audit results for tracking progress
    - `user_activity` - Track user actions for Genie personalization
    - `reports` - Store generated reports

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

-- User profiles table for onboarding data
CREATE TABLE IF NOT EXISTS user_profiles (
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

-- Audit history for tracking performance over time
CREATE TABLE IF NOT EXISTS audit_history (
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

-- User activity tracking for Genie personalization
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'tool_used', 'audit_run', 'page_visited', etc.
  activity_data jsonb DEFAULT '{}'::jsonb,
  tool_id text,
  website_url text,
  created_at timestamptz DEFAULT now()
);

-- Reports storage
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL, -- 'audit', 'competitive', 'citation', etc.
  report_name text NOT NULL,
  report_data jsonb NOT NULL,
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for audit_history
CREATE POLICY "Users can read own audit history"
  ON audit_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit history"
  ON audit_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policies for user_activity
CREATE POLICY "Users can read own activity"
  ON user_activity
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON user_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policies for reports
CREATE POLICY "Users can read own reports"
  ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_history_user_id ON audit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_history_created_at ON audit_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);