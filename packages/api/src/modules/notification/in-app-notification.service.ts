/**
 * In-App Notification Service
 * Manages persistent in-app notifications for admin operators and business users
 */

import { pool } from '../../db/client.js';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'account_change'
  | 'subscription_update'
  | 'payment_event'
  | 'referral_earning'
  | 'support_ticket'
  | 'system_alert'
  | 'order_update';

export type RecipientType = 'admin' | 'business';

export interface Notification {
  id: string;
  recipientType: RecipientType;
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationRow {
  id: string;
  recipient_type: RecipientType;
  recipient_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    metadata: row.metadata || undefined,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Core CRUD Operations ────────────────────────────────────────────────────

/**
 * Create a new notification
 */
export async function createNotification(params: {
  recipientType: RecipientType;
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<Notification> {
  const { recipientType, recipientId, notificationType, title, message, metadata } = params;

  // Validation
  if (!recipientId || !title || !message) {
    throw new Error('Missing required notification fields');
  }

  try {
    const result = await pool.query<NotificationRow>(
      `INSERT INTO notifications 
         (recipient_type, recipient_id, notification_type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [recipientType, recipientId, notificationType, title, message, metadata ? JSON.stringify(metadata) : null]
    );

    return rowToNotification(result.rows[0]);
  } catch (err) {
    console.error('[InAppNotification] Failed to create notification:', err);
    throw new Error('Failed to create notification');
  }
}

/**
 * Get notifications for a user with pagination and filtering
 */
export async function getNotifications(params: {
  recipientType: RecipientType;
  recipientId: string;
  limit?: number;
  offset?: number;
  type?: NotificationType;
  unread?: boolean;
}): Promise<{ notifications: Notification[]; total: number; hasMore: boolean }> {
  const { recipientType, recipientId, limit = 20, offset = 0, type, unread } = params;

  const conditions: string[] = [
    'recipient_type = $1',
    'recipient_id = $2',
  ];
  const values: (string | number | boolean)[] = [recipientType, recipientId];
  let paramIndex = 3;

  if (type) {
    conditions.push(`notification_type = $${paramIndex++}`);
    values.push(type);
  }

  if (unread !== undefined) {
    conditions.push(`is_read = $${paramIndex++}`);
    values.push(!unread);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated notifications
  const result = await pool.query<NotificationRow>(
    `SELECT * FROM notifications 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  const notifications = result.rows.map(rowToNotification);
  const hasMore = offset + notifications.length < total;

  return { notifications, total, hasMore };
}

/**
 * Get unread notification count for badge display
 */
export async function getUnreadCount(
  recipientType: RecipientType,
  recipientId: string
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM notifications 
     WHERE recipient_type = $1 AND recipient_id = $2 AND is_read = FALSE`,
    [recipientType, recipientId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(
  notificationId: string,
  recipientType: RecipientType,
  recipientId: string
): Promise<Notification> {
  const result = await pool.query<NotificationRow>(
    `UPDATE notifications 
     SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND recipient_type = $2 AND recipient_id = $3
     RETURNING *`,
    [notificationId, recipientType, recipientId]
  );

  if (result.rows.length === 0) {
    throw new Error('Notification not found');
  }

  return rowToNotification(result.rows[0]);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(
  recipientType: RecipientType,
  recipientId: string
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `UPDATE notifications 
     SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
     WHERE recipient_type = $1 AND recipient_id = $2 AND is_read = FALSE
     RETURNING id`,
    [recipientType, recipientId]
  );

  return result.rows.length;
}

/**
 * Cleanup old notifications (90-day retention)
 * Called by scheduled job
 */
export async function cleanupOldNotifications(): Promise<number> {
  try {
    const result = await pool.query<{ id: string }>(
      `DELETE FROM notifications 
       WHERE created_at < NOW() - INTERVAL '90 days'
       RETURNING id`
    );

    const deletedCount = result.rows.length;
    console.log(`[InAppNotification] Cleanup complete. Deleted ${deletedCount} notifications.`);
    return deletedCount;
  } catch (err) {
    console.error('[InAppNotification] Cleanup failed:', err);
    throw err;
  }
}
