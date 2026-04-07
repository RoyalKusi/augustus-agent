import { sendEmail } from '../modules/notification/notification.service.js';
import { config } from '../config.js';
export async function sendVerificationEmail(email, token) {
    const link = `${config.frontendUrl}/verify-email?token=${token}`;
    await sendEmail(email, 'Verify your Augustus account', `<h2>Welcome to Augustus!</h2><p>Click <a href="${link}">here</a> to verify your email address.</p><p>This link expires in 24 hours.</p>`, `Welcome to Augustus!\n\nVerify your email: ${link}\n\nThis link expires in 24 hours.`);
}
export async function sendPasswordResetEmail(email, token) {
    const link = `${config.frontendUrl}/reset-password?token=${token}`;
    await sendEmail(email, 'Reset your Augustus password', `<h2>Password Reset</h2><p>Click <a href="${link}">here</a> to reset your password.</p><p>This link expires in 60 minutes.</p>`, `Reset your Augustus password:\n\n${link}\n\nThis link expires in 60 minutes.`);
}
export async function sendLockoutEmail(email, unlockAt) {
    await sendEmail(email, 'Augustus account temporarily locked', `<h2>Account Locked</h2><p>Your account has been locked due to 5 failed login attempts.</p><p>It will unlock at ${unlockAt.toUTCString()}.</p>`, `Your Augustus account has been locked due to 5 failed login attempts. It will unlock at ${unlockAt.toUTCString()}.`);
}
export async function sendSubscriptionRenewalReminder(email, renewalDate, daysUntil) {
    const dateStr = renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    await sendEmail(email, `Your Augustus subscription renews in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`, `<h2>Subscription Renewal Reminder</h2><p>Your plan renews on <strong>${dateStr}</strong> (${daysUntil} day${daysUntil === 1 ? '' : 's'} away).</p><p>Please ensure your Paynow payment details are up to date to avoid service interruption.</p>`, `Your Augustus subscription renews on ${dateStr} (${daysUntil} day${daysUntil === 1 ? '' : 's'} away). Ensure your Paynow details are current.`);
}
export async function sendPaymentFailedEmail(email, retryAt) {
    const retryStr = retryAt.toLocaleString('en-US');
    await sendEmail(email, 'Augustus subscription payment failed', `<h2>Payment Failed</h2><p>Your subscription payment could not be processed.</p><p>We will retry on <strong>${retryStr}</strong>. Please ensure your Paynow account has sufficient funds.</p>`, `Your Augustus subscription payment failed. We will retry on ${retryStr}.`);
}
export async function sendSubscriptionSuspendedEmail(email) {
    await sendEmail(email, 'Your Augustus subscription has been suspended', `<h2>Subscription Suspended</h2><p>Your Augustus subscription has been suspended due to a failed payment.</p><p>Please log in and renew your subscription to restore access to the AI Sales Agent.</p>`, `Your Augustus subscription has been suspended. Please log in to renew and restore access.`);
}
export async function sendSubscriptionActivatedEmail(email, plan, renewalDate) {
    const dateStr = renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    await sendEmail(email, `Your Augustus ${planLabel} subscription is now active`, `<h2>Subscription Activated</h2><p>Your <strong>${planLabel}</strong> plan is now active.</p><p>Your next renewal date is <strong>${dateStr}</strong>.</p><p>The AI Sales Agent is ready to start handling your WhatsApp conversations.</p>`, `Your Augustus ${planLabel} subscription is now active. Next renewal: ${dateStr}.`);
}
export async function sendBudgetAlert80Email(email, usagePct, capUsd) {
    await sendEmail(email, `Augustus usage alert: ${usagePct.toFixed(0)}% of your monthly AI budget used`, `<h2>Usage Alert — 80%</h2><p>You have consumed <strong>${usagePct.toFixed(1)}%</strong> of your monthly AI budget (cap: $${capUsd.toFixed(2)}).</p><p>If usage reaches 100%, AI responses will be suspended until your next billing cycle. Consider upgrading your plan.</p>`, `Augustus usage alert: You have used ${usagePct.toFixed(1)}% of your $${capUsd.toFixed(2)} monthly AI budget. At 100% the AI agent will be suspended.`);
}
export async function sendBudgetAlert95Email(email, usagePct, capUsd) {
    await sendEmail(email, `Augustus urgent alert: ${usagePct.toFixed(0)}% of your monthly AI budget used`, `<h2>Urgent Usage Alert — 95%</h2><p>You have consumed <strong>${usagePct.toFixed(1)}%</strong> of your monthly AI budget (cap: $${capUsd.toFixed(2)}).</p><p><strong>Action required:</strong> Upgrade your plan now to avoid AI service suspension.</p>`, `URGENT: You have used ${usagePct.toFixed(1)}% of your $${capUsd.toFixed(2)} monthly AI budget. Upgrade now to avoid suspension.`);
}
//# sourceMappingURL=notification.stub.js.map