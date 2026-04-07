export { whatsappIntegrationRoutes } from './whatsapp-integration.routes.js';
export { storeCredentials, getCredentials, updateCredentials, updateStatus, deleteCredentials, registerWebhook, deregisterWebhook, } from './whatsapp-integration.service.js';
export type { WhatsAppCredentials, WhatsAppIntegration, RegisterWebhookResult, DeregisterWebhookResult } from './whatsapp-integration.service.js';
export { sendMessage, sendMediaWithFallback } from './message-dispatcher.js';
export { parseQuickReplyEvent } from './quick-reply-handler.js';
export type { QuickReplyEvent } from './quick-reply-handler.js';
export type { OutboundMessage, TextMessage, ImageMessage, DocumentMessage, PaymentLinkMessage, QuickReplyMessage, CarouselProduct, CarouselMessage, SendMessageResult, SendMediaWithFallbackResult, } from './message-dispatcher.js';
//# sourceMappingURL=index.d.ts.map