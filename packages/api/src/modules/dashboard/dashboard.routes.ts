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

  // GET /dashboard/debug/messages/:id — unauthenticated debug endpoint (REMOVE IN PRODUCTION)
  app.get('/dashboard/debug/messages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const conv = await pool.query(`SELECT id, business_id, message_count, customer_wa_number FROM conversations WHERE id = $1`, [id]);
      const msgs = await pool.query(`SELECT id, direction, content, created_at, meta_message_id FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20`, [id]);
      return reply.send({ conversation: conv.rows[0] ?? null, messageCount: msgs.rows.length, messages: msgs.rows });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // GET /dashboard/debug/conversations — list all conversations with message counts
  app.get('/dashboard/debug/conversations', async (_request, reply) => {
    try {
      const convs = await pool.query(
        `SELECT c.id, c.customer_wa_number, c.message_count, c.status, c.business_id,
                COUNT(m.id) AS actual_message_count
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC
         LIMIT 20`
      );
      return reply.send({ conversations: convs.rows });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  // GET /dashboard/conversations/:id/messages
  app.get('/dashboard/conversations/:id/messages', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // Fetch latest 200 messages — ORDER DESC to get most recent, then reverse for chronological display
      const result = await pool.query<{
        id: string;
        direction: string;
        content: string;
        created_at: Date | string;
      }>(
        `SELECT m.id, m.direction, m.content, m.created_at
         FROM messages m
         INNER JOIN conversations c ON c.id = m.conversation_id
         WHERE m.conversation_id = $1 AND c.business_id = $2
         ORDER BY m.created_at DESC
         LIMIT 200`,
        [id, request.businessId],
      );

      app.log.info({ conversationId: id, businessId: request.businessId, count: result.rows.length }, '[Dashboard] Messages fetched');

      // Reverse to get chronological order (oldest first)
      const messages = result.rows.reverse().map((r) => ({
        id: r.id,
        direction: r.direction,
        content: r.content,
        createdAt: r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      }));
      return reply.send({ messages });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch messages.';
      app.log.error({ err, conversationId: id }, '[Dashboard] Failed to fetch messages');
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

  // GET /dashboard/referrals — get referral info and list for the logged-in business
  app.get('/dashboard/referrals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const meta = await pool.query<{ referral_code: string | null; referral_enabled: boolean; name: string }>(
        `SELECT referral_code, referral_enabled, name FROM businesses WHERE id = $1`,
        [request.businessId],
      );
      const biz = meta.rows[0];
      if (!biz) return reply.status(404).send({ error: 'Business not found.' });

      const referrals = await pool.query(
        `SELECT id, referred_email, referred_name, status, created_at
         FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC`,
        [request.businessId],
      );

      return reply.send({
        referralEnabled: biz.referral_enabled,
        referralCode: biz.referral_code ?? null,
        referrals: referrals.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          referredEmail: r.referred_email,
          referredName: r.referred_name,
          status: r.status,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // GET /dashboard/referrals/earnings — get referral earnings for the logged-in business
  app.get('/dashboard/referrals/earnings', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { earningsService } = await import('../referral-earnings/earnings.service.js');
      const earnings = await earningsService.getBusinessEarnings(request.businessId);

      return reply.send({
        totalEarningsUsd: earnings.totalEarningsUsd,
        validReferralsCount: earnings.validReferralsCount,
        referrals: earnings.referrals.map((ref) => ({
          id: ref.id,
          referredEmail: ref.referredEmail,
          referredName: ref.referredName,
          status: ref.status,
          earningsUsd: ref.earningsUsd,
          createdAt: ref.createdAt.toISOString(),
          earningsCalculatedAt: ref.earningsCalculatedAt?.toISOString() || null,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get earnings';
      
      if (message === 'Business not found') {
        return reply.status(404).send({ error: message });
      }
      
      return reply.status(500).send({ error: message });
    }
  });

  // GET /dashboard/notification-number — get the business owner's notification WhatsApp number
  app.get('/dashboard/notification-number', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await pool.query<{ notification_wa_number: string | null }>(
        `SELECT notification_wa_number FROM businesses WHERE id = $1`,
        [request.businessId],
      );
      return reply.send({ notificationWaNumber: result.rows[0]?.notification_wa_number ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notification number.';
      return reply.status(500).send({ error: message });
    }
  });

  // PUT /dashboard/notification-number — save the business owner's notification WhatsApp number
  app.put('/dashboard/notification-number', { preHandler: authenticate }, async (request, reply) => {
    const { notificationWaNumber } = request.body as { notificationWaNumber?: string };
    const cleaned = notificationWaNumber
      ? notificationWaNumber.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/\+/g, '')
      : null;
    try {
      await pool.query(
        `UPDATE businesses SET notification_wa_number = $1, updated_at = NOW() WHERE id = $2`,
        [cleaned || null, request.businessId],
      );
      return reply.send({ notificationWaNumber: cleaned || null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save notification number.';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /dashboard/conversations/:id/label — set lead warmth label
  app.patch('/dashboard/conversations/:id/label', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { label } = request.body as { label: string | null };
    const valid = ['hot', 'warm', 'cold', 'browsing', null];
    if (!valid.includes(label as string | null)) {
      return reply.status(400).send({ error: 'label must be hot, warm, cold, browsing, or null.' });
    }
    try {
      await pool.query(
        `UPDATE conversations SET lead_label = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3`,
        [label ?? null, id, request.businessId],
      );
      return reply.send({ id, leadLabel: label ?? null });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });

  // POST /dashboard/broadcast — send a message to multiple WhatsApp numbers
  app.post('/dashboard/broadcast', { preHandler: authenticate }, async (request, reply) => {
    const { message, recipients } = request.body as {
      message: string;
      recipients: string[];
    };
    if (!message?.trim()) return reply.status(400).send({ error: 'message is required.' });
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return reply.status(400).send({ error: 'recipients must be a non-empty array.' });
    }
    if (message.length > 1000) {
      return reply.status(400).send({ error: 'Message must be 1000 characters or less.' });
    }
    if (recipients.length > 100) {
      return reply.status(400).send({ error: 'Maximum 100 recipients per broadcast.' });
    }
    try {
      const { sendWithTemplateFallback } = await import('../../modules/whatsapp/message-dispatcher.js');
      const results: Array<{ number: string; status: 'sent' | 'failed'; usedTemplate?: boolean; error?: string }> = [];
      for (const number of recipients) {
        try {
          // Use broadcast_message template if approved, else plain text
          const result = await sendWithTemplateFallback(
            request.businessId, number, 'broadcast_message',
            ['there', message, ''],
            message,
          );
          results.push({ number, status: result.success ? 'sent' : 'failed', usedTemplate: result.usedTemplate, error: result.errorMessage });
        } catch (err) {
          results.push({ number, status: 'failed', error: err instanceof Error ? err.message : 'Failed' });
        }
      }
      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const templated = results.filter(r => r.usedTemplate).length;
      return reply.send({ sent, failed, templated, results });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Broadcast failed.' });
    }
  });
}
