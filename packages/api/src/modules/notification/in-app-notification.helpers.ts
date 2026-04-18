/**
 * In-App Notification Integration Helpers
 * Helper functions to create notifications from various system events
 */

import { createNotification, type RecipientType } from './in-app-notification.service.js';
import { pool } from '../../db/client.js';

// ─── Subscription Notification Helpers ───────────────────────────────────────

export async function notifySubscriptionUpdate(
  businessId: string,
  event: 'upgraded' | 'downgraded' | 'renewed' | 'cancelled' | 'payment_failed' | 'renewal_reminder',
  details: { planName?: string; oldPlanName?: string; amount?: number; renewalDate?: Date; reason?: string; daysUntil?: number }
): Promise<void> {
  try {
    let title = '';
    let message = '';

    switch (event) {
      case 'upgraded':
        title = 'Subscription Upgraded';
        message = `Your subscription has been upgraded from ${details.oldPlanName} to ${details.planName}. New features are now available!`;
        break;
      case 'downgraded':
        title = 'Subscription Downgraded';
        message = `Your subscription has been downgraded to ${details.planName}. Changes will take effect at the next billing cycle.`;
        break;
      case 'renewed':
        title = 'Subscription Renewed';
        message = `Your ${details.planName} plan has been renewed for $${details.amount}. Next renewal: ${details.renewalDate?.toLocaleDateString() || 'N/A'}.`;
        break;
      case 'cancelled':
        title = 'Subscription Cancelled';
        message = `Your subscription has been cancelled. Service will end on ${details.renewalDate?.toLocaleDateString() || 'N/A'}.`;
        break;
      case 'payment_failed':
        title = 'Subscription Payment Failed';
        message = `Your subscription payment failed. ${details.reason || 'Please update your payment method to avoid service interruption.'}`;
        break;
      case 'renewal_reminder':
        title = 'Subscription Renewal Reminder';
        message = `Your ${details.planName} subscription will renew in ${details.daysUntil} days on ${details.renewalDate?.toLocaleDateString() || 'N/A'}.`;
        break;
    }

    await createNotification({
      recipientType: 'business',
      recipientId: businessId,
      notificationType: 'subscription_update',
      title,
      message,
      metadata: details,
    });
  } catch (err) {
    console.error('[InAppNotification] Failed to create subscription notification:', err);
  }
}

// ─── Payment Notification Helpers ────────────────────────────────────────────

export async function notifyPaymentEvent(
  businessId: string,
  event: 'order_completed' | 'refund_processed' | 'withdrawal_approved' | 'withdrawal_rejected',
  details: { amount: number; reference?: string; reason?: string; processingTimeline?: string }
): Promise<void> {
  try {
    let title = '';
    let message = '';

    switch (event) {
      case 'order_completed':
        title = 'Payment Received';
        message = `Payment of $${details.amount.toFixed(2)} received for order ${details.reference || 'N/A'}`;
        break;
      case 'refund_processed':
        title = 'Refund Processed';
        message = `Refund of $${details.amount.toFixed(2)} has been processed. ${details.reason || ''}`;
        break;
      case 'withdrawal_approved':
        title = 'Withdrawal Approved';
        message = `Your withdrawal request of $${details.amount.toFixed(2)} has been approved. ${details.processingTimeline || 'Processing will begin shortly.'}`;
        break;
      case 'withdrawal_rejected':
        title = 'Withdrawal Rejected';
        message = `Your withdrawal request of $${details.amount.toFixed(2)} has been rejected. Reason: ${details.reason || 'Please contact support for details.'}`;
        break;
    }

    await createNotification({
      recipientType: 'business',
      recipientId: businessId,
      notificationType: 'payment_event',
      title,
      message,
      metadata: details,
    });
  } catch (err) {
    console.error('[InAppNotification] Failed to create payment notification:', err);
  }
}

// ─── Referral Notification Helpers ───────────────────────────────────────────

