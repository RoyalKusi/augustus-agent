import { pool } from '../db/client.js';
import { sendEmail } from '../notifications/email.js';
import { validatePassword, hashPassword, verifyPassword } from './password.js';
import { generateEmailVerificationToken, generatePasswordResetToken, storeEmailVerificationToken, getEmailVerificationToken, deleteEmailVerificationToken, storePasswordResetToken, getPasswordResetToken, deletePasswordResetToken, } from './tokens.js';
import { signToken } from './jwt.js';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
export class AuthService {
    async register(data) {
        const { businessName, ownerName, email, password } = data;
        if (!validatePassword(password)) {
            const err = new Error('Password must be at least 8 characters with uppercase, lowercase, and digit.');
            err.statusCode = 400;
            throw err;
        }
        let businessId;
        try {
            const result = await pool.query(`INSERT INTO businesses (name, owner_name, email, password_hash, status)
         VALUES ($1, $2, $3, $4, 'pending_verification')
         RETURNING id`, [businessName, ownerName, email.toLowerCase().trim(), await hashPassword(password)]);
            businessId = result.rows[0].id;
            await pool.query(`INSERT INTO revenue_balances (business_id, available_usd, lifetime_usd)
         VALUES ($1, 0, 0)`, [businessId]);
        }
        catch (err) {
            if (isUniqueViolation(err)) {
                const e = new Error('Email already registered.');
                e.statusCode = 400;
                throw e;
            }
            throw err;
        }
        const token = generateEmailVerificationToken();
        await storeEmailVerificationToken(businessId, token);
        await sendEmail(email, 'Verify your Augustus account', `<p>Click <a href="https://app.augustus.ai/verify-email?token=${token}">here</a> to verify your email.</p>`);
        return { businessId };
    }
    async verifyEmail(token) {
        const businessId = await getEmailVerificationToken(token);
        if (!businessId) {
            throw Object.assign(new Error('Invalid or expired verification token.'), { statusCode: 400 });
        }
        await pool.query(`UPDATE businesses SET email_verified = TRUE, status = 'active', updated_at = NOW() WHERE id = $1`, [businessId]);
        await deleteEmailVerificationToken(token);
    }
    async login(email, password) {
        const result = await pool.query(`SELECT id, password_hash, email, failed_login_attempts, locked_until
       FROM businesses WHERE email = $1`, [email.toLowerCase().trim()]);
        const business = result.rows[0];
        if (!business) {
            // Constant-time path to prevent enumeration
            await verifyPassword(password, '$2a$12$invalidhashpadding000000000000000000000000000000000000');
            throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
        }
        if (business.locked_until && new Date(business.locked_until) > new Date()) {
            throw Object.assign(new Error('Account locked.'), { statusCode: 401 });
        }
        const match = await verifyPassword(password, business.password_hash);
        if (!match) {
            await this._handleFailedLogin(business.id, business.failed_login_attempts, email);
            throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
        }
        await pool.query(`UPDATE businesses SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`, [business.id]);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const token = signToken({ businessId: business.id, email: business.email });
        return { token, expiresAt };
    }
    async requestPasswordReset(email) {
        const result = await pool.query(`SELECT id FROM businesses WHERE email = $1`, [email.toLowerCase().trim()]);
        if (result.rows.length === 0)
            return; // silent — no enumeration
        const businessId = result.rows[0].id;
        const token = generatePasswordResetToken();
        await storePasswordResetToken(businessId, token);
        await sendEmail(email, 'Reset your Augustus password', `<p>Click <a href="https://app.augustus.ai/reset-password?token=${token}">here</a> to reset your password. Link expires in 60 minutes.</p>`);
    }
    async resetPassword(token, newPassword) {
        if (!validatePassword(newPassword)) {
            throw Object.assign(new Error('Password must be at least 8 characters with uppercase, lowercase, and digit.'), { statusCode: 400 });
        }
        const businessId = await getPasswordResetToken(token);
        if (!businessId) {
            throw Object.assign(new Error('Invalid or expired reset token.'), { statusCode: 400 });
        }
        await pool.query(`UPDATE businesses SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [await hashPassword(newPassword), businessId]);
        await deletePasswordResetToken(token);
    }
    async _handleFailedLogin(businessId, currentAttempts, email) {
        const newAttempts = currentAttempts + 1;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
            await pool.query(`UPDATE businesses SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3`, [newAttempts, lockedUntil, businessId]);
            await sendEmail(email, 'Augustus account locked', `<p>Your account has been locked due to 5 failed login attempts. It will unlock at ${lockedUntil.toISOString()}.</p>`);
        }
        else {
            await pool.query(`UPDATE businesses SET failed_login_attempts = $1, updated_at = NOW() WHERE id = $2`, [newAttempts, businessId]);
        }
    }
}
function isUniqueViolation(err) {
    return (typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === '23505');
}
export const authService = new AuthService();
//# sourceMappingURL=service.js.map