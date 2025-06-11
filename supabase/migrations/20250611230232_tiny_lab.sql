/*
  # Fix Plan Recognition and Add Citation Features

  1. Changes
    - Add function to ensure user plan is properly saved and retrieved
    - Add trigger to update user_profiles when plan changes
    - Add saved_citation_prompts and fingerprint_phrases tables if they don't exist
  
  2. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Create function to update user plan
CREATE OR REPLACE FUNCTION update_user_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user profile exists
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.id) THEN
    -- Update existing profile with plan from metadata if available
    UPDATE public.user_profiles 
    SET 
      plan = COALESCE(
        NEW.raw_user_meta_data->>'plan', 
        NEW.raw_app_meta_data->>'plan',
        plan
      ),
      updated_at = now()
    WHERE user_id = NEW.id;
  ELSE
    -- Create new profile with plan from metadata if available
    INSERT INTO public.user_profiles (
      user_id, 
      plan,
      websites,
      competitors,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'plan', 
        NEW.raw_app_meta_data->>'plan',
        'free'
      ),
      '[]',
      '[]',
      now(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_user_profile_on_auth_user_change'
  ) THEN
    CREATE TRIGGER update_user_profile_on_auth_user_change
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_plan();
  END IF;
END $$;

-- Create saved_citation_prompts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_citation_prompts') THEN
    CREATE TABLE saved_citation_prompts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      domain text NOT NULL,
      keywords text[] NOT NULL,
      prompt_text text,
      created_at timestamptz DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE saved_citation_prompts ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
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
    
    -- Create indexes
    CREATE INDEX idx_saved_citation_prompts_user_id ON saved_citation_prompts(user_id);
    CREATE INDEX idx_saved_citation_prompts_domain ON saved_citation_prompts(domain);
  END IF;
END $$;

-- Create fingerprint_phrases table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fingerprint_phrases') THEN
    CREATE TABLE fingerprint_phrases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      phrase text NOT NULL,
      description text,
      created_at timestamptz DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE fingerprint_phrases ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
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
    
    -- Create index
    CREATE INDEX idx_fingerprint_phrases_user_id ON fingerprint_phrases(user_id);
  END IF;
END $$;

-- Update existing user profiles with plan from auth.users if available
DO $$
BEGIN
  UPDATE public.user_profiles up
  SET 
    plan = COALESCE(
      u.raw_user_meta_data->>'plan', 
      u.raw_app_meta_data->>'plan',
      up.plan
    ),
    updated_at = now()
  FROM auth.users u
  WHERE up.user_id = u.id
  AND (
    u.raw_user_meta_data->>'plan' IS NOT NULL OR
    u.raw_app_meta_data->>'plan' IS NOT NULL
  );
END $$;