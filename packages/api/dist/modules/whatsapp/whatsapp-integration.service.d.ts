export interface WhatsAppCredentials {
    wabaId: string;
    phoneNumberId: string;
    accessToken: string;
    webhookVerifyToken: string;
}
export interface WhatsAppIntegration {
    id: string;
    businessId: string;
    wabaId: string;
    phoneNumberId: string;
    accessToken: string;
    webhookVerifyToken: string;
    status: 'active' | 'inactive' | 'error';
    errorMessage: string | null;
    displayPhoneNumber?: string;
    verifiedName?: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Store or replace WhatsApp credentials for a business.
 * The access token is encrypted at rest using AES-256-GCM.
 */
export declare function storeCredentials(businessId: string, wabaId: string, phoneNumberId: string, accessToken: string, webhookVerifyToken: string, displayPhoneNumber?: string, verifiedName?: string): Promise<WhatsAppIntegration>;
/**
 * Retrieve decrypted WhatsApp credentials for a business.
 * Returns null if no integration exists.
 */
export declare function getCredentials(businessId: string): Promise<WhatsAppIntegration | null>;
/**
 * Update one or more credential fields for an existing integration.
 * Only provided fields are updated; the access token is re-encrypted if supplied.
 */
export declare function updateCredentials(businessId: string, updates: Partial<Omit<WhatsAppCredentials, 'webhookVerifyToken'> & {
    webhookVerifyToken?: string;
}>): Promise<WhatsAppIntegration>;
/**
 * Update the integration status (and optional error message).
 */
export declare function updateStatus(businessId: string, status: 'active' | 'inactive' | 'error', errorMessage?: string | null): Promise<void>;
/**
 * Delete the WhatsApp integration record for a business.
 */
export declare function deleteCredentials(businessId: string): Promise<void>;
export interface RegisterWebhookResult {
    success: boolean;
    errorMessage?: string;
}
export interface DeregisterWebhookResult {
    success: boolean;
    errorMessage?: string;
}
/**
 * Register a phone number for Cloud API messaging.
 * Required after embedded signup — without this Meta returns #133010.
 */
export declare function registerPhoneNumber(businessId: string): Promise<{
    success: boolean;
    errorMessage?: string;
}>;
/**
 * Register a webhook subscription with the Meta Cloud API for the given business.
 *
 * Sequence:
 *  1. Load stored credentials for the business.
 *  2. POST to Meta Graph API /subscribed_apps with the callback URL and verify token.
 *  3. Meta will send a GET hub.challenge to the Webhook_Receiver; the receiver responds
 *     with the challenge value, completing verification.
 *  4. On success: set status = 'active' and record registered_at.
 *  5. On failure: set status = 'error' with a descriptive error_message, but RETAIN credentials.
 *
 * Req 4.2 — verify within 30 seconds.
 * Req 4.3 — retain credentials on failure, return descriptive error.
 * Req 4.4 — set status = 'active' on success.
 */
export declare function registerWebhook(businessId: string): Promise<RegisterWebhookResult>;
/**
 * Deregister the webhook subscription with the Meta Cloud API for the given business.
 *
 * Sequence:
 *  1. Load stored credentials for the business.
 *  2. DELETE https://graph.facebook.com/{version}/{wabaId}/subscribed_apps
 *  3. On success: set status = 'inactive' and clear registered_at.
 *  4. On failure: set status = 'error' with a descriptive error_message, but RETAIN credentials.
 *
 * Req 4.6 — deregister within 60 seconds.
 */
export declare function deregisterWebhook(businessId: string): Promise<DeregisterWebhookResult>;
export interface ExchangeTokenResult {
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName: string;
    webhookStatus: 'active' | 'pending';
    webhookError: string | null;
}
/**
 * Exchange a short-lived Embedded Signup code for a long-lived access token,
 * then discover the WABA ID and Phone Number ID from the token's granted scopes.
 * Stores credentials and registers the webhook in one shot.
 */
export declare function exchangeEmbeddedSignupCode(businessId: string, code: string): Promise<ExchangeTokenResult>;
//# sourceMappingURL=whatsapp-integration.service.d.ts.map