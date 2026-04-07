import crypto from 'crypto';
import redis from '../redis/client.js';
const EMAIL_VERIFY_TTL = 86400; // 24 hours
const PWD_RESET_TTL = 3600; // 60 minutes
export function generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}
export function generatePasswordResetToken() {
    return crypto.randomBytes(32).toString('hex');
}
export async function storeEmailVerificationToken(businessId, token) {
    await redis.set(`email_verify:${token}`, businessId, 'EX', EMAIL_VERIFY_TTL);
}
export async function getEmailVerificationToken(token) {
    return redis.get(`email_verify:${token}`);
}
export async function deleteEmailVerificationToken(token) {
    await redis.del(`email_verify:${token}`);
}
export async function storePasswordResetToken(businessId, token) {
    await redis.set(`pwd_reset:${token}`, businessId, 'EX', PWD_RESET_TTL);
}
export async function getPasswordResetToken(token) {
    return redis.get(`pwd_reset:${token}`);
}
export async function deletePasswordResetToken(token) {
    await redis.del(`pwd_reset:${token}`);
}
//# sourceMappingURL=tokens.js.map