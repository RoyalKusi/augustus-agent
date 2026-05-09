/**
 * Unit tests for WithdrawalOtpService DB-coupled methods
 * (requestOtp and confirmOtp)
 *
 * Uses the same vi.hoisted + vi.mock pattern as other tests in this project.
 * Requirements: 1.5, 1.6, 1.7, 1.8, 2.2–2.8, 5.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock fns so they're available before vi.mock factories run ─────────

const { mockQuery, mockConnect, mockClientQuery, mockClientRelease, mockSendEmail, mockCreateWithdrawalRequest } =
  vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockConnect: vi.fn(),
    mockClientQuery: vi.fn(),
    mockClientRelease: vi.fn(),
    mockSendEmail: vi.fn(),
    mockCreateWithdrawalRequest: vi.fn(),
  }));

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../db/client.js', () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

vi.mock('../../notification/notification.service.js', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('../payment.service.js', () => ({
  createWithdrawalRequest: mockCreateWithdrawalRequest,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { requestOtp, confirmOtp, WithdrawalOtpError, hashOtp } from '../withdrawal-otp.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_ID = 'biz-test-uuid-1234';
const AMOUNT = 50;
const MERCHANT_REF = 'MERCHANT-001';
const VALID_OTP = '123456';
const VALID_HASH = hashOtp(VALID_OTP);
const FUTURE_EXPIRY = new Date(Date.now() + 600_000);
const PAST_EXPIRY = new Date(Date.now() - 1000);

function makeRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    email: 'owner@example.com',
    available_usd: '100',
    withdrawal_otp_request_count: 0,
    withdrawal_otp_window_start: null,
    ...overrides,
  };
}

function makeConfirmRow(overrides: Record<string, unknown> = {}) {
  return {
    withdrawal_otp_hash: VALID_HASH,
    withdrawal_otp_expires_at: FUTURE_EXPIRY,
    withdrawal_otp_fail_count: 0,
    withdrawal_otp_window_start: null,
    available_usd: '100',
    ...overrides,
  };
}

// ─── requestOtp tests ─────────────────────────────────────────────────────────

describe('requestOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockClientQuery.mockResolvedValue({ rows: [] });
  });

  it('throws HTTP 400 for invalid amount_usd (no DB call)', async () => {
    await expect(requestOtp(BUSINESS_ID, -5, MERCHANT_REF)).rejects.toMatchObject({
      statusCode: 400,
      message: 'amount_usd must be a positive number.',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws HTTP 400 for blank paynow_merchant_ref (no DB call)', async () => {
    await expect(requestOtp(BUSINESS_ID, AMOUNT, '   ')).rejects.toMatchObject({
      statusCode: 400,
      message: 'paynow_merchant_ref is required.',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws HTTP 429 when rate limit is exceeded (count=4, active window)', async () => {
    const windowStart = new Date(Date.now() - 5 * 60_000); // 5 min ago — still active
    mockQuery.mockResolvedValueOnce({
      rows: [makeRequestRow({ withdrawal_otp_request_count: 4, withdrawal_otp_window_start: windowStart })],
    });

    const err = await requestOtp(BUSINESS_ID, AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBeDefined();
    expect(err.message).toContain('Too many OTP requests');
  });

  it('throws HTTP 422 when available balance is insufficient', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRequestRow({ available_usd: '10' })] });

    const err = await requestOtp(BUSINESS_ID, 50, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(422);
    expect(err.availableBalance).toBe(10);
  });

  it('throws HTTP 500 when sendEmail fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeRequestRow()] }) // SELECT
      .mockResolvedValueOnce({ rows: [] });                // UPDATE
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));

    const err = await requestOtp(BUSINESS_ID, AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toContain('Failed to send verification email');
  });

  it('calls UPDATE with a 64-char hex hash on successful OTP generation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeRequestRow()] }) // SELECT
      .mockResolvedValueOnce({ rows: [] });                // UPDATE

    await requestOtp(BUSINESS_ID, AMOUNT, MERCHANT_REF);

    const updateCall = mockQuery.mock.calls[1];
    const sql: string = updateCall[0];
    const params: unknown[] = updateCall[1];

    expect(sql).toContain('UPDATE businesses');
    expect(sql).toContain('withdrawal_otp_hash');
    expect(typeof params[0]).toBe('string');
    expect((params[0] as string)).toMatch(/^[0-9a-f]{64}$/);
    expect(params[4]).toBe(BUSINESS_ID);
  });

  it('resets rate-limit window (count=1) when previous window has expired', async () => {
    const expiredWindowStart = new Date(Date.now() - 20 * 60_000); // 20 min ago
    mockQuery
      .mockResolvedValueOnce({
        rows: [makeRequestRow({ withdrawal_otp_request_count: 3, withdrawal_otp_window_start: expiredWindowStart })],
      })
      .mockResolvedValueOnce({ rows: [] });

    await requestOtp(BUSINESS_ID, AMOUNT, MERCHANT_REF);

    const updateCall = mockQuery.mock.calls[1];
    const params: unknown[] = updateCall[1];
    // params[2] = newCount — should be reset to 1
    expect(params[2]).toBe(1);
  });
});

// ─── confirmOtp tests ─────────────────────────────────────────────────────────

describe('confirmOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientQuery.mockResolvedValue({ rows: [] });
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockCreateWithdrawalRequest.mockResolvedValue({
      withdrawal: { id: 'wr-1', amountUsd: AMOUNT },
      autoProcessed: false,
    });
  });

  it('throws HTTP 400 for invalid OTP format (no DB call)', async () => {
    await expect(confirmOtp(BUSINESS_ID, '12345', AMOUNT, MERCHANT_REF)).rejects.toMatchObject({
      statusCode: 400,
      message: 'otp must be a 6-digit numeric code.',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws HTTP 401 when no pending OTP exists (hash is null)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeConfirmRow({ withdrawal_otp_hash: null })] });

    const err = await confirmOtp(BUSINESS_ID, VALID_OTP, AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('No pending verification. Please request a new code.');
  });

  it('throws HTTP 401 when OTP has expired', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeConfirmRow({ withdrawal_otp_expires_at: PAST_EXPIRY })] });

    const err = await confirmOtp(BUSINESS_ID, VALID_OTP, AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Verification code has expired. Please request a new one.');
  });

  it('throws HTTP 401 and increments fail count on wrong OTP', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeConfirmRow()] }) // SELECT
      .mockResolvedValueOnce({ rows: [] });                // UPDATE fail count

    const err = await confirmOtp(BUSINESS_ID, '000000', AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid verification code.');

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('withdrawal_otp_fail_count = withdrawal_otp_fail_count + 1');
    expect(updateCall[1][0]).toBe(BUSINESS_ID);
  });

  it('throws HTTP 422 and does NOT start a transaction when balance is insufficient', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeConfirmRow({ available_usd: '5' })] });

    const err = await confirmOtp(BUSINESS_ID, VALID_OTP, 50, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(422);
    expect(err.availableBalance).toBe(5);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns { withdrawal, autoProcessed } on successful confirmation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeConfirmRow()] });

    const result = await confirmOtp(BUSINESS_ID, VALID_OTP, AMOUNT, MERCHANT_REF);

    expect(result).toHaveProperty('withdrawal');
    expect(result).toHaveProperty('autoProcessed');
    expect(result.withdrawal).toMatchObject({ id: 'wr-1', amountUsd: AMOUNT });
    expect(result.autoProcessed).toBe(false);
  });

  it('clears OTP hash and expiry in the transaction on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeConfirmRow()] });

    await confirmOtp(BUSINESS_ID, VALID_OTP, AMOUNT, MERCHANT_REF);

    const clearCall = mockClientQuery.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('withdrawal_otp_hash = NULL'),
    );
    expect(clearCall).toBeDefined();
    expect(clearCall![1][0]).toBe(BUSINESS_ID);
  });

  it('throws HTTP 429 when fail-attempt rate limit is exceeded', async () => {
    const windowStart = new Date(Date.now() - 5 * 60_000); // 5 min ago — active
    mockQuery.mockResolvedValueOnce({
      rows: [makeConfirmRow({ withdrawal_otp_fail_count: 4, withdrawal_otp_window_start: windowStart })],
    });

    const err = await confirmOtp(BUSINESS_ID, VALID_OTP, AMOUNT, MERCHANT_REF).catch((e) => e);
    expect(err).toBeInstanceOf(WithdrawalOtpError);
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain('Too many failed attempts');
  });
});
