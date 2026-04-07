/**
 * Unit tests for deregisterWebhook (task 5.3)
 *
 * Tests cover:
 *  - Success path: Meta API returns 200 → status set to 'inactive', registered_at cleared
 *  - Failure path (non-OK HTTP): credentials retained, status set to 'error'
 *  - Failure path (network error): credentials retained, status set to 'error'
 *  - Missing integration: returns descriptive error without DB writes
 *
 * Validates: Requirement 4.6
 */
export {};
//# sourceMappingURL=deregister-webhook.test.d.ts.map