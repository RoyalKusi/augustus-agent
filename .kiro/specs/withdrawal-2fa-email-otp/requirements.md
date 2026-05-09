# Requirements Document

## Introduction

This feature adds a two-factor authentication (2FA) layer to the withdrawal process in the Augustus platform. When a business initiates a withdrawal request via `POST /payments/withdrawals`, a one-time password (OTP) is sent to the business's registered email address. The business must submit the OTP alongside the withdrawal request (or in a separate confirmation step) to complete the operation. This prevents unauthorised or accidental withdrawals and protects business revenue balances.

The feature touches two layers:
- **API** (`packages/api`): OTP generation, storage, email dispatch, and verification logic wired into the withdrawal endpoint.
- **Admin Dashboard** (`packages/admin-dashboard`): No changes required — the admin approval flow is unaffected; 2FA applies only to the business-initiated withdrawal request.

## Glossary

- **Business**: A platform tenant (operator of a WhatsApp sales agent) that holds a revenue balance and can request withdrawals.
- **Withdrawal_Request**: A record in `withdrawal_requests` representing a business's request to transfer available balance to their Paynow merchant account.
- **OTP**: A one-time password — a cryptographically random 6-digit numeric code valid for a limited time window.
- **OTP_Service**: The API-side module responsible for generating, storing, sending, and verifying withdrawal OTPs.
- **Withdrawal_Service**: The existing `payment.service.ts` module that creates and processes withdrawal requests.
- **Email_Service**: The existing `notification.service.ts` module that dispatches transactional emails via SendGrid or SES.
- **Pending_OTP**: An OTP that has been generated and sent but not yet verified or expired.
- **OTP_Expiry**: The point in time after which a Pending_OTP is no longer valid (10 minutes from generation).
- **Confirmation_Token**: A short-lived, single-use token returned to the client after OTP verification, used to authorise the actual withdrawal creation.

---

## Requirements

### Requirement 1: Initiate Withdrawal OTP

**User Story:** As a business, I want to receive an OTP on my registered email when I start a withdrawal, so that I can confirm the transaction is authorised by me.

#### Acceptance Criteria

1. WHEN a business sends `POST /payments/withdrawals/request-otp` with a valid `amount_usd` and `paynow_merchant_ref`, THE OTP_Service SHALL generate a cryptographically random 6-digit numeric OTP.
2. WHEN the OTP_Service generates an OTP, THE OTP_Service SHALL store a SHA-256 hash of the OTP and its expiry timestamp against the business record in the database.
3. WHEN the OTP_Service stores the OTP hash, THE OTP_Service SHALL set the OTP_Expiry to 10 minutes from the time of generation.
4. WHEN the OTP_Service stores the OTP hash, THE Email_Service SHALL send an email to the business's registered email address containing the 6-digit OTP code.
5. WHEN a business sends `POST /payments/withdrawals/request-otp` and a Pending_OTP already exists for that business that has not yet expired, THE OTP_Service SHALL replace the existing OTP with a newly generated one and resend the email.
6. IF the `amount_usd` field is missing or not a positive number in the request to `POST /payments/withdrawals/request-otp`, THEN THE OTP_Service SHALL return HTTP 400 with a descriptive error message.
7. IF the `paynow_merchant_ref` field is missing or empty in the request to `POST /payments/withdrawals/request-otp`, THEN THE OTP_Service SHALL return HTTP 400 with a descriptive error message.
8. IF the business's available balance is less than `amount_usd` at the time of OTP request, THEN THE OTP_Service SHALL return HTTP 422 with the current available balance in the response body.

---

### Requirement 2: Verify OTP and Confirm Withdrawal

**User Story:** As a business, I want to submit my OTP to confirm a withdrawal, so that the withdrawal is only processed when I explicitly authorise it.

#### Acceptance Criteria

