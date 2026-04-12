/**
 * Subscription Management HTTP Routes
 * Requirements: 2.1–2.9
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import {
  activateSubscription,
  upgradePlan,
  downgradePlan,
  getActiveSubscription,
} from './subscription.service.js';
import {
  handleSubscriptionPaymentWebhook,
  initiateSubscriptionCharge,
  pollSubscriptionPaymentStatus,
} from './paynow.subscription.js';
import { PLANS, isValidTier } from './plans.js';
import { pool } from '../../db/client.js';

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /subscription/plans — list available plans (reads from plan_config DB table, falls back to hardcoded defaults)
  app.get('/subscription/plans', async (_request, reply) => {
    try {
      const result = await pool.query(
        `SELECT tier, display_name, price_usd, token_budget_usd, is_available
         FROM plan_config
         WHERE is_available = TRUE
         ORDER BY CASE tier WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 END`,
      );
      if (result.rows.length > 0) {
        return reply.send({ plans: result.rows.map((r: Record<string, unknown>) => ({
          tier: r.tier,
          displayName: r.display_name,
          priceUsd: Number(r.price_usd),
          tokenBudgetUsd: Number(r.token_budget_usd),
        })) });
      }
    } catch {
      // Fall through to hardcoded defaults if table doesn't exist yet
    }
    // Fallback: return hardcoded defaults filtered to all available
    return reply.send({ plans: Object.values(PLANS) });
  });

  // GET /subscription — get active subscription for authenticated business
  app.get('/subscription', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;
    if (!businessId) return reply.status(401).send({ error: 'Unauthorised.' });

    const sub = await getActiveSubscription(businessId);
    if (!sub) return reply.status(404).send({ error: 'No active subscription found.' });
    return reply.send(sub);
  });

  // POST /subscription/activate — activate after Paynow payment confirmation
  app.post('/subscription/activate', { preHandler: authenticate }, async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;
    const { tier, paynowReference } = request.body as {
      tier: string;
      paynowReference?: string;
    };

    if (!isValidTier(tier)) {
      return reply.status(400).send({ error: `Invalid tier. Must be silver, gold, or platinum.` });
    }

    try {
      const sub = await activateSubscription(businessId, tier, paynowReference ?? 'manual');
      return reply.status(201).send(sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Activation failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /subscription/upgrade
  app.post('/subscription/upgrade', async (request, reply) => {
    const { businessId, newTier, paynowReference } = request.body as {
      businessId: string;
      newTier: string;
      paynowReference: string;
    };

    if (!isValidTier(newTier)) {
      return reply.status(400).send({ error: 'Invalid tier.' });
    }

    try {
      const result = await upgradePlan(businessId, newTier, paynowReference);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upgrade failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /subscription/downgrade
  app.post('/subscription/downgrade', async (request, reply) => {
    const { businessId, newTier } = request.body as {
      businessId: string;
      newTier: string;
    };

    if (!isValidTier(newTier)) {
      return reply.status(400).send({ error: 'Invalid tier.' });
    }

    try {
      const result = await downgradePlan(businessId, newTier);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Downgrade failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /subscription/initiate-payment — initiate Paynow payment for a plan
  app.post('/subscription/initiate-payment', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { tier } = request.body as { tier: string };

    if (!isValidTier(tier)) {
      return reply.status(400).send({ error: 'Invalid tier. Must be silver, gold, or platinum.' });
    }

    const plan = PLANS[tier];
    if (!plan) return reply.status(400).send({ error: 'Plan not found.' });

    // Try to get live price from plan_config DB, fall back to hardcoded
    let planPrice = plan.priceUsd;
    try {
      const dbPlan = await pool.query<{ price_usd: string; is_available: boolean }>(
        `SELECT price_usd, is_available FROM plan_config WHERE tier = $1`,
        [tier],
      );
      if (dbPlan.rows.length > 0) {
        if (!dbPlan.rows[0].is_available) {
          return reply.status(400).send({ error: 'This plan is not currently available.' });
        }
        planPrice = Number(dbPlan.rows[0].price_usd);
      }
    } catch { /* use hardcoded fallback */ }

    // Get business email for Paynow
    const bizResult = await pool.query<{ email: string }>(
      `SELECT email FROM businesses WHERE id = $1`,
      [businessId],
    );
    const email = bizResult.rows[0]?.email ?? '';

    try {
      const result = await initiateSubscriptionCharge(
        businessId,
        email,
        planPrice,
        `Augustus ${plan.displayName} subscription`,
        tier,
      );

      if (!result.success) {
        return reply.status(502).send({ error: result.error ?? 'Failed to initiate payment.' });
      }

      return reply.send({
        paymentUrl: result.paymentUrl,
        paynowReference: result.paynowReference,
        pollUrl: result.pollUrl,
        returnUrl: result.returnUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment initiation failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /subscription/poll-payment — poll Paynow for subscription payment status
  app.post('/subscription/poll-payment', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { paynowReference, pollUrl, tier } = request.body as {
      paynowReference: string;
      pollUrl?: string;
      tier: string;
    };

    if (!paynowReference || !tier) {
      return reply.status(400).send({ error: 'paynowReference and tier are required.' });
    }

    if (!isValidTier(tier)) {
      return reply.status(400).send({ error: 'Invalid tier.' });
    }

    // Resolve poll URL — use provided one or fall back to stored record
    let resolvedPollUrl = pollUrl ?? '';
    if (!resolvedPollUrl) {
      const stored = await pool.query<{ poll_url: string | null }>(
        `SELECT poll_url FROM subscription_payments WHERE paynow_reference = $1 AND business_id = $2 LIMIT 1`,
        [paynowReference, businessId],
      );
      resolvedPollUrl = stored.rows[0]?.poll_url ?? '';
    }

    if (!resolvedPollUrl) {
      return reply.status(400).send({ error: 'No poll URL available for this payment.' });
    }

    try {
      const result = await pollSubscriptionPaymentStatus(resolvedPollUrl);

      if (result.status === 'paid') {
        await activateSubscription(businessId, tier, result.paynowReference ?? paynowReference);
        await pool.query(
          `UPDATE subscription_payments SET status = 'paid', updated_at = NOW() WHERE paynow_reference = $1`,
          [result.paynowReference ?? paynowReference],
        );
        return reply.send({ status: 'paid' });
      }

      return reply.send({ status: result.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Poll failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /webhooks/paynow/subscription — Paynow subscription payment status webhook
  app.post('/webhooks/paynow/subscription', async (request, reply) => {
    const body = request.body as Record<string, string>;

    try {
      await handleSubscriptionPaymentWebhook({
        reference: body.reference ?? '',
        status: body.status ?? '',
        paynowReference: body.paynowreference ?? '',
      });
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed.';
      return reply.status(500).send({ error: message });
    }
  });
}
