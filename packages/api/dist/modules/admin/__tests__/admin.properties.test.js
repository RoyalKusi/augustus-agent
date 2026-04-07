/**
 * Property-Based Tests for Admin Dashboard
 * Properties: 36, 37, 38
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canSuspend, canReactivate, isPlatformCostAlertTriggered } from '../admin.pure.js';
// ─── Property 36: Business Suspension ────────────────────────────────────────
// **Validates: Requirements 14.3**
describe('Property 36: Business Suspension', () => {
    it('canSuspend returns true for active status', () => {
        expect(canSuspend('active')).toBe(true);
    });
    it('canSuspend returns false for suspended status', () => {
        expect(canSuspend('suspended')).toBe(false);
    });
    it('canSuspend returns false for any status other than active', () => {
        fc.assert(fc.property(fc.string().filter((s) => s !== 'active'), (status) => {
            expect(canSuspend(status)).toBe(false);
        }), { numRuns: 25 });
    });
    it('canSuspend returns true only for exactly "active"', () => {
        fc.assert(fc.property(fc.constantFrom('active', 'suspended', 'pending_verification', 'inactive', '', 'ACTIVE', 'Active'), (status) => {
            const result = canSuspend(status);
            expect(result).toBe(status === 'active');
        }), { numRuns: 25 });
    });
});
// ─── Property 37: Business Reactivation ──────────────────────────────────────
// **Validates: Requirements 14.4**
describe('Property 37: Business Reactivation', () => {
    it('canReactivate returns true for suspended status', () => {
        expect(canReactivate('suspended')).toBe(true);
    });
    it('canReactivate returns false for active status', () => {
        expect(canReactivate('active')).toBe(false);
    });
    it('canReactivate returns false for any status other than suspended', () => {
        fc.assert(fc.property(fc.string().filter((s) => s !== 'suspended'), (status) => {
            expect(canReactivate(status)).toBe(false);
        }), { numRuns: 25 });
    });
    it('canReactivate returns true only for exactly "suspended"', () => {
        fc.assert(fc.property(fc.constantFrom('suspended', 'active', 'pending_verification', 'inactive', '', 'SUSPENDED', 'Suspended'), (status) => {
            const result = canReactivate(status);
            expect(result).toBe(status === 'suspended');
        }), { numRuns: 25 });
    });
});
// ─── Property 38: Platform Cost Alert ────────────────────────────────────────
// **Validates: Requirements 15.3**
describe('Property 38: Platform Cost Alert', () => {
    it('isPlatformCostAlertTriggered returns true when cost/cap >= 0.9', () => {
        fc.assert(fc.property(
        // Use integer percentages 90-100 to avoid float32 precision issues
        fc.integer({ min: 90, max: 100 }), fc.integer({ min: 1, max: 10000 }), (percentInt, capInt) => {
            const cap = capInt;
            const cost = (percentInt / 100) * cap;
            expect(isPlatformCostAlertTriggered(cost, cap)).toBe(true);
        }), { numRuns: 25 });
    });
    it('isPlatformCostAlertTriggered returns false when cost/cap < 0.9', () => {
        fc.assert(fc.property(
        // Use integer percentages 0-89 to avoid float32 precision issues
        fc.integer({ min: 0, max: 89 }), fc.integer({ min: 1, max: 10000 }), (percentInt, capInt) => {
            const cap = capInt;
            const cost = (percentInt / 100) * cap;
            expect(isPlatformCostAlertTriggered(cost, cap)).toBe(false);
        }), { numRuns: 25 });
    });
    it('boundary: exactly 90% triggers the alert', () => {
        fc.assert(fc.property(
        // Use multiples of 10 so cost = cap * 9/10 is exact integer arithmetic
        fc.integer({ min: 1, max: 1000 }), (n) => {
            const cap = n * 10;
            const cost = n * 9; // exactly 90% of cap
            expect(isPlatformCostAlertTriggered(cost, cap)).toBe(true);
        }), { numRuns: 25 });
    });
    it('isPlatformCostAlertTriggered returns false when cap is 0', () => {
        fc.assert(fc.property(fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }), (cost) => {
            expect(isPlatformCostAlertTriggered(cost, 0)).toBe(false);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=admin.properties.test.js.map