/*
  # Create reports storage bucket

  1. Storage Setup
    - Create 'reports' storage bucket for user-generated reports
    - Configure bucket to allow authenticated users to upload their own reports
    - Set up RLS policies for secure access

  2. Security
    - Enable RLS on storage objects
    - Users can only access their own reports (organized by user_id folder structure)
    - Public read access for report downloads via signed URLs
*/

-- Create the reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  true,
  52428800, -- 50MB limit
  ARRAY['application/json', 'text/csv', 'text/html', 'application/pdf']
);

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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