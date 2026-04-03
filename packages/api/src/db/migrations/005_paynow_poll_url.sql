-- Migration: 005_paynow_poll_url.sql
-- Add paynow_poll_url column to orders table for polling fallback (Task 9.2)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paynow_poll_url TEXT;
