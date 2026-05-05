import { sendEmail } from '../modules/notification/notification.service.js';
import { config } from '../config.js';

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${config.frontendUrl}/verify-email?token=${token}`;
  await sendEmail(
    email,
    'Verify your Augustus account',
    `<h2>Welcome to Augustus!</h2><p>Click <a href="${link}">here</a> to verify your email address.</p><p>This link expires in 24 hours.</p>`,
    `Welcome to Augustus!\n\nVerify your email: ${link}\n\nThis link expires in 24 hours.`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${config.frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    email,
    'Reset your Augustus password',
    `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a202c;">
  <h2 style="margin-bottom:8px;">Reset your password</h2>
  <p>We received a request to reset the password for your Augustus account.</p>
  <p>Click the button below to choose a new password. This link expires in <strong>60 minutes</strong>.</p>
  <p style="margin:24px 0;">
    <a href="${link}" style="background:#3182ce;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a>
  </p>
  <p style="font-size:13px;color:#718096;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="font-size:13px;word-break:break-all;color:#3182ce;">${link}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
  <p style="font-size:12px;color:#a0aec0;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
</body>
</html>`,
    `Reset your Augustus password\n\nClick the link below to reset your password (expires in 60 minutes):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
  );
}

export async function sendLockoutEmail(email: string, unlockAt: Date): Promise<void> {
  await sendEmail(
    email,
    'Augustus account temporarily locked',
    `<h2>Account Locked</h2><p>Your account has been locked due to 5 failed login attempts.</p><p>It will unlock at ${unlockAt.toUTCString()}.</p>`,
    `Your Augustus account has been locked due to 5 failed login attempts. It will unlock at ${unlockAt.toUTCString()}.`,
  );
}

export async function sendSubscriptionRenewalReminder(
  email: string,
  renewalDate: Date,
  daysUntil: number,
): Promise<void> {
  const dateStr = renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  await sendEmail(
    email,
    `Your Augustus subscription renews in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    `<h2>Subscription Renewal Reminder</h2><p>Your plan renews on <strong>${dateStr}</strong> (${daysUntil} day${daysUntil === 1 ? '' : 's'} away).</p><p>Please ensure your Paynow payment details are up to date to avoid service interruption.</p>`,
    `Your Augustus subscription renews on ${dateStr} (${daysUntil} day${daysUntil === 1 ? '' : 's'} away). Ensure your Paynow details are current.`,
  );
}

export async function sendPaymentFailedEmail(email: string, retryAt: Date): Promise<void> {
  const retryStr = retryAt.toLocaleString('en-US');
  await sendEmail(
    email,
    'Augustus subscription payment failed',
    `<h2>Payment Failed</h2><p>Your subscription payment could not be processed.</p><p>We will retry on <strong>${retryStr}</strong>. Please ensure your Paynow account has sufficient funds.</p>`,
    `Your Augustus subscription payment failed. We will retry on ${retryStr}.`,
  );
}

export async function sendSubscriptionSuspendedEmail(email: string): Promise<void> {
  await sendEmail(
    email,
    'Your Augustus subscription has been suspended',
    `<h2>Subscription Suspended</h2><p>Your Augustus subscription has been suspended due to a failed payment.</p><p>Please log in and renew your subscription to restore access to the AI Sales Agent.</p>`,
    `Your Augustus subscription has been suspended. Please log in to renew and restore access.`,
  );
}

export async function sendSubscriptionActivatedEmail(
  email: string,
  plan: string,
  renewalDate: Date,
): Promise<void> {
  const dateStr = renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  await sendEmail(
    email,
    `Your Augustus ${planLabel} subscription is now active`,
    `<h2>Subscription Activated</h2><p>Your <strong>${planLabel}</strong> plan is now active.</p><p>Your next renewal date is <strong>${dateStr}</strong>.</p><p>The AI Sales Agent is ready to start handling your WhatsApp conversations.</p>`,
    `Your Augustus ${planLabel} subscription is now active. Next renewal: ${dateStr}.`,
  );
}

export async function sendBudgetAlert80Email(
  email: string,
  usagePct: number,
  capUsd: number,
): Promise<void> {
  await sendEmail(
    email,
    `Augustus usage alert: ${usagePct.toFixed(0)}% of your monthly AI budget used`,
    `<h2>Usage Alert — 80%</h2><p>You have consumed <strong>${usagePct.toFixed(1)}%</strong> of your monthly AI budget (cap: $${capUsd.toFixed(2)}).</p><p>If usage reaches 100%, AI responses will be suspended until your next billing cycle. Consider upgrading your plan.</p>`,
    `Augustus usage alert: You have used ${usagePct.toFixed(1)}% of your $${capUsd.toFixed(2)} monthly AI budget. At 100% the AI agent will be suspended.`,
  );
}

export async function sendBudgetAlert95Email(
  email: string,
  usagePct: number,
  capUsd: number,
): Promise<void> {
  await sendEmail(
    email,
    `Augustus urgent alert: ${usagePct.toFixed(0)}% of your monthly AI budget used`,
    `<h2>Urgent Usage Alert — 95%</h2><p>You have consumed <strong>${usagePct.toFixed(1)}%</strong> of your monthly AI budget (cap: $${capUsd.toFixed(2)}).</p><p><strong>Action required:</strong> Upgrade your plan now to avoid AI service suspension.</p>`,
    `URGENT: You have used ${usagePct.toFixed(1)}% of your $${capUsd.toFixed(2)} monthly AI budget. Upgrade now to avoid suspension.`,
  );
}
