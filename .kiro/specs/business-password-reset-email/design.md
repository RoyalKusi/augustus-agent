# Business Password Reset Email Bugfix Design

## Overview

Business account users who request a password reset do not receive the reset email, or the reset link fails to work, due to two independent root causes.

**Root Cause 1 — Vite dev proxy misconfiguration**: `ForgotPassword.tsx` and `ResetPassword.tsx` call `/auth/request-password-reset` and `/auth/reset-password` as relative URLs. The Vite dev server proxy in `vite.config.ts` only covers `/api/*` paths, so in local development these requests hit the Vite dev server directly and receive a 404 — the API is never reached and no email is ever sent. In production the SPA and API share the same origin, so the relative URLs do reach the API, but any delivery failure is silently swallowed.

**Root Cause 2 — Silent error swallowing**: The `POST /auth/request-password-reset` route handler in `routes.ts` calls `.catch(() => {})`, discarding all errors (SendGrid failures, Redis failures, network timeouts, etc.) and always returning a success response. This makes it impossible to detect or diagnose email delivery failures in any environment.

The fix is minimal and targeted: add `/auth` to the Vite proxy configuration, and replace the empty catch handler with one that logs the error while preserving the anti-enumeration response.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger the bug — either a `/auth/*` request in local dev (proxy miss) or a `sendEmail` failure in any environment (silent swallow)
- **Property (P)**: The desired behavior — password reset emails are delivered and errors are observable in logs
- **Preservation**: Existing behaviors that must remain unchanged — anti-enumeration response, token generation/storage, password validation, token expiry enforcement
- **authRoutes**: The function in `augustus/packages/api/src/auth/routes.ts` that registers all `/auth/*` Fastify route handlers
- **requestPasswordReset**: The method in `augustus/packages/api/src/auth/service.ts` that generates a reset token, stores it in Redis, and sends the reset email via SendGrid
- **Vite proxy**: The `server.proxy` configuration in `augustus/packages/business-dashboard/vite.config.ts` that forwards matching URL paths from the Vite dev server to the API server
- **anti-enumeration response**: The generic success message returned regardless of whether the email exists, preventing attackers from discovering registered addresses

## Bug Details

### Bug Condition

The bug manifests in two distinct scenarios:

1. **Proxy miss (dev only)**: Any request to `/auth/request-password-reset` or `/auth/reset-password` from the business dashboard in local development is not forwarded to the API because the Vite proxy only covers `/api/*`.

2. **Silent swallow (all environments)**: Any error thrown inside `authService.requestPasswordReset(email)` — including SendGrid API errors, Redis connection failures, or network timeouts — is caught and discarded by `.catch(() => {})`, making the failure invisible.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PasswordResetRequest
  OUTPUT: boolean

  // Scenario 1: dev proxy miss
  IF environment = 'development'
     AND input.url IN ['/auth/request-password-reset', '/auth/reset-password']
     AND viteProxy.covers('/auth') = FALSE
  THEN RETURN TRUE

  // Scenario 2: silent error swallow
  IF authService.requestPasswordReset(input.email) THROWS error
     AND error IS silently_caught
  THEN RETURN TRUE

  RETURN FALSE
