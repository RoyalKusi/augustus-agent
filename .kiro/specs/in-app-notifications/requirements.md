# Requirements Document

## Introduction

The in-app notification system provides real-time, persistent notifications to both admin operators and business users within their respective dashboards. This system complements the existing email and WhatsApp notification channels by providing immediate, actionable alerts directly within the application interface. Users can view, manage, and track notifications through a notification center with badge indicators showing unread counts.

## Glossary

- **Notification_System**: The in-app notification subsystem responsible for creating, storing, and delivering notifications
- **Notification_Center**: The UI component (dropdown/panel) that displays the list of notifications
- **Notification_Badge**: The visual indicator showing the count of unread notifications
- **Admin_Dashboard**: The React application used by system operators and administrators
- **Business_Dashboard**: The React application used by business owners and staff
- **Notification_Trigger**: An event in the system that automatically creates a notification
- **Read_Status**: Boolean flag indicating whether a notification has been viewed by the recipient

## Requirements

### Requirement 1: Notification Storage and Management

**User Story:** As a system architect, I want a persistent storage mechanism for notifications, so that users can access their notification history and the system can track read/unread status.

#### Acceptance Criteria

1. THE Notification_System SHALL store notifications in a PostgreSQL database table with fields for recipient type (admin/business), recipient ID, notification type, title, message body, read status, and timestamps
2. WHEN a notification is created, THE Notification_System SHALL record the creation timestamp in UTC format
3. THE Notification_System SHALL support storing notifications for both admin operators and business users in the same table with a discriminator field
4. THE Notification_System SHALL maintain referential integrity between notifications and their recipient entities
5. THE Notification_System SHALL index notifications by recipient ID and read status for efficient querying

### Requirement 2: Notification Types and Categories

**User Story:** As a developer, I want well-defined notification types, so that I can trigger appropriate notifications for different system events.

#### Acceptance Criteria

1. THE Notification_System SHALL support notification type "account_change" for account status modifications, suspensions, and reactivations
2. THE Notification_System SHALL support notification type "subscription_update" for plan changes, renewals, and cancellations
3. THE Notification_System SHALL support notification type "payment_event" for successful payments, failed payments, and refunds
4. THE Notification_System SHALL support notification type "referral_earning" for commission credits and referral milestones
5. THE Notification_System SHALL support notification type "support_ticket" for ticket creation, status changes, and admin replies
6. THE Notification_System SHALL support notification type "system_alert" for critical system events and maintenance notifications
7. THE Notification_System SHALL support notification type "order_update" for order status changes and fulfillment events
8. THE Notification_System SHALL store the notification type as an enumerated value in the database

### Requirement 3: Notification Badge Display

**User Story:** As a user, I want to see a badge with the count of unread notifications, so that I know when new notifications require my attention.

#### Acceptance Criteria

1. WHEN unread notifications exist for the current user, THE Notification_Badge SHALL display the count of unread notifications
2. WHEN the unread count exceeds 99, THE Notification_Badge SHALL display "99+" instead of the exact count
3. WHEN no unread notifications exist, THE Notification_Badge SHALL not display any badge indicator
4. THE Notification_Badge SHALL update immediately when the unread count changes
5. THE Notification_Badge SHALL be visible on both Admin_Dashboard and Business_Dashboard navigation bars

### Requirement 4: Notification Center Interface

**User Story:** As a user, I want to view all my notifications in a centralized panel, so that I can review recent activity and important alerts.

#### Acceptance Criteria

1. WHEN a user clicks the notification icon, THE Notification_Center SHALL display a dropdown panel with the list of notifications
2. THE Notification_Center SHALL display notifications in reverse chronological order with most recent first
3. THE Notification_Center SHALL visually distinguish between read and unread notifications using styling differences
4. THE Notification_Center SHALL display notification title, message preview, timestamp, and notification type icon for each notification
5. THE Notification_Center SHALL show the 20 most recent notifications initially
6. WHEN more than 20 notifications exist, THE Notification_Center SHALL provide a "View All" link to a full-page notification history
7. THE Notification_Center SHALL display relative timestamps for recent notifications (e.g., "5 minutes ago", "2 hours ago", "yesterday")
8. WHEN no notifications exist, THE Notification_Center SHALL display an empty state message

### Requirement 5: Mark Notifications as Read

**User Story:** As a user, I want to mark notifications as read, so that I can track which notifications I have already reviewed.

#### Acceptance Criteria

1. WHEN a user clicks on an individual notification, THE Notification_System SHALL mark that notification as read
2. THE Notification_Center SHALL provide a "Mark all as read" action button
3. WHEN a user clicks "Mark all as read", THE Notification_System SHALL mark all unread notifications for that user as read
4. WHEN a notification is marked as read, THE Notification_Badge SHALL decrement the unread count immediately
5. THE Notification_System SHALL record the timestamp when a notification is marked as read
6. WHEN a notification is marked as read, THE Notification_Center SHALL update the visual styling to reflect read status

### Requirement 6: Real-time Notification Updates

**User Story:** As a user, I want to receive notifications in real-time without refreshing the page, so that I am immediately aware of important events.

#### Acceptance Criteria

1. WHEN a new notification is created for a user, THE Notification_System SHALL update the Notification_Badge count without requiring page refresh
2. WHEN a new notification arrives, THE Notification_Badge SHALL display a visual animation to draw attention
3. THE Notification_System SHALL poll for new notifications at regular intervals (every 30 seconds)
4. WHEN the Notification_Center is open and a new notification arrives, THE Notification_Center SHALL prepend the new notification to the list
5. THE Notification_System SHALL fetch only notifications created after the last known notification timestamp to minimize data transfer

