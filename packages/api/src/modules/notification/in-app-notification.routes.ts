/**
 * In-App Notification API Routes
 * Provides RESTful endpoints for notification operations
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import { authenticateOperator } from '../admin/admin.middleware.js';
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type NotificationType,
  type RecipientType,
} from './in-app-notification.service.js';

export async function inAppNotificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications - Get notifications for authenticated user
  app.get('/notifications', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { limit, offset, type, unread } = request.query as {
        limit?: string;
        offset?: string;
        type?: NotificationType;
        unread?: string;
      };

      const recipientType: RecipientType = 'business';
      const recipientId = request.businessId;

      const result = await getNotifications({
        recipientType,
        recipientId,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        type,
        unread: unread === 'true' ? true : unread === 'false' ? false : undefined,
      });

      return reply.send({
        notifications: result.notifications.map((n) => ({
          id: n.id,
          type: n.notificationType,
          title: n.title,
          message: n.message,
          metadata: n.metadata,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() || null,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /admin/notifications - Get notifications for authenticated admin
  app.get('/admin/notifications', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const { limit, offset, type, unread } = request.query as {
        limit?: string;
        offset?: string;
        type?: NotificationType;
        unread?: string;
      };

      const recipientType: RecipientType = 'admin';
      const recipientId = request.operatorId;

      const result = await getNotifications({
        recipientType,
        recipientId,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        type,
        unread: unread === 'true' ? true : unread === 'false' ? false : undefined,
      });

      return reply.send({
        notifications: result.notifications.map((n) => ({
          id: n.id,
          type: n.notificationType,
          title: n.title,
          message: n.message,
          metadata: n.metadata,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() || null,
        })),
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /notifications/unread-count - Get unread count for authenticated user
  app.get('/notifications/unread-count', { preHandler: authenticate }, async (request, reply) => {
    try {
      const recipientType: RecipientType = 'business';
      const recipientId = request.businessId;

      const count = await getUnreadCount(recipientType, recipientId);

      return reply.send({ count });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch unread count';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /admin/notifications/unread-count - Get unread count for authenticated admin
  app.get('/admin/notifications/unread-count', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const recipientType: RecipientType = 'admin';
      const recipientId = request.operatorId;

      const count = await getUnreadCount(recipientType, recipientId);

      return reply.send({ count });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch unread count';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /notifications/:id/read - Mark notification as read
  app.patch('/notifications/:id/read', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const recipientType: RecipientType = 'business';
      const recipientId = request.businessId;

      const notification = await markAsRead(id, recipientType, recipientId);

      return reply.send({
        id: notification.id,
        isRead: notification.isRead,
        readAt: notification.readAt?.toISOString() || null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';

      if (message === 'Notification not found') {
        return reply.status(404).send({ error: message });
      }

      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /admin/notifications/:id/read - Mark admin notification as read
  app.patch('/admin/notifications/:id/read', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const recipientType: RecipientType = 'admin';
      const recipientId = request.operatorId;

      const notification = await markAsRead(id, recipientType, recipientId);

      return reply.send({
        id: notification.id,
        isRead: notification.isRead,
        readAt: notification.readAt?.toISOString() || null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';

      if (message === 'Notification not found') {
        return reply.status(404).send({ error: message });
      }

      return reply.status(500).send({ error: message });
    }
  });

  // POST /notifications/mark-all-read - Mark all notifications as read
  app.post('/notifications/mark-all-read', { preHandler: authenticate }, async (request, reply) => {
    try {
      const recipientType: RecipientType = 'business';
      const recipientId = request.businessId;

      const markedCount = await markAllAsRead(recipientType, recipientId);

      return reply.send({ markedCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /admin/notifications/mark-all-read - Mark all admin notifications as read
  app.post('/admin/notifications/mark-all-read', { preHandler: authenticateOperator }, async (request, reply) => {
    try {
      const recipientType: RecipientType = 'admin';
      const recipientId = request.operatorId;

      const markedCount = await markAllAsRead(recipientType, recipientId);

      return reply.send({ markedCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      return reply.status(500).send({ error: message });
    }
  });
}
