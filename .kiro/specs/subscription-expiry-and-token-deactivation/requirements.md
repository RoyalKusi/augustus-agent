# Requirements Document

## Introduction

This feature implements automatic subscription lifecycle deactivation for the Augustus AI Sales Platform. Two independent triggers cause deactivation:

1. **Subscription period expiry** — when a subscription's `renewal_date` passes without a new payment, the subscription is cancelled and the business account is suspended immediately (no grace period). A daily cron job performs this check. Businesses receive reminder emails 7 days and 1 day before expiry, and a deactivation notice at the moment of cancellation.

2. **Token budget exhaustion** — when a business's `accumulated_cost_usd` for the current billing cycle reaches the plan's `token_budget_usd` cap, the AI Sales Agent stops responding for that business until the next billing cycle or a plan upgrade. Businesses receive alert emails at 80%, 95%, and 100% (exhaustion) of their budget.

The system builds on existing infrastructure: `subscriptions` and `token_usage` tables, `notification.service.ts` (SendGrid), `token-budget.service.ts` (inline budget checks), and `subscription.service.ts` (renewal reminders already partially implemented).

---

## Glossary

- **Subscription_Expiry_Job**: The daily cron job that identifies and cancels expired subscriptions.
- **Subscription**: A row in the `subscriptions` table representing a business's active plan contract.
- **Business**: A row in the `businesses` table representing a platform tenant.
- **Token_Budget_Service**: The existing `token-budget.service.ts` module that tracks and enforces AI inference cost limits.
- **Notification_Service**: The existing `notification.service.ts` module that dispatches transactional emails via SendGrid.
- **Billing_Cycle**: The period between `billing_cycle_start` and `renewal_date` on a subscription row.
- **Token_Budget**: The maximum `accumulated_cost_usd` allowed per billing cycle, sourced from `plan_config.token_budget_usd` (or a `business_token_overrides` hard limit if set).
- **Renewal_Date**: The `DATE` column on the `subscriptions` table after which the subscription is considered expired if no new payment has been received.
- **Accumulated_Cost**: The `accumulated_cost_usd` value in the `token_usage` table for the current `billing_cycle_start`.
- **Suspension**: Setting `businesses.status = 'suspended'`, which prevents the business from using the platform.
- **Cancellation**: Setting `subscriptions.status = 'cancelled'`, which marks the subscription as no longer active.

---

## Requirements

### Requirement 1: Daily Subscription Expiry Check

**User Story:** As a platform operator, I want expired subscriptions to be automatically cancelled and the associated business accounts suspended, so that businesses without a valid subscription cannot continue using the platform.

#### Acceptance Criteria

1. THE Subscription_Expiry_Job SHALL run once per day via a scheduled cron trigger.
2. WHEN the Subscription_Expiry_Job runs, THE Subscription_Expiry_Job SHALL query all Subscriptions where `status = 'active'` and `renewal_date < CURRENT_DATE`.
3. WHEN an expired Subscription is identified, THE Subscription_Expiry_Job SHALL set `subscriptions.status = 'cancelled'` and `businesses.status = 'suspended'` in a single atomic database transaction.
4. WHEN the atomic transaction in criterion 3 commits, THE Subscription_Expiry_Job SHALL send a subscription-expired notification email to the Business's registered email address.
5. IF the atomic transaction in criterion 3 fails, THEN THE Subscription_Expiry_Job SHALL log the error with the subscription ID and business ID, and continue processing remaining expired subscriptions.
6. WHEN the Subscription_Expiry_Job completes a run, THE Subscription_Expiry_Job SHALL log the count of subscriptions cancelled and any errors encountered.
7. THE Subscription_Expiry_Job SHALL be idempotent — running it multiple times on the same day SHALL NOT cancel a Subscription more than once.

---

### Requirement 2: Subscription Expiry Email Notifications

**User Story:** As a business owner, I want to receive email reminders before my subscription expires and a notification when it is cancelled, so that I have the opportunity to renew and am informed when access is revoked.

#### Acceptance Criteria

1. WHEN the Subscription_Expiry_Job runs and a Subscription's `renewal_date` is exactly 7 days away and `reminder_7_sent = FALSE`, THE Notification_Service SHALL send a 7-day renewal reminder email to the Business's registered email address.
2. WHEN the Subscription_Expiry_Job runs and a Subscription's `renewal_date` is exactly 1 day away and `reminder_1_sent = FALSE`, THE Notification_Service SHALL send a 1-day renewal reminder email to the Business's registered email address.
3. WHEN a 7-day reminder email is sent successfully, THE Subscription_Expiry_Job SHALL set `subscriptions.reminder_7_sent = TRUE` to prevent duplicate sends.
4. WHEN a 1-day reminder email is sent successfully, THE Subscription_Expiry_Job SHALL set `subscriptions.reminder_1_sent = TRUE` to prevent duplicate sends.
5. WHEN a Subscription is cancelled due to expiry, THE Notification_Service SHALL send a subscription-expired email that includes the plan name and instructions for reactivation.
6. IF the Notification_Service fails to send a reminder or expiry email, THEN THE Subscription_Expiry_Job SHALL log the failure with the business ID and email address, and SHALL NOT retry the email send within the same job run.
7. THE Notification_Service SHALL provide an `emailTemplates.subscriptionExpired` template that includes the plan name, expiry date, and a reactivation call-to-action.

