/**
 * Unit tests for Task 9.2: Paynow webhook receiver and polling fallback
 * Tests the pure logic: hash validation, status parsing, poll URL handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createHash } from 'crypto';

// ─── Hash validation helper (mirrors the implementation) ─────────────────────

function computeMd5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

/**
 * Mirrors the validatePaynowWebhookHash logic from payment.service.ts
 * so we can test it in isolation without DB dependencies.
 */
function buildValidPaynowPayload(
  fields: Record<string, string>,
  integrationKey: string,
): Record<string, string> {
  const hashInput =
    Object.entries(fields)
      .map(([, value]) => value)
      .join('') + integrationKey;
  const hash = computeMd5(hashInput).toUpperCase();
  return { ...fields, hash };
}

function validatePaynowHash(payload: Record<string, string>, integrationKey: string): boolean {
  const receivedHash = (payload['hash'] ?? '').toUpperCase();
  if (!receivedHash) return false;

  const hashInput =
    Object.entries(payload)
      .filter(([key]) => key.toLowerCase() !== 'hash')
      .map(([, value]) => value)
      .join('') + integrationKey;

  const expectedHash = computeMd5(hashInput).toUpperCase();
  return receivedHash === expectedHash;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Task 9.2: Paynow webhook hash validation', () => {
  const INTEGRATION_KEY = 'test-integration-key-abc123';

  it('accepts a payload with a correct hash', () => {
    const fields = {
      reference: 'ORD-ABC123',
      amount: '25.00',
      status: 'Paid',
      paynowreference: 'PN-REF-001',
    };
    const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
    expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(true);
  });

  it('rejects a payload with a tampered hash', () => {
    const fields = {
      reference: 'ORD-ABC123',
      amount: '25.00',
      status: 'Paid',
      paynowreference: 'PN-REF-001',
    };
    const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
    payload['hash'] = 'DEADBEEFDEADBEEFDEADBEEFDEADBEEF';
    expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(false);
  });

  it('rejects a payload with a missing hash field', () => {
    const payload = {
      reference: 'ORD-ABC123',
      amount: '25.00',
      status: 'Paid',
    };
    expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(false);
  });

  it('rejects a payload where a field value has been tampered', () => {
    const fields = {
      reference: 'ORD-ABC123',
      amount: '25.00',
      status: 'Paid',
      paynowreference: 'PN-REF-001',
    };
    const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
    // Tamper with the amount after signing
    payload['amount'] = '999.99';
    expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(false);
  });

  it('rejects when integration key is empty', () => {
    const fields = { reference: 'ORD-1', amount: '10.00', status: 'Paid' };
    const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
    // Validate with wrong key
    expect(validatePaynowHash(payload, '')).toBe(false);
  });

  it('hash comparison is case-insensitive (Paynow sends uppercase)', () => {
    const fields = { reference: 'ORD-1', amount: '10.00', status: 'Paid' };
    const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
    // Lowercase the hash — should still match since we normalise to uppercase
    payload['hash'] = payload['hash'].toLowerCase();
    expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(true);
  });
});

// ─── Property-based tests ─────────────────────────────────────────────────────

