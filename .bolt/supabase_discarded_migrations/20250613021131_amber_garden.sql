/*
  # Create reports storage bucket and policies

  1. New Storage
    - Creates 'reports' storage bucket for storing generated reports
  
  2. Security
    - Sets up appropriate RLS policies for the reports bucket
    - Configures user-specific folder access
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
  storage.foldername(name)[1]::text = auth.uid()::text
);

-- Policy: Users can read their own reports
SELECT storage.create_policy(
  'reports',
  'authenticated',
  'SELECT',
  storage.foldername(name)[1]::text = auth.uid()::text
);

-- Policy: Users can delete their own reports
SELECT storage.create_policy(
  'reports',
  'authenticated',
  'DELETE',
  storage.foldername(name)[1]::text = auth.uid()::text
);

-- Policy: Allow public access for report downloads (via signed URLs)
SELECT storage.create_policy(
  'reports',
  'public',
  'SELECT',
  true
);