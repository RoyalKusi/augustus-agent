import redis from '../redis/client.js';
import { WEBHOOK_STREAM, WebhookEvent } from './producer.js';

export async function createConsumerGroup(groupName: string): Promise<void> {
  try {
    await redis.xgroup('CREATE', WEBHOOK_STREAM, groupName, '$', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) throw err;
  }
}

function parseFields(fields: string[]): WebhookEvent {
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    map[fields[i]] = fields[i + 1];
  }
  return {
    businessId: map['businessId'],
    messageId: map['messageId'],
    payload: JSON.parse(map['payload']),
  };
}

export async function consumeWebhookEvents(
  groupName: string,
  consumerName: string,
  handler: (event: WebhookEvent, msgId: string) => Promise<void>,
  options: { count?: number; blockMs?: number } = {},
): Promise<void> {
  const { count = 10, blockMs = 5000 } = options;

  const results = (await redis.xreadgroup(
    'GROUP', groupName, consumerName,
    'COUNT', count,
    'BLOCK', blockMs,
    'STREAMS', WEBHOOK_STREAM, '>',
  )) as Array<[string, Array<[string, string[]]>]> | null;

  if (!results) return;

  for (const [, messages] of results) {
    for (const [msgId, fields] of messages) {
      const event = parseFields(fields);
      try {
        await handler(event, msgId);
        await redis.xack(WEBHOOK_STREAM, groupName, msgId);
      } catch (err) {
        // Leave message in PEL — reprocessPendingEvents will reclaim it after idleMs
        console.error('[Consumer] Handler failed, message left in PEL for reprocessing:', { msgId, err });
      }
    }
  }
}

export async function reprocessPendingEvents(
  groupName: string,
  consumerName: string,
  handler: (event: WebhookEvent, msgId: string) => Promise<void>,
): Promise<void> {
  const idleMs = 60_000;

  const result = (await redis.xautoclaim(
    WEBHOOK_STREAM, groupName, consumerName,
    idleMs, '0-0',
  )) as [string, Array<[string, string[]]>, string[]];

  const messages = result[1];
  for (const [msgId, fields] of messages) {
    const event = parseFields(fields);
    try {
      await handler(event, msgId);
      await redis.xack(WEBHOOK_STREAM, groupName, msgId);
    } catch (err) {
      console.error('[Consumer] Reprocess handler failed, message left in PEL:', { msgId, err });
    }
  }
}
