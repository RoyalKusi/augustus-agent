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
  // GET /subscription/plans — list available plans
  app.get('/subscription/plans', async (_request, reply) => {
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
        plan.priceUsd,
        `Augustus ${plan.displayName} subscription`,
      );

      if (!result.success) {
        return reply.status(502).send({ error: result.error ?? 'Failed to initiate payment.' });
      }

      return reply.send({
        paynowReference: result.paynowReference,
        pollUrl: result.pollUrl,
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
      pollUrl: string;
      tier: string;
    };

    if (!paynowReference || !pollUrl || !tier) {
      return reply.status(400).send({ error: 'paynowReference, pollUrl, and tier are required.' });
    }

    if (!isValidTier(tier)) {
      return reply.status(400).send({ error: 'Invalid tier.' });
    }

    try {
      const result = await pollSubscriptionPaymentStatus(pollUrl);

      if (result.status === 'paid') {
        await activateSubscription(businessId, tier, result.paynowReference ?? paynowReference);
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
        businessId: body.businessId ?? '',
        tier: (body.tier as 'silver' | 'gold' | 'platinum') ?? 'silver',
        subscriptionId: body.subscriptionId,
      });
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed.';
      return reply.status(500).send({ error: message });
    }
  });
}
