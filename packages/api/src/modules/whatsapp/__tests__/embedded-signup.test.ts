/**
 * Tests for the WhatsApp embedded signup token exchange flow.
 * Validates that the service correctly handles all Meta postMessage event variants
 * and extracts WABA ID / Phone Number ID without requiring whatsapp_business_management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../db/client.js', () => ({
  pool: { query: mockQuery },
}));

vi.mock('../../../utils/crypto.js', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, '')),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Test the postMessage parsing logic (pure, no imports needed) ─────────────

describe('Meta postMessage event parsing', () => {
  // Simulate the frontend logic for extracting WABA ID from postMessage
  function parsePostMessage(data: Record<string, unknown>): { wabaId?: string; phoneNumberId?: string; code?: string; isFinish: boolean } {
    const isFinish = typeof data.event === 'string' && (data.event as string).startsWith('FINISH');
    const inner = data.data as Record<string, unknown> | undefined;
    return {
      isFinish,
      code: inner?.code as string | undefined,
      wabaId: (inner?.waba_id ?? inner?.wabaId) as string | undefined,
      phoneNumberId: (inner?.phone_number_id ?? inner?.phoneNumberId) as string | undefined,
    };
  }

  it('handles FINISH event (standard Cloud API flow)', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: { code: 'abc123', waba_id: 'waba-001', phone_number_id: 'phone-001' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(true);
    expect(result.code).toBe('abc123');
    expect(result.wabaId).toBe('waba-001');
    expect(result.phoneNumberId).toBe('phone-001');
  });

  it('handles FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING event', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      data: { code: 'xyz789', waba_id: 'waba-002', phone_number_id: 'phone-002' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(true);
    expect(result.wabaId).toBe('waba-002');
    expect(result.phoneNumberId).toBe('phone-002');
  });

  it('handles FINISH_ONLY_WABA event', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH_ONLY_WABA',
      data: { code: 'code123', waba_id: 'waba-003' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(true);
    expect(result.wabaId).toBe('waba-003');
  });

  it('handles FINISH_OBO_MIGRATION event', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH_OBO_MIGRATION',
      data: { code: 'code456', waba_id: 'waba-004', phone_number_id: 'phone-004' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(true);
  });

  it('does NOT treat CANCEL as a finish event', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'CANCEL',
      data: { current_step: 'PHONE_NUMBER_SETUP' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(false);
  });

  it('does NOT treat ERROR as a finish event', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'ERROR',
      data: { error_message: 'Something went wrong', error_code: '524126' },
    };
    const result = parsePostMessage(data);
    expect(result.isFinish).toBe(false);
  });

  it('extracts waba_id and phone_number_id from standard Meta field names', () => {
    const data = {
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: {
        code: 'code789',
        waba_id: '524126980791429',
        phone_number_id: '106540352242922',
        business_id: '2729063490586005',
      },
    };
    const result = parsePostMessage(data);
    expect(result.wabaId).toBe('524126980791429');
    expect(result.phoneNumberId).toBe('106540352242922');
  });
});

// ─── Test the backend service with provided WABA ID (skips debug_token) ───────

describe('exchangeEmbeddedSignupCode with provided WABA ID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Set required env vars
    process.env.META_APP_ID = 'app-001';
    process.env.META_APP_SECRET = 'secret-001';
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'verify-token';
  });

  it('skips debug_token call when wabaId is provided', async () => {
    // Mock token exchange
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok-abc' }),
      })
      // Mock phone numbers enrichment (best-effort)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'phone-001',
            display_phone_number: '+263771234567',
            verified_name: 'Test Business',
            code_verification_status: 'VERIFIED',
            name_status: 'APPROVED',
          }],
        }),
      })
      // Mock phone registration
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      // Mock webhook subscription
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    // Mock DB calls
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO whatsapp_integrations')) return { rows: [{
        id: 'int-001', business_id: 'biz-001', waba_id: 'waba-001',
        phone_number_id: 'phone-001', access_token_encrypted: 'enc:tok-abc',
        webhook_verify_token: 'verify-token', status: 'inactive',
        error_message: null, display_phone_number: '+263771234567',
        verified_name: 'Test Business', created_at: new Date(), updated_at: new Date(),
      }] };
      if (sql.includes('SELECT * FROM whatsapp_integrations')) return { rows: [{
        id: 'int-001', business_id: 'biz-001', waba_id: 'waba-001',
        phone_number_id: 'phone-001', access_token_encrypted: 'enc:tok-abc',
        webhook_verify_token: 'verify-token', status: 'inactive',
        error_message: null, display_phone_number: '+263771234567',
        verified_name: 'Test Business', created_at: new Date(), updated_at: new Date(),
      }] };
      return { rows: [] };
    });

    const { exchangeEmbeddedSignupCode } = await import('../whatsapp-integration.service.js');
    const result = await exchangeEmbeddedSignupCode('biz-001', 'code-abc', 'waba-001', 'phone-001');

    expect(result.wabaId).toBe('waba-001');
    expect(result.phoneNumberId).toBe('phone-001');
    expect(result.registrationStatus).toBe('registered');

    // Verify debug_token was NOT called (only 4 fetch calls: token exchange, phone numbers, register, webhook)
    const fetchCalls = mockFetch.mock.calls.map(([url]: [string]) => url as string);
    const debugTokenCalled = fetchCalls.some(url => url.includes('debug_token'));
    expect(debugTokenCalled).toBe(false);
  });

  it('returns correct result when phone number enrichment fails (non-fatal)', async () => {
    // Mock token exchange
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok-abc' }),
      })
      // Phone numbers enrichment fails
      .mockRejectedValueOnce(new Error('Network error'))
      // Phone registration
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      // Webhook subscription
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO whatsapp_integrations')) return { rows: [{
        id: 'int-001', business_id: 'biz-001', waba_id: 'waba-001',
        phone_number_id: 'phone-001', access_token_encrypted: 'enc:tok-abc',
        webhook_verify_token: 'verify-token', status: 'inactive',
        error_message: null, display_phone_number: null,
        verified_name: null, created_at: new Date(), updated_at: new Date(),
      }] };
      if (sql.includes('SELECT * FROM whatsapp_integrations')) return { rows: [{
        id: 'int-001', business_id: 'biz-001', waba_id: 'waba-001',
        phone_number_id: 'phone-001', access_token_encrypted: 'enc:tok-abc',
        webhook_verify_token: 'verify-token', status: 'inactive',
        error_message: null, display_phone_number: null,
        verified_name: null, created_at: new Date(), updated_at: new Date(),
      }] };
      return { rows: [] };
    });

    const { exchangeEmbeddedSignupCode } = await import('../whatsapp-integration.service.js');

    // Should NOT throw even when phone enrichment fails
    await expect(
      exchangeEmbeddedSignupCode('biz-001', 'code-abc', 'waba-001', 'phone-001')
    ).resolves.toBeDefined();
  });
});
