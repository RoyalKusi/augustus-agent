/**
 * Property-based tests for WhatsApp Integration
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 4.3
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as fc from 'fast-check';
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
function makeIntegrationRow(wabaId, phoneNumberId, accessToken) {
    return {
        id: 'int-prop-1',
        business_id: 'biz-prop-1',
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        access_token_encrypted: encrypt(accessToken),
        webhook_verify_token: 'verify-token-prop',
        status: 'inactive',
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
        registered_at: null,
    };
}
afterEach(() => {
    vi.restoreAllMocks();
});
// ── Arbitraries ───────────────────────────────────────────────────────────────
/** Non-empty string (no null bytes to keep encrypt happy) */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => !s.includes('\0'));
/** HTTP 4xx status codes */
const http4xxArb = fc.integer({ min: 400, max: 499 });
/** HTTP 5xx status codes */
const http5xxArb = fc.integer({ min: 500, max: 599 });
/** Any non-2xx HTTP status */
const httpErrorStatusArb = fc.oneof(http4xxArb, http5xxArb);
/** Network error messages */
const networkErrorArb = fc.constantFrom('ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'fetch failed', 'network error', 'AbortError: The operation was aborted.');
// ─── Property 11: Failed Webhook Verification Retains Credentials ─────────────
// Feature: augustus-ai-sales-platform, Property 11: Failed Webhook Verification Retains Credentials
// **Validates: Requirements 4.3**
describe('Property 11: Failed Webhook Verification Retains Credentials', () => {
    it('retains credentials and returns error when Meta API returns any HTTP error status', async () => {
        await fc.assert(fc.asyncProperty(nonEmptyStringArb, // wabaId
        nonEmptyStringArb, // phoneNumberId
        nonEmptyStringArb, // accessToken
        httpErrorStatusArb, // HTTP error status
        async (wabaId, phoneNumberId, accessToken, httpStatus) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            // First call: getCredentials SELECT — returns stored credentials
            mockQuery.mockResolvedValueOnce({
                rows: [makeIntegrationRow(wabaId, phoneNumberId, accessToken)],
                rowCount: 1,
            });
            // Second call: UPDATE to error status
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: `HTTP ${httpStatus} error` } }), {
                status: httpStatus,
            }));
            const result = await registerWebhook('biz-prop-1');
            // 1. An error message must be returned
            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeTruthy();
            expect(typeof result.errorMessage).toBe('string');
            expect(result.errorMessage.length).toBeGreaterThan(0);
            // 2. Status must be set to 'error' (not cleared/deleted)
            const allQueries = mockQuery.mock.calls.map((c) => c[0]);
            const updateCall = mockQuery.mock.calls.find((c) => c[0].includes("status = 'error'"));
            expect(updateCall).toBeDefined();
            expect(updateCall[0]).toMatch(/status = 'error'/);
            // 3. Credentials must NOT be deleted — no DELETE query issued
            expect(allQueries.every((q) => !q.trim().toUpperCase().startsWith('DELETE'))).toBe(true);
            // 4. The error message stored in DB must be descriptive (non-empty)
            const errorMsgInDb = updateCall[1][0];
            expect(errorMsgInDb).toBeTruthy();
            expect(errorMsgInDb.length).toBeGreaterThan(0);
        }), { numRuns: 25 });
    });
    it('retains credentials and returns error when a network error occurs', async () => {
        await fc.assert(fc.asyncProperty(nonEmptyStringArb, // wabaId
        nonEmptyStringArb, // phoneNumberId
        nonEmptyStringArb, // accessToken
        networkErrorArb, // network error message
        async (wabaId, phoneNumberId, accessToken, networkError) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            // First call: getCredentials SELECT
            mockQuery.mockResolvedValueOnce({
                rows: [makeIntegrationRow(wabaId, phoneNumberId, accessToken)],
                rowCount: 1,
            });
            // Second call: UPDATE to error status
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error(networkError));
            const result = await registerWebhook('biz-prop-1');
            // 1. An error message must be returned
            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeTruthy();
            expect(result.errorMessage.length).toBeGreaterThan(0);
            // 2. Status must be set to 'error'
            const updateCall = mockQuery.mock.calls.find((c) => c[0].includes("status = 'error'"));
            expect(updateCall).toBeDefined();
            // 3. No DELETE query — credentials retained
            const allQueries = mockQuery.mock.calls.map((c) => c[0]);
            expect(allQueries.every((q) => !q.trim().toUpperCase().startsWith('DELETE'))).toBe(true);
            // 4. The error message in DB references the network error
            const errorMsgInDb = updateCall[1][0];
            expect(errorMsgInDb).toContain(networkError);
        }), { numRuns: 25 });
    });
    it('retains credentials and returns error for any combination of credentials and error scenario', async () => {
        const errorScenarioArb = fc.oneof(
        // HTTP 4xx
        http4xxArb.map((status) => ({
            type: 'http',
            status,
            body: JSON.stringify({ error: { message: `Client error ${status}` } }),
        })), 
        // HTTP 5xx
        http5xxArb.map((status) => ({
            type: 'http',
            status,
            body: '',
        })), 
        // Network error
        networkErrorArb.map((msg) => ({ type: 'network', message: msg })));
        await fc.assert(fc.asyncProperty(nonEmptyStringArb, nonEmptyStringArb, nonEmptyStringArb, errorScenarioArb, async (wabaId, phoneNumberId, accessToken, scenario) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            mockQuery.mockResolvedValueOnce({
                rows: [makeIntegrationRow(wabaId, phoneNumberId, accessToken)],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            if (scenario.type === 'http') {
                vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(scenario.body, { status: scenario.status }));
            }
            else {
                vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error(scenario.message));
            }
            const result = await registerWebhook('biz-prop-1');
            // Core property: failure always retains credentials and returns error
            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeTruthy();
            // Status set to 'error' — not cleared
            const updateCall = mockQuery.mock.calls.find((c) => c[0].includes("status = 'error'"));
            expect(updateCall).toBeDefined();
            // No DELETE — credentials retained in system
            const allQueries = mockQuery.mock.calls.map((c) => c[0]);
            expect(allQueries.every((q) => !q.trim().toUpperCase().startsWith('DELETE'))).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 12: Re-integration Preserves Catalogue and Training Data ────────
// Feature: augustus-ai-sales-platform, Property 12: Re-integration Preserves Catalogue and Training Data
// **Validates: Requirements 4.5**
//
// The storeCredentials function uses INSERT ... ON CONFLICT (business_id) DO UPDATE
// which only touches the whatsapp_integrations table. It must never issue any
// DELETE, UPDATE, or INSERT against the products or training_data tables.
import { storeCredentials } from '../whatsapp-integration.service.js';
describe('Property 12: Re-integration Preserves Catalogue and Training Data', () => {
    it('storeCredentials only touches whatsapp_integrations — never products or training_data', async () => {
        await fc.assert(fc.asyncProperty(nonEmptyStringArb, // businessId
        nonEmptyStringArb, // wabaId
        nonEmptyStringArb, // phoneNumberId
        nonEmptyStringArb, // accessToken
        nonEmptyStringArb, // webhookVerifyToken
        async (businessId, wabaId, phoneNumberId, accessToken, webhookVerifyToken) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            // storeCredentials issues exactly one query (the upsert) and returns the row.
            // access_token_encrypted must be a valid encrypted payload so rowToIntegration
            // can call decrypt() without throwing.
            const fakeRow = {
                id: 'int-1',
                business_id: businessId,
                waba_id: wabaId,
                phone_number_id: phoneNumberId,
                access_token_encrypted: encrypt(accessToken),
                webhook_verify_token: webhookVerifyToken,
                status: 'inactive',
                error_message: null,
                created_at: new Date(),
                updated_at: new Date(),
                registered_at: null,
            };
            mockQuery.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });
            await storeCredentials(businessId, wabaId, phoneNumberId, accessToken, webhookVerifyToken);
            const allQueries = mockQuery.mock.calls.map((c) => c[0].toLowerCase());
            // 1. No query must reference the products table
            expect(allQueries.every((q) => !q.includes('products'))).toBe(true);
            // 2. No query must reference the training_data table
            expect(allQueries.every((q) => !q.includes('training_data'))).toBe(true);
            // 3. The only query issued must target whatsapp_integrations
            expect(allQueries.length).toBe(1);
            expect(allQueries[0]).toContain('whatsapp_integrations');
            // 4. The query must be an INSERT (upsert), not a DELETE
            expect(allQueries[0].trim().startsWith('insert')).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 20: Media Size Fallback ────────────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 20: Media Size Fallback
// **Validates: Requirements 6.5**
//
// For any media file whose size exceeds 16 MB, the WhatsApp_Integration_Service
// must send a text description instead of the media file, and must not attempt
// to upload the oversized file to the Meta Cloud API.
import { sendMediaWithFallback } from '../message-dispatcher.js';
const MB = 1024 * 1024;
const LIMIT = 16 * MB;
/** File sizes strictly above 16 MB */
const oversizedArb = fc.integer({ min: LIMIT + 1, max: LIMIT + 100 * MB });
/** File sizes at or below 16 MB (including 0) */
const withinLimitArb = fc.integer({ min: 0, max: LIMIT });
/** A simple image message */
const imageMsgArb = fc
    .record({
    to: nonEmptyStringArb,
    url: nonEmptyStringArb,
    caption: fc.option(nonEmptyStringArb, { nil: undefined }),
})
    .map(({ to, url, caption }) => ({
    type: 'image',
    to,
    url,
    caption,
}));
/** A simple document message */
const documentMsgArb = fc
    .record({
    to: nonEmptyStringArb,
    url: nonEmptyStringArb,
    filename: nonEmptyStringArb,
    caption: fc.option(nonEmptyStringArb, { nil: undefined }),
})
    .map(({ to, url, filename, caption }) => ({
    type: 'document',
    to,
    url,
    filename,
    caption,
}));
/** Either an image or document message */
const mediaMsgArb = fc.oneof(imageMsgArb, documentMsgArb);
describe('Property 20: Media Size Fallback', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('uses text fallback and never calls Meta API for any file size > 16 MB', async () => {
        await fc.assert(fc.asyncProperty(mediaMsgArb, nonEmptyStringArb, // textFallback
        oversizedArb, // fileSizeBytes > 16 MB
        async (mediaMsg, textFallback, fileSizeBytes) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            // Provide a valid integration row so sendMessage can load credentials
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'int-p20',
                        business_id: 'biz-p20',
                        waba_id: 'waba-p20',
                        phone_number_id: 'phone-p20',
                        access_token_encrypted: encrypt('token-p20'),
                        webhook_verify_token: 'verify-p20',
                        status: 'active',
                        error_message: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                        registered_at: new Date(),
                    },
                ],
                rowCount: 1,
            });
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'msg-p20' }] }), { status: 200 }));
            const result = await sendMediaWithFallback('biz-p20', mediaMsg, textFallback, fileSizeBytes);
            // 1. Must report that fallback was used
            expect(result.usedFallback).toBe(true);
            // 2. The fetch call must have been made with a TEXT payload, not image/document
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const callArgs = fetchSpy.mock.calls[0];
            const sentBody = JSON.parse(callArgs[1]?.body);
            expect(sentBody.type).toBe('text');
            expect(sentBody.type).not.toBe('image');
            expect(sentBody.type).not.toBe('document');
            // 3. The text body must be the fallback string
            const textPayload = sentBody.text;
            expect(textPayload.body).toBe(textFallback);
        }), { numRuns: 25 });
    });
    it('sends media normally (no fallback) for any file size <= 16 MB', async () => {
        await fc.assert(fc.asyncProperty(mediaMsgArb, nonEmptyStringArb, // textFallback
        withinLimitArb, // fileSizeBytes <= 16 MB
        async (mediaMsg, textFallback, fileSizeBytes) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'int-p20',
                        business_id: 'biz-p20',
                        waba_id: 'waba-p20',
                        phone_number_id: 'phone-p20',
                        access_token_encrypted: encrypt('token-p20'),
                        webhook_verify_token: 'verify-p20',
                        status: 'active',
                        error_message: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                        registered_at: new Date(),
                    },
                ],
                rowCount: 1,
            });
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'msg-p20' }] }), { status: 200 }));
            const result = await sendMediaWithFallback('biz-p20', mediaMsg, textFallback, fileSizeBytes);
            // 1. Must report that fallback was NOT used
            expect(result.usedFallback).toBe(false);
            // 2. The fetch call must have been made with the original media type
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const callArgs = fetchSpy.mock.calls[0];
            const sentBody = JSON.parse(callArgs[1]?.body);
            expect(sentBody.type).toBe(mediaMsg.type);
            expect(sentBody.type).not.toBe('text');
        }), { numRuns: 25 });
    });
    it('sends media normally when fileSizeBytes is not provided', async () => {
        await fc.assert(fc.asyncProperty(mediaMsgArb, nonEmptyStringArb, async (mediaMsg, textFallback) => {
            const mockQuery = vi.mocked(pool.query);
            mockQuery.mockReset();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'int-p20',
                        business_id: 'biz-p20',
                        waba_id: 'waba-p20',
                        phone_number_id: 'phone-p20',
                        access_token_encrypted: encrypt('token-p20'),
                        webhook_verify_token: 'verify-p20',
                        status: 'active',
                        error_message: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                        registered_at: new Date(),
                    },
                ],
                rowCount: 1,
            });
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'msg-p20' }] }), { status: 200 }));
            // No fileSizeBytes provided
            const result = await sendMediaWithFallback('biz-p20', mediaMsg, textFallback);
            expect(result.usedFallback).toBe(false);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=whatsapp.properties.test.js.map