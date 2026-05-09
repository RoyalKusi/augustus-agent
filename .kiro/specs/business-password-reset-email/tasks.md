# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Auth Routes Are Reachable in All Environments
  - **Property 2: Bug Condition** - Email Delivery Errors Are Logged
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - Test file: `augustus/packages/api/src/auth/__tests__/password-reset.bug.test.ts`
  - Test case 1 — Silent swallow: mock `authService.requestPasswordReset` to throw a `new Error('SendGrid API error')`, call the `POST /auth/request-password-reset` handler, assert that `app.log.error` was called with `{ err, email }` (will fail on unfixed code — empty catch discards the error without logging)
  - Test case 2 — Anti-enumeration preserved under error: mock `authService.requestPasswordReset` to throw, assert the response is still `{ message: 'If that email is registered, a reset link has been sent.' }` with status 200 (should pass on unfixed code — confirms this behavior is already correct)
  - Test case 3 — Proxy config: read the Vite proxy configuration from `vite.config.ts` and assert that a proxy rule for `/auth` exists pointing to the API target (will fail on unfixed code — only `/api` is present)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests 1 and 3 FAIL (this is correct — it proves the bugs exist); Test 2 PASSES (confirms anti-enumeration is already working)
  - Document counterexamples found (e.g., `app.log.error` is never called; no `/auth` proxy rule in Vite config)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 3: Preservation** - Anti-Enumeration and Token Lifecycle
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for inputs that are unaffected by the two bugs (i.e., requests that reach the API and succeed without errors)
  - Test file: `augustus/packages/api/src/auth/__tests__/password-reset.preservation.test.ts`
  - Observe: calling `POST /auth/request-password-reset` with an unregistered email returns status 200 with the generic success message (anti-enumeration)
  - Observe: calling `POST /auth/reset-password` with an expired/invalid token returns status 400 with "Invalid or expired reset token."
  - Observe: calling `POST /auth/reset-password` with a valid token but a weak password returns status 400 with the password complexity error
  - Observe: calling `POST /auth/reset-password` with a valid token and compliant password returns status 200 and the token is deleted from Redis
  - Write property-based tests using `fast-check` that generate random email strings and assert the handler always returns status 200 with the generic message (regardless of whether the email is registered)
  - Property: for any email input, `POST /auth/request-password-reset` always returns `{ message: 'If that email is registered, a reset link has been sent.' }` with status 200
  - Property: for any invalid/expired token, `POST /auth/reset-password` always returns status 400
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix business password reset email delivery

  - [x] 3.1 Add `/auth` proxy rule to `vite.config.ts`
    - Open `augustus/packages/business-dashboard/vite.config.ts`
    - Add a second entry to the `server.proxy` object for `/auth` pointing to the same `apiTarget` with `changeOrigin: true` and no path rewrite (the API already serves routes at `/auth/*`)
    - The existing `/api` proxy rule must remain unchanged
    - _Bug_Condition: isBugCondition(X) = TRUE when environment = 'development' AND request URL starts with '/auth' AND no proxy rule covers '/auth'_
    - _Expected_Behavior: all '/auth/*' requests from the business dashboard dev server are forwarded to the API server_
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 Replace empty catch with logging catch in `routes.ts`
    - Open `augustus/packages/api/src/auth/routes.ts`
    - In the `POST /auth/request-password-reset` handler, replace `.catch(() => {/* swallow — no enumeration */})` with `.catch((err) => { app.log.error({ err, email }, '[auth] requestPasswordReset failed'); })`
    - The `reply.send({ message: 'If that email is registered, a reset link has been sent.' })` line must remain unconditional — the anti-enumeration response is always returned regardless of whether an error occurred
    - _Bug_Condition: isBugCondition(X) = TRUE when authService.requestPasswordReset throws AND error is silently discarded_
    - _Expected_Behavior: error is logged via app.log.error with { err, email } context; generic success response is still returned to caller_
    - _Preservation: anti-enumeration response is unchanged — caller cannot distinguish between "email not found" and "email found but send failed"_
    - _Requirements: 2.2, 3.1_

  - [x] 3.3 Verify bug condition exploration tests now pass
    - **Property 1 & 2: Expected Behavior** - Auth Routes Reachable and Errors Logged
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run `password-reset.bug.test.ts` on the FIXED code
    - **EXPECTED OUTCOME**: All tests PASS (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 3: Preservation** - Anti-Enumeration and Token Lifecycle
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `password-reset.preservation.test.ts` on the FIXED code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preserved behaviors are intact: anti-enumeration response, token validation, password complexity enforcement, token expiry

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full auth test suite: `vitest --run packages/api/src/auth`
  - Ensure both `password-reset.bug.test.ts` and `password-reset.preservation.test.ts` pass
  - Ensure any existing auth tests (login, register, verify-email) still pass — no regressions
  - Ask the user if any questions arise
