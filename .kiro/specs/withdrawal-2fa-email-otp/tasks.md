# Implementation Plan: Withdrawal 2FA Email OTP

## Overview

Implement a two-step email OTP gate in front of the business-initiated withdrawal flow. The existing `POST /payments/withdrawals` endpoint is kept for backward compatibility; two new endpoints are added: `POST /payments/withdrawals/request-otp` and `POST /payments/withdrawals/confirm`. All OTP logic lives in a new `WithdrawalOtpService` module. The admin approval flow is entirely unchanged.

## Tasks

- [x] 1. Create database migration for withdrawal OTP columns
  - Create `packages/api/src/db/migrations/031_withdrawal_otp_columns.sql`
  - Add five columns to the `businesses` table: `withdrawal_otp_hash VARCHAR(64)`, `withdrawal_otp_expires_at TIMESTAMPTZ`, `withdrawal_otp_request_count INT NOT NULL DEFAULT 0`, `withdrawal_otp_fail_count INT NOT NULL DEFAULT 0`, `withdrawal_otp_window_start TIMESTAMPTZ`
  - Add a partial index on `withdrawal_otp_expires_at` (WHERE NOT NULL) to support efficient expiry queries
  - Follow the same `ADD COLUMN IF NOT EXISTS` pattern used in `017_operator_otp_columns.sql`
  - _Requirements: 4.2_

