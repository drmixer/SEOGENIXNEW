/*
  # Add white-labeling and CMS integration support

  1. New Tables
    - `white_label_settings` - Store custom branding configurations
    - `cms_integrations` - Track connected CMS platforms and credentials
    
  2. Security
    - Enable RLS on both tables
    - Add policies for user access control
    
  3. Changes
    - Extend user profiles with white-label capabilities
    - Add secure credential storage for CMS connections
*/

-- White-label settings table
CREATE TABLE IF NOT EXISTS white_label_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  custom_logo_url text,
  primary_color_hex text DEFAULT '#8B5CF6',
  secondary_color_hex text DEFAULT '#14B8A6',
  accent_color_hex text DEFAULT '#F59E0B',
  custom_domain text,
  company_name text,
  favicon_url text,
  custom_css text,
  footer_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CMS integrations table
CREATE TABLE IF NOT EXISTS cms_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cms_type text NOT NULL, -- 'wordpress', 'shopify', 'webflow', etc.
  cms_name text NOT NULL, -- User-friendly name
  site_url text NOT NULL,
  status text DEFAULT 'connected', -- 'connected', 'disconnected', 'error'
  credentials jsonb DEFAULT '{}', -- Encrypted credentials
  settings jsonb DEFAULT '{}', -- Integration-specific settings
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_integrations ENABLE ROW LEVEL SECURITY;

-- White-label policies
CREATE POLICY "Users can read own white-label settings"
  ON white_label_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own white-label settings"
  ON white_label_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own white-label settings"
  ON white_label_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- CMS integration policies
CREATE POLICY "Users can read own CMS integrations"
  ON cms_integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CMS integrations"
  ON cms_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CMS integrations"
  ON cms_integrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CMS integrations"
  ON cms_integrations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_white_label_settings_user_id ON white_label_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_cms_integrations_user_id ON cms_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_cms_integrations_cms_type ON cms_integrations(cms_type);