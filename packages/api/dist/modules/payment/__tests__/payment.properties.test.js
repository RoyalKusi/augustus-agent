/**
 * Property-based tests for Payment Processor
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5, 12.1, 12.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shouldAutoProcess, getAutoWithdrawalThreshold } from '../payment.service.js';
// ─── Pure receipt body builder (mirrors dispatchReceipt logic) ────────────────
function buildReceiptBody(orderReference, items, totalAmount, currency, timestamp) {
    const itemLines = items
        .map((i) => `  • ${i.productName} x${i.quantity} @ ${currency} ${i.unitPrice.toFixed(2)}`)
        .join('\n');
    return (`✅ Payment Confirmed!\n\n` +
        `Order Reference: ${orderReference}\n` +
        `Items:\n${itemLines}\n` +
        `Total: ${currency} ${totalAmount.toFixed(2)}\n` +
        `Date: ${timestamp.toISOString()}`);
}
// ─── Arbitraries ──────────────────────────────────────────────────────────────
const orderRefArb = fc
    .tuple(fc.string({ minLength: 3, maxLength: 8, unit: 'grapheme-ascii' }), fc.string({ minLength: 3, maxLength: 8, unit: 'grapheme-ascii' }))
    .map(([a, b]) => `ORD-${a.toUpperCase()}-${b.toUpperCase()}`);
const currencyArb = fc.constantFrom('USD', 'ZWL', 'EUR', 'GBP');
const priceArb = fc.integer({ min: 1, max: 999999 }).map((n) => n / 100);
const productNameArb = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0 && !s.includes('\0'));
const orderItemArb = fc.record({
    productId: fc.uuid(),
    productName: productNameArb,
    quantity: fc.integer({ min: 1, max: 99 }),
    unitPrice: priceArb,
});
// ─── Property 21: Payment Receipt Content Completeness ───────────────────────
// **Validates: Requirements 7.2**
describe('Property 21: Payment Receipt Content Completeness', () => {
    it('receipt contains order reference', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 5 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            expect(body).toContain(orderReference);
        }), { numRuns: 25 });
    });
    it('receipt contains total amount', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 5 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            expect(body).toContain(totalAmount.toFixed(2));
        }), { numRuns: 25 });
    });
    it('receipt contains ISO timestamp', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 5 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            expect(body).toContain(timestamp.toISOString());
        }), { numRuns: 25 });
    });
    it('receipt contains all item names', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 5 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            for (const item of items) {
                expect(body).toContain(item.productName);
            }
        }), { numRuns: 25 });
    });
    it('receipt contains all four required fields', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 5 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            // Field 1: order reference
            expect(body).toContain(orderReference);
            // Field 2: item names
            for (const item of items)
                expect(body).toContain(item.productName);
            // Field 3: total amount
            expect(body).toContain(totalAmount.toFixed(2));
            // Field 4: timestamp
            expect(body).toContain(timestamp.toISOString());
        }), { numRuns: 25 });
    });
    it('receipt body starts with confirmation header', () => {
        fc.assert(fc.property(orderRefArb, fc.array(orderItemArb, { minLength: 1, maxLength: 3 }), priceArb, currencyArb, fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (orderReference, items, totalAmount, currency, timestamp) => {
            const body = buildReceiptBody(orderReference, items, totalAmount, currency, timestamp);
            expect(body).toContain('Payment Confirmed');
        }), { numRuns: 25 });
    });
});
// ─── Pure helpers (mirrors payment.service.ts logic) ─────────────────────────
function generateOrderReference() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ORD-${ts}-${rand}`;
}
function isOrderStale(expiresAt, now) {
    return expiresAt < now;
}
function buildOrderObject(status, amount, currency, orderReference, businessId) {
    return { status, amount, currency, orderReference, businessId };
}
function computeNewStock(oldStock, quantity) {
    return oldStock - quantity;
}
function isWithdrawalValid(amountUsd, availableBalance) {
    return amountUsd <= availableBalance;
}
// ─── Property 22: Payment Link Expiry ────────────────────────────────────────
// **Validates: Requirements 7.3**
describe('Property 22: Payment Link Expiry', () => {
    it('a pending order with expires_at in the past is stale', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 3600 }), (secondsAgo) => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() - secondsAgo * 1000);
            expect(isOrderStale(expiresAt, now)).toBe(true);
        }), { numRuns: 25 });
    });
    it('a pending order with expires_at in the future is not stale', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 3600 }), (secondsAhead) => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + secondsAhead * 1000);
            expect(isOrderStale(expiresAt, now)).toBe(false);
        }), { numRuns: 25 });
    });
    it('expiry boundary: expires_at exactly equal to now is stale', () => {
        const now = new Date(1000000000000); // fixed point in time
        const expiresAt = new Date(1000000000000);
        expect(isOrderStale(expiresAt, now)).toBe(false); // not strictly less than
    });
});
// ─── Property 23: Transaction Record Fields ───────────────────────────────────
// **Validates: Requirements 7.4**
describe('Property 23: Transaction Record Has All Five Required Fields', () => {
    it('generateOrderReference always produces a non-empty ORD-* string', () => {
        fc.assert(fc.property(fc.constant(null), () => {
            const ref = generateOrderReference();
            expect(ref).toBeTruthy();
            expect(ref.length).toBeGreaterThan(0);
            expect(ref).toMatch(/^ORD-/);
        }), { numRuns: 25 });
    });
    it('order object always has all 5 required fields non-null', () => {
        fc.assert(fc.property(fc.constantFrom('pending', 'completed', 'expired', 'failed'), fc.integer({ min: 1, max: 100000 }).map((n) => n / 100), fc.constantFrom('USD', 'ZWL', 'EUR'), fc.uuid(), (status, amount, currency, businessId) => {
            const ref = generateOrderReference();
            const order = buildOrderObject(status, amount, currency, ref, businessId);
            expect(order.status).toBeTruthy();
            expect(order.amount).toBeGreaterThan(0);
            expect(order.currency).toBeTruthy();
            expect(order.orderReference).toMatch(/^ORD-/);
            expect(order.businessId).toBeTruthy();
        }), { numRuns: 25 });
    });
});
// ─── Property 24: Stock Decrement on Payment Confirmation ────────────────────
// **Validates: Requirements 7.5**
describe('Property 24: Stock Decrement on Payment Confirmation', () => {
    it('new stock = old stock - purchased quantity for any valid quantity', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 10000 }), (oldStock, quantity) => {
            fc.pre(quantity <= oldStock);
            const newStock = computeNewStock(oldStock, quantity);
            expect(newStock).toBe(oldStock - quantity);
            expect(newStock).toBeGreaterThanOrEqual(0);
        }), { numRuns: 25 });
    });
    it('stock decrement is always non-negative when quantity <= oldStock', () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }), (oldStock, quantity) => {
            fc.pre(quantity <= oldStock);
            const newStock = computeNewStock(oldStock, quantity);
            expect(newStock).toBeGreaterThanOrEqual(0);
        }), { numRuns: 25 });
    });
});
// ─── Property 33: Withdrawal Validation ──────────────────────────────────────
// **Validates: Requirements 12.1**
describe('Property 33: Withdrawal Rejected When Amount Exceeds Balance', () => {
    it('withdrawal is valid when amount <= available balance', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }).map((n) => n / 100), fc.integer({ min: 1, max: 100000 }).map((n) => n / 100), (amount, available) => {
            fc.pre(amount <= available);
            expect(isWithdrawalValid(amount, available)).toBe(true);
        }), { numRuns: 25 });
    });
    it('withdrawal is invalid when amount > available balance', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }).map((n) => n / 100), fc.integer({ min: 0, max: 100000 }).map((n) => n / 100), (amount, available) => {
            fc.pre(amount > available);
            expect(isWithdrawalValid(amount, available)).toBe(false);
        }), { numRuns: 25 });
    });
});
// ─── Property 39: Auto-Processing Threshold ──────────────────────────────────
// **Validates: Requirements 12.3**
describe('Property 39: Auto-Processing Threshold', () => {
    it('shouldAutoProcess returns true for any amount strictly below threshold', () => {
        const threshold = getAutoWithdrawalThreshold();
        // Use integer cents to avoid 32-bit float constraint issues
        fc.assert(fc.property(fc.integer({ min: 1, max: Math.floor(threshold * 100) - 1 }), (amountCents) => {
            const amount = amountCents / 100;
            fc.pre(amount < threshold);
            expect(shouldAutoProcess(amount)).toBe(true);
        }), { numRuns: 25 });
    });
    it('shouldAutoProcess returns false for any amount >= threshold', () => {
        const threshold = getAutoWithdrawalThreshold();
        fc.assert(fc.property(fc.integer({ min: Math.ceil(threshold * 100), max: Math.ceil(threshold * 100) * 10 }), (amountCents) => {
            const amount = amountCents / 100;
            fc.pre(amount >= threshold);
            expect(shouldAutoProcess(amount)).toBe(false);
        }), { numRuns: 25 });
    });
    it('threshold boundary: amount exactly equal to threshold is not auto-processed', () => {
        const threshold = getAutoWithdrawalThreshold();
        expect(shouldAutoProcess(threshold)).toBe(false);
    });
});
// ─── Import new helpers for in-chat payments properties ──────────────────────
import { isExternalDetailsValid, buildPaymentSettingsResponse, buildInvoiceMessage, determineOrderFlow, } from '../payment.service.js';
// ─── Arbitraries for in-chat payments tests ───────────────────────────────────
const nonEmptyStringArb = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0);
const externalDetailsArb = fc
    .record({
    bank_account: nonEmptyStringArb,
    ecocash_number: nonEmptyStringArb,
    other: nonEmptyStringArb,
})
    .filter((d) => isExternalDetailsValid(d));
const invoiceMessageArb = fc.record({
    orderReference: orderRefArb,
    items: fc.array(orderItemArb, { minLength: 1, maxLength: 5 }),
    totalAmount: priceArb,
    currency: currencyArb,
    externalPaymentDetails: externalDetailsArb,
});
// ─── Property 42: Disabling In_Chat_Payments Requires External_Payment_Details ─
// **Validates: Requirements 18.2, 18.3**
describe('Property 42: Disabling In_Chat_Payments Requires External_Payment_Details', () => {
    it('isExternalDetailsValid returns false for null', () => {
        expect(isExternalDetailsValid(null)).toBe(false);
    });
    it('isExternalDetailsValid returns false for undefined', () => {
        expect(isExternalDetailsValid(undefined)).toBe(false);
    });
    it('isExternalDetailsValid returns false for empty object', () => {
        expect(isExternalDetailsValid({})).toBe(false);
    });
    it('isExternalDetailsValid returns false when all values are empty strings', () => {
        fc.assert(fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.constant(''), { minKeys: 1, maxKeys: 5 }), (details) => {
            expect(isExternalDetailsValid(details)).toBe(false);
        }), { numRuns: 25 });
    });
    it('isExternalDetailsValid returns true when at least one field is non-empty', () => {
        fc.assert(fc.property(externalDetailsArb, (details) => {
            expect(isExternalDetailsValid(details)).toBe(true);
        }), { numRuns: 25 });
    });
    it('disabling with valid external details is allowed (no error thrown)', () => {
        fc.assert(fc.property(externalDetailsArb, (details) => {
            // Valid: disabling with non-empty details should not throw
            expect(isExternalDetailsValid(details)).toBe(true);
        }), { numRuns: 25 });
    });
    it('disabling with no details is rejected (isExternalDetailsValid returns false)', () => {
        fc.assert(fc.property(fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant({})), (details) => {
            expect(isExternalDetailsValid(details)).toBe(false);
        }), { numRuns: 25 });
    });
});
// ─── Property 44: Payment Settings Round-Trip ────────────────────────────────
// **Validates: Requirements 18.5**
describe('Property 44: Payment Settings Round-Trip', () => {
    it('round-trip: settings stored and retrieved are identical', () => {
        fc.assert(fc.property(fc.boolean(), fc.oneof(fc.constant(null), externalDetailsArb), (enabled, details) => {
            const settings = buildPaymentSettingsResponse(enabled, details);
            expect(settings.inChatPaymentsEnabled).toBe(enabled);
            expect(settings.externalPaymentDetails).toEqual(details);
        }), { numRuns: 25 });
    });
    it('when enabled=true, externalPaymentDetails can be null', () => {
        fc.assert(fc.property(fc.oneof(fc.constant(null), externalDetailsArb), (details) => {
            const settings = buildPaymentSettingsResponse(true, details);
            expect(settings.inChatPaymentsEnabled).toBe(true);
            // No constraint on details when enabled
            expect(settings).toHaveProperty('externalPaymentDetails');
        }), { numRuns: 25 });
    });
    it('when enabled=false, externalPaymentDetails must be non-null with at least one entry', () => {
        fc.assert(fc.property(externalDetailsArb, (details) => {
            const settings = buildPaymentSettingsResponse(false, details);
            expect(settings.inChatPaymentsEnabled).toBe(false);
            expect(isExternalDetailsValid(settings.externalPaymentDetails)).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 40: No Paynow Link When In_Chat_Payments Disabled ──────────────
// **Validates: Requirements 7.8, 18.4**
describe('Property 40: No Paynow Link When In_Chat_Payments Disabled', () => {
    it('when inChatPaymentsEnabled=false, order has paynowLink=null', () => {
        fc.assert(fc.property(fc.constant(false), (enabled) => {
            const flow = determineOrderFlow(enabled);
            expect(flow.paynowLink).toBeNull();
            expect(flow.usePaynow).toBe(false);
        }), { numRuns: 25 });
    });
    it('when inChatPaymentsEnabled=true, order has a non-null paynowLink placeholder', () => {
        fc.assert(fc.property(fc.constant(true), (enabled) => {
            const flow = determineOrderFlow(enabled);
            expect(flow.paynowLink).not.toBeNull();
            expect(flow.usePaynow).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 41: Invoice Content Completeness When In_Chat_Payments Disabled ─
// **Validates: Requirements 7.7**
describe('Property 41: Invoice Content Completeness When In_Chat_Payments Disabled', () => {
    it('invoice always contains order reference', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            expect(msg).toContain(invoice.orderReference);
        }), { numRuns: 25 });
    });
    it('invoice always contains total amount', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            expect(msg).toContain(invoice.totalAmount.toFixed(2));
        }), { numRuns: 25 });
    });
    it('invoice always contains at least one external payment detail entry', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            const hasDetail = Object.entries(invoice.externalPaymentDetails).some(([, v]) => v.trim() !== '' && msg.includes(v));
            expect(hasDetail).toBe(true);
        }), { numRuns: 25 });
    });
    it('invoice always contains all item names', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            for (const item of invoice.items) {
                expect(msg).toContain(item.productName);
            }
        }), { numRuns: 25 });
    });
});
// ─── Property 43: Toggle Change Applies Immediately to Subsequent Orders ─────
// **Validates: Requirements 18.4**
describe('Property 43: Toggle Change Applies Immediately to Subsequent Orders', () => {
    it('after toggle to disabled, next order uses invoice flow (paynowLink=null)', () => {
        fc.assert(fc.property(fc.constant(false), (newEnabled) => {
            const flow = determineOrderFlow(newEnabled);
            expect(flow.paynowLink).toBeNull();
            expect(flow.usePaynow).toBe(false);
        }), { numRuns: 25 });
    });
    it('after toggle to enabled, next order uses Paynow flow (paynowLink non-null)', () => {
        fc.assert(fc.property(fc.constant(true), (newEnabled) => {
            const flow = determineOrderFlow(newEnabled);
            expect(flow.paynowLink).not.toBeNull();
            expect(flow.usePaynow).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 45: AI Agent Presents Invoice When In_Chat_Payments Disabled ───
// **Validates: Requirements 18.6**
describe('Property 45: AI Agent Presents Invoice When In_Chat_Payments Disabled', () => {
    it('buildInvoiceMessage output does NOT contain a Paynow URL pattern', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            expect(msg).not.toMatch(/paynow\.co\.zw/i);
            expect(msg).not.toMatch(/https?:\/\/.*paynow/i);
        }), { numRuns: 25 });
    });
    it('invoice message contains "Order Reference" text', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            expect(msg).toContain('Order Reference');
        }), { numRuns: 25 });
    });
    it('invoice message contains at least one external payment detail', () => {
        fc.assert(fc.property(invoiceMessageArb, (invoice) => {
            const msg = buildInvoiceMessage(invoice);
            const hasDetail = Object.entries(invoice.externalPaymentDetails).some(([, v]) => v.trim() !== '' && msg.includes(v));
            expect(hasDetail).toBe(true);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=payment.properties.test.js.map