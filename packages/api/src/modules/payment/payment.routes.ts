/**
 * Payment Processor HTTP Routes
 * Requirements: 7.1–7.6, 7.7, 7.8, 12.1–12.5, 17.5, 18.1–18.6
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import {
  generatePaynowLink,
  handlePaynowWebhook,
  pollPaynowStatus,
  expireStaleOrders,
  createWithdrawalRequest,
  processWithdrawal,
  getRevenueBalance,
  getOrderWithItems,
  getPaymentSettings,
  updatePaymentSettings,
  type OrderItem,
} from './payment.service.js';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // ── Task 9.1: Generate payment link ──────────────────────────────────────

  // POST /payments/initiate — generate Paynow payment link on purchase confirmation
  app.post('/payments/initiate', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      customer_wa_number?: string;
      items?: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>;
      currency?: string;
      conversation_id?: string;
    };

    if (!body.customer_wa_number || !body.items?.length || !body.currency) {
      return reply.status(400).send({ error: 'Missing required fields: customer_wa_number, items, currency.' });
    }

    const items: OrderItem[] = body.items.map((i) => ({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    }));

    try {
      const { order, paymentUrl } = await generatePaynowLink(
        businessId,
        body.customer_wa_number,
        items,
        body.currency,
        body.conversation_id,
      );
      return reply.status(201).send({ order, paymentUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate payment link.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 9.2: Paynow webhook receiver ────────────────────────────────────

  // POST /payments/paynow/webhook — receive Paynow status callbacks
  app.post('/payments/paynow/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    // Paynow sends application/x-www-form-urlencoded
    let body: Record<string, string>;
    const contentType = request.headers['content-type'] ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const raw = (request as unknown as { rawBody?: Buffer }).rawBody;
      const text = raw ? raw.toString() : (typeof request.body === 'string' ? request.body : '');
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = request.body as Record<string, string>;
    }
    try {
      await handlePaynowWebhook(body);
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /payments/orders/:id/poll — manual poll for payment status
  app.post('/payments/orders/:id/poll', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await pollPaynowStatus(id);
      const order = await getOrderWithItems(id);
      return reply.send({ order });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Poll failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 9.4: Expire stale orders ────────────────────────────────────────

  // POST /payments/expire-stale — expire orders past their 15-minute window
  app.post('/payments/expire-stale', async (_request, reply) => {
    try {
      await expireStaleOrders();
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Expiry job failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 9.7: Revenue balance ─────────────────────────────────────────────

  // GET /payments/balance — get revenue balance for authenticated business
  app.get('/payments/balance', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      const balance = await getRevenueBalance(businessId);
      return reply.send({ balance: balance ?? { businessId, availableUsd: 0, lifetimeUsd: 0, updatedAt: null } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch balance.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 9.8: Withdrawal request (Property 33) ───────────────────────────

  // POST /payments/withdrawals — create withdrawal request
  app.post('/payments/withdrawals', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      amount_usd?: number;
      paynow_merchant_ref?: string;
    };

    if (body.amount_usd === undefined || !body.paynow_merchant_ref) {
      return reply.status(400).send({ error: 'Missing required fields: amount_usd, paynow_merchant_ref.' });
    }
    if (body.amount_usd <= 0) {
      return reply.status(400).send({ error: 'amount_usd must be greater than 0.' });
    }

    try {
      const { withdrawal, autoProcessed } = await createWithdrawalRequest(
        businessId,
        body.amount_usd,
        body.paynow_merchant_ref,
      );
      return reply.status(201).send({ withdrawal, autoProcessed });
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { statusCode?: number }).statusCode === 422) {
        const typedErr = err as Error & { availableBalance: number };
        return reply.status(422).send({
          error: err.message,
          availableBalance: typedErr.availableBalance,
        });
      }
      const message = err instanceof Error ? err.message : 'Failed to create withdrawal.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 9.9: Approve withdrawal ─────────────────────────────────────────

  // POST /payments/withdrawals/:id/approve — operator approves a withdrawal
  app.post('/payments/withdrawals/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const operatorId = request.businessId; // reuse auth context; in production use operator session

    try {
      const withdrawal = await processWithdrawal(id, operatorId);
      return reply.send({ withdrawal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process withdrawal.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Task 18.2: Payment Settings ──────────────────────────────────────────

  // GET /payments/settings — get payment settings for authenticated business
  app.get('/payments/settings', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      const settings = await getPaymentSettings(businessId);
      return reply.send(settings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payment settings.';
      return reply.status(500).send({ error: message });
    }
  });

  // PUT /payments/settings — update payment settings for authenticated business
  app.put('/payments/settings', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      inChatPaymentsEnabled?: boolean;
      externalPaymentDetails?: Record<string, string> | null;
    };

    if (body.inChatPaymentsEnabled === undefined) {
      return reply.status(400).send({ error: 'Missing required field: inChatPaymentsEnabled.' });
    }

    try {
      const settings = await updatePaymentSettings(businessId, {
        inChatPaymentsEnabled: body.inChatPaymentsEnabled,
        externalPaymentDetails: body.externalPaymentDetails ?? null,
      });
      return reply.send(settings);
    } catch (err: unknown) {
      if (err instanceof Error && (err as Error & { statusCode?: number }).statusCode === 422) {
        return reply.status(422).send({ error: err.message });
      }
      const message = err instanceof Error ? err.message : 'Failed to update payment settings.';
      return reply.status(500).send({ error: message });
    }
  });
}
