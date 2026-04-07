export declare const WEBHOOK_STREAM = "augustus:webhook:events";
export interface WebhookEvent {
    businessId: string;
    messageId: string;
    payload: object;
}
export declare function enqueueWebhookEvent(event: WebhookEvent): Promise<string>;
//# sourceMappingURL=producer.d.ts.map