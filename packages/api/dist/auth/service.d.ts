export declare class AuthService {
    register(data: {
        businessName: string;
        ownerName: string;
        email: string;
        password: string;
    }): Promise<{
        businessId: string;
    }>;
    verifyEmail(token: string): Promise<void>;
    login(email: string, password: string): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    private _handleFailedLogin;
}
export declare const authService: AuthService;
//# sourceMappingURL=service.d.ts.map