/*
  # Create reports storage bucket and policies
  
  1. New Storage
    - Creates 'reports' storage bucket for report files
    - Sets 50MB file size limit
    - Allows specific MIME types
  
  2. Security
    - Creates policies for authenticated users to manage their own reports
    - Adds public read access for report downloads via signed URLs
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

-- Create storage policies using the storage API
-- Policy: Users can upload reports to their own folder
SELECT storage.create_policy(
  'reports',
  'authenticated',
  'INSERT',
  'storage.foldername(name)[1] = auth.uid()::text'
);

-- Policy: Users can read their own reports
SELECT storage.create_policy(
  'reports',
  'authenticated',
  'SELECT',
  'storage.foldername(name)[1] = auth.uid()::text'
);

-- Policy: Users can delete their own reports
SELECT storage.create_policy(
  'reports',
  'authenticated',
  'DELETE',
  'storage.foldername(name)[1] = auth.uid()::text'
);

-- Policy: Allow public access for report downloads (via signed URLs)
SELECT storage.create_policy(
  'reports',
  'public',
  'SELECT',
  'true'
);