/**
 * Integration and End-to-End Property-Based Tests
 * Tasks: 17.1–17.5
 * Tests pure logic of system flows without hitting real DB or external APIs.
 */
/** Returns true if newPlan is a higher tier than currentPlan */
export declare function isPlanUpgrade(currentPlan: string, newPlan: string): boolean;
/** Returns true if newPlan is a lower tier than currentPlan */
export declare function isPlanDowngrade(currentPlan: string, newPlan: string): boolean;
/**
 * Pure functions for WhatsApp integration validation
 */
export declare function isValidIntegration(wabaId: string, phoneNumberId: string, accessToken: string): boolean;
export declare function reintegrationPreservesData(catalogueCount: number): boolean;
//# sourceMappingURL=e2e.properties.test.d.ts.map