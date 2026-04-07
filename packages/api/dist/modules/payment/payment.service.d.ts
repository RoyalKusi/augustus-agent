/**
 * Payment Processor Service
 * Requirements: 7.1–7.6, 7.7, 7.8, 12.1–12.5, 17.5, 18.1–18.6
 * Properties: 21, 22, 23, 24, 33, 39, 40, 41, 42, 43, 44, 45
 */
export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}
export interface Order {
    id: string;
    businessId: string;
    conversationId: string | null;
    customerWaNumber: string;
    orderReference: string;
    totalAmount: number;
    currency: string;
    status: 'pending' | 'completed' | 'expired' | 'failed' | 'pending_external_payment';
    paynowLink: string | null;
    paynowReference: string | null;
    paynowPollUrl: string | null;
    createdAt: Date;
    completedAt: Date | null;
    expiresAt: Date | null;
    items: OrderItem[];
}
export interface RevenueBalance {
    businessId: string;
    availableUsd: number;
    lifetimeUsd: number;
    updatedAt: Date | null;
}
export interface WithdrawalRequest {
    id: string;
    businessId: string;
    amountUsd: number;
    status: 'pending' | 'processed' | 'failed';
    paynowMerchantRef: string | null;
    paynowPayoutRef: string | null;
    requestedAt: Date;
    processedAt: Date | null;
    approvedBy: string | null;
}
export interface PaynowLinkResult {
    success: boolean;
    paymentUrl: string | null;
    pollUrl: string | null;
    paynowReference: string | null;
    error?: string;
}
/**
 * Generate a Paynow payment link for a purchase.
 * Creates an order record with status='pending', expires_at = NOW() + 15 min.
 * Property 23: order has all 5 required fields.
 */
export declare function generatePaynowLink(businessId: string, customerWaNumber: string, items: OrderItem[], currency: string, conversationId?: string): Promise<{
    order: Order;
    paymentUrl: string;
}>;
/**
 * Initiate a Paynow payment and return the payment URL + poll URL.
 * Uses config.paynow credentials.
 */
export declare function initiatePaynowPayment(orderReference: string, email: string, amount: number, _currency: string, description: string): Promise<PaynowLinkResult>;
/**
 * Handle an inbound Paynow payment status webhook.
 * On confirmed payment: dispatch receipt, update revenue, decrement stock.
 */
export declare function handlePaynowWebhook(payload: Record<string, string>): Promise<void>;
/**
 * Poll Paynow for the status of an order.
 * Fallback for when webhooks are not received.
 * Uses the stored paynow_poll_url from the order record.
 */
export declare function pollPaynowStatus(orderId: string): Promise<void>;
/**
 * Send a WhatsApp receipt message to the customer.
 * Property 21: receipt must contain order_reference, items, total_amount, timestamp.
 */
export declare function dispatchReceipt(businessId: string, customerWaNumber: string, orderReference: string, items: OrderItem[], totalAmount: number, currency: string, timestamp: Date): Promise<void>;
/**
 * Mark expired orders and notify customers.
 * Property 22: order status = 'expired' after 15 minutes.
 */
export declare function expireStaleOrders(): Promise<void>;
/**
 * Check and expire a single order if past its expiry time.
 * Returns true if the order was expired.
 */
export declare function expireOrderIfStale(orderId: string): Promise<boolean>;
/**
 * Confirm a payment: update order status, dispatch receipt,
 * decrement stock (Property 24), update revenue balance (Task 9.7).
 * Property 23: transaction record has all 5 fields.
 */
export declare function confirmPayment(orderId: string, paynowReference: string): Promise<void>;
export declare function getRevenueBalance(businessId: string): Promise<RevenueBalance | null>;
/**
 * Create a withdrawal request.
 * Property 33: if amount > available balance, reject with current balance.
 */
export declare function createWithdrawalRequest(businessId: string, amountUsd: number, paynowMerchantRef: string): Promise<{
    withdrawal: WithdrawalRequest;
    autoProcessed: boolean;
}>;
/**
 * Initiate a Paynow payout for an approved withdrawal.
 * Updates withdrawal status to 'processed' with paynow_payout_ref.
 */
export declare function processWithdrawal(withdrawalId: string, approvedBy: string | null): Promise<WithdrawalRequest>;
/**
 * Returns the configured auto-withdrawal threshold.
 */
export declare function getAutoWithdrawalThreshold(): number;
/**
 * Returns true if the given amount should be auto-processed.
 * Property 39: strictly below threshold → auto-processed.
 */
export declare function shouldAutoProcess(amountUsd: number): boolean;
export declare function getOrderWithItems(orderId: string): Promise<Order | null>;
export interface PaymentSettings {
    inChatPaymentsEnabled: boolean;
    externalPaymentDetails: Record<string, string> | null;
}
/**
 * Returns true if details has at least one non-null, non-empty entry.
 * Property 42: disabling requires valid external details.
 */
export declare function isExternalDetailsValid(details: Record<string, unknown> | null | undefined): boolean;
/**
 * Get payment settings for a business.
 */
export declare function getPaymentSettings(businessId: string): Promise<PaymentSettings>;
/**
 * Update payment settings for a business.
 * Validates: if inChatPaymentsEnabled = false, externalPaymentDetails must have
 * at least one non-null, non-empty entry.
 */
export declare function updatePaymentSettings(businessId: string, settings: PaymentSettings): Promise<PaymentSettings>;
/**
 * Build a PaymentSettings response object from raw values.
 * Property 44: round-trip — stored and retrieved values are identical.
 */
export declare function buildPaymentSettingsResponse(enabled: boolean, details: Record<string, string> | null): PaymentSettings;
export interface InvoiceMessage {
    orderReference: string;
    items: OrderItem[];
    totalAmount: number;
    currency: string;
    externalPaymentDetails: Record<string, string>;
}
/**
 * Build a WhatsApp invoice text message for external payment flow.
 * Property 41: invoice contains order reference, items, total amount,
 *              and at least one external payment detail entry.
 * Property 45: invoice does NOT contain a Paynow URL.
 */
export declare function buildInvoiceMessage(invoice: InvoiceMessage): string;
/**
 * Determine the order flow based on in_chat_payments_enabled flag.
 * Property 40: when disabled, paynowLink is null.
 * Property 43: toggle applies immediately.
 */
export declare function determineOrderFlow(inChatPaymentsEnabled: boolean): {
    usePaynow: boolean;
    paynowLink: string | null;
};
//# sourceMappingURL=payment.service.d.ts.map