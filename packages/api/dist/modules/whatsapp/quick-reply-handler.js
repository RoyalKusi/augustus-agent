/**
 * Quick Reply event parser for the WhatsApp_Integration_Service.
 *
 * Parses inbound interactive reply events from the Meta Cloud API webhook
 * payload and routes the selected Quick_Reply payload as a structured input
 * to the Conversation Engine.
 *
 * Validates: Requirements 6.3
 */
// ── Parser ────────────────────────────────────────────────────────────────────
/**
 * Parse a Meta Cloud API webhook value object and extract a QuickReplyEvent
 * if the first message is an interactive button_reply or list_reply.
 *
 * Returns `null` for any non-interactive message or unsupported interactive type.
 */
export function parseQuickReplyEvent(webhookValue) {
    const message = webhookValue?.messages?.[0];
    if (!message)
        return null;
    if (message.type !== 'interactive')
        return null;
    const interactive = message.interactive;
    if (!interactive)
        return null;
    const from = message.from ?? '';
    const messageId = message.id ?? '';
    const timestamp = parseInt(message.timestamp ?? '0', 10);
    if (interactive.type === 'button_reply') {
        const reply = interactive.button_reply;
        if (!reply)
            return null;
        return {
            type: 'button_reply',
            from,
            messageId,
            buttonId: reply.id,
            buttonTitle: reply.title,
            timestamp,
        };
    }
    if (interactive.type === 'list_reply') {
        const reply = interactive.list_reply;
        if (!reply)
            return null;
        return {
            type: 'list_reply',
            from,
            messageId,
            buttonId: reply.id,
            buttonTitle: reply.title,
            timestamp,
        };
    }
    return null;
}
//# sourceMappingURL=quick-reply-handler.js.map