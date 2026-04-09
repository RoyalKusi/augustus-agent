import redis from '../redis/client.js';
import { WEBHOOK_STREAM } from './producer.js';
export async function createConsumerGroup(groupName) {
    try {
        // Use '0' to read from the beginning so messages enqueued before group creation are not lost
        await redis.xgroup('CREATE', WEBHOOK_STREAM, groupName, '0', 'MKSTREAM');
    }
    catch (err) {
        if (err.message?.includes('BUSYGROUP')) {
            // Group already exists — reset its last-delivered-id to '0' so unread messages are delivered
            try {
                await redis.xgroup('SETID', WEBHOOK_STREAM, groupName, '0');
            }
            catch {
                // ignore — group may not support SETID on this Redis version
            }
        }
        else {
            throw err;
        }
    }
}
function parseFields(fields) {
    const map = {};
    for (let i = 0; i < fields.length; i += 2) {
        map[fields[i]] = fields[i + 1];
    }
    return {
        businessId: map['businessId'],
        messageId: map['messageId'],
        payload: JSON.parse(map['payload']),
    };
}
export async function consumeWebhookEvents(groupName, consumerName, handler, options = {}) {
    const { count = 10, blockMs = 5000 } = options;
    const results = (await redis.xreadgroup('GROUP', groupName, consumerName, 'COUNT', count, 'BLOCK', blockMs, 'STREAMS', WEBHOOK_STREAM, '>'));
    if (!results)
        return;
    for (const [, messages] of results) {
        for (const [msgId, fields] of messages) {
            const event = parseFields(fields);
            try {
                await handler(event, msgId);
                await redis.xack(WEBHOOK_STREAM, groupName, msgId);
            }
            catch (err) {
                // Leave message in PEL — reprocessPendingEvents will reclaim it after idleMs
                console.error('[Consumer] Handler failed, message left in PEL for reprocessing:', { msgId, err });
            }
        }
    }
}
export async function reprocessPendingEvents(groupName, consumerName, handler) {
    const idleMs = 60_000;
    const result = (await redis.xautoclaim(WEBHOOK_STREAM, groupName, consumerName, idleMs, '0-0'));
    const messages = result[1];
    for (const [msgId, fields] of messages) {
        const event = parseFields(fields);
        try {
            await handler(event, msgId);
            await redis.xack(WEBHOOK_STREAM, groupName, msgId);
        }
        catch (err) {
            console.error('[Consumer] Reprocess handler failed, message left in PEL:', { msgId, err });
        }
    }
}
//# sourceMappingURL=consumer.js.map