END FUNCTION
```

### Examples

- **Dev proxy miss**: Developer runs the business dashboard locally, enters their email on the Forgot Password page, clicks "Send reset link" — the browser receives a 404 from the Vite dev server, the UI shows an error, and no email is sent.
- **Silent SendGrid failure (production)**: A business user submits their email; the SendGrid API key is invalid or the sender domain is unverified; `sendEmail` throws; `.catch(() => {})` discards the error; the user sees "If that email is registered, a reset link has been sent." but receives nothing.
- **Silent Redis failure**: Redis is temporarily unavailable; `storePasswordResetToken` throws; the error is swallowed; the user sees success but no token was stored, so any reset link would be invalid.
- **Reset link in dev**: A business user receives a reset email (e.g., sent from production), clicks the link which opens the local dev dashboard at `/reset-password?token=...`, submits a new password — the `POST /auth/reset-password` call hits the Vite dev server (404) because `/auth` is not proxied.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When a business user submits an email address that is not registered, the system must continue to return the generic success message without revealing whether the email exists (anti-enumeration)
- When a business user submits a valid registered email, the system must continue to generate a secure random token, store it in Redis with a 60-minute TTL, and include it in the reset link
- When a business user submits a valid reset token with a compliant new password, the system must continue to update the password hash in the database and invalidate the token
- When a business user submits an expired or invalid reset token, the system must continue to return a 400 error with "Invalid or expired reset token."
- When a business user successfully resets their password, the system must continue to redirect them to the login page with a success message

**Scope:**
All behaviors that do NOT involve the `/auth/request-password-reset` or `/auth/reset-password` paths are completely unaffected by this fix. This includes:
- Login, registration, and email verification flows
- All `/api/*` proxied requests
- Mouse/keyboard interactions unrelated to the password reset flow
- Admin dashboard authentication

## Hypothesized Root Cause

Based on code review of the four affected files:

1. **Incomplete Vite proxy configuration**: `vite.config.ts` defines a single proxy rule for `/api` with a path rewrite (`/api` → ``). The `/auth` prefix is absent. Since the frontend calls `/auth/request-password-reset` and `/auth/reset-password` directly (no `/api` prefix), these requests are never forwarded to the API in local dev. The fix is to add a second proxy entry for `/auth` pointing to the same `apiTarget` with no rewrite (the API already registers routes at `/auth/*`).

2. **Empty catch handler in `routes.ts`**: The `POST /auth/request-password-reset` handler calls `authService.requestPasswordReset(email).catch(() => {})`. The intent was to prevent email enumeration by always returning success, but the empty catch also discards legitimate operational errors. The fix is to replace the empty catch with one that logs the error using Fastify's built-in logger (`app.log.error`) while still returning the generic success response.

3. **No logging infrastructure gap**: Fastify's `app.log` is available in the route handler scope, so no new logging dependency is needed. The fix is purely a one-line change to the catch handler.

4. **Frontend fetch calls are correct**: `ForgotPassword.tsx` and `ResetPassword.tsx` correctly call `/auth/request-password-reset` and `/auth/reset-password`. No changes are needed to these files — the proxy fix in `vite.config.ts` is sufficient to make them work in local dev.

## Correctness Properties

Property 1: Bug Condition - Auth Routes Are Reachable in All Environments

_For any_ password reset request (either `POST /auth/request-password-reset` or `POST /auth/reset-password`) submitted from the business dashboard, the fixed configuration SHALL route the request to the API server in both local development (via Vite proxy) and production (via same-origin), so the API handler is invoked and can process the request.

**Validates: Requirements 2.1, 2.3**

Property 2: Bug Condition - Email Delivery Errors Are Logged

_For any_ invocation of `POST /auth/request-password-reset` where `authService.requestPasswordReset(email)` throws an error, the fixed handler SHALL log the error (including the email address and error details) via `app.log.error` while still returning the generic anti-enumeration success response to the caller.

**Validates: Requirements 2.2**

Property 3: Preservation - Anti-Enumeration and Token Lifecycle

_For any_ password reset request where the bug condition does NOT hold (i.e., the request reaches the API and no error is thrown), the fixed code SHALL produce exactly the same behavior as the original code: returning the generic success message for unregistered emails, generating and storing a valid reset token for registered emails, validating and consuming the token on reset, and enforcing password complexity requirements.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `augustus/packages/business-dashboard/vite.config.ts`

**Specific Changes**:

1. **Add `/auth` proxy rule**: Add a second entry to the `proxy` object that forwards `/auth` requests to the same `apiTarget` without any path rewrite (the API already serves routes at `/auth/*`):
   ```typescript
   proxy: {
     '/api': {
       target: apiTarget,
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/api/, ''),
     },
     '/auth': {
       target: apiTarget,
       changeOrigin: true,
     },
   },
   ```

---

**File**: `augustus/packages/api/src/auth/routes.ts`

**Function**: `authRoutes` → `POST /auth/request-password-reset` handler

**Specific Changes**:

2. **Replace empty catch with logging catch**: Change the `.catch(() => {})` to log the error while preserving the anti-enumeration response:
   ```typescript
   // Before:
   await authService.requestPasswordReset(email).catch(() => {/* swallow — no enumeration */});

   // After:
   await authService.requestPasswordReset(email).catch((err) => {
     app.log.error({ err, email }, '[auth] requestPasswordReset failed');
   });
   ```
   The generic success response (`reply.send(...)`) is returned unconditionally in both cases, preserving anti-enumeration behavior.

---

**No changes required** to `ForgotPassword.tsx` or `ResetPassword.tsx` — the frontend fetch calls are already correct.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests for the `POST /auth/request-password-reset` route handler that mock `authService.requestPasswordReset` to throw an error, then assert whether the error is logged. Run these tests on the UNFIXED code to observe that the error is silently swallowed (no log call). For the proxy issue, verify the Vite config directly by inspecting the proxy rules.

**Test Cases**:
1. **Silent swallow test**: Mock `authService.requestPasswordReset` to throw a `SendGrid API error`. Assert that `app.log.error` is called with the error and email. (Will fail on unfixed code — the empty catch discards the error without logging.)
2. **Anti-enumeration preserved**: Mock `authService.requestPasswordReset` to throw. Assert the response is still `{ message: 'If that email is registered, a reset link has been sent.' }` with status 200. (Should pass on unfixed code — confirms this behavior is preserved.)
3. **Proxy config test**: Read `vite.config.ts` proxy rules and assert that `/auth` is present as a proxy target. (Will fail on unfixed code — only `/api` is present.)

**Expected Counterexamples**:
- `app.log.error` is never called when `requestPasswordReset` throws — the error is silently discarded
- The Vite proxy configuration has no entry for `/auth`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedHandler(input)
  IF input.scenario = 'sendEmail throws'
  THEN ASSERT app.log.error WAS CALLED with { err, email }
       AND result.status = 200
       AND result.body.message = 'If that email is registered, a reset link has been sent.'
  IF input.scenario = 'dev proxy'
  THEN ASSERT viteProxy.covers('/auth') = TRUE
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fixedHandler(input) = originalHandler(input)
  // i.e., anti-enumeration response, token generation, token validation,
  // password complexity enforcement, and token expiry all behave identically
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of email inputs (registered, unregistered, malformed) automatically
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that the anti-enumeration response is always returned regardless of internal errors

**Test Cases**:
1. **Anti-enumeration preservation**: For any email (registered or not), assert the response is always the generic success message — never a 404 or 500
2. **Token lifecycle preservation**: For a registered email with no errors, assert a token is stored in Redis and the reset email is sent (same as original behavior)
3. **Reset token validation preservation**: For an expired/invalid token, assert a 400 error is returned with "Invalid or expired reset token."
4. **Password complexity preservation**: For a valid token but a weak password, assert a 400 error is returned

### Unit Tests

- Test that the route handler calls `app.log.error` when `requestPasswordReset` throws
- Test that the route handler always returns the generic success response regardless of whether `requestPasswordReset` throws
- Test that the Vite proxy configuration includes an entry for `/auth` pointing to the API target
- Test edge cases: empty email body, missing email field, malformed JSON

### Property-Based Tests

- Generate random email strings and verify the `POST /auth/request-password-reset` handler always returns status 200 with the generic message (regardless of whether the email is registered)
- Generate random error types thrown by `requestPasswordReset` and verify `app.log.error` is always called with the error details
- Generate random valid/invalid reset tokens and verify the `POST /auth/reset-password` handler returns the correct status code in each case

### Integration Tests

- Test the full forgot-password flow in a local dev environment: submit email → verify the request reaches the API (not a 404) → verify a reset token is stored in Redis
- Test the full reset-password flow: submit token + new password → verify the password is updated in the database
- Test that a SendGrid failure is logged in the API server logs while the user still receives the generic success response