### Requirement 7: Subscription Event Notifications

**User Story:** As a business owner, I want to receive notifications about subscription changes, so that I am informed about plan upgrades, renewals, and payment issues.

#### Acceptance Criteria

1. WHEN a subscription plan is upgraded or downgraded, THE Notification_System SHALL create a notification for the business owner with the old and new plan names
2. WHEN a subscription payment succeeds, THE Notification_System SHALL create a notification for the business owner with the payment amount and next renewal date
3. WHEN a subscription payment fails, THE Notification_System SHALL create a notification for the business owner with failure reason and retry instructions
4. WHEN a subscription is cancelled, THE Notification_System SHALL create a notification for the business owner with the cancellation date and end of service date
5. WHEN a subscription renewal is approaching (7 days before), THE Notification_System SHALL create a reminder notification for the business owner

### Requirement 8: Payment Event Notifications

**User Story:** As a business owner, I want to receive notifications about payment events, so that I can track revenue and address payment issues promptly.

#### Acceptance Criteria

1. WHEN a customer order payment is completed, THE Notification_System SHALL create a notification for the business owner with order reference and amount
2. WHEN a payment refund is processed, THE Notification_System SHALL create a notification for the business owner with refund amount and reason
3. WHEN a withdrawal request is approved, THE Notification_System SHALL create a notification for the business owner with withdrawal amount and processing timeline
4. WHEN a withdrawal request is rejected, THE Notification_System SHALL create a notification for the business owner with rejection reason

### Requirement 9: Referral Earnings Notifications

**User Story:** As a business owner, I want to receive notifications about referral earnings, so that I can track my referral program success.

#### Acceptance Criteria

1. WHEN a referred business makes their first subscription payment, THE Notification_System SHALL create a notification for the referrer with commission amount earned
2. WHEN a referred business makes a recurring subscription payment, THE Notification_System SHALL create a notification for the referrer with commission amount earned
3. WHEN referral commission is credited to the wallet, THE Notification_System SHALL create a notification for the referrer with the credited amount and new wallet balance

### Requirement 10: Support Ticket Notifications

**User Story:** As a business owner, I want to receive notifications about support ticket updates, so that I can respond promptly to support team communications.

#### Acceptance Criteria

1. WHEN a business creates a support ticket, THE Notification_System SHALL create a notification for admin operators with ticket reference and subject
2. WHEN an admin operator replies to a support ticket, THE Notification_System SHALL create a notification for the business owner with a message preview
3. WHEN a support ticket status changes, THE Notification_System SHALL create a notification for the business owner with the new status
4. WHEN a support ticket is resolved, THE Notification_System SHALL create a notification for the business owner with resolution summary

### Requirement 11: Admin Notifications

**User Story:** As an admin operator, I want to receive notifications about system events requiring attention, so that I can respond to issues and manage the platform effectively.

#### Acceptance Criteria

1. WHEN a new business registers, THE Notification_System SHALL create a notification for admin operators with business name and registration timestamp
2. WHEN a business account is suspended due to payment failure, THE Notification_System SHALL create a notification for admin operators with business name and suspension reason
3. WHEN a new support ticket is created, THE Notification_System SHALL create a notification for admin operators with ticket reference, business name, and priority
4. WHEN a withdrawal request is submitted, THE Notification_System SHALL create a notification for admin operators with business name and withdrawal amount
5. WHEN a subscription payment fails after retry attempts, THE Notification_System SHALL create a notification for admin operators with business name and payment details

### Requirement 12: Notification API Endpoints

**User Story:** As a frontend developer, I want RESTful API endpoints for notification operations, so that I can integrate the notification system into the dashboards.

#### Acceptance Criteria

1. THE Notification_System SHALL provide a GET endpoint to retrieve notifications for the authenticated user with pagination support
2. THE Notification_System SHALL provide a GET endpoint to retrieve the unread notification count for the authenticated user
3. THE Notification_System SHALL provide a PATCH endpoint to mark a single notification as read by notification ID
4. THE Notification_System SHALL provide a POST endpoint to mark all notifications as read for the authenticated user
5. THE Notification_System SHALL authenticate all notification endpoints using the existing JWT authentication middleware
6. THE Notification_System SHALL return notifications in JSON format with all relevant fields including ID, type, title, message, read status, and timestamps
7. THE Notification_System SHALL support filtering notifications by read status and notification type via query parameters

### Requirement 13: Notification Creation Service

**User Story:** As a backend developer, I want a service function to create notifications programmatically, so that I can trigger notifications from various parts of the application.

#### Acceptance Criteria

1. THE Notification_System SHALL provide a service function that accepts recipient type, recipient ID, notification type, title, and message as parameters
2. WHEN the service function is called, THE Notification_System SHALL insert a new notification record into the database
3. THE Notification_System SHALL validate that the recipient exists before creating the notification
4. WHEN notification creation fails due to database error, THE Notification_System SHALL log the error and throw an exception
5. THE Notification_System SHALL return the created notification ID upon successful creation

### Requirement 14: Notification Cleanup and Retention

**User Story:** As a system administrator, I want old notifications to be automatically cleaned up, so that the database does not grow indefinitely.

#### Acceptance Criteria

1. THE Notification_System SHALL retain notifications for 90 days from creation date
2. THE Notification_System SHALL provide a cleanup function that deletes notifications older than 90 days
3. THE Notification_System SHALL execute the cleanup function on a scheduled basis (daily at midnight UTC)
4. WHEN notifications are deleted during cleanup, THE Notification_System SHALL log the count of deleted notifications
5. THE Notification_System SHALL preserve read status and timestamps for notifications within the retention period
