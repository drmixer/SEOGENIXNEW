-- Project-level allow/block rules for competitor discovery
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_domain_rules') THEN
    CREATE TABLE project_domain_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      type text NOT NULL CHECK (type IN ('allow','block')),
      pattern text NOT NULL,
      reason text,
      created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE project_domain_rules ENABLE ROW LEVEL SECURITY;

    -- Users can manage their own rules
    CREATE POLICY "Users manage own domain rules"
      ON project_domain_rules
      FOR ALL
      TO authenticated
      USING (auth.uid() = created_by)
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

