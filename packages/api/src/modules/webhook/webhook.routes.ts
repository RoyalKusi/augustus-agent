import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';
import { pool } from '../../db/client.js';
import {
  validateHmacSignature,
  isDuplicate,
  enqueueWebhookPayload,
  extractMessageId,
} from './webhook.service.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
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
   * POST /webhooks/whatsapp/:businessId
   *
   * Receives inbound Meta Cloud API events.
   * 1. Validates X-Hub-Signature-256 HMAC — returns 403 if invalid.
   * 2. Returns HTTP 200 immediately (Meta requires < 5 s).
   * 3. Async: deduplicates by message ID in Redis (TTL 24 h).
   * 4. Async: enqueues to message queue if not a duplicate.
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

      // Async processing: deduplication + enqueue (fire-and-forget)
      void (async () => {
        try {
          const payload = request.body;
          const messageId = extractMessageId(payload);

          if (messageId) {
            const duplicate = await isDuplicate(messageId);
            if (duplicate) {
              app.log.info({ businessId, messageId }, 'Duplicate webhook message — skipping enqueue');
              return;
            }
          }

          await enqueueWebhookPayload(businessId, payload);
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
