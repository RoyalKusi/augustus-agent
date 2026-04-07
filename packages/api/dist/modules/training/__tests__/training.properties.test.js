/**
 * Property-based tests for Training Data Module
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 11.2
 *
 * Property 29: Training Data File Size Validation
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isFileSizeValid, MAX_FILE_SIZE_BYTES } from '../training.service.js';
// ─── Property 29: Training Data File Size Validation ─────────────────────────
// **Validates: Requirements 11.2**
describe('Property 29: Training Data File Size Validation', () => {
    it('isFileSizeValid returns true for any size <= 10 MB', () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES }), (sizeBytes) => {
            expect(isFileSizeValid(sizeBytes)).toBe(true);
        }), { numRuns: 25 });
    });
    it('isFileSizeValid returns false for any size > 10 MB', () => {
        fc.assert(fc.property(fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: MAX_FILE_SIZE_BYTES * 10 }), (sizeBytes) => {
            expect(isFileSizeValid(sizeBytes)).toBe(false);
        }), { numRuns: 25 });
    });
    it('boundary: exactly 10 MB is valid', () => {
        expect(isFileSizeValid(MAX_FILE_SIZE_BYTES)).toBe(true);
    });
    it('zero bytes is valid', () => {
        expect(isFileSizeValid(0)).toBe(true);
    });
});
//# sourceMappingURL=training.properties.test.js.map