import redis from '../redis/client.js';

const MAX_CONCURRENT_WORKERS = 5; // per business

/**
 * Attempts to acquire a concurrency slot for a business's conversation worker.
 * Uses a Redis counter with a TTL safety net.
 *
 * @returns true if a slot was acquired, false if at capacity
 */
export async function acquireWorkerSlot(businessId: string): Promise<boolean> {
  const key = `concurrency:workers:${businessId}`;
  const current = await redis.incr(key);
  // Set TTL on first increment as a safety net (auto-release after 5 min)
  if (current === 1) {
    await redis.expire(key, 300);
  }
  if (current > MAX_CONCURRENT_WORKERS) {
    await redis.decr(key);
    return false;
  }
  return true;
}

/**
 * Releases a previously acquired concurrency slot.
 */
export async function releaseWorkerSlot(businessId: string): Promise<void> {
  const key = `concurrency:workers:${businessId}`;
  const val = await redis.decr(key);
  // Guard against going negative
  if (val < 0) {
    await redis.set(key, 0);
  }
}
