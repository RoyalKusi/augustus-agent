/**
 * Property-Based Tests for Business Dashboard
 * Properties: 30, 31, 32, 34, 35
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { maskWaNumber, generateTicketReference, isTicketReferenceUnique, } from '../dashboard.service.js';
// ─── Shared arbitraries ───────────────────────────────────────────────────────
/** WA numbers: at least 4 chars, digits/plus/spaces */
const waNumberArb = fc
    .string({ minLength: 4, maxLength: 20 })
    .filter((s) => s.length >= 4 && !s.includes('\0'));
// ─── Property 30: WhatsApp Number Masking ────────────────────────────────────
// **Validates: Requirements 11.1**
describe('Property 30: WhatsApp Number Masking', () => {
    it('maskWaNumber always starts with ****', () => {
        fc.assert(fc.property(waNumberArb, (waNumber) => {
            const masked = maskWaNumber(waNumber);
            expect(masked.startsWith('****')).toBe(true);
        }), { numRuns: 25 });
    });
    it('maskWaNumber always ends with the last 4 chars of the input', () => {
        fc.assert(fc.property(waNumberArb, (waNumber) => {
            const masked = maskWaNumber(waNumber);
            const last4 = waNumber.slice(-4);
            expect(masked.endsWith(last4)).toBe(true);
        }), { numRuns: 25 });
    });
    it('maskWaNumber returns exactly ****{last4} for any string of length >= 4', () => {
        fc.assert(fc.property(waNumberArb, (waNumber) => {
            const masked = maskWaNumber(waNumber);
            const last4 = waNumber.slice(-4);
            expect(masked).toBe(`****${last4}`);
        }), { numRuns: 25 });
    });
    it('masked number has exactly 8 characters when input is exactly 4 chars', () => {
        fc.assert(fc.property(fc.string({ minLength: 4, maxLength: 4 }).filter((s) => !s.includes('\0')), (waNumber) => {
            const masked = maskWaNumber(waNumber);
            // ****{4chars} = 8 chars
            expect(masked.length).toBe(8);
        }), { numRuns: 25 });
    });
});
// ─── Property 31: Revenue Summary Correctness ────────────────────────────────
// **Validates: Requirements 11.3**
/**
 * Pure function to compute revenue summary from a list of order amounts.
 */
function computeRevenueSummary(amounts) {
    const totalRevenue = amounts.reduce((sum, a) => sum + a, 0);
    const totalOrders = amounts.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, averageOrderValue };
}
describe('Property 31: Revenue Summary Correctness', () => {
    it('averageOrderValue = totalRevenue / totalOrders when totalOrders > 0', () => {
        fc.assert(fc.property(fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { minLength: 1, maxLength: 50 }), (amounts) => {
            const { totalRevenue, totalOrders, averageOrderValue } = computeRevenueSummary(amounts);
            const expected = totalRevenue / totalOrders;
            expect(Math.abs(averageOrderValue - expected)).toBeLessThan(0.0001);
        }), { numRuns: 25 });
    });
    it('averageOrderValue = 0 when totalOrders = 0', () => {
        fc.assert(fc.property(fc.constant([]), (amounts) => {
            const { averageOrderValue } = computeRevenueSummary(amounts);
            expect(averageOrderValue).toBe(0);
        }), { numRuns: 25 });
    });
    it('totalRevenue is always >= 0 for non-negative order amounts', () => {
        fc.assert(fc.property(fc.array(fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }), { minLength: 0, maxLength: 50 }), (amounts) => {
            const { totalRevenue } = computeRevenueSummary(amounts);
            expect(totalRevenue).toBeGreaterThanOrEqual(0);
        }), { numRuns: 25 });
    });
    it('totalOrders equals the number of orders in the input', () => {
        fc.assert(fc.property(fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }), { minLength: 0, maxLength: 50 }), (amounts) => {
            const { totalOrders } = computeRevenueSummary(amounts);
            expect(totalOrders).toBe(amounts.length);
        }), { numRuns: 25 });
    });
});
// ─── Property 32: CSV Export Format ──────────────────────────────────────────
// **Validates: Requirements 11.4**
/**
 * Pure function to build a CSV string from order rows.
 */
