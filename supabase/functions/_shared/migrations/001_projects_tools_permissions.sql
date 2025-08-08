-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tool Runs table
CREATE TABLE IF NOT EXISTS tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  params jsonb,
  output jsonb,
  status text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  provenance jsonb,
  created_by uuid REFERENCES users(id)
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  params jsonb,
  cadence text NOT NULL, -- e.g. 'daily', 'weekly', 'monthly'
  next_run_at timestamptz,
  created_by uuid REFERENCES users(id)
);

-- Share Links table
CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  tool_run_id uuid REFERENCES tool_runs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  permissions text NOT NULL, -- e.g. 'viewer', 'editor'
  created_by uuid REFERENCES users(id)
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'admin', 'editor', 'viewer'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable row-level security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Policies for projects table
CREATE POLICY "Allow project access for permitted users"
  ON projects
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = projects.id
        AND permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert for permitted users"
  ON projects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = projects.id
        AND permissions.user_id = auth.uid()
    )
  );

-- Policies for tool_runs table
CREATE POLICY "Allow tool_run access for permitted users"
  ON tool_runs
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = tool_runs.project_id
        AND permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert for permitted users"
  ON tool_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = tool_runs.project_id
        AND permissions.user_id = auth.uid()
    )
  );

-- Policies for schedules table
CREATE POLICY "Allow schedules access for permitted users"
  ON schedules
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = schedules.project_id
        AND permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert for permitted users"
  ON schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = schedules.project_id
        AND permissions.user_id = auth.uid()
    )
  );

-- Policies for share_links table
CREATE POLICY "Allow share_links access for permitted users"
  ON share_links
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = share_links.project_id
        AND permissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert for permitted users"
  ON share_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = share_links.project_id
        AND permissions.user_id = auth.uid()
    )
  );

-- Policies for permissions table
CREATE POLICY "Allow permissions read for permitted users"
  ON permissions
  USING (
    EXISTS (
      SELECT 1 FROM permissions AS p2
      WHERE p2.project_id = permissions.project_id
        AND p2.user_id = auth.uid()
    )
  );

-- Only admins can manage permissions
CREATE POLICY "Allow permissions insert/update/delete for admin"
  ON permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM permissions AS p2
      WHERE p2.project_id = permissions.project_id
        AND p2.user_id = auth.uid()
        AND p2.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions AS p2
      WHERE p2.project_id = permissions.project_id
        AND p2.user_id = auth.uid()
        AND p2.role = 'admin'
    )
  );