---

### Requirement 3: Token Budget Exhaustion Notification

**User Story:** As a business owner, I want to receive email alerts when my AI token budget is approaching exhaustion and when it is fully exhausted, so that I can upgrade my plan or prepare for the AI assistant being temporarily unavailable.

#### Acceptance Criteria

1. WHEN `accumulated_cost_usd` reaches 80% of `token_budget_usd` for the current Billing_Cycle and `alert_80_sent = FALSE`, THE Token_Budget_Service SHALL send an 80% budget alert email to the Business's registered email address.
2. WHEN `accumulated_cost_usd` reaches 95% of `token_budget_usd` for the current Billing_Cycle and `alert_95_sent = FALSE`, THE Token_Budget_Service SHALL send a 95% budget alert email to the Business's registered email address.
3. WHEN `accumulated_cost_usd` reaches 100% of `token_budget_usd` for the current Billing_Cycle, THE Token_Budget_Service SHALL send a budget-exhausted notification email to the Business's registered email address.
4. WHEN a budget-exhausted email is sent successfully, THE Token_Budget_Service SHALL set a `alert_100_sent` flag on the `token_usage` row to prevent duplicate sends.
5. IF the Notification_Service fails to send a budget alert email, THEN THE Token_Budget_Service SHALL log the failure with the business ID and threshold percentage, and SHALL NOT block the inference cost recording operation.
6. THE Notification_Service SHALL provide an `emailTemplates.budgetExhausted` template that includes the plan name, exhausted amount, and the date the next billing cycle begins.

---

### Requirement 4: Token Budget Enforcement (AI Deactivation)

**User Story:** As a platform operator, I want the AI Sales Agent to stop responding for businesses that have exhausted their token budget, so that platform costs are controlled and fair usage is enforced.

#### Acceptance Criteria

1. WHEN `checkBudget` is called for a Business and `accumulated_cost_usd >= token_budget_usd` for the current Billing_Cycle, THE Token_Budget_Service SHALL return `allowed = false` and `suspended = true`.
2. WHILE a Business's token_usage row has `suspended = TRUE` for the current Billing_Cycle, THE Token_Budget_Service SHALL return `allowed = false` for every subsequent `checkBudget` call.
3. WHEN a new Billing_Cycle begins for a Business (i.e., `billing_cycle_start` advances), THE Token_Budget_Service SHALL create a new `token_usage` row with `accumulated_cost_usd = 0`, `suspended = FALSE`, `alert_80_sent = FALSE`, `alert_95_sent = FALSE`, and `alert_100_sent = FALSE`.
4. WHEN a Business upgrades to a higher plan tier during a suspended Billing_Cycle, THE Token_Budget_Service SHALL re-evaluate the budget against the new `token_budget_usd` cap and set `suspended = FALSE` if the accumulated cost is below the new cap.
5. THE Token_Budget_Service SHALL source the effective token cap from `business_token_overrides.hard_limit_usd` when a hard limit override exists for the Business, and from `plan_config.token_budget_usd` otherwise.

---

### Requirement 5: Reactivation Path

**User Story:** As a business owner, I want a clear path to reactivate my account after suspension, so that I can resume using the platform after making a new subscription payment.

#### Acceptance Criteria

1. WHEN a new subscription payment is successfully processed for a suspended Business, THE Subscription service SHALL set `subscriptions.status = 'active'` and `businesses.status = 'active'` in a single atomic transaction.
2. WHEN a Business is reactivated via a new subscription payment, THE Subscription service SHALL reset `reminder_7_sent = FALSE` and `reminder_1_sent = FALSE` on the new Subscription row.
3. THE Subscription service SHALL NOT reactivate a Business account without a corresponding successful subscription payment record.
4. WHEN a Business is reactivated, THE Notification_Service SHALL send a subscription-activated confirmation email to the Business's registered email address.

---

### Requirement 6: Observability and Auditability

**User Story:** As a platform operator, I want all automatic deactivation events to be logged and auditable, so that I can investigate disputes and monitor system health.

#### Acceptance Criteria

1. WHEN the Subscription_Expiry_Job cancels a Subscription, THE Subscription_Expiry_Job SHALL insert a row into `operator_audit_log` with `action_type = 'subscription_expired'`, the `target_business_id`, and a `details` JSON object containing the subscription ID, plan, and expiry date.
2. WHEN the Token_Budget_Service suspends a Business due to budget exhaustion, THE Token_Budget_Service SHALL insert a row into `operator_audit_log` with `action_type = 'token_budget_exhausted'`, the `target_business_id`, and a `details` JSON object containing the billing cycle start, accumulated cost, and cap.
3. THE Subscription_Expiry_Job SHALL log a structured summary at INFO level after each run, including: total subscriptions checked, total cancelled, total reminder emails sent, and total errors.
4. WHEN a budget alert email fails to send, THE Token_Budget_Service SHALL log the failure at ERROR level with the business ID, threshold, and error message.
