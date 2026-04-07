export declare function sendVerificationEmail(email: string, token: string): Promise<void>;
export declare function sendPasswordResetEmail(email: string, token: string): Promise<void>;
export declare function sendLockoutEmail(email: string, unlockAt: Date): Promise<void>;
export declare function sendSubscriptionRenewalReminder(email: string, renewalDate: Date, daysUntil: number): Promise<void>;
export declare function sendPaymentFailedEmail(email: string, retryAt: Date): Promise<void>;
export declare function sendSubscriptionSuspendedEmail(email: string): Promise<void>;
export declare function sendSubscriptionActivatedEmail(email: string, plan: string, renewalDate: Date): Promise<void>;
export declare function sendBudgetAlert80Email(email: string, usagePct: number, capUsd: number): Promise<void>;
export declare function sendBudgetAlert95Email(email: string, usagePct: number, capUsd: number): Promise<void>;
//# sourceMappingURL=notification.stub.d.ts.map