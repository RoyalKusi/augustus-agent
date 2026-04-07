/**
 * Business Dashboard Service
 * Requirements: 2.9, 3.7, 8.1, 11.1–11.4, 12.5, 13.1–13.4
 * Properties: 30, 31, 32, 34, 35
 */
/**
 * Mask a WhatsApp number to show only the last 4 characters.
 * Property 30: always returns ****{last4}
 */
export declare function maskWaNumber(waNumber: string): string;
/**
 * Generate a unique support ticket reference.
 * Property 35: format TKT-{timestamp}-{random}
 */
export declare function generateTicketReference(): string;
/**
 * Check if a ticket reference is unique among existing references.
 * Property 35: returns false if ref is already in existingRefs
 */
export declare function isTicketReferenceUnique(ref: string, existingRefs: string[]): boolean;
export interface SubscriptionOverview {
    planName: string;
    renewalDate: string | null;
    creditUsageUsd: number;
    creditCapUsd: number;
    creditUsagePercent: number;
}
export declare function getSubscriptionOverview(businessId: string): Promise<SubscriptionOverview>;
export interface CreditUsage {
    currentCostUsd: number;
    monthlyCap: number;
    usagePercent: number;
    status: 'active' | 'suspended';
}
export declare function getCreditUsage(businessId: string): Promise<CreditUsage>;
export interface ConversationSummary {
    id: string;
    customerWaNumber: string;
    status: string;
    messageCount: number;
    manualInterventionActive: boolean;
    sessionStart: string;
}
export declare function getActiveConversations(businessId: string): Promise<{
    conversations: ConversationSummary[];
}>;
export interface OrderSummaryItem {
    id: string;
    orderReference: string;
    customerWaNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
}
export interface OrdersFilter {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    productName?: string;
}
export declare function getOrdersSummary(businessId: string, filters?: OrdersFilter): Promise<{
    orders: OrderSummaryItem[];
    total: number;
}>;
export interface RevenueSummary {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    currency: string;
}
export declare function getRevenueSummary(businessId: string): Promise<RevenueSummary>;
export declare function getOrdersCsv(businessId: string): Promise<string>;
export interface WithdrawalHistoryItem {
    id: string;
    amountUsd: number;
    status: string;
    requestedAt: string;
    processedAt: string | null;
    reference: string | null;
}
export declare function getWithdrawalHistory(businessId: string): Promise<{
    withdrawals: WithdrawalHistoryItem[];
}>;
export declare function updateOrderStatus(businessId: string, orderId: string, newStatus: string): Promise<OrderSummaryItem>;
export interface SupportTicket {
    id: string;
    businessId: string;
    reference: string;
    subject: string;
    description: string;
    attachmentUrl: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export declare function createSupportTicket(businessId: string, subject: string, description: string, attachmentUrl?: string): Promise<SupportTicket>;
export declare function updateSupportTicketStatus(businessId: string, ticketId: string, newStatus: string): Promise<SupportTicket>;
export declare function listSupportTickets(businessId: string): Promise<{
    tickets: SupportTicket[];
}>;
//# sourceMappingURL=dashboard.service.d.ts.map