/**
 * Business Dashboard HTTP Routes
 * Requirements: 2.9, 3.7, 8.1, 11.1–11.4, 12.5, 13.1–13.4
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import { pool } from '../../db/client.js';
import {
  getSubscriptionOverview,
  getCreditUsage,
  getActiveConversations,
  getOrdersSummary,
  getRevenueSummary,
  getOrdersCsv,
  getWithdrawalHistory,
  createSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
  updateOrderStatus,
} from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  // GET /dashboard/subscription
  app.get('/dashboard/subscription', { preHandler: authenticate }, async (request, reply) => {
    try {
      const overview = await getSubscriptionOverview(request.businessId);
      return reply.send(overview);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription overview.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/credit-usage
  app.get('/dashboard/credit-usage', { preHandler: authenticate }, async (request, reply) => {
    try {
      const usage = await getCreditUsage(request.businessId);
      return reply.send(usage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch credit usage.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/conversations/:id/messages
  app.get('/dashboard/conversations/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await pool.query<{
        id: string;
        direction: string;
        content: string;
        created_at: Date;
      }>(
        `SELECT id, direction, content, created_at
         FROM messages
         WHERE conversation_id = $1 AND business_id = $2
         ORDER BY created_at ASC
         LIMIT 200`,
        [id, request.businessId],
      );
      const messages = result.rows.map((r) => ({
        id: r.id,
        direction: r.direction,
        content: r.content,
        createdAt: r.created_at.toISOString(),
      }));
      return reply.send({ messages });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch messages.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/conversations
  app.get('/dashboard/conversations', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await getActiveConversations(request.businessId);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch conversations.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/orders
  app.get('/dashboard/orders', { preHandler: authenticate }, async (request, reply) => {
    const query = request.query as {
      dateFrom?: string;
      dateTo?: string;
      status?: string;
      productName?: string;
    };
    try {
      const result = await getOrdersSummary(request.businessId, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        status: query.status,
        productName: query.productName,
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/revenue
  app.get('/dashboard/revenue', { preHandler: authenticate }, async (request, reply) => {
    try {
      const summary = await getRevenueSummary(request.businessId);
      return reply.send(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch revenue summary.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/orders/export
  app.get('/dashboard/orders/export', { preHandler: authenticate }, async (request, reply) => {
    try {
      const csv = await getOrdersCsv(request.businessId);
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="orders.csv"')
        .send(csv);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export orders.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/withdrawals
  app.get('/dashboard/withdrawals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await getWithdrawalHistory(request.businessId);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch withdrawal history.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /dashboard/support
  app.post('/dashboard/support', { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as {
      subject?: string;
      description?: string;
      attachmentUrl?: string;
    };

    if (!body.subject || !body.description) {
      return reply.status(400).send({ error: 'Missing required fields: subject, description.' });
    }

    try {
      const ticket = await createSupportTicket(
        request.businessId,
        body.subject,
        body.description,
        body.attachmentUrl,
      );
      return reply.status(201).send(ticket);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create support ticket.';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /dashboard/orders/:id/status — update order status
  app.patch('/dashboard/orders/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string };
    if (!body.status) return reply.status(400).send({ error: 'Missing required field: status.' });
    try {
      const order = await updateOrderStatus(request.businessId, id, body.status);
      return reply.send(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order status.';
      const code = message.includes('not found') ? 404 : message.includes('Invalid') ? 400 : 500;
      return reply.status(code).send({ error: message });
    }
  });

  // GET /dashboard/support
  app.get('/dashboard/support', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await listSupportTickets(request.businessId);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch support tickets.';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /dashboard/support/:id/status
  app.patch(
    '/dashboard/support/:id/status',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string };

      if (!body.status) {
        return reply.status(400).send({ error: 'Missing required field: status.' });
      }

      try {
        const ticket = await updateSupportTicketStatus(request.businessId, id, body.status);
        return reply.send(ticket);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update ticket status.';
        const statusCode = message === 'Support ticket not found.' ? 404 : 400;
        return reply.status(statusCode).send({ error: message });
      }
    },
  );
}
