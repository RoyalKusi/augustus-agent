/**
 * Admin Dashboard Routes
 * Requirements: 14, 15, 16, 17
 */

import type { FastifyInstance } from 'fastify';
import { authenticateOperator } from './admin.middleware.js';
import {
  operatorLogin,
  enrollMfa,
  verifyMfaEnrollment,
  listBusinesses,
  suspendBusiness,
  reactivateBusiness,
  getAiMetrics,
  getMetaMetrics,
  getPlatformCostMetrics,
  setTokenOverride,
  getSubscriptionMetrics,
  listPendingWithdrawals,
  listAllWithdrawals,
  approveWithdrawal,
  getBusinessDashboardView,
  getApiKeyStatus,
  listAllSupportTickets,
  updateSupportTicketStatus,
  logAuditEvent,
} from './admin.service.js';
import { pool } from '../../db/client.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ─── Task 13.1: Operator auth ───────────────────────────────────────────────

  app.post('/admin/auth/login', async (request, reply) => {
    const { email, password, totpCode } = request.body as {
      email: string;
      password: string;
      totpCode: string;
    };
    try {
      const result = await operatorLogin(email, password, totpCode ?? '');
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      return reply.status(401).send({ error: message });
    }
  });

  // POST /admin/auth/enroll-mfa  (requires operator token)
  app.post('/admin/auth/enroll-mfa', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await enrollMfa(request.operatorId);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'MFA enrollment failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /admin/auth/verify-mfa  (requires operator token)
  app.post('/admin/auth/verify-mfa', { preHandler: authenticateOperator }, async (request, reply) => {
    const { code } = request.body as { code: string };
    try {
      await verifyMfaEnrollment(request.operatorId, code);
      return reply.send({ message: 'MFA enabled successfully.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'MFA verification failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // ─── Task 13.2: Business list ───────────────────────────────────────────────

  // GET /admin/businesses
  app.get('/admin/businesses', { preHandler: authenticateOperator }, async (request, reply) => {
    const { search, status, plan } = request.query as {
      search?: string;
      status?: string;
      plan?: string;
    };
    try {
      const result = await listBusinesses({ search, status, plan });
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list businesses.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.3: Suspend business ───────────────────────────────────────────

  // POST /admin/businesses/:id/suspend
  app.post('/admin/businesses/:id/suspend', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await suspendBusiness(id, request.operatorId);
      return reply.send({ message: 'Business suspended.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to suspend business.';
      const status = message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  // ─── Task 13.4: Reactivate business ────────────────────────────────────────

  // POST /admin/businesses/:id/reactivate
  app.post('/admin/businesses/:id/reactivate', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await reactivateBusiness(id, request.operatorId);
      return reply.send({ message: 'Business reactivated.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate business.';
      const status = message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  // ─── Task 13.6: AI metrics ──────────────────────────────────────────────────

  // GET /admin/metrics/ai
  app.get('/admin/metrics/ai', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await getAiMetrics();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get AI metrics.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.7: Meta metrics ────────────────────────────────────────────────

  // GET /admin/metrics/meta
  app.get('/admin/metrics/meta', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await getMetaMetrics();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get Meta metrics.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.8: Platform cost metrics ──────────────────────────────────────

  // GET /admin/metrics/platform-cost
  app.get('/admin/metrics/platform-cost', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await getPlatformCostMetrics();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get platform cost metrics.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.9: Token override ──────────────────────────────────────────────

  // POST /admin/businesses/:id/token-override
  app.post('/admin/businesses/:id/token-override', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { monthlyCapUsd } = request.body as { monthlyCapUsd: number };
    try {
      await setTokenOverride(id, monthlyCapUsd, request.operatorId);
      return reply.send({ message: 'Token override applied.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set token override.';
      return reply.status(400).send({ error: message });
    }
  });

  // ─── Task 13.10: Subscription metrics ──────────────────────────────────────

  // GET /admin/metrics/subscriptions
  app.get('/admin/metrics/subscriptions', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await getSubscriptionMetrics();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get subscription metrics.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.11: Withdrawal management ─────────────────────────────────────

  // GET /admin/withdrawals/pending
  app.get('/admin/withdrawals/pending', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await listPendingWithdrawals();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list withdrawals.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /admin/withdrawals/:id/approve
  app.post('/admin/withdrawals/:id/approve', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await approveWithdrawal(id, request.operatorId);
      return reply.send({ message: 'Withdrawal approved.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve withdrawal.';
      const status = message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  // GET /admin/withdrawals/history
  app.get('/admin/withdrawals/history', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await listAllWithdrawals();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list withdrawal history.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.14: Business dashboard view ───────────────────────────────────

  // GET /admin/businesses/:id/dashboard
  app.get('/admin/businesses/:id/dashboard', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await getBusinessDashboardView(id);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get business dashboard.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Task 13.15: API key status ─────────────────────────────────────────────

  // GET /admin/api-keys/status
  app.get('/admin/api-keys/status', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const result = await getApiKeyStatus();
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get API key status.';
      return reply.status(500).send({ error: message });
    }
  });

  // ─── Support Ticket Management ────────────────────────────────────────────

  // GET /admin/support — list all support tickets across all businesses
  app.get('/admin/support', { preHandler: authenticateOperator }, async (request, reply) => {
    const { status, search } = request.query as { status?: string; search?: string };
    try {
      const result = await listAllSupportTickets({ status, search });
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list support tickets.';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /admin/support/:id/status — update a ticket's status
  app.patch('/admin/support/:id/status', { preHandler: authenticateOperator }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!status) return reply.status(400).send({ error: 'Missing required field: status.' });
    try {
      const ticket = await updateSupportTicketStatus(id, status, request.operatorId);
      return reply.send(ticket);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update ticket.';
      const code = message.includes('not found') ? 404 : message.includes('Invalid') ? 400 : 500;
      return reply.status(code).send({ error: message });
    }
  });

  // ─── Plan Management ──────────────────────────────────────────────────────

  // GET /admin/plans — list all plan configs
  app.get('/admin/plans', { preHandler: authenticateOperator }, async (_request, reply) => {
    try {
      const result = await pool.query(
        `SELECT tier, display_name, price_usd, token_budget_usd, is_available, updated_at
         FROM plan_config ORDER BY CASE tier WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 END`,
      );
      return reply.send({ plans: result.rows.map((r: Record<string, unknown>) => ({
        tier: r.tier,
        displayName: r.display_name,
        priceUsd: Number(r.price_usd),
        tokenBudgetUsd: Number(r.token_budget_usd),
        isAvailable: r.is_available,
        updatedAt: r.updated_at,
      })) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get plans.';
      return reply.status(500).send({ error: message });
    }
  });

  // PUT /admin/plans/:tier — update a plan's config
  app.put('/admin/plans/:tier', { preHandler: authenticateOperator }, async (request, reply) => {
    const { tier } = request.params as { tier: string };
    if (!['silver', 'gold', 'platinum'].includes(tier)) {
      return reply.status(400).send({ error: 'Invalid tier. Must be silver, gold, or platinum.' });
    }
    const body = request.body as {
      displayName?: string;
      priceUsd?: number;
      tokenBudgetUsd?: number;
      isAvailable?: boolean;
    };
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.displayName !== undefined) { updates.push(`display_name = $${idx++}`); params.push(body.displayName); }
    if (body.priceUsd !== undefined) {
      if (body.priceUsd <= 0) return reply.status(400).send({ error: 'priceUsd must be greater than 0.' });
      updates.push(`price_usd = $${idx++}`); params.push(body.priceUsd);
    }
    if (body.tokenBudgetUsd !== undefined) {
      if (body.tokenBudgetUsd <= 0) return reply.status(400).send({ error: 'tokenBudgetUsd must be greater than 0.' });
      updates.push(`token_budget_usd = $${idx++}`); params.push(body.tokenBudgetUsd);
    }
    if (body.isAvailable !== undefined) { updates.push(`is_available = $${idx++}`); params.push(body.isAvailable); }
    if (updates.length === 0) return reply.status(400).send({ error: 'No fields to update.' });
    updates.push(`updated_at = NOW()`);
    params.push(tier);
    try {
      await pool.query(
        `UPDATE plan_config SET ${updates.join(', ')} WHERE tier = $${idx}`,
        params,
      );
      await logAuditEvent(
        request.operatorId, 'update_plan_config', 'plan', request.operatorId,
        { tier, priceUsd: body.priceUsd, tokenBudgetUsd: body.tokenBudgetUsd, isAvailable: body.isAvailable },
      );
      return reply.send({ message: `Plan '${tier}' updated successfully.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update plan.';
      return reply.status(500).send({ error: message });
    }
  });
}