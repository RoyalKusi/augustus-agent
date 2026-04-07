export declare function generateEmailVerificationToken(): string;
export declare function generatePasswordResetToken(): string;
export declare function storeEmailVerificationToken(businessId: string, token: string): Promise<void>;
export declare function getEmailVerificationToken(token: string): Promise<string | null>;
export declare function deleteEmailVerificationToken(token: string): Promise<void>;
export declare function storePasswordResetToken(businessId: string, token: string): Promise<void>;
export declare function getPasswordResetToken(token: string): Promise<string | null>;
export declare function deletePasswordResetToken(token: string): Promise<void>;
//# sourceMappingURL=tokens.d.ts.map