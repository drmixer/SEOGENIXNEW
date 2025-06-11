/*
  # Fix Plan Recognition and Add Trigger

  1. Create a trigger function to update user_profiles when auth.users changes
  2. Create a trigger to execute the function on auth.users changes
  3. Update existing user profiles with plan from auth.users metadata
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

-- Create trigger on auth.users table if it doesn't exist
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