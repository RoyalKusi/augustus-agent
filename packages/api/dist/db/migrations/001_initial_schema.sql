-- Augustus AI Sales Platform — Initial Schema Migration
-- Migration: 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Operators (Augustus internal staff)
CREATE TABLE operators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  mfa_secret_encrypted VARCHAR(512),
  mfa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Businesses (platform tenants)
CREATE TABLE businesses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(255) NOT NULL,
  owner_name            VARCHAR(255) NOT NULL,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending_verification'
                          CHECK (status IN ('active', 'suspended', 'pending_verification')),
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan                 VARCHAR(16) NOT NULL CHECK (plan IN ('silver', 'gold', 'platinum')),
  price_usd            NUMERIC(10, 2) NOT NULL,
  status               VARCHAR(16) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'cancelled')),
  activation_timestamp TIMESTAMPTZ,
  renewal_date         DATE,
  billing_cycle_start  DATE,
  paynow_reference     VARCHAR(255),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token usage tracking per billing cycle
CREATE TABLE token_usage (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  billing_cycle_start  DATE NOT NULL,
  accumulated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  alert_80_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  alert_95_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, billing_cycle_start)
);

-- Business token hard-limit overrides (set by operators)
CREATE TABLE business_token_overrides (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  hard_limit_usd      NUMERIC(12, 2) NOT NULL,
  set_by_operator_id  VARCHAR(255) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp integrations
CREATE TABLE whatsapp_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  waba_id               VARCHAR(255) NOT NULL,
  phone_number_id       VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  webhook_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(16) NOT NULL DEFAULT 'inactive'
                          CHECK (status IN ('active', 'inactive', 'error')),
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  price          NUMERIC(12, 2) NOT NULL,
  currency       VARCHAR(3) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  category       VARCHAR(255),
  image_urls     TEXT[] NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Promotional combos
CREATE TABLE promo_combos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  promo_price NUMERIC(12, 2) NOT NULL,
  currency    VARCHAR(3) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products within a promo combo
CREATE TABLE promo_combo_products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id   UUID NOT NULL REFERENCES promo_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE (combo_id, product_id)
);

-- Conversations
CREATE TABLE conversations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone           VARCHAR(32) NOT NULL,
  status                   VARCHAR(16) NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'closed')),
  manual_intervention_active BOOLEAN NOT NULL DEFAULT FALSE,
  intervention_agent_id    VARCHAR(255),
  intervention_started_at  TIMESTAMPTZ,
  intervention_ended_at    TIMESTAMPTZ,
  message_count            INT NOT NULL DEFAULT 0,
  session_started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction       VARCHAR(8) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content         TEXT NOT NULL,
  message_type    VARCHAR(16) NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'image', 'pdf', 'carousel', 'quick_reply', 'payment_link')),
  meta_message_id VARCHAR(255) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id        UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_phone         VARCHAR(32) NOT NULL,
  order_reference        VARCHAR(255) NOT NULL UNIQUE,
  total_amount           NUMERIC(12, 2) NOT NULL,
  currency               VARCHAR(3) NOT NULL,
  payment_status         VARCHAR(16) NOT NULL DEFAULT 'pending'
                           CHECK (payment_status IN ('pending', 'completed', 'expired', 'failed')),
  paynow_reference       VARCHAR(255),
  payment_link           TEXT,
  payment_link_expires_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order line items
CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity     INT NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12, 2) NOT NULL,
  currency     VARCHAR(3) NOT NULL
);

-- Revenue balances per business
CREATE TABLE revenue_balances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  available_balance     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_lifetime_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawal requests
CREATE TABLE withdrawal_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount               NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency             VARCHAR(3) NOT NULL,
  status               VARCHAR(16) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processed', 'failed')),
  paynow_merchant_ref  VARCHAR(255),
  paynow_payout_ref    VARCHAR(255),
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at         TIMESTAMPTZ
);

-- AI training data per business
CREATE TABLE training_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  data_type        VARCHAR(32) NOT NULL
                     CHECK (data_type IN ('description', 'faq', 'tone_guidelines', 'logo')),
  content          TEXT,
  file_url         VARCHAR(1024),
  file_size_bytes  BIGINT,
  incorporated_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support tickets
CREATE TABLE support_tickets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  ticket_reference     VARCHAR(64) NOT NULL UNIQUE,
  subject              VARCHAR(255) NOT NULL,
  description          TEXT NOT NULL,
  attachment_url       VARCHAR(1024),
  attachment_size_bytes BIGINT,
  status               VARCHAR(16) NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operator audit log
CREATE TABLE operator_audit_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id        VARCHAR(255) NOT NULL,
  action_type        VARCHAR(128) NOT NULL,
  target_business_id UUID,
  details            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX idx_token_usage_business_cycle ON token_usage(business_id, billing_cycle_start);
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_products_business_active ON products(business_id, is_active);
CREATE INDEX idx_promo_combos_business_id ON promo_combos(business_id);
CREATE INDEX idx_conversations_business_id ON conversations(business_id);
CREATE INDEX idx_conversations_business_phone ON conversations(business_id, customer_phone);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_business_id ON messages(business_id);
CREATE INDEX idx_orders_business_id ON orders(business_id);
CREATE INDEX idx_orders_payment_status ON orders(business_id, payment_status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_withdrawal_requests_business_id ON withdrawal_requests(business_id);
CREATE INDEX idx_training_data_business_id ON training_data(business_id);
CREATE INDEX idx_support_tickets_business_id ON support_tickets(business_id);
CREATE INDEX idx_operator_audit_log_operator ON operator_audit_log(operator_id);
CREATE INDEX idx_operator_audit_log_target ON operator_audit_log(target_business_id);
