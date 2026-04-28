/**
 * Outbound message dispatcher for the WhatsApp_Integration_Service.
 *
 * Supports: text, image, document/PDF, interactive carousel,
 *           quick-reply buttons, payment links, and message templates.
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 */

import { config } from '../../config.js';
import { getCredentials } from './whatsapp-integration.service.js';

// ── Message type definitions ──────────────────────────────────────────────────

export type TextMessage = {
  type: 'text';
  to: string;
  body: string;
};

export type ImageMessage = {
  type: 'image';
  to: string;
  url: string;
  caption?: string;
};

export type DocumentMessage = {
  type: 'document';
  to: string;
  url: string;
  filename: string;
  caption?: string;
};

export type PaymentLinkMessage = {
  type: 'payment_link';
  to: string;
  body: string;
  paymentUrl: string;
};

export type QuickReplyMessage = {
  type: 'quick_reply';
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
};

export type CarouselProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  description?: string;
};

/** Req 6.2: at least 1 and at most 10 products */
export type CarouselMessage = {
  type: 'carousel';
  to: string;
  products: CarouselProduct[]; // 1–10 products
};

export type OutboundMessage =
  | TextMessage
  | ImageMessage
  | DocumentMessage
  | PaymentLinkMessage
  | QuickReplyMessage
  | CarouselMessage;

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}

export interface SendMediaWithFallbackResult {
  success: boolean;
  messageId?: string;
  usedFallback: boolean;
  errorMessage?: string;
}

// ── Payload builders ──────────────────────────────────────────────────────────

function buildTextPayload(to: string, body: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body },
  };
}

function buildImagePayload(msg: ImageMessage): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to,
    type: 'image',
    image: {
      link: msg.url,
      ...(msg.caption ? { caption: msg.caption } : {}),
    },
  };
}

function buildDocumentPayload(msg: DocumentMessage): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to,
    type: 'document',
    document: {
      link: msg.url,
      filename: msg.filename,
      ...(msg.caption ? { caption: msg.caption } : {}),
    },
  };
}

/** Payment link: sent as a text message with the URL appended */
function buildPaymentLinkPayload(msg: PaymentLinkMessage): Record<string, unknown> {
  return buildTextPayload(msg.to, `${msg.body}\n\n${msg.paymentUrl}`);
}

/** Quick reply: interactive reply_button payload */
function buildQuickReplyPayload(msg: QuickReplyMessage): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: msg.body },
      action: {
        buttons: msg.buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  };
}

/**
 * Placeholder image URL for products without images.
 * Used to ensure consistent carousel card appearance when some products lack images.
 * WhatsApp requires all carousel cards to have the same header type — if any card
 * has an image header, all cards must have one.
 */
const PRODUCT_PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e2e8f0/718096/png?text=No+Image';

/**
 * Product display for WhatsApp:
 * - 2–10 products: native horizontally scrollable carousel
 *   - Products with images use their own image
 *   - Products WITHOUT images use a placeholder so all cards look consistent
 * - 1 product: image (own or placeholder) + quick reply button
 */
function buildCarouselPayload(msg: CarouselMessage): Record<string, unknown> {
  const products = msg.products.slice(0, 10);

  // Check if ANY product has an image — if so, all cards need an image header
  // (WhatsApp requires consistent header types across carousel cards)
  const anyHasImage = products.some(p => p.imageUrl && p.imageUrl.startsWith('http'));

  if (products.length === 1) {
    const p = products[0];
    const imageUrl = p.imageUrl && p.imageUrl.startsWith('http') ? p.imageUrl : (anyHasImage ? PRODUCT_PLACEHOLDER_IMAGE : undefined);
    const bodyText = `*${p.name}*\n${p.currency} ${p.price.toFixed(2)}${p.description ? '\n' + p.description.slice(0, 100) : ''}`;

    if (imageUrl) {
      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.to,
        type: 'image',
        image: { link: imageUrl, caption: bodyText },
      };
    }
    // No images at all — interactive button only
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: msg.to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: [{ type: 'reply', reply: { id: `order_${p.id}`, title: '🛒 Order Now' } }],
        },
      },
    };
  }

  // 2–10 products: native carousel
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: msg.to,
    type: 'interactive',
    interactive: {
      type: 'carousel',
      body: { text: 'Here are some options for you 👇' },
      action: {
        cards: products.map((p, index) => {
          const priceStr = `${p.currency} ${p.price.toFixed(2)}`;
          const bodyText = p.description
            ? `*${p.name}*\n${priceStr}\n${p.description.slice(0, 60)}`
            : `*${p.name}*\n${priceStr}`;

          const card: Record<string, unknown> = {
            card_index: index,
            body: { text: bodyText },
            action: {
              buttons: [{ type: 'reply', reply: { id: `order_${p.id}`, title: '🛒 Order Now' } }],
            },
          };

          // Use product image if available, otherwise placeholder if any product has an image
          // (ensures consistent card appearance across the carousel)
          const imageUrl = p.imageUrl && p.imageUrl.startsWith('http')
            ? p.imageUrl
            : anyHasImage ? PRODUCT_PLACEHOLDER_IMAGE : undefined;

          if (imageUrl) {
            card['header'] = { type: 'image', image: { link: imageUrl } };
          }

          return card;
        }),
      },
    },
  };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Send an outbound WhatsApp message on behalf of a business.
 *
 * 1. Loads credentials for the business.
 * 2. Builds the appropriate Meta Cloud API payload.
 * 3. POSTs to https://graph.facebook.com/{version}/{phoneNumberId}/messages.
 * 4. Returns { success, messageId } or { success: false, errorMessage }.
 */
