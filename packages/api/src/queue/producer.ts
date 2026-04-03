import redis from '../redis/client.js';

export const WEBHOOK_STREAM = 'augustus:webhook:events';

export interface WebhookEvent {
  businessId: string;
  messageId: string;
  payload: object;
}

export async function enqueueWebhookEvent(event: WebhookEvent): Promise<string> {
  const msgId = await redis.xadd(
    WEBHOOK_STREAM,
    '*',
    'businessId', event.businessId,
    'messageId', event.messageId,
    'payload', JSON.stringify(event.payload),
  );
  return msgId as string;
}
