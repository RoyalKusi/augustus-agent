/**
 * Outbound message dispatcher for the WhatsApp_Integration_Service.
 *
 * Supports: text, image, document/PDF, interactive carousel,
 *           quick-reply buttons, and payment links.
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 */
export type TextMessage = {
    type: 'text';
    to: string;
    body: string;
};
export type ImageMessage = {
    type: 'image';
    to: string;
    url: string;
    caption?: string;
};
export type DocumentMessage = {
    type: 'document';
    to: string;
    url: string;
    filename: string;
    caption?: string;
};
export type PaymentLinkMessage = {
    type: 'payment_link';
    to: string;
    body: string;
    paymentUrl: string;
};
export type QuickReplyMessage = {
    type: 'quick_reply';
    to: string;
    body: string;
    buttons: Array<{
        id: string;
        title: string;
    }>;
};
export type CarouselProduct = {
    id: string;
    name: string;
    price: number;
    currency: string;
    imageUrl: string;
};
/** Req 6.2: at least 1 and at most 10 products */
export type CarouselMessage = {
    type: 'carousel';
    to: string;
    products: CarouselProduct[];
};
export type OutboundMessage = TextMessage | ImageMessage | DocumentMessage | PaymentLinkMessage | QuickReplyMessage | CarouselMessage;
export interface SendMessageResult {
    success: boolean;
    messageId?: string;
    errorMessage?: string;
}
export interface SendMediaWithFallbackResult {
    success: boolean;
    messageId?: string;
    usedFallback: boolean;
    errorMessage?: string;
}
/**
 * Send an outbound WhatsApp message on behalf of a business.
 *
 * 1. Loads credentials for the business.
 * 2. Builds the appropriate Meta Cloud API payload.
 * 3. POSTs to https://graph.facebook.com/{version}/{phoneNumberId}/messages.
 * 4. Returns { success, messageId } or { success: false, errorMessage }.
 */
export declare function sendMessage(businessId: string, message: OutboundMessage): Promise<SendMessageResult>;
/**
 * Send a media message (image or document) with automatic text fallback.
 *
 * If `fileSizeBytes` is provided and exceeds 16 MB, sends `textFallback` as a
 * plain text message instead of attempting to upload the oversized file.
 *
 * Validates: Requirements 6.5 / Property 20
 */
export declare function sendMediaWithFallback(businessId: string, mediaMsg: ImageMessage | DocumentMessage, textFallback: string, fileSizeBytes?: number): Promise<SendMediaWithFallbackResult>;
//# sourceMappingURL=message-dispatcher.d.ts.map