describe('Task 9.2: Webhook hash validation — property tests', () => {
  const INTEGRATION_KEY = 'prop-test-key-xyz';

  it('any correctly signed payload is accepted', () => {
    fc.assert(
      fc.property(
        fc.record({
          reference: fc.string({ minLength: 1, maxLength: 50 }),
          amount: fc.integer({ min: 1, max: 999999 }).map((n) => (n / 100).toFixed(2)),
          status: fc.constantFrom('Paid', 'Awaiting', 'Cancelled', 'Failed'),
          paynowreference: fc.string({ minLength: 1, maxLength: 40 }),
        }),
        (fields) => {
          const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
          expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('any payload with a modified field value after signing is rejected', () => {
    fc.assert(
      fc.property(
        fc.record({
          reference: fc.string({ minLength: 1, maxLength: 50 }),
          amount: fc.integer({ min: 1, max: 999999 }).map((n) => (n / 100).toFixed(2)),
          status: fc.constantFrom('Paid', 'Awaiting', 'Cancelled'),
        }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (fields, tamperValue) => {
          const payload = buildValidPaynowPayload(fields, INTEGRATION_KEY);
          // Tamper with the reference after signing
          if (tamperValue !== fields.reference) {
            payload['reference'] = tamperValue;
            expect(validatePaynowHash(payload, INTEGRATION_KEY)).toBe(false);
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ─── Poll URL selection logic ─────────────────────────────────────────────────

describe('Task 9.2: Poll URL selection', () => {
  /**
   * Mirrors the poll URL selection logic in pollPaynowStatus:
   * prefer paynow_poll_url, fall back to constructing from paynow_reference.
   */
  function selectPollUrl(paynowPollUrl: string | null, paynowReference: string | null): string | null {
    return (
      paynowPollUrl ??
      (paynowReference
        ? `https://www.paynow.co.zw/interface/returntransaction/${paynowReference}`
        : null)
    );
  }

  it('uses stored paynow_poll_url when available', () => {
    const url = selectPollUrl('https://paynow.co.zw/poll/abc123', 'REF-001');
    expect(url).toBe('https://paynow.co.zw/poll/abc123');
  });

  it('falls back to constructing URL from paynow_reference when poll_url is null', () => {
    const url = selectPollUrl(null, 'REF-001');
    expect(url).toBe('https://www.paynow.co.zw/interface/returntransaction/REF-001');
  });

  it('returns null when both paynow_poll_url and paynow_reference are null', () => {
    const url = selectPollUrl(null, null);
    expect(url).toBeNull();
  });

  it('property: stored poll URL always takes precedence over constructed URL', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        (storedUrl, reference) => {
          const url = selectPollUrl(storedUrl, reference);
          expect(url).toBe(storedUrl);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('property: fallback URL always contains the paynow_reference', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }).filter((s) => !s.includes('/')),
        (reference) => {
          const url = selectPollUrl(null, reference);
          expect(url).not.toBeNull();
          expect(url).toContain(reference);
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ─── Status parsing logic ─────────────────────────────────────────────────────

describe('Task 9.2: Paynow status parsing', () => {
  type OrderAction = 'confirm' | 'fail' | 'ignore';

  function parsePaynowStatus(status: string): OrderAction {
    const s = status.toLowerCase();
    if (s === 'paid') return 'confirm';
    if (s === 'cancelled' || s === 'failed') return 'fail';
    return 'ignore';
  }

  it('paid status triggers confirmation', () => {
    expect(parsePaynowStatus('paid')).toBe('confirm');
    expect(parsePaynowStatus('Paid')).toBe('confirm');
    expect(parsePaynowStatus('PAID')).toBe('confirm');
  });

  it('cancelled status triggers failure', () => {
    expect(parsePaynowStatus('cancelled')).toBe('fail');
    expect(parsePaynowStatus('Cancelled')).toBe('fail');
  });

  it('failed status triggers failure', () => {
    expect(parsePaynowStatus('failed')).toBe('fail');
    expect(parsePaynowStatus('Failed')).toBe('fail');
  });

  it('awaiting/sent/other statuses are ignored', () => {
    expect(parsePaynowStatus('awaiting')).toBe('ignore');
    expect(parsePaynowStatus('Sent')).toBe('ignore');
    expect(parsePaynowStatus('Message')).toBe('ignore');
    expect(parsePaynowStatus('')).toBe('ignore');
  });

  it('property: only paid maps to confirm', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.toLowerCase() !== 'paid'),
        (status) => {
          expect(parsePaynowStatus(status)).not.toBe('confirm');
        },
      ),
      { numRuns: 25 },
    );
  });
});
