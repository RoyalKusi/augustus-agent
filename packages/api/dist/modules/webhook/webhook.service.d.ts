/**
 * Validate the X-Hub-Signature-256 HMAC-SHA256 header from Meta Cloud API.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export declare function validateHmacSignature(rawBody: Buffer, signature: string, secret: string): boolean;
/**
 * Check if a message ID has already been processed (deduplication).
 * If not a duplicate, sets the Redis key with a 24-hour TTL atomically.
 * Returns true if the message is a duplicate (already seen).
 * Fails open (returns false) if Redis is unavailable — better to process twice than drop messages.
 */
export declare function isDuplicate(messageId: string): Promise<boolean>;
/**
 * Enqueue a raw webhook event payload to the message queue for async processing.
 */
export declare function enqueueWebhookPayload(businessId: string, payload: unknown): Promise<void>;
/**
 * Attempt to extract the first Meta message ID from a webhook payload.
 * Returns undefined if the payload structure doesn't contain a message ID.
 */
export declare function extractMessageId(payload: unknown): string | undefined;
/**
 * Extract the phone_number_id from the metadata of a webhook payload.
 * Used by the global webhook endpoint to resolve which business the event belongs to.
 */
export declare function extractPhoneNumberId(payload: unknown): string | undefined;
//# sourceMappingURL=webhook.service.d.ts.map