# Bugfix Requirements Document

## Introduction

Business account users who request a password reset via the "Forgot Password" flow do not receive the reset email, or when they do receive it, the reset link does not work as expected. The root cause is a combination of two issues:

1. **Vite dev proxy misconfiguration**: The `ForgotPassword.tsx` and `ResetPassword.tsx` pages call `/auth/request-password-reset` and `/auth/reset-password` directly (relative URLs), but the Vite dev server proxy only covers `/api/*` paths. In the local development environment, these requests never reach the API server, so no email is ever sent and no password is ever reset.

2. **Silent error swallowing**: The `POST /auth/request-password-reset` route handler swallows all errors with `.catch(() => {})`, making it impossible to detect or diagnose failures (e.g., SendGrid API errors, Redis failures). The user always receives a success message even when the email was never sent.

In production, the SPA and API share the same origin (`https://augustus.silverconne.com`), so the relative `/auth/*` calls do reach the API. However, any email delivery failure (invalid SendGrid API key, unverified sender domain, etc.) is silently swallowed, leaving users with no indication that the reset email was not sent.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a business user submits their email on the Forgot Password page in the local development environment THEN the system sends the request to the Vite dev server (not the API) because `/auth/request-password-reset` is not covered by the Vite proxy, resulting in a 404 or silent failure and no reset email being sent

1.2 WHEN the `sendPasswordResetEmail` function throws an error (e.g., invalid SendGrid API key, network timeout, unverified sender) THEN the system swallows the error silently and returns a success response to the user, giving no indication that the email was not delivered

1.3 WHEN a business user clicks the password reset link in the email THEN the system correctly navigates to the `/reset-password` page in production, but in local development the `ResetPassword.tsx` page calls `POST /auth/reset-password` as a relative URL that is not proxied by Vite, causing the reset to fail

### Expected Behavior (Correct)

2.1 WHEN a business user submits their email on the Forgot Password page in any environment (development or production) THEN the system SHALL route the request to the API server correctly, resulting in the password reset email being sent

2.2 WHEN the `sendPasswordResetEmail` function throws an error THEN the system SHALL log the error with sufficient detail (email address, error message) so that the failure can be diagnosed, while still returning a non-enumerable response to the user

2.3 WHEN a business user clicks the password reset link and submits a new password THEN the system SHALL successfully call `POST /auth/reset-password` in all environments (development and production) and reset the password

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a business user submits an email address that is not registered THEN the system SHALL CONTINUE TO return a generic success message without revealing whether the email exists (anti-enumeration behavior)

3.2 WHEN a business user submits a valid registered email THEN the system SHALL CONTINUE TO generate a secure random token, store it in Redis with a 60-minute TTL, and include it in the reset link

3.3 WHEN a business user clicks a valid reset link and submits a new password that meets the complexity requirements THEN the system SHALL CONTINUE TO update the password hash in the database and invalidate the reset token

3.4 WHEN a business user submits a reset token that has expired or is invalid THEN the system SHALL CONTINUE TO return a 400 error with the message "Invalid or expired password reset token."

3.5 WHEN a business user successfully resets their password THEN the system SHALL CONTINUE TO redirect them to the login page with a success message
