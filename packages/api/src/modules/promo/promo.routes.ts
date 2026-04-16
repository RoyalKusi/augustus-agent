/**
 * Promo Code Routes
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import { authenticateOperator } from '../admin/admin.middleware.js';
import { logAuditEvent } from '../admin/admin.service.js';
import {
  createPromoCode,
  listPromoCodes,
  updatePromoCode,
  deletePromoCode,
  getPromoMetrics,
  validatePromoCode,
  recordPromoRedemption,
} from './promo.service.js';

export async function promoRoutes(app: FastifyInstance): Promise<void> {
  // ─── Admin endpoints ──────────────────────────────────────────────────────

  // GET /admin/promo-codes
  app.get('/admin/promo-codes', { preHandler: authenticateOperator }, async (_request, reply) => {
    try {
      const codes = await listPromoCodes();
      return reply.send({ promoCodes: codes });
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // POST /admin/promo-codes
  app.post('/admin/promo-codes', { preHandler: authenticateOperator }, async (request, reply) => {
    const body = request.body as {
      code: string;
      description?: string;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      applicableTiers?: string[];
      maxUses?: number | null;
      validFrom?: string;
      validUntil?: string | null;
    };
    if (!body.code || !body.discountType || !body.discountValue) {
      return reply.status(400).send({ error: 'code, discountType, and discountValue are required.' });
    }
    try {
      const promo = await createPromoCode({ ...body, createdBy: request.operatorId });
      await logAuditEvent(request.operatorId, 'create_promo_code', 'promo', request.operatorId, { code: promo.code });
      return reply.status(201).send(promo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed.';
      const status = msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists') ? 409 : 500;
      return reply.status(status).send({ error: msg });
    }
  });

  // PATCH /admin/promo-codes/:id
  app.patch('/admin/promo-codes/:id', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Parameters<typeof updatePromoCode>[1];
    try {
      const promo = await updatePromoCode(id, body);
      await logAuditEvent(request.operatorId, 'update_promo_code', 'promo', request.operatorId, body as Record<string, unknown>);
      return reply.send(promo);
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // DELETE /admin/promo-codes/:id
  app.delete('/admin/promo-codes/:id', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deletePromoCode(id);
      await logAuditEvent(request.operatorId, 'delete_promo_code', 'promo', request.operatorId, { id });
      return reply.status(204).send();
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // GET /admin/promo-codes/:id/metrics
  app.get('/admin/promo-codes/:id/metrics', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const metrics = await getPromoMetrics(id);
      return reply.send(metrics);
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // ─── Business endpoints ───────────────────────────────────────────────────

  // POST /subscription/validate-promo — validate a promo code before checkout
  app.post('/subscription/validate-promo', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { code, tier, originalPrice } = request.body as {
      code: string;
      tier: string;
      originalPrice: number;
    };
    if (!code || !tier || originalPrice === undefined) {
      return reply.status(400).send({ error: 'code, tier, and originalPrice are required.' });
    }
    try {
      const result = await validatePromoCode(code, tier, originalPrice, businessId);
      return reply.send(result);
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // POST /subscription/record-promo — record redemption after successful payment
  app.post('/subscription/record-promo', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { promoCodeId, tier, originalPrice, discountedPrice, discountAmount, paynowReference } = request.body as {
      promoCodeId: string;
      tier: string;
      originalPrice: number;
      discountedPrice: number;
      discountAmount: number;
      paynowReference?: string;
    };
    try {
      await recordPromoRedemption(promoCodeId, businessId, tier, originalPrice, discountedPrice, discountAmount, paynowReference);
      return reply.send({ ok: true });
    } catch (err: unknown) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });
}
