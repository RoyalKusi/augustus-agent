/**
 * Checks whether a business has exceeded the inbound webhook rate limit.
 * Uses a Redis sliding window counter.
 *
 * @returns true if the request is allowed, false if rate-limited
 */
export declare function checkWebhookRateLimit(businessId: string): Promise<boolean>;
//# sourceMappingURL=webhookRateLimit.d.ts.map