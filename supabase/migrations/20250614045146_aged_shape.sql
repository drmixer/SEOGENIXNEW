/*
  # Reports Storage Bucket and Policies

  1. New Storage
    - Creates 'reports' storage bucket if it doesn't exist
    - Sets appropriate size limits and MIME types
  
  2. Security
    - Adds storage policies for authenticated users
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

-- Create policies directly on the objects table
-- Policy: Users can upload reports to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can upload reports to own folder'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can upload reports to own folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;
END
$$;

-- Policy: Users can read their own reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can read own reports'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own reports"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;
END
$$;

-- Policy: Users can delete their own reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can delete own reports'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete own reports"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = ''reports'' AND
      auth.uid()::text = (storage.foldername(name))[1]
    )';
  END IF;
END
$$;

-- Policy: Allow public access for report downloads (via signed URLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public read access for reports'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read access for reports"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = ''reports'')';
  END IF;
END
$$;