- [x] 2. Implement `WithdrawalOtpService` pure helper functions
  - Create `packages/api/src/modules/payment/withdrawal-otp.service.ts`
  - Implement and export `generateOtp(): string` — uses `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits
  - Implement and export `hashOtp(otp: string): string` — SHA-256 hex digest via Node `crypto.createHash`
  - Implement and export `computeOtpExpiry(from?: Date): Date` — returns `from + 600_000 ms`
  - Implement and export `isOtpExpired(expiresAt: Date, now?: Date): boolean` — returns `true` iff `expiresAt < now`
  - Implement and export `isValidOtpFormat(otp: string): boolean` — tests `/^\d{6}$/`
  - Implement and export `isValidAmount(amount: unknown): boolean` — finite positive number check
  - Implement and export `isValidMerchantRef(ref: unknown): boolean` — non-empty string after trim
  - Implement and export `isRateLimited(count: number, windowStart: Date, now?: Date): boolean` — `count > 3` within a 15-minute window; returns `false` if window has expired
  - Implement and export `buildWithdrawalOtpEmail(otp: string, amountUsd: number, paynowMerchantRef: string): { subject: string; html: string; text: string }` — subject must be exactly `"Augustus — Withdrawal Verification Code"`; body must include OTP, amount, merchant ref, "10 minutes", and a security notice
  - _Requirements: 1.1, 1.3, 2.1, 3.1–3.5, 4.1, 4.5, 5.1–5.3_

- [x] 3. Write property-based tests for pure helper functions
  - Create `packages/api/src/modules/payment/__tests__/withdrawal-otp.properties.test.ts`
  - Use `fast-check` with `numRuns: 100` for each property
  - Tag format: `Feature: withdrawal-2fa-email-otp, Property {N}: {property_text}`

  - [ ]* 3.1 Write property test for OTP generation (Property 1)
    - **Property 1: OTP Generation Produces Valid 6-Digit Codes**
    - Assert `generateOtp()` always returns a string matching `/^\d{6}$/`
    - Assert the numeric value is in range 0–999999
    - **Validates: Requirements 1.1, 4.5**

  - [ ]* 3.2 Write property test for SHA-256 hash round-trip (Property 2)
    - **Property 2: SHA-256 Hash Round-Trip**
    - Assert `hashOtp(otp)` is deterministic (same input → same output)
    - Assert `hashOtp(otp)` produces a 64-character hex string
    - Assert `hashOtp(otp1) !== hashOtp(otp2)` for any two distinct 6-digit strings
    - Assert the hash is never equal to the plaintext OTP
    - **Validates: Requirements 1.2, 2.1, 4.1, 4.6**

  - [ ]* 3.3 Write property test for OTP expiry calculation (Property 3)
    - **Property 3: OTP Expiry Calculation**
    - Assert `computeOtpExpiry(t).getTime() - t.getTime() === 600_000` for any date `t`
    - **Validates: Requirements 1.3**

  - [ ]* 3.4 Write property test for OTP expiry check (Property 4)
    - **Property 4: OTP Expiry Check**
    - Assert `isOtpExpired(expiresAt, now)` returns `true` for any `expiresAt < now`
    - Assert `isOtpExpired(expiresAt, now)` returns `false` for any `expiresAt >= now`
    - **Validates: Requirements 2.5, 4.4**

  - [ ]* 3.5 Write property test for email content completeness (Property 5)
    - **Property 5: Withdrawal OTP Email Content Completeness**
    - Assert subject is exactly `"Augustus — Withdrawal Verification Code"`
    - Assert body contains the OTP string, `"10 minutes"`, formatted amount, merchant ref, and a security notice phrase
    - **Validates: Requirements 3.1–3.5**

  - [ ]* 3.6 Write property test for amount validation (Property 6)
    - **Property 6: Amount Validation**
    - Assert `isValidAmount` returns `false` for non-positive, NaN, Infinity, and non-numeric values
    - Assert `isValidAmount` returns `true` for any finite positive number
    - **Validates: Requirements 1.6**

  - [ ]* 3.7 Write property test for OTP format validation (Property 7)
    - **Property 7: OTP Format Validation**
    - Assert `isValidOtpFormat` returns `false` for strings not matching `/^\d{6}$/`
    - Assert `isValidOtpFormat` returns `true` for any string matching `/^\d{6}$/`
    - **Validates: Requirements 2.7**

  - [ ]* 3.8 Write property test for rate limit window check (Property 8)
    - **Property 8: Rate Limit Window Check**
    - Assert `isRateLimited(n, windowStart, now)` returns `true` for `n > 3` within an active 15-minute window
    - Assert `isRateLimited(n, windowStart, now)` returns `false` for `n <= 3` within an active window
    - Assert `isRateLimited` returns `false` for any `n` when `windowStart` is more than 15 minutes before `now`
    - **Validates: Requirements 5.1–5.3**

- [x] 4. Checkpoint — Ensure all property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement `requestOtp` DB-coupled service method
  - Add `requestOtp(businessId: string, amountUsd: number, paynowMerchantRef: string): Promise<void>` to `withdrawal-otp.service.ts`
  - Validate `amountUsd` with `isValidAmount`; throw HTTP 400 if invalid
  - Validate `paynowMerchantRef` with `isValidMerchantRef`; throw HTTP 400 if invalid
  - Query `businesses` for `available_usd` (via `revenue_balances`), `withdrawal_otp_request_count`, `withdrawal_otp_window_start`, and `email`
  - Check rate limit with `isRateLimited`; throw HTTP 429 with `retryAfter` ISO timestamp if exceeded
  - Check available balance; throw HTTP 422 with `availableBalance` if insufficient
  - Generate OTP with `generateOtp()`, hash with `hashOtp()`, compute expiry with `computeOtpExpiry()`
  - Reset or increment `withdrawal_otp_request_count` and `withdrawal_otp_window_start` (lazy window reset when expired)
  - `UPDATE businesses SET withdrawal_otp_hash, withdrawal_otp_expires_at, withdrawal_otp_request_count, withdrawal_otp_window_start` — replaces any existing pending OTP
  - Call `sendEmail` with the result of `buildWithdrawalOtpEmail`; throw HTTP 500 on email failure
  - _Requirements: 1.1–1.8, 3.1–3.5, 4.1–4.3, 5.1, 5.3_

- [x] 6. Implement `confirmOtp` DB-coupled service method
  - Add `confirmOtp(businessId: string, otp: string, amountUsd: number, paynowMerchantRef: string): Promise<{ withdrawal: WithdrawalRequest; autoProcessed: boolean }>` to `withdrawal-otp.service.ts`
  - Validate `otp` with `isValidOtpFormat`; throw HTTP 400 if invalid
  - Validate `amountUsd` and `paynowMerchantRef`; throw HTTP 400 if invalid
  - Query `businesses` for `withdrawal_otp_hash`, `withdrawal_otp_expires_at`, `withdrawal_otp_fail_count`, `withdrawal_otp_window_start`
  - Check fail-attempt rate limit with `isRateLimited`; throw HTTP 429 if exceeded
  - If no pending OTP (`withdrawal_otp_hash IS NULL`), throw HTTP 401 "No pending verification. Please request a new code."
  - If OTP expired (`isOtpExpired`), throw HTTP 401 "Verification code has expired. Please request a new one."
  - Hash submitted OTP and compare to stored hash; if mismatch, increment `withdrawal_otp_fail_count` and throw HTTP 401 "Invalid verification code."
  - Check available balance; if insufficient, throw HTTP 422 with `availableBalance` — do NOT invalidate OTP, do NOT increment fail count
  - Execute in a single DB transaction: clear `withdrawal_otp_hash` and `withdrawal_otp_expires_at` to NULL, then call `createWithdrawalRequest(businessId, amountUsd, paynowMerchantRef)`
  - Return `{ withdrawal, autoProcessed }` from the transaction result
  - _Requirements: 2.1–2.8, 4.3_

- [x] 7. Write unit tests for DB-coupled service methods
  - Create `packages/api/src/modules/payment/__tests__/withdrawal-otp.test.ts`
  - Mock `pool.query` and `sendEmail` to avoid real DB/email calls

  - [ ]* 7.1 Write unit tests for `requestOtp`
    - Test: OTP replacement — call `requestOtp` twice, verify the stored hash changes (second UPDATE overwrites first)
    - Test: Rate limit enforced — mock `withdrawal_otp_request_count = 4` within active window, expect HTTP 429
    - Test: Insufficient balance — mock `available_usd < amount_usd`, expect HTTP 422 with `availableBalance`
    - Test: Email failure — mock `sendEmail` to throw, expect HTTP 500
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 5.1_

  - [ ]* 7.2 Write unit tests for `confirmOtp`
    - Test: OTP one-time use — verify OTP, then attempt to verify again; second attempt returns HTTP 401 "No pending verification."
    - Test: Balance failure preserves OTP — confirm with `amount > balance`, verify OTP columns are unchanged in DB
    - Test: Successful confirm returns `{ withdrawal, autoProcessed }` shape
    - Test: No-OTP confirm — attempt confirm without requesting; returns HTTP 401 "No pending verification."
    - Test: Wrong OTP increments fail count
    - Test: Expired OTP returns HTTP 401 "Verification code has expired."
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

- [x] 8. Register new routes in `payment.routes.ts`
  - Import `requestOtp` and `confirmOtp` from `./withdrawal-otp.service.js`
  - Add `POST /payments/withdrawals/request-otp` route with `authenticate` middleware
    - Parse `{ amount_usd, paynow_merchant_ref }` from request body
    - Call `requestOtp(businessId, amount_usd, paynow_merchant_ref)`
    - On success return HTTP 200 `{ message: "Verification code sent to your registered email." }`
    - Map thrown errors to their correct HTTP status codes (400, 422, 429, 500)
  - Add `POST /payments/withdrawals/confirm` route with `authenticate` middleware
    - Parse `{ otp, amount_usd, paynow_merchant_ref }` from request body
    - Call `confirmOtp(businessId, otp, amount_usd, paynow_merchant_ref)`
    - On success return HTTP 201 `{ withdrawal, autoProcessed }`
    - Map thrown errors to their correct HTTP status codes (400, 401, 422, 429)
  - Keep the existing `POST /payments/withdrawals` route unchanged (backward compatibility)
  - _Requirements: 1.1, 2.1, 2.3, 6.3_

- [x] 9. Export new service from payment module index
  - Update `packages/api/src/modules/payment/index.ts` to re-export `WithdrawalOtpService` functions as needed
  - Verify the module compiles without TypeScript errors (`tsc --noEmit`)
  - _Requirements: 1.1, 2.1_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The existing `POST /payments/withdrawals` route is kept unchanged — do not remove it
- Admin dashboard and `POST /admin/withdrawals/:id/approve` are not touched
- OTP invalidation and withdrawal creation must be wrapped in a single DB transaction (task 6)
- The fail counter is only incremented for wrong OTP submissions, not for balance failures
- Property tests use `numRuns: 100` and the tag format `Feature: withdrawal-2fa-email-otp, Property {N}: {property_text}`
- Migration file must be `031_withdrawal_otp_columns.sql` — verify no migration with that number already exists before running
