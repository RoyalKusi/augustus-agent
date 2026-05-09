-- Migration 038: Support document uploads with Claude-generated summaries
-- Adds document_summary column to store the one-time Claude extraction result.
-- Also relaxes the data_type CHECK to include 'document' (already added in 007
-- but may not be present on all environments).

ALTER TABLE training_data
  ADD COLUMN IF NOT EXISTS document_summary TEXT;

-- Ensure 'document' is an accepted data_type value (idempotent via DO block)
DO $$
BEGIN
  -- Drop and recreate the CHECK constraint to include 'document'
  -- Only needed if the constraint was created without 'document'
  ALTER TABLE training_data
    DROP CONSTRAINT IF EXISTS training_data_data_type_check;

  ALTER TABLE training_data
    ADD CONSTRAINT training_data_data_type_check
    CHECK (data_type IN ('description', 'faq', 'tone_guidelines', 'logo', 'document'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'training_data_data_type_check constraint update skipped: %', SQLERRM;
END;
$$;
