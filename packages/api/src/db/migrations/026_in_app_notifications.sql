-- In-App Notification System
-- Provides persistent notification storage for both admin operators and business users

CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type      VARCHAR(16) NOT NULL CHECK (recipient_type IN ('admin', 'business')),
  recipient_id        UUID NOT NULL,
  notification_type   VARCHAR(32) NOT NULL CHECK (notification_type IN (
    'account_change',
    'subscription_update',
    'payment_event',
    'referral_earning',
    'support_ticket',
    'system_alert',
    'order_update'
  )),
  title               VARCHAR(255) NOT NULL,
  message             TEXT NOT NULL,
  metadata            JSONB,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for primary query pattern: get notifications for a user
CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
  ON notifications(recipient_type, recipient_id, created_at DESC);

-- Partial index for unread count queries (badge display)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(recipient_type, recipient_id, is_read) 
  WHERE is_read = FALSE;

-- Partial index for cleanup job optimization
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup 
  ON notifications(created_at) 
  WHERE created_at < NOW() - INTERVAL '90 days';
