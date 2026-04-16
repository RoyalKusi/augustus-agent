-- Migration: 019_notification_wa_number.sql
-- Add notification WhatsApp number to businesses table
-- This is the business owner's personal number that receives order and lead alerts

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS notification_wa_number VARCHAR(32);
