# Implementation Plan: Subscription Expiry and Token Deactivation

## Overview

Implement two independent automatic deactivation paths: a daily subscription expiry job that cancels past-due subscriptions and suspends businesses, and an extension to the token budget service that sends a 100% exhaustion email, writes audit log entries, and re-evaluates suspension on plan upgrade. Both paths share the existing `notification.service.ts` and `operator_audit_log` infrastructure.

## Tasks

- [x] 1. Add DB migration for `alert_100_sent` column
  - Create `augustus/packages/api/src/db/migrations/034_alert_100_sent.sql`
  - Add `ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS alert_100_sent BOOLEAN NOT NULL DEFAULT FALSE;`
  - _Requirements: 3.4, 4.3_

- [x] 2. Add new email templates to `notification.service.ts`
  - [x] 2.1 Implement `emailTemplates.subscriptionExpired` template
    - Add `subscriptionExpired(planName: string, expiryDate: string, reactivationUrl: string)` to the `emailTemplates` object in `notification.service.ts`
    - HTML and text output must include the plan name, expiry date string, and a reactivation call-to-action link
    - _Requirements: 2.5, 2.7_

  - [ ]* 2.2 Write property test for `subscriptionExpired` template (Property 6)
    - **Property 6: Subscription expiry email template contains required fields**
    - Use `fc.string()` for plan name, `fc.string()` for expiry date, `fc.webUrl()` for reactivation URL
    - Assert `html` and `text` contain all three values
    - **Validates: Requirements 2.5, 2.7**
    - Test file: `augustus/packages/api/src/modules/subscription/__tests__/subscription-expiry.job.test.ts`

  - [x] 2.3 Implement `emailTemplates.budgetExhausted` template
    - Add `budgetExhausted(planName: string, exhaustedAmountUsd: number, nextCycleDate: string)` to the `emailTemplates` object in `notification.service.ts`
    - HTML and text output must include the plan name, exhausted amount, and next billing cycle date
    - _Requirements: 3.6_

  - [ ]* 2.4 Write property test for `budgetExhausted` template (Property 9)
    - **Property 9: Budget exhausted email template contains required fields**
    - Use `fc.string()` for plan name, `fc.float({ min: 0.01 })` for amount, `fc.string()` for next cycle date
    - Assert `html` and `text` contain all three values
    - **Validates: Requirements 3.6**
    - Test file: `augustus/packages/api/src/modules/token-budget/__tests__/token-budget.service.test.ts`

- [x] 3. Add send helpers to `notification.stub.ts`
  - [x] 3.1 Implement `sendSubscriptionExpiredEmail` helper
    - Add `sendSubscriptionExpiredEmail(email: string, planName: string, expiryDate: Date): Promise<void>` to `notification.stub.ts`
    - Format `expiryDate` as a human-readable string, build `reactivationUrl` from `config.frontendUrl + '/dashboard/subscription'`
    - Call `emailTemplates.subscriptionExpired` and dispatch via `sendEmail`
    - _Requirements: 2.5_

  - [x] 3.2 Implement `sendBudgetExhaustedEmail` helper
    - Add `sendBudgetExhaustedEmail(email: string, planName: string, exhaustedAmountUsd: number, nextCycleDate: Date): Promise<void>` to `notification.stub.ts`
    - Format `nextCycleDate` as a human-readable string
    - Call `emailTemplates.budgetExhausted` and dispatch via `sendEmail`
    - _Requirements: 3.3, 3.6_

