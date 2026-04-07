/**
 * Quick Reply event parser for the WhatsApp_Integration_Service.
 *
 * Parses inbound interactive reply events from the Meta Cloud API webhook
 * payload and routes the selected Quick_Reply payload as a structured input
 * to the Conversation Engine.
 *
 * Validates: Requirements 6.3
 */
export type QuickReplyEvent = {
    type: 'button_reply' | 'list_reply';
    from: string;
    messageId: string;
    buttonId: string;
    buttonTitle: string;
    timestamp: number;
};
interface MetaInteractiveButtonReply {
    id: string;
    title: string;
}
interface MetaInteractiveListReply {
    id: string;
    title: string;
}
interface MetaInteractive {
    type: 'button_reply' | 'list_reply' | string;
    button_reply?: MetaInteractiveButtonReply;
    list_reply?: MetaInteractiveListReply;
}
interface MetaMessage {
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    interactive?: MetaInteractive;
}
interface MetaWebhookValue {
    messages?: MetaMessage[];
}
/**
 * Parse a Meta Cloud API webhook value object and extract a QuickReplyEvent
 * if the first message is an interactive button_reply or list_reply.
 *
 * Returns `null` for any non-interactive message or unsupported interactive type.
 */
export declare function parseQuickReplyEvent(webhookValue: MetaWebhookValue): QuickReplyEvent | null;
export {};
//# sourceMappingURL=quick-reply-handler.d.ts.map