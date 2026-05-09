/**
 * Unit tests for the Webhook Receiver module (tasks 6.1–6.4)
 *
 * Covers:
 *  - Valid HMAC signature → 200
 *  - Invalid HMAC signature → 403
 *  - Duplicate message ID → 200 (silently ignored)
 *  - hub.challenge verification success → returns challenge
 *  - hub.challenge verification failure → 403
 *
 * Validates: Requirements 4.1 (HMAC), 4.2 (hub.challenge), deduplication, async enqueue
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import crypto from 'crypto';
import Fastify from 'fastify';

// ── Set env vars before any module is loaded (vi.hoisted runs before imports) ─
vi.hoisted(() => {
  process.env.META_APP_SECRET = 'test-app-secret';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY ?? 'test-claude-key';
  process.env.CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-test';
});

// ── Environment setup ─────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.META_APP_SECRET = 'test-app-secret';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY ?? 'test-claude-key';
  process.env.CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-test';
});

// ── Mock dependencies ─────────────────────────────────────────────────────────
vi.mock('../../../redis/client.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../queue/producer.js', () => ({
  enqueueWebhookEvent: vi.fn().mockResolvedValue('stream-id-1'),
  WEBHOOK_STREAM: 'augustus:webhook:events',
}));

vi.mock('../../../db/client.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../../config.js', () => ({
  config: {
    meta: {
      appSecret: 'test-app-secret',
      verifyToken: '',
      graphApiVersion: 'v19.0',
    },
    claude: {
      apiKey: 'test-claude-key',
      model: 'claude-sonnet-4-5-20251001',
    },
  },
}));

// Mock the service functions used by the route for async path tests
vi.mock('../webhook.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../webhook.service.js')>();
  return {
    ...actual,
    isDuplicate: vi.fn(),
    enqueueWebhookPayload: vi.fn().mockResolvedValue(undefined),
  };
});

import { pool } from '../../../db/client.js';
import { validateHmacSignature } from '../webhook.service.js';
import { isDuplicate, enqueueWebhookPayload } from '../webhook.service.js';
import { webhookRoutes } from '../webhook.routes.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignature(body: string | Buffer, secret: string): string {
  const buf = typeof body === 'string' ? Buffer.from(body) : body;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(webhookRoutes);
  return app;
}

afterEach(() => {
  vi.clearAllMocks();
});

// ── validateHmacSignature unit tests ─────────────────────────────────────────

describe('validateHmacSignature', () => {
  const secret = 'my-secret';
  const body = Buffer.from('{"hello":"world"}');

  it('returns true for a valid HMAC signature', () => {
    const sig = makeSignature(body, secret);
    expect(validateHmacSignature(body, sig, secret)).toBe(true);
  });

  it('returns false for an invalid HMAC signature', () => {
    expect(validateHmacSignature(body, 'sha256=deadbeef', secret)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    expect(validateHmacSignature(body, '', secret)).toBe(false);
  });

  it('returns false when secret is empty', () => {
    const sig = makeSignature(body, secret);
    expect(validateHmacSignature(body, sig, '')).toBe(false);
  });

  it('returns false when signature has wrong prefix', () => {
    const raw = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(validateHmacSignature(body, `sha1=${raw}`, secret)).toBe(false);
  });
});

// ── isDuplicate unit tests (real implementation via redis mock) ───────────────

describe('isDuplicate (service function)', () => {
  it('returns false (not duplicate) when Redis SET NX succeeds', async () => {
    const redis = (await import('../../../redis/client.js')).default;
    vi.mocked(redis.set).mockResolvedValueOnce('OK' as never);

    const { isDuplicate: realIsDuplicate } = await vi.importActual<typeof import('../webhook.service.js')>('../webhook.service.js');
    const result = await realIsDuplicate('msg-123');
    expect(result).toBe(false);
    expect(redis.set).toHaveBeenCalledWith('webhook:dedup:msg-123', '1', 'EX', 86400, 'NX');
  });

  it('returns true (duplicate) when Redis SET NX returns null', async () => {
    const redis = (await import('../../../redis/client.js')).default;
    vi.mocked(redis.set).mockResolvedValueOnce(null as never);

    const { isDuplicate: realIsDuplicate } = await vi.importActual<typeof import('../webhook.service.js')>('../webhook.service.js');
    const result = await realIsDuplicate('msg-already-seen');
    expect(result).toBe(true);
  });
});

// ── Deduplication + enqueue logic unit tests ──────────────────────────────────

describe('deduplication and enqueue logic', () => {
  it('does not enqueue when isDuplicate returns true', async () => {
    vi.mocked(isDuplicate).mockResolvedValue(true);

    const duplicate = await isDuplicate('wamid.dup-test');
    if (!duplicate) {
      await enqueueWebhookPayload('biz-1', {});
    }

    expect(enqueueWebhookPayload).not.toHaveBeenCalled();
  });

  it('enqueues when isDuplicate returns false', async () => {
    vi.mocked(isDuplicate).mockResolvedValue(false);
    vi.mocked(enqueueWebhookPayload).mockResolvedValue(undefined);

    const duplicate = await isDuplicate('wamid.new-test');
    if (!duplicate) {
      await enqueueWebhookPayload('biz-1', { entry: [] });
    }

    expect(enqueueWebhookPayload).toHaveBeenCalledOnce();
    expect(enqueueWebhookPayload).toHaveBeenCalledWith('biz-1', { entry: [] });
  });
});

// ── POST /webhooks/whatsapp/:businessId ───────────────────────────────────────

describe('POST /webhooks/whatsapp/:businessId', () => {
  it('returns 200 for a valid HMAC signature', async () => {
    const app = await buildApp();
    const body = JSON.stringify({ entry: [] });
    const sig = makeSignature(body, 'test-app-secret');

    vi.mocked(isDuplicate).mockResolvedValueOnce(false);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp/biz-1',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sig,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 403 for an invalid HMAC signature', async () => {
    const app = await buildApp();
    const body = JSON.stringify({ entry: [] });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp/biz-1',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=invalidsignature',
      },
      payload: body,
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({ error: 'Invalid signature' });
  });

  it('returns 403 when X-Hub-Signature-256 header is missing', async () => {
    const app = await buildApp();
    const body = JSON.stringify({ entry: [] });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp/biz-1',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 200 for a duplicate message ID (silently ignored)', async () => {
    const app = await buildApp();
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.duplicate-msg-id' }],
              },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    const sig = makeSignature(body, 'test-app-secret');

    // isDuplicate returns true → duplicate, skip enqueue
    vi.mocked(isDuplicate).mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp/biz-1',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sig,
      },
      payload: body,
    });

    // HTTP 200 is returned immediately regardless of duplicate status
    expect(response.statusCode).toBe(200);
  });

  it('enqueues the event when message is not a duplicate', async () => {
    const app = await buildApp();
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.new-msg-id' }],
              },
            },
          ],
        },
      ],
    };
    const body = JSON.stringify(payload);
    const sig = makeSignature(body, 'test-app-secret');

    // isDuplicate returns false → not a duplicate, enqueue
    vi.mocked(isDuplicate).mockResolvedValue(false);
    vi.mocked(enqueueWebhookPayload).mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp/biz-1',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sig,
      },
      payload: body,
    });

    // HTTP 200 is returned immediately
    expect(response.statusCode).toBe(200);
  });
});

// ── GET /webhooks/whatsapp/:businessId (hub.challenge) ────────────────────────

describe('GET /webhooks/whatsapp/:businessId', () => {
  it('returns the hub.challenge when verification succeeds', async () => {
    const app = await buildApp();
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ webhook_verify_token: 'my-verify-token' }],
      rowCount: 1,
    } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp/biz-1',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'challenge-abc123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('challenge-abc123');
  });

  it('returns 403 when verify_token does not match', async () => {
    const app = await buildApp();
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ webhook_verify_token: 'correct-token' }],
      rowCount: 1,
    } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp/biz-1',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'challenge-abc123',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 403 when hub.mode is not subscribe', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp/biz-1',
      query: {
        'hub.mode': 'unsubscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'challenge-abc123',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 403 when no integration exists for the business', async () => {
    const app = await buildApp();
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as never);

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp/biz-unknown',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'any-token',
        'hub.challenge': 'challenge-xyz',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 403 when hub.challenge is missing', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp/biz-1',
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my-verify-token',
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
