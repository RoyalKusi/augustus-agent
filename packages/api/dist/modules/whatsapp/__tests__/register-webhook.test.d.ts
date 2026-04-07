/**
 * Unit tests for registerWebhook (task 5.2)
 *
 * Tests cover:
 *  - Success path: Meta API returns 200 → status set to 'active'
 *  - Failure path (non-OK HTTP): credentials retained, status set to 'error'
 *  - Failure path (network error): credentials retained, status set to 'error'
 *  - Missing integration: returns descriptive error without DB writes
 *
 * Validates: Requirements 4.2, 4.3, 4.4
 */
export {};
//# sourceMappingURL=register-webhook.test.d.ts.map