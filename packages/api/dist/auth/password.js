import bcrypt from 'bcryptjs';
const ROUNDS = process.env.NODE_ENV === 'production' ? 10 : 12;
/**
 * Returns true if the password meets all criteria:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export function validatePassword(password) {
    if (password.length < 8)
        return false;
    if (!/[A-Z]/.test(password))
        return false;
    if (!/[a-z]/.test(password))
        return false;
    if (!/[0-9]/.test(password))
        return false;
    return true;
}
export async function hashPassword(password) {
    return bcrypt.hash(password, ROUNDS);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
//# sourceMappingURL=password.js.map