- [x] 4. Extend `token-budget.service.ts`
  - [x] 4.1 Add `alert_100_sent` handling to `evaluateThresholds`
    - Import `sendBudgetExhaustedEmail` from `notification.stub.ts`
    - In `evaluateThresholds`, add a block: when `pct >= 1.0 && !usage.alert_100_sent`, call `sendBudgetExhaustedEmail` (wrapped in try/catch — log failure at ERROR level, do not rethrow), then add `alert_100_sent = TRUE` to the `updates` array
    - The `alert_100_sent` update must be applied regardless of whether the email send succeeded, to prevent infinite retry loops
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 4.2 Add audit log write on budget exhaustion suspension
    - In `evaluateThresholds`, when `pct >= 1.0 && !usage.suspended`, after setting `suspended = TRUE`, insert a row into `operator_audit_log` with `action_type = 'token_budget_exhausted'`, `target_business_id = businessId`, and `details = { billingCycleStart, accumulatedCostUsd, capUsd }`
    - Use the existing `pool.query` pattern; wrap in try/catch and log failures without blocking
    - _Requirements: 6.2_

  - [ ]* 4.3 Write property tests for `evaluateThresholds` extensions (Properties 7, 8)
    - **Property 7: Budget alert flags prevent duplicate threshold emails**
    - Use `fc.float({ min: 0, max: 10 })` for cap, generate cost sequences that cross 80%, 95%, 100% thresholds; assert each alert email is sent exactly once per cycle
    - **Property 8: Email failure does not block cost recording**
    - Mock `sendBudgetExhaustedEmail` to throw; assert `recordInferenceCost` still returns correct `BudgetStatus` and `accumulated_cost_usd` is incremented
    - **Validates: Requirements 3.1–3.5, 6.4**
    - Test file: `augustus/packages/api/src/modules/token-budget/__tests__/token-budget.service.test.ts`

  - [x] 4.4 Implement `reevaluateBudgetAfterUpgrade` helper
    - Add `export async function reevaluateBudgetAfterUpgrade(businessId: string): Promise<void>` to `token-budget.service.ts`
    - Fetch the current `token_usage` row and the new effective cap via `getUsageAndCap`
    - If `accumulated_cost_usd < capUsd` and `suspended = TRUE`, update `token_usage SET suspended = FALSE` for the current billing cycle
    - _Requirements: 4.4_

  - [ ]* 4.5 Write property test for `reevaluateBudgetAfterUpgrade` (Property 12)
    - **Property 12: Upgrade re-evaluation lifts suspension when cost is below new cap**
    - Use `fc.float({ min: 0 })` for accumulated cost `A` and `fc.float({ min: 0 })` for new cap `C`; when `A < C`, assert `suspended` becomes `FALSE` and `checkBudget` returns `allowed = true`
    - **Validates: Requirements 4.4**
    - Test file: `augustus/packages/api/src/modules/token-budget/__tests__/token-budget.service.test.ts`

  - [ ]* 4.6 Write property tests for `checkBudget` and cap resolution (Properties 10, 13)
    - **Property 10: checkBudget returns allowed=false when accumulated >= cap**
    - Use `fc.float({ min: 0 })` for cap and accumulated cost pairs where `accumulated >= cap`; assert `{ allowed: false, suspended: true }`
    - **Property 13: Effective cap resolution respects override precedence**
    - Generate scenarios with and without `business_token_overrides` rows; assert `capUsd` equals `hard_limit_usd` when override exists, `plan_config.token_budget_usd` otherwise
    - **Validates: Requirements 4.1, 4.2, 4.5**
    - Test file: `augustus/packages/api/src/modules/token-budget/__tests__/token-budget.service.test.ts`

  - [ ]* 4.7 Write property test for billing cycle reset (Property 11)
    - **Property 11: Billing cycle reset clears all flags and counters**
    - Use `fc.uuid()` for business IDs and arbitrary prior flag states; after `resetBillingCycle`, assert new row has `accumulated_cost_usd = 0`, `suspended = FALSE`, `alert_80_sent = FALSE`, `alert_95_sent = FALSE`, `alert_100_sent = FALSE`
    - **Validates: Requirements 4.3**
    - Test file: `augustus/packages/api/src/modules/token-budget/__tests__/token-budget.service.test.ts`