1. WHEN a business sends `POST /payments/withdrawals/confirm` with a valid `otp` and `withdrawal_context` (amount and merchant ref), THE OTP_Service SHALL verify the submitted OTP against the stored hash for that business.
2. WHEN the submitted OTP matches the stored hash and the OTP has not expired, THE Withdrawal_Service SHALL create the withdrawal request and THE OTP_Service SHALL invalidate the OTP immediately after use.
3. WHEN the Withdrawal_Service creates the withdrawal request after successful OTP verification, THE Withdrawal_Service SHALL return the created withdrawal record and an `autoProcessed` flag in the HTTP 201 response.
4. IF the submitted OTP does not match the stored hash, THEN THE OTP_Service SHALL return HTTP 401 with the error message "Invalid verification code."
5. IF the submitted OTP has expired (current time is past OTP_Expiry), THEN THE OTP_Service SHALL return HTTP 401 with the error message "Verification code has expired. Please request a new one."
6. IF no Pending_OTP exists for the business at the time of confirmation, THEN THE OTP_Service SHALL return HTTP 401 with the error message "No pending verification. Please request a new code."
7. IF the `otp` field is missing or not a 6-digit numeric string in the confirm request, THEN THE OTP_Service SHALL return HTTP 400 with a descriptive error message.
8. IF the business's available balance is less than `amount_usd` at the time of confirmation, THEN THE Withdrawal_Service SHALL return HTTP 422 with the current available balance, and THE OTP_Service SHALL NOT invalidate the OTP.

---

### Requirement 3: OTP Email Content

**User Story:** As a business, I want the OTP email to be clear and include security guidance, so that I can use the code confidently and know what to do if I did not initiate the request.

#### Acceptance Criteria

1. THE Email_Service SHALL send the withdrawal OTP email with the subject "Augustus — Withdrawal Verification Code".
2. THE Email_Service SHALL include the 6-digit OTP code prominently in the email body.
3. THE Email_Service SHALL state in the email body that the code expires in 10 minutes.
4. THE Email_Service SHALL include the withdrawal amount (in USD) and the Paynow merchant reference in the email body so the business can verify the transaction details.
5. THE Email_Service SHALL include a security notice in the email body instructing the recipient to contact support if they did not initiate the withdrawal.

---

### Requirement 4: OTP Storage and Security

**User Story:** As a platform operator, I want OTPs to be stored securely and to expire automatically, so that the system is not vulnerable to replay attacks or stale credential abuse.

#### Acceptance Criteria

1. THE OTP_Service SHALL store only the SHA-256 hash of the OTP, never the plaintext code, in the database.
2. THE OTP_Service SHALL store the OTP hash and expiry in dedicated columns on the `businesses` table (or a separate `withdrawal_otps` table).
3. WHEN an OTP is successfully verified, THE OTP_Service SHALL set the stored hash and expiry to NULL immediately.
4. WHEN an OTP expires without being used, THE OTP_Service SHALL treat it as invalid on the next verification attempt without requiring a background cleanup job.
5. THE OTP_Service SHALL generate OTPs using a cryptographically secure random number generator with uniform distribution across all 6-digit values (000000–999999).
6. FOR ALL valid 6-digit OTP codes, the round-trip property SHALL hold: a code generated by the OTP_Service, when hashed with SHA-256 and compared to the stored hash, SHALL produce a match.

---

### Requirement 5: Rate Limiting

**User Story:** As a platform operator, I want OTP requests to be rate-limited per business, so that the email service is not abused and brute-force attacks on OTP codes are mitigated.

#### Acceptance Criteria

1. WHEN a business sends more than 3 `POST /payments/withdrawals/request-otp` requests within a 15-minute window, THE OTP_Service SHALL return HTTP 429 with a message indicating when the limit resets.
2. WHEN a business submits more than 3 incorrect OTP codes within a 15-minute window, THE OTP_Service SHALL return HTTP 429 and SHALL NOT accept further OTP submissions until the window resets.
3. WHEN the rate-limit window expires, THE OTP_Service SHALL automatically allow new OTP requests and verification attempts from that business.

---

### Requirement 6: Admin Dashboard — No Change to Approval Flow

**User Story:** As a platform operator using the admin dashboard, I want the withdrawal approval flow to remain unchanged, so that my existing workflow is not disrupted by the business-side 2FA change.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL continue to display pending withdrawals on the Withdrawals page without requiring any OTP input from the operator.
2. WHEN an operator clicks "Approve & Process" on a pending withdrawal, THE Admin_Dashboard SHALL call `POST /admin/withdrawals/:id/approve` as before, with no additional OTP step.
3. THE Withdrawal_Service SHALL continue to accept `POST /admin/withdrawals/:id/approve` from authenticated operators without requiring an OTP.
