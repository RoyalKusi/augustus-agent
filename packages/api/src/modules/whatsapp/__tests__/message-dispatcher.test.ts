/**
 * Unit tests for sendMessage (task 5.6)
 *
 * Covers:
 *  - Text message dispatch
 *  - Image message dispatch
 *  - Document/PDF dispatch
 *  - Carousel dispatch (validates 1–10 product constraint — Req 6.2)
 *  - Quick reply dispatch
 *  - Payment link dispatch
 *  - Error handling (Meta API failure, network error, missing integration)
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// ── Env setup ─────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.META_GRAPH_API_VERSION = 'v19.0';
});

// ── Mock DB pool ──────────────────────────────────────────────────────────────
vi.mock('../../../db/client.js', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../../db/client.js';
import { encrypt } from '../../../utils/crypto.js';
import { sendMessage } from '../message-dispatcher.js';
import type {
  TextMessage,
  ImageMessage,
  DocumentMessage,
  CarouselMessage,
  QuickReplyMessage,
  PaymentLinkMessage,
  CarouselProduct,
} from '../message-dispatcher.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIntegrationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int-1',
    business_id: 'biz-1',
    waba_id: 'waba-123',
    phone_number_id: 'phone-456',
    access_token_encrypted: encrypt('test-token'),
    webhook_verify_token: 'verify-token',
    status: 'active',
    error_message: null,
    created_at: new Date(),
    updated_at: new Date(),
    registered_at: new Date(),
    ...overrides,
  };
}

function mockIntegration() {
  vi.mocked(pool.query).mockResolvedValueOnce({
    rows: [makeIntegrationRow()],
    rowCount: 1,
  } as never);
}

function mockMetaSuccess(messageId = 'wamid.abc123') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({ messages: [{ id: messageId }] }),
      { status: 200 },
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendMessage — text', () => {
  it('sends a text message and returns messageId on success', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: TextMessage = { type: 'text', to: '+263771234567', body: 'Hello!' };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid.abc123');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('phone-456/messages');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.type).toBe('text');
    expect((body.text as { body: string }).body).toBe('Hello!');
  });
});

describe('sendMessage — image', () => {
  it('sends an image message with link and optional caption', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: ImageMessage = {
      type: 'image',
      to: '+263771234567',
      url: 'https://cdn.example.com/product.jpg',
      caption: 'Check this out',
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.type).toBe('image');
    const image = body.image as { link: string; caption: string };
    expect(image.link).toBe('https://cdn.example.com/product.jpg');
    expect(image.caption).toBe('Check this out');
  });

  it('sends an image message without caption when not provided', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: ImageMessage = {
      type: 'image',
      to: '+263771234567',
      url: 'https://cdn.example.com/product.jpg',
    };
    await sendMessage('biz-1', msg);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect((body.image as Record<string, unknown>).caption).toBeUndefined();
  });
});

describe('sendMessage — document (PDF)', () => {
  it('sends a document message with filename', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: DocumentMessage = {
      type: 'document',
      to: '+263771234567',
      url: 'https://cdn.example.com/catalogue.pdf',
      filename: 'catalogue.pdf',
      caption: 'Our latest catalogue',
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.type).toBe('document');
    const doc = body.document as { link: string; filename: string; caption: string };
    expect(doc.link).toBe('https://cdn.example.com/catalogue.pdf');
    expect(doc.filename).toBe('catalogue.pdf');
    expect(doc.caption).toBe('Our latest catalogue');
  });
});

describe('sendMessage — carousel', () => {
  function makeProducts(count: number): CarouselProduct[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `prod-${i}`,
      name: `Product ${i}`,
      price: 9.99 + i,
      currency: 'USD',
      imageUrl: `https://cdn.example.com/prod-${i}.jpg`,
    }));
  }

  it('sends a carousel with valid products (1–10) as an interactive list', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products: makeProducts(3),
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.type).toBe('interactive');
    const interactive = body.interactive as {
      type: string;
      action: { button: string; sections: Array<{ rows: unknown[] }> };
    };
    expect(interactive.type).toBe('list');
    // Req 6.1: "View Details" button label
    expect(interactive.action.button).toBe('View Details');
    // 3 rows for 3 products
    expect(interactive.action.sections[0].rows).toHaveLength(3);
  });

  it('rejects carousel with 0 products (Req 6.2)', async () => {
    mockIntegration();

    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products: [],
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/between 1 and 10/);
  });

  it('rejects carousel with 11 products (Req 6.2)', async () => {
    mockIntegration();

    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products: makeProducts(11),
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/between 1 and 10/);
  });

  it('accepts carousel with exactly 1 product', async () => {
    mockIntegration();
    mockMetaSuccess();

    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products: makeProducts(1),
    };
    const result = await sendMessage('biz-1', msg);
    expect(result.success).toBe(true);
  });

  it('accepts carousel with exactly 10 products', async () => {
    mockIntegration();
    mockMetaSuccess();

    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products: makeProducts(10),
    };
    const result = await sendMessage('biz-1', msg);
    expect(result.success).toBe(true);
  });

  it('includes product name and price in each carousel row (Req 6.1)', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const products = makeProducts(2);
    const msg: CarouselMessage = {
      type: 'carousel',
      to: '+263771234567',
      products,
    };
    await sendMessage('biz-1', msg);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    const interactive = body.interactive as {
      action: { sections: Array<{ rows: Array<{ id: string; title: string; description: string }> }> };
    };
    const rows = interactive.action.sections[0].rows;

    expect(rows[0].id).toBe('prod-0');
    expect(rows[0].title).toContain('Product 0');
    expect(rows[0].description).toContain('9.99');

    expect(rows[1].id).toBe('prod-1');
    expect(rows[1].title).toContain('Product 1');
    expect(rows[1].description).toContain('10.99');
  });
});

describe('sendMessage — quick reply', () => {
  it('sends an interactive reply_button message', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: QuickReplyMessage = {
      type: 'quick_reply',
      to: '+263771234567',
      body: 'Would you like to proceed?',
      buttons: [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ],
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.type).toBe('interactive');
    const interactive = body.interactive as {
      type: string;
      body: { text: string };
      action: { buttons: Array<{ type: string; reply: { id: string; title: string } }> };
    };
    expect(interactive.type).toBe('button');
    expect(interactive.body.text).toBe('Would you like to proceed?');
    expect(interactive.action.buttons).toHaveLength(2);
    expect(interactive.action.buttons[0].reply.id).toBe('yes');
    expect(interactive.action.buttons[1].reply.id).toBe('no');
  });
});

describe('sendMessage — payment link', () => {
  it('sends payment link as a text message with URL appended', async () => {
    mockIntegration();
    const fetchSpy = mockMetaSuccess();

    const msg: PaymentLinkMessage = {
      type: 'payment_link',
      to: '+263771234567',
      body: 'Complete your purchase:',
      paymentUrl: 'https://paynow.co.zw/pay/abc123',
    };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.type).toBe('text');
    const text = (body.text as { body: string }).body;
    expect(text).toContain('Complete your purchase:');
    expect(text).toContain('https://paynow.co.zw/pay/abc123');
  });
});

describe('sendMessage — error handling', () => {
  it('returns failure when no integration exists for the business', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const msg: TextMessage = { type: 'text', to: '+263771234567', body: 'Hi' };
    const result = await sendMessage('biz-unknown', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/No WhatsApp integration found/);
  });

  it('returns failure with Meta error detail when API returns non-200', async () => {
    mockIntegration();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: 'Invalid phone number' } }),
        { status: 400 },
      ),
    );

    const msg: TextMessage = { type: 'text', to: 'bad-number', body: 'Hi' };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Invalid phone number');
  });

  it('returns failure with HTTP status when API returns non-200 with no error body', async () => {
    mockIntegration();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 503 }),
    );

    const msg: TextMessage = { type: 'text', to: '+263771234567', body: 'Hi' };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('503');
  });

  it('returns failure when fetch throws a network error', async () => {
    mockIntegration();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const msg: TextMessage = { type: 'text', to: '+263771234567', body: 'Hi' };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('ECONNREFUSED');
  });

  it('returns success even when response body has no messageId', async () => {
    mockIntegration();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const msg: TextMessage = { type: 'text', to: '+263771234567', body: 'Hi' };
    const result = await sendMessage('biz-1', msg);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeUndefined();
  });
});
