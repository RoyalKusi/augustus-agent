-- Migration: 012_whatsapp_display_fields.sql
-- Store display_phone_number and verified_name returned by Meta during embedded signup

ALTER TABLE whatsapp_integrations
  ADD COLUMN IF NOT EXISTS display_phone_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS verified_name        VARCHAR(255);
