-- Support ticket messages (admin ↔ business communication thread)
CREATE TABLE support_ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(16) NOT NULL CHECK (sender_type IN ('admin', 'business')),
  sender_id   VARCHAR(255) NOT NULL,   -- operatorId for admin, businessId for business
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON support_ticket_messages(ticket_id, created_at);
