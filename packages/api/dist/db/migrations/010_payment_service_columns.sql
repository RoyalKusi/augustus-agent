-- Migration: 010_payment_service_columns.sql
-- Align orders and revenue_balances tables with payment service expectations

-- orders: add missing columns used by payment service
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_wa_number  VARCHAR(32),
  ADD COLUMN IF NOT EXISTS paynow_link         TEXT,
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at          TIMESTAMPTZ;

-- Backfill customer_wa_number from customer_phone
UPDATE orders SET customer_wa_number = customer_phone WHERE customer_wa_number IS NULL;

-- Backfill paynow_link from payment_link
UPDATE orders SET paynow_link = payment_link WHERE paynow_link IS NULL;

-- Backfill expires_at from payment_link_expires_at
UPDATE orders SET expires_at = payment_link_expires_at WHERE expires_at IS NULL;

-- revenue_balances: add available_usd and lifetime_usd aliases
ALTER TABLE revenue_balances
  ADD COLUMN IF NOT EXISTS available_usd  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_usd   NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Backfill from existing columns
UPDATE revenue_balances
  SET available_usd = available_balance,
      lifetime_usd  = total_lifetime_revenue
  WHERE available_usd = 0;

-- order_items: add product_name column used by payment service
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NOT NULL DEFAULT '';

-- Backfill product_name from products table
UPDATE order_items oi
  SET product_name = p.name
  FROM products p
  WHERE oi.product_id = p.id AND oi.product_name = '';
