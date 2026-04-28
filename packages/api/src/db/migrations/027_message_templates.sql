-- Message Templates for WhatsApp Business API
-- Templates must be pre-approved by Meta before use.
-- Categories: UTILITY (transactional), MARKETING (promotional), AUTHENTICATION (OTP)

CREATE TABLE IF NOT EXISTS message_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              VARCHAR(512) NOT NULL,           -- snake_case, e.g. order_confirmation
  category          VARCHAR(32) NOT NULL             -- UTILITY | MARKETING | AUTHENTICATION
                      CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  language          VARCHAR(10) NOT NULL DEFAULT 'en_US',
  status            VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')),
  meta_template_id  VARCHAR(255),                    -- ID returned by Meta after creation
  header_type       VARCHAR(16),                     -- TEXT | IMAGE | VIDEO | DOCUMENT | NONE
  header_text       TEXT,
  body_text         TEXT NOT NULL,                   -- Template body with {{1}} placeholders
  footer_text       TEXT,
  buttons           JSONB,                           -- Array of button objects
  example_params    JSONB,                           -- Example values for placeholders
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_business ON message_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON message_templates(business_id, status);
