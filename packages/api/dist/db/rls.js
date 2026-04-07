import { pool } from './client.js';
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
export async function getClientForBusiness(businessId) {
    const client = await pool.connect();
    await client.query(`SELECT set_config('app.current_business_id', $1, TRUE)`, [businessId]);
    return client;
}
/**
 * Runs a callback within a transaction scoped to a specific business_id.
 * RLS context is set before the transaction begins.
 */
export async function withBusinessContext(businessId, fn) {
    const client = await getClientForBusiness(businessId);
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=rls.js.map