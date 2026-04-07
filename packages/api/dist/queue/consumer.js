import redis from '../redis/client.js';
import { WEBHOOK_STREAM } from './producer.js';
export async function createConsumerGroup(groupName) {
    try {
        await redis.xgroup('CREATE', WEBHOOK_STREAM, groupName, '$', 'MKSTREAM');
    }
    catch (err) {
        if (!err.message?.includes('BUSYGROUP'))
            throw err;
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
            await handler(event, msgId);
            await redis.xack(WEBHOOK_STREAM, groupName, msgId);
        }
    }
}
export async function reprocessPendingEvents(groupName, consumerName, handler) {
    const idleMs = 60_000;
    const result = (await redis.xautoclaim(WEBHOOK_STREAM, groupName, consumerName, idleMs, '0-0'));
    const messages = result[1];
    for (const [msgId, fields] of messages) {
        const event = parseFields(fields);
        await handler(event, msgId);
        await redis.xack(WEBHOOK_STREAM, groupName, msgId);
    }
}
//# sourceMappingURL=consumer.js.map