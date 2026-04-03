-- Migration: 007_training_document_type.sql
-- Extend training_data data_type to include 'document'

ALTER TABLE training_data
  DROP CONSTRAINT IF EXISTS training_data_data_type_check;

ALTER TABLE training_data
  ADD CONSTRAINT training_data_data_type_check
  CHECK (data_type IN ('description', 'faq', 'tone_guidelines', 'logo', 'document'));