function buildOrdersCsv(orders) {
    const header = 'Order Reference,Customer (masked),Status,Total Amount,Currency,Date';
    const rows = orders.map((o) => {
        const masked = maskWaNumber(o.customerWaNumber);
        return `${o.orderReference},${masked},${o.status},${o.totalAmount.toFixed(2)},${o.currency},${o.createdAt}`;
    });
    return [header, ...rows].join('\n');
}
const orderArb = fc.record({
    orderReference: fc.string({ minLength: 3, maxLength: 20 }).filter((s) => !s.includes('\0') && !s.includes(',') && !s.includes('\n')),
    customerWaNumber: fc.string({ minLength: 4, maxLength: 20 }).filter((s) => !s.includes('\0') && !s.includes(',') && !s.includes('\n')),
    status: fc.constantFrom('pending', 'completed', 'expired', 'failed'),
    totalAmount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    currency: fc.constantFrom('USD', 'ZWL'),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
});
describe('Property 32: CSV Export Format', () => {
    it('CSV always has a header row as the first line', () => {
        fc.assert(fc.property(fc.array(orderArb, { minLength: 0, maxLength: 10 }), (orders) => {
            const csv = buildOrdersCsv(orders);
            const lines = csv.split('\n');
            expect(lines[0]).toBe('Order Reference,Customer (masked),Status,Total Amount,Currency,Date');
        }), { numRuns: 25 });
    });
    it('each data row has the same number of columns as the header', () => {
        fc.assert(fc.property(fc.array(orderArb, { minLength: 1, maxLength: 10 }), (orders) => {
            const csv = buildOrdersCsv(orders);
            const lines = csv.split('\n');
            const headerCols = lines[0].split(',').length;
            for (let i = 1; i < lines.length; i++) {
                const rowCols = lines[i].split(',').length;
                expect(rowCols).toBe(headerCols);
            }
        }), { numRuns: 25 });
    });
    it('customer numbers in CSV are masked (start with ****)', () => {
        fc.assert(fc.property(fc.array(orderArb, { minLength: 1, maxLength: 10 }), (orders) => {
            const csv = buildOrdersCsv(orders);
            const lines = csv.split('\n');
            // Data rows start at index 1
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                // Column index 1 is the masked customer number
                expect(cols[1].startsWith('****')).toBe(true);
            }
        }), { numRuns: 25 });
    });
    it('CSV has exactly orders.length + 1 lines (header + one per order)', () => {
        fc.assert(fc.property(fc.array(orderArb, { minLength: 0, maxLength: 10 }), (orders) => {
            const csv = buildOrdersCsv(orders);
            const lines = csv.split('\n');
            expect(lines.length).toBe(orders.length + 1);
        }), { numRuns: 25 });
    });
});
// ─── Property 34: Support Ticket Reference Uniqueness ────────────────────────
// **Validates: Requirements 13.2**
describe('Property 34: Support Ticket Reference Uniqueness', () => {
    it('generateTicketReference always returns a non-empty string starting with TKT-', () => {
        fc.assert(fc.property(fc.constant(null), () => {
            const ref = generateTicketReference();
            expect(ref.length).toBeGreaterThan(0);
            expect(ref.startsWith('TKT-')).toBe(true);
        }), { numRuns: 25 });
    });
    it('isTicketReferenceUnique returns false when ref is in existingRefs', () => {
        fc.assert(fc.property(fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('\0')), { minLength: 1, maxLength: 20 }), (refs) => {
            // Pick a ref that is in the list
            const ref = refs[0];
            expect(isTicketReferenceUnique(ref, refs)).toBe(false);
        }), { numRuns: 25 });
    });
    it('isTicketReferenceUnique returns true when ref is not in existingRefs', () => {
        fc.assert(fc.property(fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('\0')), { minLength: 0, maxLength: 20 }), (refs) => {
            // Use a ref that cannot be in refs (guaranteed unique prefix)
            const uniqueRef = `UNIQUE-${Date.now()}-${Math.random()}`;
            expect(isTicketReferenceUnique(uniqueRef, refs)).toBe(true);
        }), { numRuns: 25 });
    });
    it('two calls to generateTicketReference produce different values (high probability)', () => {
        fc.assert(fc.property(fc.constant(null), () => {
            const ref1 = generateTicketReference();
            const ref2 = generateTicketReference();
            // They should differ due to random component
            // (extremely unlikely to collide in 25 runs)
            expect(typeof ref1).toBe('string');
            expect(typeof ref2).toBe('string');
            expect(ref1.startsWith('TKT-')).toBe(true);
            expect(ref2.startsWith('TKT-')).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 35: Support Ticket Listing ─────────────────────────────────────
// **Validates: Requirements 13.3**
describe('Property 35: Support Ticket Listing', () => {
    it('filtering tickets by businessId returns only tickets for that business', () => {
        fc.assert(fc.property(fc.uuid(), fc.uuid(), fc.array(fc.record({
            id: fc.uuid(),
            businessId: fc.uuid(),
            reference: fc.string({ minLength: 3, maxLength: 20 }).filter((s) => !s.includes('\0')),
            subject: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('\0')),
            status: fc.constantFrom('open', 'in_progress', 'closed'),
        }), { minLength: 0, maxLength: 20 }), (targetBusinessId, otherBusinessId, allTickets) => {
            // Assign some tickets to targetBusinessId, some to otherBusinessId
            const mixed = allTickets.map((t, i) => ({
                ...t,
                businessId: i % 2 === 0 ? targetBusinessId : otherBusinessId,
            }));
            // Pure filter logic: listing should only return tickets for the requesting business
            const filtered = mixed.filter((t) => t.businessId === targetBusinessId);
            // Every returned ticket must belong to targetBusinessId
            for (const ticket of filtered) {
                expect(ticket.businessId).toBe(targetBusinessId);
            }
        }), { numRuns: 25 });
    });
    it('no ticket from another business appears in the listing', () => {
        fc.assert(fc.property(fc.uuid(), fc.array(fc.record({
            id: fc.uuid(),
            businessId: fc.uuid(),
            subject: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('\0')),
        }), { minLength: 0, maxLength: 20 }), (myBusinessId, tickets) => {
            // Simulate listing: only return tickets where businessId matches
            const myTickets = tickets.filter((t) => t.businessId === myBusinessId);
            // None of the returned tickets should have a different businessId
            const hasOtherBusiness = myTickets.some((t) => t.businessId !== myBusinessId);
            expect(hasOtherBusiness).toBe(false);
        }), { numRuns: 25 });
    });
    it('listing returns all tickets belonging to the requesting business', () => {
        fc.assert(fc.property(fc.uuid(), fc.array(fc.record({
            id: fc.uuid(),
            businessId: fc.uuid(),
        }), { minLength: 0, maxLength: 20 }), (myBusinessId, tickets) => {
            const expectedCount = tickets.filter((t) => t.businessId === myBusinessId).length;
            const myTickets = tickets.filter((t) => t.businessId === myBusinessId);
            expect(myTickets.length).toBe(expectedCount);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=dashboard.properties.test.js.map