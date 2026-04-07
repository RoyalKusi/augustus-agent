/**
 * Returns true if the password meets all criteria:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export declare function validatePassword(password: string): boolean;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
//# sourceMappingURL=password.d.ts.map