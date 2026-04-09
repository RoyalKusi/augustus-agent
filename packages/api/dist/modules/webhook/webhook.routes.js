import { config } from '../../config.js';
import { pool } from '../../db/client.js';
import { validateHmacSignature, extractPhoneNumberId, } from './webhook.service.js';
import { processInboundMessage } from '../conversation/conversation-engine.service.js';
// In-memory dedup set — prevents double-processing within the same process lifetime
const recentMessageIds = new Set();
function dedupCheck(messageId) {
    if (recentMessageIds.has(messageId))
        return true;
    recentMessageIds.add(messageId);
    // Keep set bounded — clear oldest entries after 10k
    if (recentMessageIds.size > 10_000) {
        const first = recentMessageIds.values().next().value;
        if (first)
            recentMessageIds.delete(first);
    }
    return false;
}
export async function webhookRoutes(app) {
    // Capture raw body for HMAC validation
    app.addHook('preParsing', async (request, _reply, payload) => {
        const chunks = [];
        for await (const chunk of payload) {
            chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);
        request.rawBody = raw;
        const { Readable } = await import('stream');
        return Readable.from(raw);
    });
    /**
     * GET /webhooks/diag — diagnostic endpoint
     */
    app.get('/webhooks/diag', async (_request, reply) => {
        try {
            const integrations = await pool.query(`SELECT business_id, phone_number_id, status, error_message, waba_id, updated_at
         FROM whatsapp_integrations ORDER BY updated_at DESC LIMIT 5`);
            const conversations = await pool.query(`SELECT id, business_id, customer_wa_number, message_count, status, updated_at
         FROM conversations ORDER BY updated_at DESC LIMIT 5`);
            const messages = await pool.query(`SELECT id, business_id, direction, content, created_at
         FROM messages ORDER BY created_at DESC LIMIT 10`);
            return reply.send({
                integrations: integrations.rows,
                recentConversations: conversations.rows,
                recentMessages: messages.rows,
                mode: 'direct-processing',
            });
        }
        catch (err) {
            return reply.status(500).send({ error: err instanceof Error ? err.message : 'DB error' });
        }
    });
    /**
     * POST /webhooks/whatsapp — Global Meta Cloud API webhook endpoint
     */
    app.post('/webhooks/whatsapp', async (request, reply) => {
        const signature = request.headers['x-hub-signature-256'] ?? '';
        const rawBody = request.rawBody ??
            Buffer.from(JSON.stringify(request.body ?? {}));
        if (!validateHmacSignature(rawBody, signature, config.meta.appSecret)) {
            return reply.status(403).send({ error: 'Invalid signature' });
        }
        // Acknowledge immediately — Meta requires response within 5 seconds
        reply.status(200).send();
        void (async () => {
            try {
                const payload = request.body;
                const entry = payload?.entry?.[0];
                const change = entry?.changes?.[0];
                const field = change?.field;
                const value = change?.value;
                // ── WABA lifecycle events ─────────────────────────────────────────
                if (field === 'account_update' && value?.event === 'PARTNER_ADDED') {
                    const wabaId = value?.waba_info?.waba_id;
                    if (wabaId) {
                        await pool.query(`UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE waba_id = $1`, [wabaId]);
                    }
                    return;
                }
                if (field === 'phone_number_name_update' && value?.decision === 'APPROVED') {
                    const phoneNumberId = extractPhoneNumberId(payload);
                    if (phoneNumberId) {
                        await pool.query(`UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE phone_number_id = $1 AND status != 'active'`, [phoneNumberId]);
                    }
                    return;
                }
                if (field === 'account_update' && value?.event === 'VERIFIED_ACCOUNT') {
                    const wabaId = entry?.id;
                    if (wabaId) {
                        await pool.query(`UPDATE whatsapp_integrations SET status = 'active', error_message = NULL, updated_at = NOW() WHERE waba_id = $1 AND status != 'active'`, [wabaId]);
                    }
                    return;
                }
                // ── Inbound messages ──────────────────────────────────────────────
                const message = value?.messages?.[0];
                if (!message)
                    return;
                const phoneNumberId = extractPhoneNumberId(payload);
                if (!phoneNumberId)
                    return;
                const result = await pool.query(`SELECT business_id FROM whatsapp_integrations WHERE phone_number_id = $1 LIMIT 1`, [phoneNumberId]);
                const businessId = result.rows[0]?.business_id;
                if (!businessId) {
                    app.log.warn({ phoneNumberId }, '[Webhook] No business found for phone_number_id');
                    return;
                }
                const messageId = message.id ?? '';
                if (messageId && dedupCheck(messageId)) {
                    app.log.info({ messageId }, '[Webhook] Duplicate — skipping');
                    return;
                }
                // Extract text from message
                let messageText = null;
                if (message.type === 'text') {
                    messageText = message.text?.body ?? null;
                }
                else if (message.type === 'interactive') {
                    const interactive = message.interactive;
                    if (interactive?.type === 'button_reply') {
                        messageText = interactive.button_reply?.title ?? interactive.button_reply?.id ?? null;
                    }
                    else if (interactive?.type === 'list_reply') {
                        messageText = interactive.list_reply?.title ?? interactive.list_reply?.id ?? null;
                    }
                }
                if (!messageText) {
                    app.log.info({ type: message.type, messageId }, '[Webhook] Non-text message — skipping');
                    return;
                }
                app.log.info({ businessId, messageId, messageText }, '[Webhook] Processing message directly');
                // Process directly — no Redis queue needed
                await processInboundMessage({
                    businessId,
                    customerWaNumber: message.from ?? '',
                    messageText,
                    messageId,
                    timestamp: parseInt(message.timestamp ?? '0', 10) * 1000 || Date.now(),
                });
                app.log.info({ businessId, messageId }, '[Webhook] Message processed successfully');
            }
            catch (err) {
                app.log.error({ err }, '[Webhook] Failed to process webhook event');
            }
        })();
    });
    /**
     * POST /webhooks/whatsapp/:businessId — per-business legacy endpoint
     */
    app.post('/webhooks/whatsapp/:businessId', async (request, reply) => {
        const { businessId } = request.params;
        const signature = request.headers['x-hub-signature-256'] ?? '';
        const rawBody = request.rawBody ??
            Buffer.from(JSON.stringify(request.body ?? {}));
        if (!validateHmacSignature(rawBody, signature, config.meta.appSecret)) {
            return reply.status(403).send({ error: 'Invalid signature' });
        }
        reply.status(200).send();
        void (async () => {
            try {
                const payload = request.body;
                const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
                if (!message)
                    return;
                const messageId = message.id ?? '';
                if (messageId && dedupCheck(messageId))
                    return;
                let messageText = null;
                if (message.type === 'text') {
                    messageText = message.text?.body ?? null;
                }
                else if (message.type === 'interactive') {
                    const interactive = message.interactive;
                    if (interactive?.type === 'button_reply') {
                        messageText = interactive.button_reply?.title ?? interactive.button_reply?.id ?? null;
                    }
                    else if (interactive?.type === 'list_reply') {
                        messageText = interactive.list_reply?.title ?? interactive.list_reply?.id ?? null;
                    }
                }
                if (!messageText)
                    return;
                await processInboundMessage({
                    businessId,
                    customerWaNumber: message.from ?? '',
                    messageText,
                    messageId,
                    timestamp: parseInt(message.timestamp ?? '0', 10) * 1000 || Date.now(),
                });
            }
            catch (err) {
                app.log.error({ err, businessId }, '[Webhook] Failed to process per-business webhook');
            }
        })();
    });
    /**
     * GET /webhooks/whatsapp — global hub.challenge verification
     */
    app.get('/webhooks/whatsapp', async (request, reply) => {
        const query = request.query;
        if (query['hub.mode'] !== 'subscribe' || !query['hub.verify_token'] || !query['hub.challenge']) {
            return reply.status(403).send({ error: 'Invalid hub verification request' });
        }
        if (query['hub.verify_token'] !== config.meta.verifyToken) {
            return reply.status(403).send({ error: 'Verify token mismatch' });
        }
        return reply.status(200).send(query['hub.challenge']);
    });
    /**
     * GET /webhooks/whatsapp/:businessId — per-business hub.challenge verification
     */
    app.get('/webhooks/whatsapp/:businessId', async (request, reply) => {
        const { businessId } = request.params;
        const query = request.query;
        if (query['hub.mode'] !== 'subscribe' || !query['hub.verify_token'] || !query['hub.challenge']) {
            return reply.status(403).send({ error: 'Invalid hub verification request' });
        }
        if (query['hub.verify_token'] === config.meta.verifyToken) {
            return reply.status(200).send(query['hub.challenge']);
        }
        try {
            const result = await pool.query(`SELECT webhook_verify_token FROM whatsapp_integrations WHERE business_id = $1`, [businessId]);
            const storedToken = result.rows[0]?.webhook_verify_token ?? null;
            if (!storedToken || query['hub.verify_token'] !== storedToken) {
                return reply.status(403).send({ error: 'Verify token mismatch' });
            }
            return reply.status(200).send(query['hub.challenge']);
        }
        catch (err) {
            app.log.error({ err, businessId }, 'Failed to look up webhook_verify_token');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
//# sourceMappingURL=webhook.routes.js.map