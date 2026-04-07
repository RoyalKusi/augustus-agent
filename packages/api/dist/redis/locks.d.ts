export declare function acquireLock(lockKey: string, ttlSeconds?: number): Promise<string | null>;
export declare function releaseLock(lockKey: string, lockToken: string): Promise<boolean>;
//# sourceMappingURL=locks.d.ts.map