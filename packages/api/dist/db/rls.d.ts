import type { PoolClient } from 'pg';
/**
 * Acquires a client from the pool, sets the RLS business_id context,
 * and returns the client. Caller must release it when done.
 *
 * Usage:
 *   const client = await getClientForBusiness(businessId);
 *   try {
 *     await client.query('SELECT * FROM products');
 *   } finally {
 *     client.release();
 *   }
 */
export declare function getClientForBusiness(businessId: string): Promise<PoolClient>;
/**
 * Runs a callback within a transaction scoped to a specific business_id.
 * RLS context is set before the transaction begins.
 */
export declare function withBusinessContext<T>(businessId: string, fn: (client: PoolClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=rls.d.ts.map