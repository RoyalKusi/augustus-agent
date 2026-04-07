import redis from '../redis/client.js';
export const WEBHOOK_STREAM = 'augustus:webhook:events';
export async function enqueueWebhookEvent(event) {
    const msgId = await redis.xadd(WEBHOOK_STREAM, '*', 'businessId', event.businessId, 'messageId', event.messageId, 'payload', JSON.stringify(event.payload));
    return msgId;
}
//# sourceMappingURL=producer.js.map