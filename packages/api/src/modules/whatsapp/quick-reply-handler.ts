/**
 * Quick Reply event parser for the WhatsApp_Integration_Service.
 *
 * Parses inbound interactive reply events from the Meta Cloud API webhook
 * payload and routes the selected Quick_Reply payload as a structured input
 * to the Conversation Engine.
 *
 * Validates: Requirements 6.3
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuickReplyEvent = {
  type: 'button_reply' | 'list_reply';
  from: string;        // customer WhatsApp number
  messageId: string;   // Meta message ID
  buttonId: string;    // the button/row ID that was tapped
  buttonTitle: string; // the button/row title
  timestamp: number;   // Unix timestamp
};

// ── Meta Cloud API webhook payload shapes ─────────────────────────────────────

interface MetaInteractiveButtonReply {
  id: string;
  title: string;
}

interface MetaInteractiveListReply {
  id: string;
  title: string;
}

interface MetaInteractive {
  type: 'button_reply' | 'list_reply' | string;
  button_reply?: MetaInteractiveButtonReply;
  list_reply?: MetaInteractiveListReply;
}

interface MetaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  interactive?: MetaInteractive;
}

interface MetaWebhookValue {
  messages?: MetaMessage[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a Meta Cloud API webhook value object and extract a QuickReplyEvent
 * if the first message is an interactive button_reply or list_reply.
 *
 * Returns `null` for any non-interactive message or unsupported interactive type.
 */
export function parseQuickReplyEvent(
  webhookValue: MetaWebhookValue,
): QuickReplyEvent | null {
  const message = webhookValue?.messages?.[0];
  if (!message) return null;

  if (message.type !== 'interactive') return null;

  const interactive = message.interactive;
  if (!interactive) return null;

  const from = message.from ?? '';
  const messageId = message.id ?? '';
  const timestamp = parseInt(message.timestamp ?? '0', 10);

  if (interactive.type === 'button_reply') {
    const reply = interactive.button_reply;
    if (!reply) return null;
    return {
      type: 'button_reply',
      from,
      messageId,
      buttonId: reply.id,
      buttonTitle: reply.title,
      timestamp,
    };
  }

  if (interactive.type === 'list_reply') {
    const reply = interactive.list_reply;
    if (!reply) return null;
    return {
      type: 'list_reply',
      from,
      messageId,
      buttonId: reply.id,
      buttonTitle: reply.title,
      timestamp,
    };
  }

  return null;
}
