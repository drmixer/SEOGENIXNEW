/*
  # Create reports storage bucket and policies

  1. New Storage Bucket
    - `reports` bucket for storing generated reports
    - 50MB file size limit
    - Allowed MIME types: JSON, CSV, HTML, PDF

  2. Security
    - Enable policies for authenticated users to manage their own reports
    - Allow public read access for report downloads via signed URLs
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

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload reports to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own reports" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for reports" ON storage.objects;

-- Create policies directly on the objects table
-- Policy: Users can upload reports to their own folder
CREATE POLICY "Users can upload reports to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own reports
CREATE POLICY "Users can read own reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own reports
CREATE POLICY "Users can delete own reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public access for report downloads (via signed URLs)
CREATE POLICY "Public read access for reports"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reports');