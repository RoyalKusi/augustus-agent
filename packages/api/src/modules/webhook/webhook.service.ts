import crypto from 'crypto';
import redis from '../../redis/client.js';
import { enqueueWebhookEvent } from '../../queue/producer.js';

const DEDUP_TTL_SECONDS = 86400; // 24 hours

/**
 * Validate the X-Hub-Signature-256 HMAC-SHA256 header from Meta Cloud API.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateHmacSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expectedSig =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    // Buffers of different lengths throw — treat as invalid
    return false;
  }
}

/**
 * Check if a message ID has already been processed (deduplication).
 * If not a duplicate, sets the Redis key with a 24-hour TTL atomically.
 * Returns true if the message is a duplicate (already seen).
 */
export async function isDuplicate(messageId: string): Promise<boolean> {
  const key = `webhook:dedup:${messageId}`;
  // SET NX EX: returns 'OK' if key was set (new), null if key already existed (duplicate)
  const result = await redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
  return result === null;
}

/**
 * Enqueue a raw webhook event payload to the message queue for async processing.
 */
export async function enqueueWebhookPayload(
  businessId: string,
  payload: unknown,
): Promise<void> {
  // Extract a representative messageId from the payload for queue tracking
  const messageId = extractMessageId(payload) ?? `${businessId}-${Date.now()}`;
  await enqueueWebhookEvent({ businessId, messageId, payload: payload as object });
}

/**
 * Attempt to extract the first Meta message ID from a webhook payload.
 * Returns undefined if the payload structure doesn't contain a message ID.
 */
export function extractMessageId(payload: unknown): string | undefined {
  try {
    const p = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{ id?: string }>;
          };
        }>;
      }>;
    };
    return p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
  } catch {
    return undefined;
  }
}
