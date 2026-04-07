/**
 * Unit tests for registerWebhook (task 5.2)
 *
 * Tests cover:
 *  - Success path: Meta API returns 200 → status set to 'active'
 *  - Failure path (non-OK HTTP): credentials retained, status set to 'error'
 *  - Failure path (network error): credentials retained, status set to 'error'
 *  - Missing integration: returns descriptive error without DB writes
 *
 * Validates: Requirements 4.2, 4.3, 4.4
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
// ── Set up env before any module imports ──────────────────────────────────────
beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.BASE_URL = 'https://api.example.com';
    process.env.META_GRAPH_API_VERSION = 'v19.0';
});
// ── Mock the DB pool ──────────────────────────────────────────────────────────
vi.mock('../../../db/client.js', () => ({
    pool: {
        query: vi.fn(),
    },
}));
import { pool } from '../../../db/client.js';
import { encrypt } from '../../../utils/crypto.js';
import { registerWebhook } from '../whatsapp-integration.service.js';
// ── Helpers ───────────────────────────────────────────────────────────────────
function makeIntegrationRow(overrides = {}) {
    return {
        id: 'int-1',
        business_id: 'biz-1',
        waba_id: 'waba-123',
        phone_number_id: 'phone-456',
        access_token_encrypted: encrypt('test-access-token'),
        webhook_verify_token: 'my-verify-token',
        status: 'inactive',
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
        registered_at: null,
        ...overrides,
    };
}
afterEach(() => {
    vi.restoreAllMocks();
});
// ── Tests ─────────────────────────────────────────────────────────────────────
describe('registerWebhook', () => {
    it('returns success and sets status to active when Meta API responds 200', async () => {
        const mockQuery = vi.mocked(pool.query);
        // First call: getCredentials SELECT
        mockQuery.mockResolvedValueOnce({ rows: [makeIntegrationRow()], rowCount: 1 });
        // Second call: UPDATE to active
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        // Stub global fetch to return 200
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
        const result = await registerWebhook('biz-1');
        expect(result.success).toBe(true);
        expect(result.errorMessage).toBeUndefined();
        // Verify fetch was called with correct URL and Bearer token
        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toContain('waba-123/subscribed_apps');
        expect(init.headers['Authorization']).toBe('Bearer test-access-token');
        // Verify the body contains callback_url and verify_token
        const body = JSON.parse(init.body);
        expect(body.callback_url).toBe('https://api.example.com/webhooks/whatsapp/biz-1');
        expect(body.verify_token).toBe('my-verify-token');
        // Verify DB was updated to active
        const updateCall = mockQuery.mock.calls[1];
        expect(updateCall[0]).toMatch(/status = 'active'/);
        expect(updateCall[1]).toContain('biz-1');
    });
    it('returns failure and sets status to error (retaining credentials) when Meta API returns non-200', async () => {
        const mockQuery = vi.mocked(pool.query);
        mockQuery.mockResolvedValueOnce({ rows: [makeIntegrationRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Invalid access token' } }), { status: 401 }));
        const result = await registerWebhook('biz-1');
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('Invalid access token');
        // Verify DB was updated to error (not deleted — credentials retained)
        const updateCall = mockQuery.mock.calls[1];
        expect(updateCall[0]).toMatch(/status = 'error'/);
        expect(updateCall[1][0]).toContain('Invalid access token');
        expect(updateCall[1][1]).toBe('biz-1');
        // Confirm no DELETE was issued
        const allQueries = mockQuery.mock.calls.map((c) => c[0]);
        expect(allQueries.every((q) => !q.toUpperCase().startsWith('DELETE'))).toBe(true);
    });
    it('returns failure and sets status to error when fetch throws a network error', async () => {
        const mockQuery = vi.mocked(pool.query);
        mockQuery.mockResolvedValueOnce({ rows: [makeIntegrationRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const result = await registerWebhook('biz-1');
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('ECONNREFUSED');
        const updateCall = mockQuery.mock.calls[1];
        expect(updateCall[0]).toMatch(/status = 'error'/);
    });
    it('returns descriptive error without DB writes when no integration exists', async () => {
        const mockQuery = vi.mocked(pool.query);
        // getCredentials returns empty
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const result = await registerWebhook('biz-unknown');
        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/No WhatsApp integration found/);
        // Only one DB call (the SELECT), no UPDATE
        expect(mockQuery).toHaveBeenCalledOnce();
    });
    it('includes a generic error message when Meta API returns non-200 with no error body', async () => {
        const mockQuery = vi.mocked(pool.query);
        mockQuery.mockResolvedValueOnce({ rows: [makeIntegrationRow()], rowCount: 1 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
        const result = await registerWebhook('biz-1');
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('500');
    });
});
//# sourceMappingURL=register-webhook.test.js.map