- [x] 5. Checkpoint — token budget extensions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create `subscription-expiry.job.ts`
  - [x] 6.1 Define `ExpiryJobResult` interface and `runSubscriptionExpiryJob` function skeleton
    - Create `augustus/packages/api/src/modules/subscription/subscription-expiry.job.ts`
    - Export `ExpiryJobResult` interface: `{ totalChecked, totalCancelled, totalRemindersSent, totalErrors, errors: Array<{ subscriptionId, businessId, error }> }`
    - Export `async function runSubscriptionExpiryJob(): Promise<ExpiryJobResult>`
    - _Requirements: 1.1, 1.6_

  - [x] 6.2 Implement expired subscription query
    - Inside `runSubscriptionExpiryJob`, query `subscriptions JOIN businesses` where `subscriptions.status = 'active' AND renewal_date < CURRENT_DATE`, selecting `id`, `business_id`, `plan`, `renewal_date`, and `businesses.email`
    - Set `totalChecked` from the result row count
    - _Requirements: 1.2_

  - [x] 6.3 Implement per-subscription atomic cancellation transaction
    - For each expired subscription row, open a `pool.connect()` transaction
    - Within the transaction: `UPDATE subscriptions SET status = 'cancelled'` and `UPDATE businesses SET status = 'suspended'` for the matching IDs
    - Commit on success; rollback and catch on failure
    - Wrap each iteration in try/catch — on error, push to `errors` array and increment `totalErrors`, then `continue` to the next subscription
    - _Requirements: 1.3, 1.5, 1.7_

  - [x] 6.4 Add audit log write and expiry email send per cancelled subscription
    - After a successful commit, insert into `operator_audit_log` with `action_type = 'subscription_expired'`, `target_business_id`, and `details = { subscriptionId, plan, expiryDate }`
    - Call `sendSubscriptionExpiredEmail` (wrapped in try/catch — log failure with business ID and email, do not rethrow)
    - Increment `totalCancelled` on success
    - _Requirements: 1.4, 2.5, 2.6, 6.1_

  - [x] 6.5 Add structured summary log on job completion
    - After the loop, log at INFO level: `[SubscriptionExpiryJob] Run complete: checked=N, cancelled=N, reminders=N, errors=N`
    - Return the `ExpiryJobResult` object
    - _Requirements: 1.6_

  - [ ]* 6.6 Write property tests for expiry job query predicate and state transitions (Properties 1, 2)
    - **Property 1: Expiry job selects only active, past-due subscriptions**
    - Use `fc.record({ status: fc.constantFrom('active','cancelled','suspended'), renewal_date: fc.date() })` to generate subscription rows; assert the query predicate filters correctly
    - **Property 2: Expiry job produces correct state transitions**
    - For any expired subscription, after processing, assert `subscriptions.status = 'cancelled'` and `businesses.status = 'suspended'`
    - **Validates: Requirements 1.2, 1.3**
    - Test file: `augustus/packages/api/src/modules/subscription/__tests__/subscription-expiry.job.test.ts`

  - [ ]* 6.7 Write property tests for idempotence and batch resilience (Properties 3, 4)
    - **Property 3: Expiry job is idempotent**
    - Run `runSubscriptionExpiryJob` twice on the same fixture; assert final DB state is identical to a single run and no duplicate emails or audit entries are created
    - **Property 4: Expiry job continues on per-item failure**
    - Use `fc.integer({ min: 2, max: 10 })` for batch size; mock one subscription's DB transaction to throw; assert remaining N-1 subscriptions are processed and `totalErrors = 1`
    - **Validates: Requirements 1.5, 1.7**
    - Test file: `augustus/packages/api/src/modules/subscription/__tests__/subscription-expiry.job.test.ts`

  - [ ]* 6.8 Write property tests for reminder flag deduplication and audit log completeness (Properties 5, 14)
    - **Property 5: Reminder flags prevent duplicate sends**
    - Use `fc.integer({ min: 0, max: 14 })` for days-until-renewal and `fc.boolean()` for flag state; assert 7-day and 1-day reminders are sent exactly once per cycle
    - **Property 14: Audit log entry is written for every automatic deactivation**
    - For any cancelled subscription, assert an `operator_audit_log` row exists with correct `action_type`, `target_business_id`, and `details` fields
    - **Validates: Requirements 2.1–2.4, 6.1, 6.2**
    - Test file: `augustus/packages/api/src/modules/subscription/__tests__/subscription-expiry.job.test.ts`

- [x] 7. Wire `runSubscriptionExpiryJob` into the daily job runner in `index.ts`
  - Import `runSubscriptionExpiryJob` from `./modules/subscription/subscription-expiry.job.js`
  - Add `runSubscriptionExpiryJob().catch((err) => alertJobFailure('runSubscriptionExpiryJob', err))` inside the `runDailyJobs` function, alongside the existing daily job calls
  - _Requirements: 1.1_

- [x] 8. Call `reevaluateBudgetAfterUpgrade` from `upgradePlan` in `subscription.service.ts`
  - In `subscription.service.ts`, after the `upgradePlan` DB update succeeds, import and call `reevaluateBudgetAfterUpgrade(businessId)` from `token-budget.service.ts`
  - Wrap in try/catch and log failures without rethrowing — the upgrade itself must not fail if budget re-evaluation errors
  - _Requirements: 4.4_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** (`npm install --save-dev fast-check` in `augustus/packages/api`)
- All email sends in the expiry job and `evaluateThresholds` are non-blocking — failures are logged at ERROR level but never propagate to callers
- The `alert_100_sent` flag is set regardless of email send success to prevent infinite retry loops
- The expiry job is idempotent by design: the query filters `status = 'active'`, so already-cancelled subscriptions are never re-processed
- Migration `034_alert_100_sent.sql` uses `ADD COLUMN IF NOT EXISTS` so it is safe to run multiple times
