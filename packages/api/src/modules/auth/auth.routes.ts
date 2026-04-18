import type { FastifyInstance } from 'fastify';
import {
  registerBusiness,
  verifyEmail,
  login,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';
import { deleteSession } from '../../redis/session.js';
import { config } from '../../config.js';
import { pool } from '../../db/client.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register
  app.post('/auth/register', async (request, reply) => {
    const { businessName, ownerName, email, password, referralCode } = request.body as {
      businessName: string;
      ownerName: string;
      email: string;
      password: string;
      referralCode?: string;
    };

    try {
      const result = await registerBusiness({ businessName, ownerName, email, password });

      // Record referral if a valid code was provided
      if (referralCode) {
        try {
          const referrer = await pool.query<{ id: string }>(
            `SELECT id FROM businesses WHERE referral_code = $1 AND referral_enabled = TRUE`,
            [referralCode.toUpperCase().trim()],
          );
          if (referrer.rows[0]) {
            await pool.query(
              `INSERT INTO referrals (referrer_id, referred_id, referred_email, referred_name)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (referred_id) DO NOTHING`,
              [referrer.rows[0].id, result.id, email.toLowerCase().trim(), businessName],
            );
          }
        } catch { /* non-fatal — don't fail registration over referral tracking */ }
      }

      return reply.status(201).send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      const status = message.includes('already exists') ? 409 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  // POST /auth/verify-email
  app.post('/auth/verify-email', async (request, reply) => {
    const { token } = request.body as { token: string };

    try {
      const businessId = await verifyEmail(token);
      return reply.send({ message: 'Email verified successfully.', businessId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /auth/verify-email?token=... — clickable link from email
  // Verifies the token and redirects to the frontend login page
  app.get('/auth/verify-email', async (request, reply) => {
    const { token } = request.query as { token?: string };
    const frontendUrl = config.frontendUrl;

    if (!token) {
      return reply.redirect(`${frontendUrl}/login?verified=error&reason=missing_token`);
    }

    try {
      await verifyEmail(token);
      return reply.redirect(`${frontendUrl}/login?verified=true`);
    } catch {
      return reply.redirect(`${frontendUrl}/login?verified=error&reason=invalid_token`);
    }
  });

  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    try {
      const result = await login(email, password);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      const status = message.includes('locked') ? 403 : 401;
      return reply.status(status).send({ error: message });
    }
  });

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      await deleteSession(token);
    }

    return reply.send({ message: 'Logged out successfully.' });
  });

  // POST /auth/request-password-reset
  app.post('/auth/request-password-reset', async (request, reply) => {
    const { email } = request.body as { email: string };

    // Always return success to avoid email enumeration
    await requestPasswordReset(email).catch(() => {/* swallow errors */});
    return reply.send({ message: 'If an account with that email exists, a reset link has been sent.' });
  });

  // POST /auth/reset-password
  app.post('/auth/reset-password', async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };

    try {
      await resetPassword(token, newPassword);
      return reply.send({ message: 'Password reset successfully.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed.';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /auth/reset-password?token=... — clickable link from email
  app.get('/auth/reset-password', async (request, reply) => {
    const { token } = request.query as { token?: string };
    const frontendUrl = config.frontendUrl;
    if (!token) {
      return reply.redirect(`${frontendUrl}/login`);
    }
    return reply.redirect(`${frontendUrl}/reset-password?token=${token}`);
  });
}
