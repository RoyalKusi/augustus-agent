import redis from '../redis/client.js';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_BUSINESS = 100; // per minute per business

/**
 * Checks whether a business has exceeded the inbound webhook rate limit.
 * Uses a Redis sliding window counter.
 *
 * @returns true if the request is allowed, false if rate-limited
 */
export async function checkWebhookRateLimit(businessId: string): Promise<boolean> {
  const key = `ratelimit:webhook:${businessId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count <= MAX_REQUESTS_PER_BUSINESS;
}
