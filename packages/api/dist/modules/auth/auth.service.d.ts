/**
 * Returns true only if the password meets all criteria:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export declare function validatePassword(password: string): boolean;
export declare function registerBusiness(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password: string;
}): Promise<{
    id: string;
    email: string;
}>;
export declare function verifyEmail(token: string): Promise<string>;
export declare function login(email: string, password: string): Promise<{
    token: string;
    expiresAt: Date;
}>;
export declare function requestPasswordReset(email: string): Promise<void>;
export declare function resetPassword(token: string, newPassword: string): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map