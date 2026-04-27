import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';
import { pool } from '../../db/client.js';
import redis from '../../redis/client.js';
import {
  validateHmacSignature,
  isDuplicate,
  extractMessageId,
  extractPhoneNumberId,
} from './webhook.service.js';
import { processInboundMessage } from '../conversation/conversation-engine.service.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Store last processing error for diagnostics
  let lastError: { message: string; time: string } | null = null;

  app.get('/webhooks/last-error', async (_request, reply) => {
    return reply.send({ lastError });
  });

  // Temporary: register phone number for Cloud API
  app.post('/webhooks/register-phone', async (_request, reply) => {
    try {
      const { pool } = await import('../../db/client.js');
      const { getCredentials } = await import('../whatsapp/whatsapp-integration.service.js');
      const integrations = await pool.query<{ business_id: string }>(
        `SELECT business_id FROM whatsapp_integrations WHERE status = 'active'`
      );
      const results = [];
      for (const row of integrations.rows) {
        const integration = await getCredentials(row.business_id);
        if (!integration) continue;
        const graphVersion = config.meta.graphApiVersion;
        const regRes = await fetch(
          `https://graph.facebook.com/${graphVersion}/${integration.phoneNumberId}/register`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${integration.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000' }),
            signal: AbortSignal.timeout(15_000),
          }
        );
        const regBody = await regRes.json().catch(() => ({})) as { error?: { message?: string; code?: number }; success?: boolean };
        results.push({
          businessId: row.business_id,
          phoneNumberId: integration.phoneNumberId,
          status: regRes.status,
          ok: regRes.ok,
          body: regBody,
        });
      }
      return reply.send({ results });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.post('/webhooks/test-send', async (request, reply) => {
    try {
      const { to, message, businessId: reqBusinessId } = request.body as { to?: string; message?: string; businessId?: string };
      if (!to || !message) return reply.status(400).send({ error: 'to and message required' });
      const { pool } = await import('../../db/client.js');

      // Use provided businessId or find first active integration
      let businessId = reqBusinessId;
      if (!businessId) {
        const integration = await pool.query<{ business_id: string }>(
          `SELECT business_id FROM whatsapp_integrations WHERE status = 'active' LIMIT 1`
        );
        if (!integration.rows.length) return reply.status(404).send({ error: 'No active integration' });
        businessId = integration.rows[0].business_id;
      }

      const { sendMessage } = await import('../whatsapp/message-dispatcher.js');
      const result = await sendMessage(businessId, { type: 'text', to, body: message });
      return reply.send({ businessId, result });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /webhooks/sim-message — simulate an inbound message through the conversation engine
  app.post('/webhooks/sim-message', async (request, reply) => {
    try {
      const { businessId, customerWaNumber, messageText } = request.body as {
        businessId?: string;
        customerWaNumber?: string;
        messageText?: string;
      };
      if (!businessId || !customerWaNumber || !messageText) {
        return reply.status(400).send({ error: 'businessId, customerWaNumber, messageText required' });
      }
      const { processInboundMessage } = await import('../conversation/conversation-engine.service.js');
      const result = await processInboundMessage({
        businessId,
        customerWaNumber,
        messageText,
        messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        customerName: 'Sim Customer',
      });
      return reply.send({ success: true, result });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Temporary: test Paynow link generation directly
  app.post('/webhooks/test-paynow', async (_request, reply) => {
    try {
      const { pool } = await import('../../db/client.js');
      const integration = await pool.query<{ business_id: string }>(
        `SELECT business_id FROM whatsapp_integrations WHERE status = 'active' LIMIT 1`
      );
      if (!integration.rows.length) return reply.status(404).send({ error: 'No active integration' });
      const businessId = integration.rows[0].business_id;
      const product = await pool.query<{ id: string; name: string; price: string; currency: string }>(
        `SELECT id, name, price, currency FROM products WHERE business_id = $1 AND is_active = TRUE AND stock_quantity > 0 LIMIT 1`,
        [businessId]
      );
      if (!product.rows.length) return reply.status(404).send({ error: 'No active products' });
      const p = product.rows[0];
      const { generatePaynowLink } = await import('../payment/payment.service.js');
      const result = await generatePaynowLink(
        businessId, '+263783673079',
        [{ productId: p.id, productName: p.name, quantity: 1, unitPrice: Number(p.price) }],
        p.currency,
      );
      return reply.send({ success: true, paymentUrl: result.paymentUrl, orderRef: result.order.orderReference, product: p.name });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.post('/webhooks/resubscribe', async (_request, reply) => {
    try {
      const { pool } = await import('../../db/client.js');
      const { registerWebhook } = await import('../whatsapp/whatsapp-integration.service.js');
      const integrations = await pool.query<{ business_id: string }>(
        `SELECT business_id FROM whatsapp_integrations WHERE status = 'active'`
      );
      const results = [];
      for (const row of integrations.rows) {
        const result = await registerWebhook(row.business_id);
        results.push({ businessId: row.business_id, ...result });
      }
      return reply.send({ results });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  // Capture raw body for HMAC validation using a scoped preParsing hook.
  // This avoids conflicting with the global JSON body parser.
  app.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks);
    (request as unknown as { rawBody: Buffer }).rawBody = raw;
    // Return a readable stream from the buffer for Fastify to continue parsing
    const { Readable } = await import('stream');
    return Readable.from(raw);
  });

  /**
   * GET /webhooks/diag — temporary diagnostic: show integration status and recent activity
   */
  app.get('/webhooks/diag', async (_request, reply) => {
    try {
      const integrations = await pool.query(
        `SELECT business_id, phone_number_id, status, error_message, waba_id, updated_at
         FROM whatsapp_integrations ORDER BY updated_at DESC LIMIT 5`
      );
      const conversations = await pool.query(
        `SELECT id, business_id, customer_wa_number, message_count, status, updated_at
         FROM conversations ORDER BY updated_at DESC LIMIT 5`
      );
      const messages = await pool.query(
        `SELECT id, business_id, direction, content, created_at
         FROM messages ORDER BY created_at DESC LIMIT 10`
      );

      // Check Redis stream with timeout
      let streamLen: number | null = null;
      let redisError: string | null = null;
      try {
        const result = await Promise.race([
          redis.xlen('augustus:webhook:events'),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000)),
        ]);
        streamLen = result as number;
      } catch (redisErr) {
        redisError = redisErr instanceof Error ? redisErr.message : String(redisErr);
      }

      return reply.send({
        integrations: integrations.rows,
        recentConversations: conversations.rows,
        recentMessages: messages.rows,
        redis: { streamLen, error: redisError },
      });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'DB error' });
    }
  });

  /**
   * POST /webhooks/test — diagnostic: verify body parsing and phone_number_id extraction
   */
  app.post('/webhooks/test', async (request, reply) => {
    const body = request.body;
    const phoneId = extractPhoneNumberId(body);
    const msgId = extractMessageId(body);
    const dbResult = phoneId
      ? await pool.query<{ business_id: string; status: string }>('SELECT business_id, status FROM whatsapp_integrations WHERE phone_number_id = $1 LIMIT 1', [phoneId])
      : { rows: [] };
    // Also return all known phone_number_ids for comparison
    const allIds = await pool.query<{ phone_number_id: string; status: string; business_id: string }>('SELECT phone_number_id, status, business_id FROM whatsapp_integrations');
    return reply.send({
      bodyType: typeof body,
      hasEntry: !!(body as Record<string,unknown>)?.entry,
      phoneId,
      msgId,
      businessId: dbResult.rows[0]?.business_id ?? null,
      integrationStatus: dbResult.rows[0]?.status ?? null,
      allIntegrations: allIds.rows,
    });
  });

  /**
   * POST /webhooks/whatsapp
   *
   * Global Meta Cloud API webhook endpoint.
   * Meta sends ALL subscribed WABA events to this single app-level URL.
   * Resolves businessId from metadata.phone_number_id in the payload.
   */
  app.post(
    '/webhooks/whatsapp',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = (request.headers['x-hub-signature-256'] as string) ?? '';
      const rawBody: Buffer =
        (request as unknown as { rawBody: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(request.body ?? {}));

      // Validate HMAC signature
      const secret = config.meta.appSecret;
      if (!validateHmacSignature(rawBody, signature, secret)) {
        return reply.status(403).send({ error: 'Invalid signature' });
      }

      // Acknowledge immediately — Meta requires a response within 5 seconds
      reply.status(200).send();

      // Async processing: resolve businessId from phone_number_id, then enqueue
      void (async () => {
        try {
          const payload = request.body as {
            object?: string;
            entry?: Array<{
              id?: string;
              changes?: Array<{
                field?: string;
                value?: {
                  event?: string;
                  waba_info?: { waba_id?: string };
                  phone_number?: string;
                  decision?: string;
                  messaging_product?: string;
                  metadata?: { phone_number_id?: string };
                  messages?: unknown[];
                };
              }>;
            }>;
          };

          const entry = payload?.entry?.[0];
          const change = entry?.changes?.[0];
          const field = change?.field;
          const value = change?.value;

          app.log.info({ field, event: value?.event }, '[Webhook] Processing global webhook');

          // ── Handle WABA lifecycle events ──────────────────────────────────

          // PARTNER_ADDED: business completed embedded signup, WABA connected to app
          if (field === 'account_update' && value?.event === 'PARTNER_ADDED') {
            const wabaId = value?.waba_info?.waba_id;
            if (wabaId) {
              app.log.info({ wabaId }, '[Webhook] PARTNER_ADDED — activating integration');
              // Find the integration by WABA ID and activate it
              const r = await pool.query<{ business_id: string }>(
                `SELECT business_id FROM whatsapp_integrations WHERE waba_id = $1 LIMIT 1`,
                [wabaId],
              );
              if (r.rows.length > 0) {
                await pool.query(
                  `UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE waba_id = $1`,
                  [wabaId],
                );
                app.log.info({ wabaId, businessId: r.rows[0].business_id }, '[Webhook] Integration activated via PARTNER_ADDED');
              }
            }
            return;
          }

          // phone_number_name_update: display name approved — ensure status is active
          if (field === 'phone_number_name_update' && value?.decision === 'APPROVED') {
            const phoneNumberId = extractPhoneNumberId(payload);
            if (phoneNumberId) {
              await pool.query(
                `UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE phone_number_id = $1 AND status != 'active'`,
                [phoneNumberId],
              );
              app.log.info({ phoneNumberId }, '[Webhook] Phone number name approved — integration activated');
            }
            return;
          }

          // account_update VERIFIED_ACCOUNT: phone number verified
          if (field === 'account_update' && value?.event === 'VERIFIED_ACCOUNT') {
            const wabaId = entry?.id;
            if (wabaId) {
              await pool.query(
                `UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE waba_id = $1 AND status != 'active'`,
                [wabaId],
              );
              app.log.info({ wabaId }, '[Webhook] VERIFIED_ACCOUNT — integration activated');
            }
            return;
          }

          // ── Handle inbound messages ───────────────────────────────────────

          const phoneNumberId = extractPhoneNumberId(payload);
          const messageId = extractMessageId(payload);

          if (!phoneNumberId) {
            app.log.info({ field }, '[Webhook] No phone_number_id — skipping');
            return;
          }

          // Look up businessId from phone_number_id
          const result = await pool.query<{ business_id: string }>(
            `SELECT business_id FROM whatsapp_integrations WHERE phone_number_id = $1 LIMIT 1`,
            [phoneNumberId],
          );
          const businessId = result.rows[0]?.business_id;

          app.log.info({ businessId, phoneNumberId }, '[Webhook] Business lookup result');

          if (!businessId) {
            app.log.warn({ phoneNumberId }, '[Webhook] No business found for phone_number_id — skipping');
            return;
          }

          app.log.info({ businessId, messageId }, '[Webhook] Checking duplicate');
          if (messageId) {
            const duplicate = await isDuplicate(messageId);
            app.log.info({ businessId, messageId, duplicate }, '[Webhook] Duplicate check result');
            if (duplicate) {
              app.log.info({ businessId, messageId }, '[Webhook] Duplicate — skipping');
              return;
            }
          }

          // Process directly — bypass Redis queue for reliability
          const message = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
          if (!message) {
            app.log.info({ businessId }, '[Webhook] No message in payload — skipping');
            return;
          }

          let messageText: string | null = null;
          let intentOverride: import('../conversation/intent-detector.js').IntentResult | undefined;
          if (message.type === 'text') {
            messageText = message.text?.body ?? null;
          } else if (message.type === 'interactive') {
            const interactive = message.interactive;
            if (interactive?.type === 'button_reply') {
              const buttonId = interactive.button_reply?.id ?? '';
              if (buttonId.startsWith('order_')) {
                const productId = buttonId.replace('order_', '');
                // Resolve product name so the message is natural and the intent is clear
                const prodRow = await pool.query<{ name: string }>(
                  `SELECT name FROM products WHERE id = $1 LIMIT 1`,
                  [productId],
                );
                const productName = prodRow.rows[0]?.name ?? 'that product';
                messageText = `I'd like to order ${productName}`;
                // Use order_button intent — forces a confirmation step before payment
                const { orderButtonIntent } = await import('../conversation/intent-detector.js');
                intentOverride = orderButtonIntent(productName);
              } else {
                messageText = interactive.button_reply?.title ?? buttonId ?? null;
              }
            } else if (interactive?.type === 'list_reply') {
              messageText = interactive.list_reply?.title ?? interactive.list_reply?.id ?? null;
            }
          }

          if (!messageText) {
            app.log.info({ businessId, type: message.type }, '[Webhook] Non-text message — skipping');
            return;
          }

          app.log.info({ businessId, messageId }, '[Webhook] Processing message directly');
          // Show typing indicator immediately while processing
          if (messageId) {
            const { sendTypingIndicator } = await import('../whatsapp/message-dispatcher.js');
            void sendTypingIndicator(businessId, messageId);
          }
          // Extract customer name from WhatsApp contacts array if available
          const contacts = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.contacts;
          const customerName = contacts?.[0]?.profile?.name ?? '';
          await processInboundMessage({
            businessId,
            customerWaNumber: message.from ?? '',
            messageText,
            messageId: message.id ?? '',
            timestamp: parseInt(message.timestamp ?? '0', 10) * 1000 || Date.now(),
            customerName,
            intentOverride,
          });
          app.log.info({ businessId, messageId }, '[Webhook] Message processed successfully');
        } catch (err) {
          const errMsg = err instanceof Error ? `${err.message} ${err.stack?.split('\n')[1] ?? ''}` : String(err);
          lastError = { message: errMsg, time: new Date().toISOString() };
          app.log.error({ err }, '[Webhook] Failed to process global webhook event');
        }      })();
    },
  );

  /**
   * POST /webhooks/whatsapp/:businessId
   *
   * Per-business webhook endpoint (legacy / manual setup path).
   * Receives inbound Meta Cloud API events.
   */
  app.post(
    '/webhooks/whatsapp/:businessId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { businessId } = request.params as { businessId: string };
      const signature = (request.headers['x-hub-signature-256'] as string) ?? '';
      const rawBody: Buffer =
        (request as unknown as { rawBody: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(request.body ?? {}));

      // Validate HMAC signature
      const secret = config.meta.appSecret;
      if (!validateHmacSignature(rawBody, signature, secret)) {
        return reply.status(403).send({ error: 'Invalid signature' });
      }

      // Acknowledge immediately — Meta requires a response within 5 seconds
      reply.status(200).send();

      // Async processing: deduplication + direct processing (fire-and-forget)
      void (async () => {
        try {
          const payload = request.body as any;
          const messageId = extractMessageId(payload);

          if (messageId) {
            const duplicate = await isDuplicate(messageId);
            if (duplicate) {
              app.log.info({ businessId, messageId }, 'Duplicate webhook message — skipping');
              return;
            }
          }

          const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
          if (!message) return;

          let messageText: string | null = null;
          if (message.type === 'text') {
            messageText = message.text?.body ?? null;
          } else if (message.type === 'interactive') {
            const interactive = message.interactive;
            if (interactive?.type === 'button_reply') {
              const buttonId = interactive.button_reply?.id ?? '';
              if (buttonId.startsWith('order_')) {
                const productId = buttonId.replace('order_', '');
                const prodRow = await pool.query<{ name: string }>(
                  `SELECT name FROM products WHERE id = $1 LIMIT 1`,
                  [productId],
                );
                const productName = prodRow.rows[0]?.name ?? 'that product';
                messageText = `I'd like to order ${productName}`;
                const { orderButtonIntent } = await import('../conversation/intent-detector.js');
                await processInboundMessage({
                  businessId,
                  customerWaNumber: message.from ?? '',
                  messageText,
                  messageId: message.id ?? '',
                  timestamp: parseInt(message.timestamp ?? '0', 10) * 1000 || Date.now(),
                  intentOverride: orderButtonIntent(productName),
                });
                return;
              } else {
                messageText = interactive.button_reply?.title ?? buttonId ?? null;
              }
            } else if (interactive?.type === 'list_reply') {
              messageText = interactive.list_reply?.title ?? interactive.list_reply?.id ?? null;
            }
          }

          if (!messageText) return;

          await processInboundMessage({
            businessId,
            customerWaNumber: message.from ?? '',
            messageText,
            messageId: message.id ?? '',
            timestamp: parseInt(message.timestamp ?? '0', 10) * 1000 || Date.now(),
          });
        } catch (err) {
          app.log.error({ err, businessId }, 'Failed to process webhook event asynchronously');
        }
      })();
    },
  );

  /**
   * GET /webhooks/whatsapp
   *
   * Global Meta hub.challenge verification endpoint (no businessId).
   * Meta calls this URL when you save the webhook config in the dashboard.
   * Verifies hub.verify_token against the global META_WEBHOOK_VERIFY_TOKEN.
   */
  app.get(
    '/webhooks/whatsapp',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        'hub.mode'?: string;
        'hub.verify_token'?: string;
        'hub.challenge'?: string;
      };

      const mode = query['hub.mode'];
      const verifyToken = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode !== 'subscribe' || !verifyToken || !challenge) {
        return reply.status(403).send({ error: 'Invalid hub verification request' });
      }

      if (verifyToken !== config.meta.verifyToken) {
        return reply.status(403).send({ error: 'Verify token mismatch' });
      }

      return reply.status(200).send(challenge);
    },
  );

  /**
   * GET /webhooks/whatsapp/:businessId
   *
   * Per-business Meta hub.challenge verification endpoint.
   * Verifies hub.mode === 'subscribe' and hub.verify_token matches the stored
   * webhook_verify_token for the business. Returns hub.challenge if valid, 403 otherwise.
   */
  app.get(
    '/webhooks/whatsapp/:businessId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { businessId } = request.params as { businessId: string };
      const query = request.query as {
        'hub.mode'?: string;
        'hub.verify_token'?: string;
        'hub.challenge'?: string;
      };

      const mode = query['hub.mode'];
      const verifyToken = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode !== 'subscribe' || !verifyToken || !challenge) {
        return reply.status(403).send({ error: 'Invalid hub verification request' });
      }

      // Check global token first, then per-business token
      if (verifyToken === config.meta.verifyToken) {
        return reply.status(200).send(challenge);
      }

      // Look up the stored webhook_verify_token for this business
      let storedToken: string | null = null;
      try {
        const result = await pool.query<{ webhook_verify_token: string }>(
          `SELECT webhook_verify_token FROM whatsapp_integrations WHERE business_id = $1`,
          [businessId],
        );
        storedToken = result.rows[0]?.webhook_verify_token ?? null;
      } catch (err) {
        app.log.error({ err, businessId }, 'Failed to look up webhook_verify_token');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      if (!storedToken || verifyToken !== storedToken) {
        return reply.status(403).send({ error: 'Verify token mismatch' });
      }

      return reply.status(200).send(challenge);
    },
  );
}
