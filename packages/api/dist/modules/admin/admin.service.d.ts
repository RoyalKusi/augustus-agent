/**
 * Admin Dashboard Service
 * Requirements: 14, 15, 16, 17
 * Properties: 36, 37, 38
 */
export interface OperatorJwtPayload {
    operatorId: string;
    role: 'operator';
}
export declare function signOperatorToken(operatorId: string): string;
export declare function verifyOperatorToken(token: string): OperatorJwtPayload | null;
/**
 * Generate a random TOTP secret (base32-like hex string).
 */
export declare function generateTotpSecret(): string;
/**
 * Generate a TOTP QR code URL for enrollment.
 */
export declare function generateTotpQrUrl(email: string, secret: string): string;
/**
 * Simple TOTP verification stub.
 * Accepts a 6-digit code. In production, use otplib or speakeasy.
 * For testing: accepts any 6-digit numeric string as valid when secret is non-empty.
 * Real implementation would compute HOTP(secret, floor(time/30)).
 */
export declare function verifyTotp(secret: string, code: string): boolean;
export declare function operatorLogin(email: string, password: string, totpCode: string): Promise<{
    token: string;
} | {
    mfaRequired: true;
}>;
export declare function enrollMfa(operatorId: string): Promise<{
    secret: string;
    qrUrl: string;
}>;
export declare function verifyMfaEnrollment(operatorId: string, code: string): Promise<void>;
export interface BusinessListItem {
    id: string;
    name: string;
    email: string;
    status: string;
    plan: string | null;
    createdAt: string;
}
export declare function listBusinesses(filters: {
    search?: string;
    status?: string;
    plan?: string;
}): Promise<{
    businesses: BusinessListItem[];
    total: number;
}>;
export { canSuspend } from './admin.pure.js';
export declare function suspendBusiness(businessId: string, operatorId: string): Promise<void>;
export { canReactivate } from './admin.pure.js';
export declare function reactivateBusiness(businessId: string, operatorId: string): Promise<void>;
export declare function logAuditEvent(operatorId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>): Promise<void>;
export interface AiMetrics {
    totalTokens: number;
    totalCalls: number;
    totalCostUsd: number;
    perBusiness: Array<{
        businessId: string;
        businessName: string;
        tokens: number;
        calls: number;
        costUsd: number;
    }>;
}
export declare function getAiMetrics(): Promise<AiMetrics>;
export interface MetaMetrics {
    totalSent: number;
    totalReceived: number;
    perBusiness: Array<{
        businessId: string;
        businessName: string;
        sent: number;
        received: number;
    }>;
}
export declare function getMetaMetrics(): Promise<MetaMetrics>;
export { isPlatformCostAlertTriggered } from './admin.pure.js';
export interface PlatformCostMetrics {
    totalCostUsd: number;
    platformCapUsd: number;
    usagePercent: number;
    alertTriggered: boolean;
}
export declare function getPlatformCostMetrics(): Promise<PlatformCostMetrics>;
export declare function setTokenOverride(businessId: string, monthlyCapUsd: number, operatorId: string): Promise<void>;
export interface SubscriptionMetrics {
    perTier: {
        silver: {
            count: number;
            mrr: number;
        };
        gold: {
            count: number;
            mrr: number;
        };
        platinum: {
            count: number;
            mrr: number;
        };
    };
    totalMrr: number;
    churnCount: number;
    avgCreditUtilisationPercent: number;
}
export declare function getSubscriptionMetrics(): Promise<SubscriptionMetrics>;
export interface AdminWithdrawal {
    id: string;
    businessId: string;
    businessName: string;
    amountUsd: number;
    status: string;
    requestedAt: string;
    processedAt: string | null;
    paynowMerchantRef: string | null;
    paynowPayoutRef: string | null;
}
export declare function listPendingWithdrawals(): Promise<{
    withdrawals: AdminWithdrawal[];
}>;
export declare function listAllWithdrawals(): Promise<{
    withdrawals: AdminWithdrawal[];
}>;
export declare function approveWithdrawal(withdrawalId: string, operatorId: string): Promise<void>;
export declare function getBusinessDashboardView(businessId: string): Promise<Record<string, unknown>>;
export interface ApiKeyStatus {
    meta: {
        status: 'active' | 'expired' | 'error';
        reason: string | null;
        detail?: string | null;
    };
    paynow: {
        status: 'active' | 'error';
        reason: string | null;
        detail?: string | null;
    };
    claude: {
        status: 'active' | 'error';
        reason: string | null;
        detail?: string | null;
    };
}
export declare function getApiKeyStatus(): Promise<ApiKeyStatus>;
export interface AdminSupportTicket {
    id: string;
    businessId: string;
    businessName: string;
    businessEmail: string;
    reference: string;
    subject: string;
    description: string;
    attachmentUrl: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export declare function listAllSupportTickets(filters: {
    status?: string;
    search?: string;
}): Promise<{
    tickets: AdminSupportTicket[];
    total: number;
}>;
export declare function updateSupportTicketStatus(ticketId: string, newStatus: string, operatorId: string): Promise<AdminSupportTicket>;
//# sourceMappingURL=admin.service.d.ts.map