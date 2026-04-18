/**
 * Notification Cleanup Job
 * Deletes notifications older than 90 days
 * Scheduled to run daily at midnight UTC
 */

import { cleanupOldNotifications } from '../modules/notification/in-app-notification.service.js';

export async function runNotificationCleanup(): Promise<void> {
  console.log('[Job] Starting notification cleanup...');
  try {
    const deletedCount = await cleanupOldNotifications();
    console.log(`[Job] Notification cleanup complete. Deleted ${deletedCount} notifications.`);
  } catch (err) {
    console.error('[Job] Notification cleanup failed:', err);
  }
}
