/**
 * Feature tests: WhatsApp connection, Catalogue, Conversations
 *
 * Tests the key service-layer logic with mocked DB and external calls.
 * No real DB, Redis, Meta API, or Claude API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { mockQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockConnect: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  pool: { query: mockQuery, connect: mockConnect },
}));

vi.mock('../../redis/client.js', () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}));

vi.mock('../../redis/conversation.js', () => ({
  getConversationContext: vi.fn().mockResolvedValue([]),
  appendMessage: vi.fn().mockResolvedValue(undefined),
  clearConversationContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/crypto.js', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, '')),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  storeCredentials,
  getCredentials,
  updateCredentials,
  deleteCredentials,
  registerWebhook,
  deregisterWebhook,
} from '../whatsapp/whatsapp-integration.service.js';

import {
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getInStockProducts,
  createCombo,
  listCombos,
  deleteCombo,
  parseCsvRows,
  validateCsvRow,
  importProductsFromCsv,
} from '../catalogue/catalogue.service.js';

import {
  filterContextWindow,
  parseClaudeResponse,
  detectLanguage,
  buildSystemPrompt,
  isSessionExpired,
  isManualInterventionActive,
  LIVE_CONTEXT_MESSAGES,
  MAX_CONTEXT_MESSAGES,
  CONTEXT_WINDOW_MS,
} from '../conversation/conversation-engine.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WA_ROW = {
  id: 'int-001',
  business_id: 'biz-001',
  waba_id: 'waba-001',
  phone_number_id: 'phone-001',
  access_token_encrypted: 'enc:tok-abc',
  webhook_verify_token: 'verify-xyz',
  status: 'inactive' as const,
  error_message: null,
  display_phone_number: '+263771234567',
  verified_name: 'Test Business',
  created_at: new Date(),
  updated_at: new Date(),
};

const PRODUCT_ROW = {
  id: 'prod-001',
  business_id: 'biz-001',
  name: 'Widget A',
  description: 'A great widget',
  price: '9.99',
  currency: 'USD',
  stock_quantity: 50,
  category: 'Widgets',
  image_urls: ['https://example.com/img.jpg'],
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeMockClient(queryImpl: (sql: string, params?: unknown[]) => { rows: unknown[]; rowCount?: number }) {
  return {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => queryImpl(sql, params)),
    release: vi.fn(),
  };
}

// ─── WhatsApp Integration ─────────────────────────────────────────────────────

describe('WhatsApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('storeCredentials', () => {
    it('encrypts the access token and upserts the integration row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [WA_ROW] });

      const result = await storeCredentials('biz-001', 'waba-001', 'phone-001', 'tok-abc', 'verify-xyz');

      expect(result.wabaId).toBe('waba-001');
      expect(result.phoneNumberId).toBe('phone-001');
      expect(result.accessToken).toBe('tok-abc'); // decrypted
      expect(result.status).toBe('inactive');

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO whatsapp_integrations');
      expect(params).toContain('enc:tok-abc'); // encrypted value stored
    });
  });

  describe('getCredentials', () => {
    it('returns null when no integration exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await getCredentials('biz-no-wa');
      expect(result).toBeNull();
    });

    it('returns decrypted credentials when integration exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [WA_ROW] });
      const result = await getCredentials('biz-001');
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('tok-abc');
      expect(result!.wabaId).toBe('waba-001');
    });
  });

  describe('updateCredentials', () => {
    it('updates only the provided fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...WA_ROW, waba_id: 'waba-002' }] });

      const result = await updateCredentials('biz-001', { wabaId: 'waba-002' });

      expect(result.wabaId).toBe('waba-002');
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('UPDATE whatsapp_integrations');
      expect(sql).toContain('waba_id');
    });

    it('throws when integration not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(updateCredentials('biz-none', { wabaId: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteCredentials', () => {
    it('issues a DELETE query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await deleteCredentials('biz-001');
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('DELETE FROM whatsapp_integrations');
    });
  });

  describe('registerWebhook', () => {
    it('returns success=false when no integration exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // getCredentials
      const result = await registerWebhook('biz-no-wa');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('No WhatsApp integration');
    });

    it('sets status=active on Meta API success', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [WA_ROW] }) // getCredentials
        .mockResolvedValueOnce({ rows: [] });       // UPDATE status=active

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

      const result = await registerWebhook('biz-001');
      expect(result.success).toBe(true);

      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes("status = 'active'"),
      );
      expect(updateCall).toBeDefined();
    });

    it('sets status=error and retains credentials on Meta API failure', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [WA_ROW] }) // getCredentials
        .mockResolvedValueOnce({ rows: [] });       // UPDATE status=error

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid token' } }),
      });

      const result = await registerWebhook('biz-001');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Invalid token');

      const errorUpdate = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes("status = 'error'"),
      );
      expect(errorUpdate).toBeDefined();
    });

    it('sets status=error on network timeout', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [WA_ROW] })
        .mockResolvedValueOnce({ rows: [] });

      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      const result = await registerWebhook('biz-001');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('aborted');
    });
  });

  describe('deregisterWebhook', () => {
    it('sets status=inactive on Meta API success', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [WA_ROW] })
        .mockResolvedValueOnce({ rows: [] });

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

      const result = await deregisterWebhook('biz-001');
      expect(result.success).toBe(true);

      const inactiveUpdate = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes("status = 'inactive'"),
      );
      expect(inactiveUpdate).toBeDefined();
    });
  });
});

// ─── Catalogue ────────────────────────────────────────────────────────────────

describe('Catalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProduct', () => {
    it('inserts a product and returns it', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });

      const result = await createProduct('biz-001', {
        name: 'Widget A',
        price: 9.99,
        currency: 'USD',
        stockQuantity: 50,
      });

      expect(result.name).toBe('Widget A');
      expect(result.price).toBe(9.99);
      expect(result.stockQuantity).toBe(50);
      expect(result.isActive).toBe(true);

      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('INSERT INTO products');
    });
  });

  describe('getProduct', () => {
    it('returns null when product not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await getProduct('biz-001', 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns the product when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });
      const result = await getProduct('biz-001', 'prod-001');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('prod-001');
    });
  });

  describe('updateProduct', () => {
    it('updates specified fields and returns updated product', async () => {
      const updated = { ...PRODUCT_ROW, price: '14.99', stock_quantity: 30 };
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const result = await updateProduct('biz-001', 'prod-001', { price: 14.99, stockQuantity: 30 });

      expect(result!.price).toBe(14.99);
      expect(result!.stockQuantity).toBe(30);
    });

    it('returns null when product not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await updateProduct('biz-001', 'nonexistent', { price: 5 });
      expect(result).toBeNull();
    });
  });

  describe('deleteProduct', () => {
    it('returns true when product deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await deleteProduct('biz-001', 'prod-001');
      expect(result).toBe(true);
    });

    it('returns false when product not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });
      const result = await deleteProduct('biz-001', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('searchProducts', () => {
    it('returns all products when no filters applied', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });
      const results = await searchProducts('biz-001', {});
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Widget A');
    });

    it('applies name filter with ILIKE', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });
      await searchProducts('biz-001', { name: 'widget' });
      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('%widget%');
    });

    it('applies inStock=true filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });
      await searchProducts('biz-001', { inStock: true });
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('stock_quantity > 0');
    });

    it('applies price range filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await searchProducts('biz-001', { minPrice: 5, maxPrice: 20 });
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('price >=');
      expect(sql).toContain('price <=');
    });
  });

  describe('getInStockProducts', () => {
    it('only returns products with stock_quantity > 0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [PRODUCT_ROW] });
      await getInStockProducts('biz-001');
      const [sql] = mockQuery.mock.calls[0] as [string];
      expect(sql).toContain('stock_quantity > 0');
      expect(sql).toContain('is_active = TRUE');
    });
  });

  describe('createCombo', () => {
    it('throws when fewer than 2 products provided', async () => {
      await expect(
        createCombo('biz-001', { name: 'Bundle', promoPrice: 15, currency: 'USD', productIds: ['p1'] }),
      ).rejects.toThrow('at least 2 products');
    });

    it('creates combo with transaction', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT/.test(sql)) return { rows: [] };
        if (sql.includes('INSERT INTO promo_combos')) {
          return { rows: [{ id: 'combo-001', business_id: 'biz-001', name: 'Bundle', promo_price: '15.00', currency: 'USD', is_active: true, created_at: new Date() }] };
        }
        return { rows: [] };
      });
      mockConnect.mockResolvedValueOnce(mockClient);

      const result = await createCombo('biz-001', {
        name: 'Bundle',
        promoPrice: 15,
        currency: 'USD',
        productIds: ['p1', 'p2'],
      });

      expect(result.name).toBe('Bundle');
      expect(result.promoPrice).toBe(15);
      expect(result.productIds).toEqual(['p1', 'p2']);
    });
  });

  describe('listCombos', () => {
    it('returns combos with their product IDs', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'combo-001', business_id: 'biz-001', name: 'Bundle', promo_price: '15.00', currency: 'USD', is_active: true, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ product_id: 'p1' }, { product_id: 'p2' }] });

      const result = await listCombos('biz-001');
      expect(result).toHaveLength(1);
      expect(result[0].productIds).toEqual(['p1', 'p2']);
    });
  });

  describe('deleteCombo', () => {
    it('returns true when combo deleted', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT/.test(sql)) return { rows: [] };
        if (sql.includes('DELETE FROM promo_combo_products')) return { rows: [], rowCount: 2 };
        if (sql.includes('DELETE FROM promo_combos')) return { rows: [], rowCount: 1 };
        return { rows: [] };
      });
      mockConnect.mockResolvedValueOnce(mockClient);

      const result = await deleteCombo('biz-001', 'combo-001');
      expect(result).toBe(true);
    });
  });

  describe('CSV import', () => {
    it('parseCsvRows parses header and data rows correctly', () => {
      const csv = 'name,price,currency,stock_quantity\nWidget A,9.99,USD,50\nWidget B,14.99,USD,20';
      const rows = parseCsvRows(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Widget A');
      expect(rows[0].price).toBe('9.99');
      expect(rows[1].stock_quantity).toBe('20');
    });

    it('parseCsvRows returns empty array for header-only CSV', () => {
      const rows = parseCsvRows('name,price,currency,stock_quantity');
      expect(rows).toHaveLength(0);
    });

    it('validateCsvRow returns null for valid row', () => {
      const reason = validateCsvRow({ name: 'Widget', price: '9.99', currency: 'USD', stock_quantity: '10' });
      expect(reason).toBeNull();
    });

    it('validateCsvRow returns error for missing required fields', () => {
      const reason = validateCsvRow({ name: 'Widget', price: '', currency: 'USD', stock_quantity: '10' });
      expect(reason).toContain('price');
    });

    it('validateCsvRow returns error for negative price', () => {
      const reason = validateCsvRow({ name: 'Widget', price: '-5', currency: 'USD', stock_quantity: '10' });
      expect(reason).toContain('price');
    });

    it('validateCsvRow returns error for non-integer stock_quantity', () => {
      const reason = validateCsvRow({ name: 'Widget', price: '9.99', currency: 'USD', stock_quantity: '1.5' });
      expect(reason).toContain('stock_quantity');
    });

    it('importProductsFromCsv imports valid rows and reports errors for invalid ones', async () => {
      mockQuery.mockResolvedValue({ rows: [] }); // INSERT calls

      const csv = [
        'name,price,currency,stock_quantity',
        'Widget A,9.99,USD,50',       // valid
        ',14.99,USD,20',               // invalid — missing name
        'Widget C,bad_price,USD,10',   // invalid — bad price
        'Widget D,5.00,USD,5',         // valid
      ].join('\n');

      const result = await importProductsFromCsv('biz-001', csv);

      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row).toBe(3); // row 2 in CSV = row 3 (1-indexed with header)
      expect(result.errors[1].row).toBe(4);
    });
  });
});

// ─── Conversation Engine (pure functions) ─────────────────────────────────────

describe('Conversation Engine', () => {
  describe('filterContextWindow', () => {
    const now = Date.now();

    it('removes messages older than the context window', () => {
      const messages = [
        { role: 'user', content: 'old', timestamp: now - CONTEXT_WINDOW_MS - 1000 },
        { role: 'user', content: 'recent', timestamp: now - 1000 },
      ];
      const result = filterContextWindow(messages, now);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('recent');
    });

    it('limits to MAX_CONTEXT_MESSAGES', () => {
      const messages = Array.from({ length: MAX_CONTEXT_MESSAGES + 5 }, (_, i) => ({
        role: 'user',
        content: `msg ${i}`,
        timestamp: now - i * 1000,
      }));
      const result = filterContextWindow(messages, now);
      expect(result.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);
    });

    it('returns empty array when all messages are expired', () => {
      const messages = [
        { role: 'user', content: 'very old', timestamp: now - CONTEXT_WINDOW_MS * 2 },
      ];
      const result = filterContextWindow(messages, now);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseClaudeResponse', () => {
    it('parses plain text response', () => {
      const result = parseClaudeResponse('Hello! How can I help you today?');
      expect(result.type).toBe('text');
      expect(result.text).toBe('Hello! How can I help you today?');
    });

    it('parses CAROUSEL_TRIGGER with product IDs', () => {
      const result = parseClaudeResponse('Here are our products:\nCAROUSEL_TRIGGER:[prod-001,prod-002]');
      expect(result.type).toBe('carousel');
      expect(result.products).toEqual(['prod-001', 'prod-002']);
      expect(result.text).toContain('Here are our products');
      expect(result.text).not.toContain('CAROUSEL_TRIGGER');
    });

    it('parses PAYMENT_TRIGGER with order JSON', () => {
      const response = 'Great choice! Let me process that.\nPAYMENT_TRIGGER:{"items":[{"product_id":"prod-001","quantity":1}],"total":9.99,"currency":"USD"}';
      const result = parseClaudeResponse(response);
      expect(result.type).toBe('payment');
      expect((result.orderDetails as { total: number }).total).toBe(9.99);
      expect(result.text).not.toContain('PAYMENT_TRIGGER');
    });

    it('handles malformed PAYMENT_TRIGGER JSON gracefully', () => {
      const result = parseClaudeResponse('PAYMENT_TRIGGER:{invalid json}');
      expect(result.type).toBe('text');
    });

    it('strips trigger from text when CAROUSEL_TRIGGER is on its own line', () => {
      const result = parseClaudeResponse('Check these out!\nCAROUSEL_TRIGGER:[p1,p2]\nLet me know what you think.');
      expect(result.type).toBe('carousel');
      expect(result.text).not.toContain('CAROUSEL_TRIGGER');
    });
  });

  describe('detectLanguage', () => {
    it('detects English for ASCII text', () => {
      expect(detectLanguage('Hello, how are you?')).toBe('English');
    });

    it('detects Chinese for CJK characters', () => {
      expect(detectLanguage('你好，我想买这个产品')).toBe('Chinese');
    });

    it('detects Arabic for Arabic script', () => {
      expect(detectLanguage('مرحبا، كيف حالك؟')).toBe('Arabic');
    });

    it('detects Russian for Cyrillic', () => {
      expect(detectLanguage('Привет, как дела?')).toBe('Russian');
    });
  });

  describe('isSessionExpired', () => {
    const now = Date.now();

    it('returns false for a fresh session with few messages', () => {
      expect(isSessionExpired(5, now - 1000, now)).toBe(false);
    });

    it('returns true when message count exceeds MAX_CONTEXT_MESSAGES', () => {
      expect(isSessionExpired(MAX_CONTEXT_MESSAGES + 1, now - 1000, now)).toBe(true);
    });

    it('returns true when session is older than CONTEXT_WINDOW_MS', () => {
      expect(isSessionExpired(5, now - CONTEXT_WINDOW_MS - 1000, now)).toBe(true);
    });
  });

  describe('isManualInterventionActive', () => {
    it('returns true when manual_intervention_active is true', () => {
      expect(isManualInterventionActive({ manual_intervention_active: true })).toBe(true);
    });

    it('returns false when manual_intervention_active is false', () => {
      expect(isManualInterventionActive({ manual_intervention_active: false })).toBe(false);
    });

    it('returns false when field is missing', () => {
      expect(isManualInterventionActive({})).toBe(false);
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes product list when products are provided', () => {
      const products = [{ id: 'p1', name: 'Widget', price: 9.99, currency: 'USD', category: null, stock_quantity: 10, description: null }];
      const prompt = buildSystemPrompt(null, products, 'English', null);
      expect(prompt).toContain('Widget');
      expect(prompt).toContain('9.99');
    });

    it('includes language instruction', () => {
      const prompt = buildSystemPrompt(null, [], 'Shona', null);
      expect(prompt).toContain('Shona');
    });

    it('includes context summary when provided', () => {
      const prompt = buildSystemPrompt(null, [], 'English', 'Customer wants to buy a widget');
      expect(prompt).toContain('Customer wants to buy a widget');
    });

    it('includes training data when provided', () => {
      const training = { business_description: 'We sell quality widgets', faqs: null, tone_guidelines: null };
      const prompt = buildSystemPrompt(training, [], 'English', null);
      expect(prompt).toContain('We sell quality widgets');
    });

    it('includes PAYMENT_TRIGGER instruction', () => {
      const prompt = buildSystemPrompt(null, [], 'English', null);
      expect(prompt).toContain('PAYMENT_TRIGGER');
    });

    it('includes CAROUSEL_TRIGGER instruction', () => {
      const prompt = buildSystemPrompt(null, [], 'English', null);
      expect(prompt).toContain('CAROUSEL_TRIGGER');
    });

    it('mentions in-chat payments disabled when flag is false', () => {
      const prompt = buildSystemPrompt(null, [], 'English', null, false);
      expect(prompt).toContain('DISABLED');
    });

    it('includes customer name when provided', () => {
      const prompt = buildSystemPrompt(null, [], 'English', null, true, '', 0, 'Alice');
      expect(prompt).toContain('Alice');
    });

    it('includes time gap context for long absence', () => {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const prompt = buildSystemPrompt(null, [], 'English', null, true, '', twoHoursMs);
      expect(prompt).toContain('Time Gap');
    });
  });
});
