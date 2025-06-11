/*
  # Citation Tracker Improvements

  1. New Tables
    - `saved_citation_prompts` - Store user's saved prompts for re-running
    - `fingerprint_phrases` - Store user's unique content phrases for detection

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Saved citation prompts table
CREATE TABLE IF NOT EXISTS saved_citation_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  domain text NOT NULL,
  keywords text[] NOT NULL,
  prompt_text text,
  created_at timestamptz DEFAULT now()
);

-- Fingerprint phrases table
CREATE TABLE IF NOT EXISTS fingerprint_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phrase text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE saved_citation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fingerprint_phrases ENABLE ROW LEVEL SECURITY;

-- Saved citation prompts policies
CREATE POLICY "Users can read own saved prompts"
  ON saved_citation_prompts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved prompts"
  ON saved_citation_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved prompts"
  ON saved_citation_prompts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fingerprint phrases policies
CREATE POLICY "Users can read own fingerprint phrases"
  ON fingerprint_phrases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fingerprint phrases"
  ON fingerprint_phrases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fingerprint phrases"
  ON fingerprint_phrases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fingerprint phrases"
  ON fingerprint_phrases
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_citation_prompts_user_id ON saved_citation_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_citation_prompts_domain ON saved_citation_prompts(domain);
CREATE INDEX IF NOT EXISTS idx_fingerprint_phrases_user_id ON fingerprint_phrases(user_id);