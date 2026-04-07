/**
 * Attempts to acquire a concurrency slot for a business's conversation worker.
 * Uses a Redis counter with a TTL safety net.
 *
 * @returns true if a slot was acquired, false if at capacity
 */
export declare function acquireWorkerSlot(businessId: string): Promise<boolean>;
/**
 * Releases a previously acquired concurrency slot.
 */
export declare function releaseWorkerSlot(businessId: string): Promise<void>;
//# sourceMappingURL=concurrencyControl.d.ts.map