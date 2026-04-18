# Implementation Plan: In-App Notifications

## Overview

This implementation plan creates a complete in-app notification system for both admin and business dashboards. The system provides persistent storage, real-time polling updates, and a comprehensive notification center UI. Implementation follows a backend-first approach, building the data layer, service layer, API endpoints, and integration helpers before moving to frontend components.

## Tasks

- [x] 1. Create database migration and schema
  - Create migration file `026_in_app_notifications.sql`
  - Define `notifications` table with all required fields and constraints
  - Add composite index on `(recipient_type, recipient_id, created_at DESC)`
  - Add partial index on unread notifications
  - Add partial index for cleanup job optimization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Implement notification service layer
  - [x] 2.1 Create notification service module structure
    - Create `packages/api/src/modules/notification/` directory
    - Create `notification.service.ts` with type definitions
    - Define `NotificationType` enum and `Notification` interface
    - _Requirements: 2.8, 13.1_

  - [x] 2.2 Implement core CRUD operations
    - Implement `createNotification()` function with validation
    - Implement `getNotifications()` with pagination and filtering
    - Implement `getUnreadCount()` for badge display
    - Implement `markAsRead()` with authorization checks
    - Implement `markAllAsRead()` batch operation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.3 Implement cleanup function
    - Implement `cleanupOldNotifications()` with 90-day retention
    - Add logging for deleted notification count
    - _Requirements: 14.1, 14.2, 14.4_

  - [ ]* 2.4 Write unit tests for notification service
    - Test `createNotification()` with valid and invalid inputs
    - Test `getNotifications()` pagination and filtering
    - Test `getUnreadCount()` accuracy
    - Test `markAsRead()` authorization checks
    - Test `markAllAsRead()` batch operations
    - Test `cleanupOldNotifications()` date filtering
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 5.1, 5.2, 5.3, 14.1, 14.2_

