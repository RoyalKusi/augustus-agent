import crypto from 'crypto';
import redis from '../../redis/client.js';
import { enqueueWebhookEvent } from '../../queue/producer.js';
const DEDUP_TTL_SECONDS = 86400; // 24 hours
/**
 * Validate the X-Hub-Signature-256 HMAC-SHA256 header from Meta Cloud API.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateHmacSignature(rawBody, signature, secret) {
    if (!signature || !secret)
        return false;
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    }
    catch {
        // Buffers of different lengths throw — treat as invalid
        return false;
    }
}
/**
 * Check if a message ID has already been processed (deduplication).
 * If not a duplicate, sets the Redis key with a 24-hour TTL atomically.
 * Returns true if the message is a duplicate (already seen).
 * Fails open (returns false) if Redis is unavailable — better to process twice than drop messages.
 */
export async function isDuplicate(messageId) {
    const key = `webhook:dedup:${messageId}`;
    try {
        const result = await Promise.race([
            redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000)),
        ]);
        return result === null;
    }
    catch {
        // Redis unavailable or timed out — fail open, allow processing
        return false;
    }
}
/**
 * Enqueue a raw webhook event payload to the message queue for async processing.
 */
export async function enqueueWebhookPayload(businessId, payload) {
    // Extract a representative messageId from the payload for queue tracking
    const messageId = extractMessageId(payload) ?? `${businessId}-${Date.now()}`;
    await enqueueWebhookEvent({ businessId, messageId, payload: payload });
}
/**
 * Attempt to extract the first Meta message ID from a webhook payload.
 * Returns undefined if the payload structure doesn't contain a message ID.
 */
export function extractMessageId(payload) {
    try {
        const p = payload;
        return p?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    }
    catch {
        return undefined;
    }
}
/**
 * Extract the phone_number_id from the metadata of a webhook payload.
 * Used by the global webhook endpoint to resolve which business the event belongs to.
 */
export function extractPhoneNumberId(payload) {
    try {
        const p = payload;
        return p?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=webhook.service.js.map