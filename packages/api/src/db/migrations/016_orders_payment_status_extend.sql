-- Migration: 016_orders_payment_status_extend.sql
-- Widen payment_status to VARCHAR(32) and add pending_external_payment status

ALTER TABLE orders
  ALTER COLUMN payment_status TYPE VARCHAR(32);

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN (
      'pending',
      'pending_external_payment',
      'completed',
      'expired',
      'failed',
      'processing',
      'shipped',
      'cancelled'
    ));
