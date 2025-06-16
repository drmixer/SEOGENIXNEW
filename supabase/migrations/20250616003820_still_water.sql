/*
  # Reports Storage Bucket and Policies - Fixed

  1. New Storage
    - Creates 'reports' storage bucket if it doesn't exist
    - Sets appropriate size limits and MIME types
  
  2. Security
    - Adds storage policies for authenticated users only if they don't already exist
    - Ensures users can only access their own reports
    - Provides public read access for report downloads
*/

-- Create the reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  true,
  52428800, -- 50MB limit
  ARRAY['application/json', 'text/csv', 'text/html', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Check if "Users can upload reports to own folder" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can upload reports to own folder'
  ) THEN
    -- Policy: Users can upload reports to their own folder
    EXECUTE 'CREATE POLICY "Users can upload reports to own folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;

  -- Check if "Users can read own reports" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can read own reports'
  ) THEN
    -- Policy: Users can read their own reports
    EXECUTE 'CREATE POLICY "Users can read own reports"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;

  -- Check if "Users can delete own reports" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can delete own reports'
  ) THEN
    -- Policy: Users can delete their own reports
    EXECUTE 'CREATE POLICY "Users can delete own reports"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;

  -- Check if "Public read access for reports" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public read access for reports'
  ) THEN
    -- Policy: Allow public access for report downloads (via signed URLs)
    EXECUTE 'CREATE POLICY "Public read access for reports"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = ''reports'')';
  END IF;
END $$;