export async function sendMessage(
  businessId: string,
  message: OutboundMessage,
): Promise<SendMessageResult> {
  // ── 1. Load credentials ───────────────────────────────────────────────────
  const integration = await getCredentials(businessId);
  if (!integration) {
    return {
      success: false,
      errorMessage: 'No WhatsApp integration found for this business.',
    };
  }

  if (integration.status !== 'active') {
    // Log warning but still attempt to send — status may be stale
    console.warn(`[MessageDispatcher] Integration status is "${integration.status}" for business ${businessId} — attempting send anyway`);
  }

  const { phoneNumberId, accessToken } = integration;

  // ── 2. Validate carousel bounds (Req 6.2) ─────────────────────────────────
  if (message.type === 'carousel') {
    const count = message.products.length;
    if (count < 1 || count > 10) {
      return {
        success: false,
        errorMessage: `Carousel must contain between 1 and 10 products; got ${count}.`,
      };
    }
  }

  // ── 3. Build payload ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  switch (message.type) {
    case 'text':
      payload = buildTextPayload(message.to, message.body);
      break;
    case 'image':
      payload = buildImagePayload(message);
      break;
    case 'document':
      payload = buildDocumentPayload(message);
      break;
    case 'payment_link':
      payload = buildPaymentLinkPayload(message);
      break;
    case 'quick_reply':
      payload = buildQuickReplyPayload(message);
      break;
    case 'carousel':
      payload = buildCarouselPayload(message);
      break;
  }

  // ── 4. POST to Meta Cloud API ─────────────────────────────────────────────
  const graphVersion =
    process.env.META_GRAPH_API_VERSION ?? config.meta.graphApiVersion;
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? `Message dispatch failed: ${err.message}`
        : 'Message dispatch failed due to a network error.';
    return { success: false, errorMessage };
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      // ignore JSON parse errors
    }
    const errorMessage = detail
      ? `Meta Cloud API rejected message: ${detail}`
      : `Meta Cloud API returned HTTP ${response.status}.`;
    return { success: false, errorMessage };
  }

  // ── 5. Extract messageId from response ────────────────────────────────────
  let messageId: string | undefined;
  try {
    const body = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };
    messageId = body?.messages?.[0]?.id;
  } catch {
    // messageId remains undefined — not fatal
  }

  return { success: true, messageId };
}

/**
 * Send a typing indicator to the customer while a response is being generated.
 * Also marks the inbound message as read.
 * The indicator auto-dismisses after 25 seconds or when a message is sent.
 * Per Meta docs: POST /{phoneNumberId}/messages with status=read + typing_indicator
 */
export async function sendTypingIndicator(
  businessId: string,
  inboundMessageId: string,
): Promise<void> {
  const integration = await getCredentials(businessId);
  if (!integration) return;

  const { phoneNumberId, accessToken } = integration;
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? config.meta.graphApiVersion;
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: inboundMessageId,
        typing_indicator: { type: 'text' },
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Non-fatal — typing indicator is best-effort
  }
}

const MEDIA_SIZE_LIMIT_BYTES = 16 * 1024 * 1024; // 16 MB

/**
 * Send a media message (image or document) with automatic text fallback.
 *
 * If `fileSizeBytes` is provided and exceeds 16 MB, sends `textFallback` as a
 * plain text message instead of attempting to upload the oversized file.
 *
 * Validates: Requirements 6.5 / Property 20
 */
export async function sendMediaWithFallback(
  businessId: string,
  mediaMsg: ImageMessage | DocumentMessage,
  textFallback: string,
  fileSizeBytes?: number,
): Promise<SendMediaWithFallbackResult> {
  if (fileSizeBytes !== undefined && fileSizeBytes > MEDIA_SIZE_LIMIT_BYTES) {
    // File exceeds 16 MB — send text description instead
    const textMsg: TextMessage = {
      type: 'text',
      to: mediaMsg.to,
      body: textFallback,
    };
    const result = await sendMessage(businessId, textMsg);
    return { ...result, usedFallback: true };
  }

  // Within limit (or size unknown) — send the media normally
  const result = await sendMessage(businessId, mediaMsg);
  return { ...result, usedFallback: false };
}

/**
 * Send a message using an approved template, falling back to plain text if:
 * - The template doesn't exist locally
 * - The template is not yet approved
 * - The template send fails
 *
 * This ensures messages always get delivered while templates are pending approval.
 */
export async function sendWithTemplateFallback(
  businessId: string,
  to: string,
  templateName: string,
  params: string[],
  fallbackText: string,
  language = 'en_US',
): Promise<SendMessageResult & { usedTemplate: boolean }> {
  try {
    const { templateService } = await import('./template.service.js');
    const result = await templateService.sendTemplateMessage(businessId, to, templateName, params, language);
    if (result.success) {
      return { ...result, usedTemplate: true };
    }
    // Template not approved or failed — fall through to plain text
    console.info(`[Dispatcher] Template '${templateName}' not available (${result.error}), using plain text fallback`);
  } catch (err) {
    console.warn(`[Dispatcher] Template send error for '${templateName}':`, err);
  }

  // Fallback: send as plain text
  const fallback = await sendMessage(businessId, { type: 'text', to, body: fallbackText });
  return { ...fallback, usedTemplate: false };
}