- [x] 3. Create notification API endpoints
  - [x] 3.1 Create notification routes module
    - Create `notification.routes.ts` with Express router
    - Add JWT authentication middleware to all routes
    - Define route handlers for all endpoints
    - _Requirements: 12.5_

  - [x] 3.2 Implement GET /notifications endpoint
    - Add pagination support (limit, offset)
    - Add filtering by type and read status
    - Return notifications with total count and hasMore flag
    - _Requirements: 12.1, 12.6, 12.7_

  - [x] 3.3 Implement GET /notifications/unread-count endpoint
    - Return unread count for authenticated user
    - Optimize query using partial index
    - _Requirements: 12.2, 3.1, 3.4_

  - [x] 3.4 Implement PATCH /notifications/:id/read endpoint
    - Mark single notification as read
    - Verify notification belongs to authenticated user
    - Return updated notification with readAt timestamp
    - _Requirements: 12.3, 5.1, 5.5, 5.6_

  - [x] 3.5 Implement POST /notifications/mark-all-read endpoint
    - Mark all unread notifications as read for authenticated user
    - Return count of marked notifications
    - _Requirements: 12.4, 5.2, 5.3, 5.4_

  - [x] 3.6 Register notification routes in main API
    - Import notification router in `packages/api/src/index.ts`
    - Mount routes at `/notifications` path
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 3.7 Write integration tests for API endpoints
    - Test GET /notifications with various filters
    - Test GET /notifications/unread-count accuracy
    - Test PATCH /notifications/:id/read authorization
    - Test POST /notifications/mark-all-read batch operation
    - Test authentication middleware enforcement
    - Test cross-user authorization (business A cannot read business B's notifications)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7_

- [ ] 4. Checkpoint - Verify backend functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement integration helper functions
  - [x] 5.1 Create notification helpers module
    - Create `notification.helpers.ts` in notification module
    - Import notification service functions
    - _Requirements: 13.1_

  - [x] 5.2 Implement subscription notification helpers
    - Implement `notifySubscriptionUpdate()` for all subscription events
    - Support events: upgraded, downgraded, renewed, cancelled, payment_failed
    - Map events to appropriate titles and messages
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.3 Implement payment notification helpers
    - Implement `notifyPaymentEvent()` for all payment events
    - Support events: order_completed, refund_processed, withdrawal_approved, withdrawal_rejected
    - Include amount and reference in metadata
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Implement referral notification helpers
    - Implement `notifyReferralEarning()` for referral events
    - Support events: commission_earned, commission_credited
    - Include commission amount and wallet balance in metadata
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 5.5 Implement support ticket notification helpers
    - Implement `notifySupportTicket()` for both admin and business recipients
    - Support events: created, status_changed, admin_replied, resolved
    - Include ticket reference and preview in metadata
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 5.6 Implement admin notification helpers
    - Implement `notifyAdminEvent()` for admin-specific events
    - Support events: business_registered, account_suspended, withdrawal_requested, payment_failed_final
    - Include business name and relevant details in metadata
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 5.7 Write unit tests for integration helpers
    - Test each helper function creates correct notification type
    - Test metadata structure for each notification type
    - Test error handling when recipient doesn't exist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 9.1, 9.2, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3_

- [x] 6. Integrate notification helpers into existing modules
  - [x] 6.1 Integrate with subscription module
    - Import `notifySubscriptionUpdate()` in subscription service
    - Add notification calls for plan changes, renewals, cancellations
    - Add notification calls for payment success and failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Integrate with payment module
    - Import `notifyPaymentEvent()` in payment service
    - Add notification calls for order completions and refunds
    - Add notification calls for withdrawal approvals and rejections
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 6.3 Integrate with referral module
    - Import `notifyReferralEarning()` in referral service
    - Add notification calls for commission earned events
    - Add notification calls for commission credited events
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.4 Integrate with support ticket module
    - Import `notifySupportTicket()` in support service
    - Add notification calls for ticket creation and status changes
    - Add notification calls for admin replies
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 6.5 Integrate with admin module
    - Import `notifyAdminEvent()` in admin service
    - Add notification calls for business registration and suspension
    - Add notification calls for withdrawal requests and payment failures
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 6.6 Write integration tests for module notifications
    - Test subscription renewal creates notification
    - Test payment completion creates notification
    - Test referral commission creates notification
    - Test support ticket reply creates notification
    - Test admin events create notifications
    - _Requirements: 7.1, 7.2, 8.1, 9.1, 10.2, 11.1_

- [x] 7. Implement scheduled cleanup job
  - [x] 7.1 Create notification cleanup job
    - Create `packages/api/src/jobs/notification-cleanup.ts`
    - Import `cleanupOldNotifications()` from service
    - Add error handling and logging
    - _Requirements: 14.2, 14.3, 14.4_

  - [x] 7.2 Register cleanup job in scheduler
    - Add job to `packages/api/src/jobs/index.ts` (or create if doesn't exist)
    - Schedule job to run daily at midnight UTC (cron: `0 0 * * *`)
    - _Requirements: 14.3_

  - [ ]* 7.3 Write tests for cleanup job
    - Test job execution and error handling
    - Test logging of deleted notification count
    - _Requirements: 14.2, 14.3, 14.4_

- [ ] 8. Checkpoint - Verify backend integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement admin dashboard frontend components
  - [x] 9.1 Create NotificationBadge component for admin dashboard
    - Create `packages/admin-dashboard/src/components/NotificationBadge.tsx`
    - Implement badge display logic (count, 99+, hide when 0)
    - Add polling mechanism (every 30 seconds) for unread count
    - Add pulse animation on count increase
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2_

  - [x] 9.2 Create NotificationItem component for admin dashboard
    - Create `packages/admin-dashboard/src/components/NotificationItem.tsx`
    - Display notification type icon, title, message preview, timestamp
    - Implement visual distinction for read/unread (bold title, blue dot)
    - Add relative timestamp formatting ("5 minutes ago", "2 hours ago")
    - Add click handler to mark as read
    - _Requirements: 4.3, 4.4, 4.7, 5.1, 5.6_

  - [x] 9.3 Create NotificationCenter component for admin dashboard
    - Create `packages/admin-dashboard/src/components/NotificationCenter.tsx`
    - Implement dropdown panel with max height and scroll
    - Display 20 most recent notifications in reverse chronological order
    - Add "Mark all as read" button
    - Add "View All" link to full-page history
    - Add empty state message when no notifications
    - Add loading state during fetch
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 5.2, 5.3_

  - [x] 9.4 Create NotificationHistoryPage for admin dashboard
    - Create `packages/admin-dashboard/src/pages/NotificationHistory.tsx`
    - Implement full-page view with pagination
    - Add filters for notification type and read/unread status
    - Reuse NotificationItem component for consistency
    - Add "Load More" button or infinite scroll
    - _Requirements: 4.6, 12.7_

  - [x] 9.5 Integrate notification components into admin dashboard layout
    - Import NotificationBadge and NotificationCenter in AdminLayout
    - Add notification icon to navigation bar
    - Wire up badge click to open/close notification center
    - Add route for NotificationHistoryPage
    - _Requirements: 3.5, 4.1_

  - [ ]* 9.6 Write tests for admin dashboard notification components
    - Test NotificationBadge displays correct count and 99+ logic
    - Test NotificationCenter displays notifications correctly
    - Test mark as read updates badge count
    - Test mark all as read clears badge
    - Test polling mechanism updates badge
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

- [ ] 10. Implement business dashboard frontend components
  - [-] 10.1 Create NotificationBadge component for business dashboard
    - Create `packages/business-dashboard/src/components/NotificationBadge.tsx`
    - Implement badge display logic (count, 99+, hide when 0)
    - Add polling mechanism (every 30 seconds) for unread count
    - Add pulse animation on count increase
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2_

  - [ ] 10.2 Create NotificationItem component for business dashboard
    - Create `packages/business-dashboard/src/components/NotificationItem.tsx`
    - Display notification type icon, title, message preview, timestamp
    - Implement visual distinction for read/unread (bold title, blue dot)
    - Add relative timestamp formatting ("5 minutes ago", "2 hours ago")
    - Add click handler to mark as read
    - _Requirements: 4.3, 4.4, 4.7, 5.1, 5.6_

  - [ ] 10.3 Create NotificationCenter component for business dashboard
    - Create `packages/business-dashboard/src/components/NotificationCenter.tsx`
    - Implement dropdown panel with max height and scroll
    - Display 20 most recent notifications in reverse chronological order
    - Add "Mark all as read" button
    - Add "View All" link to full-page history
    - Add empty state message when no notifications
    - Add loading state during fetch
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 5.2, 5.3_

  - [ ] 10.4 Create NotificationHistoryPage for business dashboard
    - Create `packages/business-dashboard/src/pages/NotificationHistory.tsx`
    - Implement full-page view with pagination
    - Add filters for notification type and read/unread status
    - Reuse NotificationItem component for consistency
    - Add "Load More" button or infinite scroll
    - _Requirements: 4.6, 12.7_

  - [ ] 10.5 Integrate notification components into business dashboard layout
    - Import NotificationBadge and NotificationCenter in business layout component
    - Add notification icon to navigation bar
    - Wire up badge click to open/close notification center
    - Add route for NotificationHistoryPage
    - _Requirements: 3.5, 4.1_

  - [ ]* 10.6 Write tests for business dashboard notification components
    - Test NotificationBadge displays correct count and 99+ logic
    - Test NotificationCenter displays notifications correctly
    - Test mark as read updates badge count
    - Test mark all as read clears badge
    - Test polling mechanism updates badge
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

- [ ] 11. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Backend implementation is completed before frontend to enable parallel frontend development
- Admin and business dashboard components are implemented separately but follow the same patterns
- Integration helpers are created before module integration to enable clean separation of concerns
- Scheduled cleanup job ensures database doesn't grow indefinitely
