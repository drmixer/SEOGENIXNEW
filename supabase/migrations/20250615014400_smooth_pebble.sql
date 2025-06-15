/*
  # Add storage_path column to reports table

  1. Changes
    - Add `storage_path` column to `reports` table to store the internal Supabase storage path
    - This enables Edge Functions to access files using Supabase's internal download method

  2. Security
    - No RLS changes needed as this is just adding a column to existing table
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