/*
  # Add storage_path to reports table

  1. Changes
    - Adds a storage_path column to the reports table to store the internal Supabase storage path
    - This allows the report-viewer function to use Supabase's internal download method
    - Provides better reliability than using public URLs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE reports ADD COLUMN storage_path text;
  END IF;
END $$;