export async function notifyReferralEarning(
  businessId: string,
  event: 'commission_earned' | 'commission_credited',
  details: { amount: number; referredBusinessName?: string; walletBalance?: number }
): Promise<void> {
  try {
    let title = '';
    let message = '';

    switch (event) {
      case 'commission_earned':
        title = 'Referral Commission Earned';
        message = `You earned $${details.amount.toFixed(2)} commission from ${details.referredBusinessName || 'a referred business'}'s subscription payment`;
        break;
      case 'commission_credited':
        title = 'Commission Credited';
        message = `$${details.amount.toFixed(2)} referral commission has been credited to your wallet. New balance: $${details.walletBalance?.toFixed(2) || 'N/A'}`;
        break;
    }

    await createNotification({
      recipientType: 'business',
      recipientId: businessId,
      notificationType: 'referral_earning',
      title,
      message,
      metadata: details,
    });
  } catch (err) {
    console.error('[InAppNotification] Failed to create referral notification:', err);
  }
}

// ─── Support Ticket Notification Helpers ─────────────────────────────────────

export async function notifySupportTicket(
  recipientType: RecipientType,
  recipientId: string,
  event: 'created' | 'status_changed' | 'admin_replied' | 'resolved',
  details: { ticketReference: string; subject?: string; status?: string; preview?: string; businessName?: string }
): Promise<void> {
  try {
    let title = '';
    let message = '';

    if (recipientType === 'business') {
      switch (event) {
        case 'created':
          title = 'Support Ticket Created';
          message = `Your support ticket [${details.ticketReference}] has been created. We'll respond shortly.`;
          break;
        case 'status_changed':
          title = 'Support Ticket Updated';
          message = `Your ticket [${details.ticketReference}] status changed to: ${details.status || 'Updated'}`;
          break;
        case 'admin_replied':
          title = 'Support Ticket Reply';
          message = `Admin replied to your ticket [${details.ticketReference}]: "${details.preview || 'View ticket for details'}"`;
          break;
        case 'resolved':
          title = 'Support Ticket Resolved';
          message = `Your ticket [${details.ticketReference}] has been resolved. ${details.preview || ''}`;
          break;
      }
    } else {
      // Admin notifications
      switch (event) {
        case 'created':
          title = 'New Support Ticket';
          message = `New ticket [${details.ticketReference}] from ${details.businessName || 'business'}: ${details.subject || 'No subject'}`;
          break;
        case 'status_changed':
          title = 'Ticket Status Changed';
          message = `Ticket [${details.ticketReference}] status changed to: ${details.status || 'Updated'}`;
          break;
        case 'admin_replied':
          title = 'Ticket Reply Sent';
          message = `You replied to ticket [${details.ticketReference}]`;
          break;
        case 'resolved':
          title = 'Ticket Resolved';
          message = `Ticket [${details.ticketReference}] has been resolved`;
          break;
      }
    }

    await createNotification({
      recipientType,
      recipientId,
      notificationType: 'support_ticket',
      title,
      message,
      metadata: details,
    });
  } catch (err) {
    console.error('[InAppNotification] Failed to create support ticket notification:', err);
  }
}

// ─── Admin Notification Helpers ──────────────────────────────────────────────

export async function notifyAdminEvent(
  event: 'business_registered' | 'account_suspended' | 'withdrawal_requested' | 'payment_failed_final',
  details: { businessName: string; businessId?: string; amount?: number; reason?: string; registrationTimestamp?: Date }
): Promise<void> {
  try {
    // Get all admin operators
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM operators WHERE role = 'admin'`
    );

    if (result.rows.length === 0) {
      console.warn('[InAppNotification] No admin operators found for notification');
      return;
    }

    let title = '';
    let message = '';

    switch (event) {
      case 'business_registered':
        title = 'New Business Registration';
        message = `${details.businessName} registered at ${details.registrationTimestamp?.toLocaleString() || 'N/A'}`;
        break;
      case 'account_suspended':
        title = 'Account Suspended';
        message = `${details.businessName} has been suspended. Reason: ${details.reason || 'Payment failure'}`;
        break;
      case 'withdrawal_requested':
        title = 'Withdrawal Request';
        message = `${details.businessName} requested withdrawal of $${details.amount?.toFixed(2) || 'N/A'}`;
        break;
      case 'payment_failed_final':
        title = 'Payment Failed (Final)';
        message = `${details.businessName} subscription payment failed after all retry attempts. ${details.reason || ''}`;
        break;
    }

    // Create notification for each admin
    for (const admin of result.rows) {
      await createNotification({
        recipientType: 'admin',
        recipientId: admin.id,
        notificationType: 'system_alert',
        title,
        message,
        metadata: details,
      });
    }
  } catch (err) {
    console.error('[InAppNotification] Failed to create admin notification:', err);
  }
}
