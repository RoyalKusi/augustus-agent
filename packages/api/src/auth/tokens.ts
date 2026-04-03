import crypto from 'crypto';
import redis from '../redis/client.js';

const EMAIL_VERIFY_TTL = 86400; // 24 hours
const PWD_RESET_TTL = 3600;     // 60 minutes

export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function storeEmailVerificationToken(businessId: string, token: string): Promise<void> {
  await redis.set(`email_verify:${token}`, businessId, 'EX', EMAIL_VERIFY_TTL);
}

export async function getEmailVerificationToken(token: string): Promise<string | null> {
  return redis.get(`email_verify:${token}`);
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  await redis.del(`email_verify:${token}`);
}

export async function storePasswordResetToken(businessId: string, token: string): Promise<void> {
  await redis.set(`pwd_reset:${token}`, businessId, 'EX', PWD_RESET_TTL);
}

export async function getPasswordResetToken(token: string): Promise<string | null> {
  return redis.get(`pwd_reset:${token}`);
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await redis.del(`pwd_reset:${token}`);
}
