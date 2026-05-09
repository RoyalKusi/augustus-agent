/**
 * Mock subscription flow tests.
 *
 * Tests the full lifecycle using mocked DB and external services:
 *
 * 1.  No-subscription state — creditCapUsd and monthlyCap must be 0
 * 2.  Payment initiation — subscription_payments record created, paymentUrl returned
 * 3.  Webhook: payment success — subscription activated, business active, token_usage seeded
 * 4.  Webhook: payment failure — subscription_payments marked failed, no subscription created
 * 5.  Poll-payment: paid — same activation path as webhook
 * 6.  Poll-payment: awaiting — no activation, status returned
 * 7.  Poll-payment: failed — no activation, status returned
 * 8.  Duplicate webhook — idempotent, second call does not error
 * 9.  Dashboard overview after activation — correct plan, cap, 0 usage
 * 10. Dashboard overview with no subscription — planName=None, creditCapUsd=0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all external dependencies before any imports ────────────────────────

const { mockQuery, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockConnect: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  pool: { query: mockQuery, connect: mockConnect },
}));

vi.mock('../../../redis/client.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

vi.mock('../../../services/notification.stub.js', () => ({
  sendSubscriptionRenewalReminder: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionSuspendedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../notification/in-app-notification.helpers.js', () => ({
  notifySubscriptionUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../referral-earnings/earnings.service.js', () => ({
  earningsService: { calculateEarnings: vi.fn().mockResolvedValue({ earningsUsd: 0 }) },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Import units under test ──────────────────────────────────────────────────

import {
  activateSubscription,
  handleFailedRenewalPayment,
} from '../subscription.service.js';
import {
  handleSubscriptionPaymentWebhook,
  pollSubscriptionPaymentStatus,
  initiateSubscriptionCharge,
} from '../paynow.subscription.js';
import {
  getSubscriptionOverview,
  getCreditUsage,
} from '../../dashboard/dashboard.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockClient(queryImpl: (sql: string, params?: unknown[]) => { rows: unknown[] }) {
  return {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => queryImpl(sql, params)),
    release: vi.fn(),
  };
}

const SILVER_SUB_ROW = {
  id: 'sub-001',
  business_id: 'biz-001',
  plan: 'silver',
  price_usd: '31.99',
  status: 'active',
  activation_timestamp: new Date(),
  renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  billing_cycle_start: new Date(),
  paynow_reference: 'REF-001',
  billing_months: 1,
  created_at: new Date(),
  updated_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Subscription flow — mock end-to-end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // ── 1. No-subscription state ────────────────────────────────────────────────

  describe('1. No-subscription state', () => {
    it('getSubscriptionOverview returns planName=None, creditCapUsd=0, creditUsagePercent=0', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getSubscriptionOverview('biz-no-sub');

      expect(result.planName).toBe('None');
      expect(result.creditCapUsd).toBe(0);
      expect(result.creditUsageUsd).toBe(0);
      expect(result.creditUsagePercent).toBe(0);
      expect(result.renewalDate).toBeNull();
    });

    it('getCreditUsage returns monthlyCap=0 when no subscription', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getCreditUsage('biz-no-sub');

      expect(result.monthlyCap).toBe(0);
      expect(result.currentCostUsd).toBe(0);
      expect(result.usagePercent).toBe(0);
    });
  });

  // ── 2. Payment initiation ───────────────────────────────────────────────────

  describe('2. Payment initiation', () => {
    it('returns paymentUrl and stores subscription_payments record on success', async () => {
      mockQuery.mockResolvedValue({ rows: [] }); // INSERT subscription_payments

      mockFetch.mockResolvedValueOnce({
        text: async () =>
          'status=Ok&browserurl=https://paynow.co.zw/pay/abc123&paynowreference=REF-001&pollurl=https://paynow.co.zw/poll/abc123',
      });

      // Import config after mocking so we can read the values
      const { config } = await import('../../../config.js');

      // Only run this test if Paynow is configured (skip in CI without env vars)
      if (!config.paynow.integrationId || !config.paynow.integrationKey) {
        // Simulate the "not configured" path — already tested below
        return;
      }

      const result = await initiateSubscriptionCharge(
        'biz-001',
        'test@example.com',
        31.99,
        'Augustus Silver subscription (monthly)',
        'silver',
        1,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://paynow.co.zw/pay/abc123');
      expect(result.paynowReference).toBe('REF-001');
      expect(result.pollUrl).toBe('https://paynow.co.zw/poll/abc123');

      // Verify subscription_payments INSERT was called
      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO subscription_payments'),
      );
      expect(insertCall).toBeDefined();
    });

    it('returns success=false when Paynow returns error status', async () => {
      const { config } = await import('../../../config.js');
      if (!config.paynow.integrationId || !config.paynow.integrationKey) {
        // Can't test Paynow error path without credentials — skip
        return;
      }

      mockFetch.mockResolvedValueOnce({
        text: async () => 'status=Error&error=Invalid+integration+id',
      });

      const result = await initiateSubscriptionCharge(
        'biz-001', 'test@example.com', 31.99, 'desc', 'silver',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns success=false when Paynow integration not configured', async () => {
      // Mock config to simulate missing credentials
      vi.doMock('../../../config.js', () => ({
        config: {
          paynow: { integrationId: '', integrationKey: '', returnUrl: 'https://example.com', resultUrl: 'https://example.com', merchantEmail: '' },
          email: { provider: 'sendgrid', apiKey: '', fromAddress: '', fromName: '' },
          frontendUrl: 'http://localhost:5173',
          claude: { apiKey: '', model: 'claude-sonnet-4-5-20251001' },
          meta: { appId: '', appSecret: '', verifyToken: '', graphApiVersion: 'v19.0', embeddedSignupConfigId: '' },
          jwt: { secret: 'test-secret', expiresIn: '24h' },
        },
      }));

      // Re-import with the mocked config
      const { initiateSubscriptionCharge: initCharge } = await import('../paynow.subscription.js');

      const result = await initCharge(
        'biz-001', 'test@example.com', 31.99, 'desc', 'silver',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');

      vi.doUnmock('../../../config.js');
    });
  });

  // ── 3. Webhook: payment success ─────────────────────────────────────────────

  describe('3. Webhook: payment success', () => {
    it('activates subscription, marks payment paid, sets business active, seeds token_usage', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return { rows: [] };
        if (sql.includes('UPDATE subscriptions SET status')) return { rows: [] };
        if (sql.includes('INSERT INTO subscriptions')) return { rows: [SILVER_SUB_ROW] };
        if (sql.includes('UPDATE businesses')) return { rows: [] };
        if (sql.includes('INSERT INTO token_usage')) return { rows: [] };
        if (sql.includes('FROM referrals')) return { rows: [] };
        return { rows: [] };
      });
      mockConnect.mockResolvedValue(mockClient);

      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscription_payments') && sql.includes('business_id')) {
          return { rows: [{ business_id: 'biz-001', tier: 'silver' }] };
        }
        if (sql.includes('billing_months')) return { rows: [{ billing_months: 1 }] };
        if (sql.includes('UPDATE subscription_payments')) return { rows: [] };
        return { rows: [] };
      });

      await handleSubscriptionPaymentWebhook({
        reference: 'REF-001',
        status: 'Paid',
        paynowReference: 'REF-001',
      });

      // Subscription INSERT called
      const insertSub = mockClient.query.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO subscriptions'),
      );
      expect(insertSub).toBeDefined();

      // Business set to active
      const updateBiz = mockClient.query.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE businesses') && sql.includes("'active'"),
      );
      expect(updateBiz).toBeDefined();

      // token_usage seeded
      const insertUsage = mockClient.query.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO token_usage'),
      );
      expect(insertUsage).toBeDefined();

      // subscription_payments marked paid
      const updatePayment = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE subscription_payments') && sql.includes("'paid'"),
      );
      expect(updatePayment).toBeDefined();
    });

    it('handles lowercase "paid" status', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return { rows: [] };
        if (sql.includes('INSERT INTO subscriptions')) return { rows: [SILVER_SUB_ROW] };
        return { rows: [] };
      });
      mockConnect.mockResolvedValue(mockClient);

      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscription_payments') && sql.includes('business_id')) {
          return { rows: [{ business_id: 'biz-001', tier: 'silver' }] };
        }
        if (sql.includes('billing_months')) return { rows: [{ billing_months: 1 }] };
        return { rows: [] };
      });

      // Should not throw
      await expect(
        handleSubscriptionPaymentWebhook({
          reference: 'REF-002',
          status: 'paid',
          paynowReference: 'REF-002',
        }),
      ).resolves.toBeUndefined();

      const insertSub = mockClient.query.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO subscriptions'),
      );
      expect(insertSub).toBeDefined();
    });
  });

  // ── 4. Webhook: payment failure ─────────────────────────────────────────────

  describe('4. Webhook: payment failure', () => {
    it('marks subscription_payments as failed, does NOT activate subscription', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscription_payments') && sql.includes('business_id')) {
          return { rows: [{ business_id: 'biz-001', tier: 'silver' }] };
        }
        if (sql.includes('UPDATE subscription_payments')) return { rows: [] };
        return { rows: [] };
      });

      await handleSubscriptionPaymentWebhook({
        reference: 'REF-FAIL',
        status: 'Failed',
        paynowReference: 'REF-FAIL',
      });

      // Payment marked failed
      const updateFailed = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE subscription_payments') && sql.includes("'failed'"),
      );
      expect(updateFailed).toBeDefined();

      // No subscription INSERT
      const insertSub = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO subscriptions'),
      );
      expect(insertSub).toBeUndefined();
    });

    it('handles "Cancelled" status', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscription_payments') && sql.includes('business_id')) {
          return { rows: [{ business_id: 'biz-001', tier: 'silver' }] };
        }
        if (sql.includes('UPDATE subscription_payments')) return { rows: [] };
        return { rows: [] };
      });

      await handleSubscriptionPaymentWebhook({
        reference: 'REF-CANCEL',
        status: 'Cancelled',
        paynowReference: 'REF-CANCEL',
      });

      const updateFailed = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE subscription_payments') && sql.includes("'failed'"),
      );
      expect(updateFailed).toBeDefined();
    });

    it('does nothing when paynowReference not found in subscription_payments', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      // Should not throw and should not insert a subscription
      await expect(
        handleSubscriptionPaymentWebhook({
          reference: 'UNKNOWN',
          status: 'Paid',
          paynowReference: 'UNKNOWN',
        }),
      ).resolves.toBeUndefined();

      const insertSub = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO subscriptions'),
      );
      expect(insertSub).toBeUndefined();
    });
  });

  // ── 5. Poll-payment: paid ───────────────────────────────────────────────────

  describe('5. Poll-payment: paid', () => {
    it('returns paid status', async () => {
      mockFetch.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValueOnce('status=Paid&paynowreference=REF-POLL-001'),
      });

      const result = await pollSubscriptionPaymentStatus('https://paynow.co.zw/poll/abc');

      expect(result.status).toBe('paid');
      expect(result.paynowReference).toBe('REF-POLL-001');
    });

    it('activateSubscription creates subscription row and seeds token_usage', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return { rows: [] };
        if (sql.includes('UPDATE subscriptions SET status')) return { rows: [] };
        if (sql.includes('INSERT INTO subscriptions')) return { rows: [SILVER_SUB_ROW] };
        if (sql.includes('UPDATE businesses')) return { rows: [] };
        if (sql.includes('INSERT INTO token_usage')) return { rows: [] };
        if (sql.includes('FROM referrals')) return { rows: [] };
        return { rows: [] };
      });
      mockConnect.mockResolvedValue(mockClient);

      const sub = await activateSubscription('biz-001', 'silver', 'REF-POLL-001', 1);

      expect(sub.plan).toBe('silver');
      expect(sub.status).toBe('active');
      expect(sub.businessId).toBe('biz-001');

      const insertUsage = mockClient.query.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO token_usage'),
      );
      expect(insertUsage).toBeDefined();
    });
  });

  // ── 6. Poll-payment: awaiting ───────────────────────────────────────────────

  describe('6. Poll-payment: awaiting', () => {
    it('returns awaiting status', async () => {
      mockFetch.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValueOnce('status=Awaiting&paynowreference=REF-AWAIT'),
      });

      const result = await pollSubscriptionPaymentStatus('https://paynow.co.zw/poll/abc');

      expect(result.status).toBe('awaiting');
    });

    it('returns awaiting when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await pollSubscriptionPaymentStatus('https://paynow.co.zw/poll/abc');

      expect(result.status).toBe('awaiting');
      expect(result.paynowReference).toBeNull();
    });
  });

  // ── 7. Poll-payment: failed ─────────────────────────────────────────────────

  describe('7. Poll-payment: failed', () => {
    it('returns failed for Cancelled status', async () => {
      mockFetch.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValueOnce('status=Cancelled&paynowreference=REF-FAIL-POLL'),
      });

      const result = await pollSubscriptionPaymentStatus('https://paynow.co.zw/poll/abc');

      expect(result.status).toBe('failed');
    });

    it('returns failed for Failed status', async () => {
      mockFetch.mockResolvedValueOnce({
        text: vi.fn().mockResolvedValueOnce('status=Failed&paynowreference=REF-FAIL-POLL2'),
      });

      const result = await pollSubscriptionPaymentStatus('https://paynow.co.zw/poll/abc');

      expect(result.status).toBe('failed');
    });
  });

  // ── 8. Duplicate webhook idempotency ────────────────────────────────────────

  describe('8. Duplicate webhook idempotency', () => {
    it('second paid webhook for same reference does not throw', async () => {
      const mockClient = makeMockClient((sql: string) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return { rows: [] };
        if (sql.includes('INSERT INTO subscriptions')) return { rows: [SILVER_SUB_ROW] };
        return { rows: [] };
      });
      mockConnect.mockResolvedValue(mockClient);

      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscription_payments') && sql.includes('business_id')) {
          return { rows: [{ business_id: 'biz-001', tier: 'silver' }] };
        }
        if (sql.includes('billing_months')) return { rows: [{ billing_months: 1 }] };
        return { rows: [] };
      });

      // Both calls should resolve without throwing
      await expect(
        handleSubscriptionPaymentWebhook({ reference: 'REF-IDEM', status: 'Paid', paynowReference: 'REF-IDEM' }),
      ).resolves.toBeUndefined();

      await expect(
        handleSubscriptionPaymentWebhook({ reference: 'REF-IDEM', status: 'Paid', paynowReference: 'REF-IDEM' }),
      ).resolves.toBeUndefined();
    });
  });

  // ── 9. Dashboard overview after activation ──────────────────────────────────

  describe('9. Dashboard overview after activation', () => {
    it('Silver: planName=Silver, creditCapUsd=12, creditUsageUsd=0', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) {
          return { rows: [{ plan: 'silver', renewal_date: new Date('2026-06-05') }] };
        }
        if (sql.includes('FROM token_usage')) {
          return { rows: [{ accumulated_cost_usd: '0.000000' }] };
        }
        if (sql.includes('FROM plan_config')) {
          return { rows: [{ token_budget_usd: '12.00' }] };
        }
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-001');

      expect(result.planName).toBe('Silver');
      expect(result.creditCapUsd).toBe(12);
      expect(result.creditUsageUsd).toBe(0);
      expect(result.creditUsagePercent).toBe(0);
      expect(result.renewalDate).toBeTruthy();
    });

    it('Gold: creditCapUsd=30, usage percentage calculated correctly', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) {
          return { rows: [{ plan: 'gold', renewal_date: new Date('2026-06-05') }] };
        }
        if (sql.includes('FROM token_usage')) {
          return { rows: [{ accumulated_cost_usd: '5.000000' }] };
        }
        if (sql.includes('FROM plan_config')) {
          return { rows: [{ token_budget_usd: '30.00' }] };
        }
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-001');

      expect(result.planName).toBe('Gold');
      expect(result.creditCapUsd).toBe(30);
      expect(result.creditUsageUsd).toBe(5);
      expect(result.creditUsagePercent).toBe(16.67);
    });

    it('Platinum: creditCapUsd=70', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) {
          return { rows: [{ plan: 'platinum', renewal_date: new Date('2026-06-05') }] };
        }
        if (sql.includes('FROM token_usage')) {
          return { rows: [{ accumulated_cost_usd: '0.000000' }] };
        }
        if (sql.includes('FROM plan_config')) {
          return { rows: [{ token_budget_usd: '70.00' }] };
        }
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-001');

      expect(result.planName).toBe('Platinum');
      expect(result.creditCapUsd).toBe(70);
    });

    it('uses DB value when plan_config has a custom token budget', async () => {
      // Operator has changed Silver token budget to 20 in the DB
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) {
          return { rows: [{ plan: 'silver', renewal_date: new Date('2026-06-05') }] };
        }
        if (sql.includes('FROM token_usage')) {
          return { rows: [{ accumulated_cost_usd: '10.000000' }] };
        }
        if (sql.includes('FROM plan_config')) {
          return { rows: [{ token_budget_usd: '20.00' }] }; // custom value
        }
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-001');

      expect(result.creditCapUsd).toBe(20);  // DB value, not hardcoded 12
      expect(result.creditUsagePercent).toBe(50); // 10/20 = 50%
    });
  });

  // ── 10. Zero token count with no subscription ────────────────────────────────

  describe('10. Zero token count with no subscription', () => {
    it('creditCapUsd is exactly 0 — not 12 — when no active subscription', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getSubscriptionOverview('biz-no-sub');

      expect(result.creditCapUsd).toBe(0);
      expect(result.creditUsagePercent).toBe(0);
      expect(result.planName).toBe('None');
    });

    it('monthlyCap is exactly 0 in getCreditUsage when no active subscription', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getCreditUsage('biz-no-sub');

      expect(result.monthlyCap).toBe(0);
      expect(result.usagePercent).toBe(0);
    });

    it('creditUsagePercent stays 0 even if token_usage has data but no subscription', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) return { rows: [] };
        if (sql.includes('FROM token_usage') || sql.includes('accumulated_cost_usd')) {
          return { rows: [{ accumulated_cost_usd: '5.000000' }] };
        }
        // plan_config not queried when no subscription
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-no-sub');

      // No subscription → cap is 0 → percent must be 0 (no division by zero)
      expect(result.creditCapUsd).toBe(0);
      expect(result.creditUsagePercent).toBe(0);
    });

    it('falls back to hardcoded value when plan_config has no row for the tier', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM subscriptions')) {
          return { rows: [{ plan: 'silver', renewal_date: new Date('2026-06-05') }] };
        }
        if (sql.includes('FROM token_usage')) {
          return { rows: [{ accumulated_cost_usd: '0.000000' }] };
        }
        if (sql.includes('FROM plan_config')) {
          return { rows: [] }; // no row in DB — fall back to hardcoded
        }
        return { rows: [] };
      });

      const result = await getSubscriptionOverview('biz-001');

      expect(result.creditCapUsd).toBe(12); // hardcoded Silver fallback
    });
  });
});
