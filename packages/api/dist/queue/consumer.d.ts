import { WebhookEvent } from './producer.js';
export declare function createConsumerGroup(groupName: string): Promise<void>;
export declare function consumeWebhookEvents(groupName: string, consumerName: string, handler: (event: WebhookEvent, msgId: string) => Promise<void>, options?: {
    count?: number;
    blockMs?: number;
}): Promise<void>;
export declare function reprocessPendingEvents(groupName: string, consumerName: string, handler: (event: WebhookEvent, msgId: string) => Promise<void>): Promise<void>;
//# sourceMappingURL=consumer.d.ts.map