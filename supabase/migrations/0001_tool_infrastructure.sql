-- Migration: Tool Infrastructure Tables & RLS Policies

-- 1. Create enum for permissions role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE TYPE role_type AS ENUM ('viewer', 'editor', 'admin');
    END IF;
END$$;

-- 2. Create projects table
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create tool_runs table
CREATE TABLE tool_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_name text NOT NULL,
    input_payload jsonb,
    output_payload jsonb,
    status text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    error_message text
);

-- 4. Create schedules table
CREATE TABLE schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_name text NOT NULL,
    cron_expression text NOT NULL,
    last_run_at timestamptz,
    next_run_at timestamptz,
    enabled boolean NOT NULL DEFAULT true
);

-- 5. Create share_links table
CREATE TABLE share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_run_id uuid REFERENCES tool_runs(id) ON DELETE SET NULL,
    link_token text NOT NULL UNIQUE,
    expires_at timestamptz,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create permissions table
CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role role_type NOT NULL,
    UNIQUE (project_id, user_id)
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Helper function: check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(project_row projects)
RETURNS boolean AS $$
    SELECT project_row.owner_id = auth.uid()
$$ LANGUAGE sql STABLE;

-- Helper function: check if user has permission for a project
CREATE OR REPLACE FUNCTION has_project_permission(pid uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.project_id = pid
        AND permissions.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = pid
        AND projects.owner_id = auth.uid()
    )
$$ LANGUAGE sql STABLE;

-- projects: only owners and permitted users can select
CREATE POLICY "Allow project select for owners and permitted users"
    ON projects
    FOR SELECT
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM permissions
            WHERE permissions.project_id = id
              AND permissions.user_id = auth.uid()
        )
    );

-- tool_runs: users with access to project can select/insert
CREATE POLICY "Allow select tool_runs for permitted users"
    ON tool_runs
    FOR SELECT
    USING (
        has_project_permission(project_id)
    );

CREATE POLICY "Allow insert tool_runs for permitted users"
    ON tool_runs
    FOR INSERT
    WITH CHECK (
        has_project_permission(project_id)
    );

-- schedules: users with access to project can select/insert
CREATE POLICY "Allow select schedules for permitted users"
    ON schedules
    FOR SELECT
    USING (
        has_project_permission(project_id)
    );

CREATE POLICY "Allow insert schedules for permitted users"
    ON schedules
    FOR INSERT
    WITH CHECK (
        has_project_permission(project_id)
    );

-- share_links: users with access to project can select/insert
CREATE POLICY "Allow select share_links for permitted users"
    ON share_links
    FOR SELECT
    USING (
        has_project_permission(project_id)
    );

CREATE POLICY "Allow insert share_links for permitted users"
    ON share_links
    FOR INSERT
    WITH CHECK (
        has_project_permission(project_id)
    );

-- permissions: only admins can modify, all permitted users can select their permissions
CREATE POLICY "Allow select permissions for permitted users"
    ON permissions
    FOR SELECT
    USING (
        has_project_permission(project_id)
    );

-- Only admins can insert/update/delete on permissions
CREATE POLICY "Allow modify permissions for admins"
    ON permissions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM permissions AS p2
            WHERE p2.project_id = project_id
              AND p2.user_id = auth.uid()
              AND p2.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM permissions AS p2
            WHERE p2.project_id = project_id
              AND p2.user_id = auth.uid()
              AND p2.role = 'admin'
        )
    );

-- projects: only owners and admins can update/delete
CREATE POLICY "Allow update/delete projects for owners and admins"
    ON projects
    FOR UPDATE, DELETE
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM permissions
            WHERE permissions.project_id = id
              AND permissions.user_id = auth.uid()
              AND permissions.role = 'admin'
        )
    );

-- tool_runs/schedules/share_links: allow update/delete for project admins
CREATE POLICY "Allow update/delete tool_runs for project admins"
    ON tool_runs
    FOR UPDATE, DELETE
    USING (
        EXISTS (
            SELECT 1 FROM permissions
            WHERE permissions.project_id = project_id
              AND permissions.user_id = auth.uid()
              AND permissions.role = 'admin'
        )
    );

CREATE POLICY "Allow update/delete schedules for project admins"
    ON schedules
    FOR UPDATE, DELETE
    USING (
        EXISTS (
            SELECT 1 FROM permissions
            WHERE permissions.project_id = project_id
              AND permissions.user_id = auth.uid()
              AND permissions.role = 'admin'
        )
    );

CREATE POLICY "Allow update/delete share_links for project admins"
    ON share_links
    FOR UPDATE, DELETE
    USING (
        EXISTS (
            SELECT 1 FROM permissions
            WHERE permissions.project_id = project_id
              AND permissions.user_id = auth.uid()
              AND permissions.role = 'admin'
        )
    );

-- Timestamps trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();