/**
 * Unit tests for the Webhook Receiver module (tasks 6.1–6.4)
 *
 * Covers:
 *  - Valid HMAC signature → 200
 *  - Invalid HMAC signature → 403
 *  - Duplicate message ID → 200 (silently ignored)
 *  - hub.challenge verification success → returns challenge
 *  - hub.challenge verification failure → 403
 *
 * Validates: Requirements 4.1 (HMAC), 4.2 (hub.challenge), deduplication, async enqueue
 */
export {};
//# sourceMappingURL=webhook.test.d.ts.map