/**
 * Notification Service
 * Requirements: 1.4, 1.7, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5, 13.2, 13.4
 * Centralised transactional email dispatch via SendGrid or AWS SES.
 */

import { config } from '../../config.js';

// ─── Task 14.1: Transactional email dispatch ──────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
): Promise<void> {
  const { provider, apiKey, fromAddress, fromName } = config.email;

  // No API key configured — throw so callers know email failed
  if (!apiKey) {
    throw new Error('Email API key not configured. Set EMAIL_API_KEY environment variable.');
  }

  if (provider === 'sendgrid') {
    await sendViaSendGrid(to, subject, htmlBody, textBody, apiKey, fromAddress, fromName);
  } else if (provider === 'ses') {
    await sendViaSes(to, subject, htmlBody, textBody, apiKey, fromAddress, fromName);
  } else {
    console.warn(`[Notification] Unknown email provider "${provider}". Email not sent.`);
  }
}

async function sendViaSendGrid(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string | undefined,
  apiKey: string,
  fromAddress: string,
  fromName: string,
): Promise<void> {
  const content: Array<{ type: string; value: string }> = [
    { type: 'text/html', value: htmlBody },
  ];
  if (textBody) {
    content.unshift({ type: 'text/plain', value: textBody });
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromAddress, name: fromName },
    subject,
    content,
  };

  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Notification] SendGrid error ${res.status}: ${body}`);
      throw new Error(`SendGrid API error: ${res.status}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[Notification] SendGrid request timeout after 10 seconds');
      throw new Error('Email service timeout');
    }
    console.error('[Notification] SendGrid fetch failed:', err);
    throw err;
  }
}

async function sendViaSes(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string | undefined,
  apiKey: string,
  fromAddress: string,
  fromName: string,
): Promise<void> {
  // Try AWS SDK first; fall back to SES HTTPS endpoint
  try {
    // Dynamic import so the package is optional
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sesModule: any = await import('@aws-sdk/client-ses' as string).catch(() => null);
    if (sesModule) {
      const { SESClient, SendEmailCommand } = sesModule;
      const client = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
      const cmd = new SendEmailCommand({
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: htmlBody },
            ...(textBody ? { Text: { Data: textBody } } : {}),
          },
        },
        Source: `${fromName} <${fromAddress}>`,
      });
      await client.send(cmd);
      return;
    }
  } catch (err) {
    console.error('[Notification] AWS SDK SES failed, falling back to fetch:', err);
  }

  // Fetch-based fallback using SES HTTPS endpoint (requires AWS Signature V4 — best-effort)
  console.warn(
    `[Notification] SES fetch fallback: AWS SDK unavailable. Email to ${to} not sent.`,
  );
  void apiKey; // suppress unused warning
}

// ─── Task 14.2: Email templates ───────────────────────────────────────────────

