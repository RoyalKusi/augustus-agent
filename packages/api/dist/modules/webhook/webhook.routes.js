import { config } from '../../config.js';
import { pool } from '../../db/client.js';
import { validateHmacSignature, isDuplicate, enqueueWebhookPayload, extractMessageId, extractPhoneNumberId, } from './webhook.service.js';
export async function webhookRoutes(app) {
    /**
     * POST /webhooks/whatsapp
     *
     * Global Meta Cloud API webhook endpoint.
     * Meta sends ALL subscribed WABA events to this single app-level URL.
     * Resolves businessId from metadata.phone_number_id in the payload.
     */
    app.post('/webhooks/whatsapp', async (request, reply) => {
        const signature = request.headers['x-hub-signature-256'] ?? '';
        // Use raw body string for HMAC validation
        const rawBodyStr = request.rawBody
            ?? JSON.stringify(request.body ?? {});
        const rawBody = Buffer.from(rawBodyStr);
        // Validate HMAC signature
        const secret = config.meta.appSecret;
        if (!validateHmacSignature(rawBody, signature, secret)) {
            return reply.status(403).send({ error: 'Invalid signature' });
        }
        // Capture body reference before sending reply
        const capturedBody = request.body;
        // Acknowledge immediately — Meta requires a response within 5 seconds
        reply.status(200).send();
        // Async processing: resolve businessId from phone_number_id, then enqueue
        void (async () => {
            try {
                const payload = capturedBody;
                const phoneNumberId = extractPhoneNumberId(payload);
                const messageId = extractMessageId(payload);
                // Diagnostic: mark that async block ran
                const diagKey = `webhook:diag:${Date.now()}`;
                await import('../../redis/client.js').then(m => m.default.set(diagKey, JSON.stringify({ phoneNumberId, messageId, hasPayload: !!payload }), 'EX', 300));
                app.log.info({ phoneNumberId, messageId }, '[Webhook] Processing global webhook');
                if (!phoneNumberId) {
                    app.log.info('[Webhook] No phone_number_id — skipping');
                    return;
                }
                // Look up businessId from phone_number_id
                const result = await pool.query(`SELECT business_id FROM whatsapp_integrations WHERE phone_number_id = $1 LIMIT 1`, [phoneNumberId]);
                const businessId = result.rows[0]?.business_id;
                app.log.info({ businessId, phoneNumberId }, '[Webhook] Business lookup result');
                if (!businessId) {
                    app.log.warn({ phoneNumberId }, '[Webhook] No business found for phone_number_id — skipping');
                    return;
                }
                if (messageId) {
                    const duplicate = await isDuplicate(messageId);
                    if (duplicate) {
                        app.log.info({ businessId, messageId }, '[Webhook] Duplicate — skipping enqueue');
                        return;
                    }
                }
                await enqueueWebhookPayload(businessId, payload);
                app.log.info({ businessId, messageId }, '[Webhook] Enqueued successfully');
            }
            catch (err) {
                app.log.error({ err }, '[Webhook] Failed to process global webhook event');
            }
        })();
    });
    /**
     * POST /webhooks/whatsapp/:businessId
     *
     * Per-business webhook endpoint (legacy / manual setup path).
     */
    app.post('/webhooks/whatsapp/:businessId', async (request, reply) => {
        const { businessId } = request.params;
        const signature = request.headers['x-hub-signature-256'] ?? '';
        const rawBodyStr = request.rawBody
            ?? JSON.stringify(request.body ?? {});
        const rawBody = Buffer.from(rawBodyStr);
        // Validate HMAC signature
        const secret = config.meta.appSecret;
        if (!validateHmacSignature(rawBody, signature, secret)) {
            return reply.status(403).send({ error: 'Invalid signature' });
        }
        // Capture body before sending reply
        const capturedBody = request.body;
        // Acknowledge immediately — Meta requires a response within 5 seconds
        reply.status(200).send();
        // Async processing: deduplication + enqueue (fire-and-forget)
        void (async () => {
            try {
                const payload = capturedBody;
                const messageId = extractMessageId(payload);
                if (messageId) {
                    const duplicate = await isDuplicate(messageId);
                    if (duplicate) {
                        app.log.info({ businessId, messageId }, 'Duplicate webhook message — skipping enqueue');
                        return;
                    }
                }
                await enqueueWebhookPayload(businessId, payload);
            }
            catch (err) {
                app.log.error({ err, businessId }, 'Failed to process webhook event asynchronously');
            }
        })();
    });
    /**
     * GET /webhooks/whatsapp
     *
     * Global Meta hub.challenge verification endpoint (no businessId).
     * Meta calls this URL when you save the webhook config in the dashboard.
     * Verifies hub.verify_token against the global META_WEBHOOK_VERIFY_TOKEN.
     */
    app.get('/webhooks/whatsapp', async (request, reply) => {
        const query = request.query;
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
    });
    /**
     * GET /webhooks/whatsapp/:businessId
     *
     * Per-business Meta hub.challenge verification endpoint.
     * Verifies hub.mode === 'subscribe' and hub.verify_token matches the stored
     * webhook_verify_token for the business. Returns hub.challenge if valid, 403 otherwise.
     */
    app.get('/webhooks/whatsapp/:businessId', async (request, reply) => {
        const { businessId } = request.params;
        const query = request.query;
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
        let storedToken = null;
        try {
            const result = await pool.query(`SELECT webhook_verify_token FROM whatsapp_integrations WHERE business_id = $1`, [businessId]);
            storedToken = result.rows[0]?.webhook_verify_token ?? null;
        }
        catch (err) {
            app.log.error({ err, businessId }, 'Failed to look up webhook_verify_token');
            return reply.status(500).send({ error: 'Internal server error' });
        }
        if (!storedToken || verifyToken !== storedToken) {
            return reply.status(403).send({ error: 'Verify token mismatch' });
        }
        return reply.status(200).send(challenge);
    });
}
//# sourceMappingURL=webhook.routes.js.map