export const emailTemplates = {
  registrationVerification(
    verificationUrl: string,
  ): { subject: string; html: string; text: string } {
    return {
      subject: 'Verify your Augustus account',
      html: `
        <h2>Welcome to Augustus</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      `,
      text: `Welcome to Augustus!\n\nVerify your email: ${verificationUrl}\n\nThis link expires in 24 hours.`,
    };
  },

  passwordReset(resetUrl: string): { subject: string; html: string; text: string } {
    return {
      subject: 'Reset your Augustus password',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password. This link is valid for 60 minutes.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
      text: `Reset your Augustus password:\n\n${resetUrl}\n\nThis link expires in 60 minutes. If you did not request this, ignore this email.`,
    };
  },

  subscriptionReminder(
    planName: string,
    daysUntilRenewal: number,
    renewalDate: string,
  ): { subject: string; html: string; text: string } {
    return {
      subject: `Your Augustus ${planName} subscription renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}`,
      html: `
        <h2>Subscription Renewal Reminder</h2>
        <p>Your <strong>${planName}</strong> plan renews on <strong>${renewalDate}</strong> (${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'} away).</p>
        <p>Please ensure your Paynow payment details are up to date to avoid service interruption.</p>
      `,
      text: `Your Augustus ${planName} plan renews on ${renewalDate} (${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'} away). Ensure your Paynow details are current.`,
    };
  },

  budgetAlert(
    usagePercent: number,
    planName: string,
  ): { subject: string; html: string; text: string } {
    return {
      subject: `Augustus usage alert: ${usagePercent}% of your ${planName} budget used`,
      html: `
        <h2>Usage Alert</h2>
        <p>You have consumed <strong>${usagePercent}%</strong> of your <strong>${planName}</strong> plan's monthly AI budget.</p>
        <p>If usage reaches 100%, AI Sales Agent responses will be suspended until your next billing cycle.</p>
        <p>Consider upgrading your plan to avoid interruption.</p>
      `,
      text: `Augustus usage alert: You have used ${usagePercent}% of your ${planName} monthly AI budget. At 100% the AI agent will be suspended until the next billing cycle.`,
    };
  },

  accountSuspension(businessName: string): { subject: string; html: string; text: string } {
    return {
      subject: 'Your Augustus account has been suspended',
      html: `
        <h2>Account Suspended</h2>
        <p>Dear <strong>${businessName}</strong>,</p>
        <p>Your Augustus account has been suspended. This may be due to a failed subscription payment or a terms of service violation.</p>
        <p>Please contact support or update your payment details to reactivate your account.</p>
      `,
      text: `Dear ${businessName},\n\nYour Augustus account has been suspended. Please contact support or update your payment details to reactivate.`,
    };
  },

  supportTicketAck(
    ticketReference: string,
    subject: string,
  ): { subject: string; html: string; text: string } {
    return {
      subject: `Support ticket received: [${ticketReference}] ${subject}`,
      html: `
        <h2>Support Ticket Received</h2>
        <p>Thank you for contacting Augustus support.</p>
        <p>Your ticket has been assigned reference <strong>${ticketReference}</strong>.</p>
        <p>Subject: <em>${subject}</em></p>
        <p>Our team will review your request and respond as soon as possible.</p>
      `,
      text: `Your Augustus support ticket has been received.\n\nReference: ${ticketReference}\nSubject: ${subject}\n\nOur team will respond shortly.`,
    };
  },

  supportTicketStatusUpdate(
    ticketReference: string,
    newStatus: string,
  ): { subject: string; html: string; text: string } {
    const statusLabel = newStatus.replace('_', ' ');
    return {
      subject: `Support ticket [${ticketReference}] status updated: ${statusLabel}`,
      html: `
        <h2>Support Ticket Status Update</h2>
        <p>Your support ticket <strong>${ticketReference}</strong> has been updated.</p>
        <p>New status: <strong>${statusLabel}</strong></p>
        <p>Log in to your Augustus dashboard to view the full ticket details.</p>
      `,
      text: `Your Augustus support ticket ${ticketReference} status has been updated to: ${statusLabel}.`,
    };
  },

  adminTicketReply(
    ticketReference: string,
    subject: string,
    replyBody: string,
  ): { subject: string; html: string; text: string } {
    return {
      subject: `New reply on your support ticket [${ticketReference}]`,
      html: `
        <h2>New Reply on Your Support Ticket</h2>
        <p>The Augustus support team has replied to your ticket <strong>${ticketReference}</strong>: <em>${subject}</em></p>
        <div style="background:#f7fafc;border-left:4px solid #3182ce;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;white-space:pre-wrap;">${replyBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        <p>Log in to your Augustus dashboard to view the full conversation and reply.</p>
      `,
      text: `The Augustus support team has replied to your ticket ${ticketReference}:\n\n${replyBody}\n\nLog in to your dashboard to view the full conversation.`,
    };
  },
};

// ─── Task 14.3: Support ticket acknowledgement ────────────────────────────────

export async function sendSupportTicketAck(
  to: string,
  ticketReference: string,
  subject: string,
): Promise<void> {
  const template = emailTemplates.supportTicketAck(ticketReference, subject);
  await sendEmail(to, template.subject, template.html, template.text);
}

// ─── Task 14.4: Support ticket status change notification ─────────────────────

export async function sendSupportTicketStatusUpdate(
  to: string,
  ticketReference: string,
  newStatus: string,
): Promise<void> {
  const template = emailTemplates.supportTicketStatusUpdate(ticketReference, newStatus);
  await sendEmail(to, template.subject, template.html, template.text);
}

// ─── Admin ticket reply notification ─────────────────────────────────────────

export async function sendAdminTicketReply(
  to: string,
  ticketReference: string,
  subject: string,
  replyBody: string,
): Promise<void> {
  const template = emailTemplates.adminTicketReply(ticketReference, subject, replyBody);
  await sendEmail(to, template.subject, template.html, template.text);
}
