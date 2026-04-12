/**
 * Payment Processor Service
 * Requirements: 7.1–7.6, 7.7, 7.8, 12.1–12.5, 17.5, 18.1–18.6
 * Properties: 21, 22, 23, 24, 33, 39, 40, 41, 42, 43, 44, 45
 */

import { pool } from '../../db/client.js';
import { config } from '../../config.js';
import { sendMessage } from '../whatsapp/message-dispatcher.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  businessId: string;
  conversationId: string | null;
  customerWaNumber: string;
  orderReference: string;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'completed' | 'expired' | 'failed' | 'pending_external_payment';
  paynowLink: string | null;
  paynowReference: string | null;
  paynowPollUrl: string | null;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  items: OrderItem[];
}

export interface RevenueBalance {
  businessId: string;
  availableUsd: number;
  lifetimeUsd: number;
  updatedAt: Date | null;
}

export interface WithdrawalRequest {
  id: string;
  businessId: string;
  amountUsd: number;
  status: 'pending' | 'processed' | 'failed';
  paynowMerchantRef: string | null;
  paynowPayoutRef: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  approvedBy: string | null;
}

export interface PaynowLinkResult {
  success: boolean;
  paymentUrl: string | null;
  pollUrl: string | null;
  paynowReference: string | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

// ─── Task 9.1: Paynow Payment Link Generation ─────────────────────────────────

/**
 * Generate a Paynow payment link for a purchase.
 * Creates an order record with status='pending', expires_at = NOW() + 15 min.
 * Property 23: order has all 5 required fields.
 */
export async function generatePaynowLink(
  businessId: string,
  customerWaNumber: string,
  items: OrderItem[],
  currency: string,
  conversationId?: string,
): Promise<{ order: Order; paymentUrl: string }> {
  const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const orderReference = generateOrderReference();

  // Use merchant email for Paynow authemail — Paynow requires a valid email, not a phone number
  const merchantEmail = config.paynow.merchantEmail || config.email.fromAddress || 'payments@augustus.ai';

  // Call Paynow API to create payment link
  const paynowResult = await initiatePaynowPayment(
    orderReference,
    merchantEmail,
    totalAmount,
    currency,
    items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
  );

  // If Paynow failed, throw immediately — don't create a dangling order
  if (!paynowResult.success || !paynowResult.paymentUrl) {
    throw new Error(`Paynow payment initiation failed: ${paynowResult.error ?? 'Unknown error'}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Property 23: all 5 fields present — status, amount, currency, order_reference, business_id
    const orderResult = await client.query<{
      id: string;
      business_id: string;
      conversation_id: string | null;
      customer_wa_number: string;
      order_reference: string;
      total_amount: string;
      currency: string;
      status: string;
      paynow_link: string | null;
      paynow_reference: string | null;
      paynow_poll_url: string | null;
      created_at: Date;
      completed_at: Date | null;
      expires_at: Date | null;
    }>(
      `INSERT INTO orders
         (business_id, conversation_id, customer_phone, customer_wa_number, order_reference,
          total_amount, currency, payment_status, payment_link, paynow_link, paynow_reference,
          paynow_poll_url, payment_link_expires_at, expires_at)
       VALUES ($1, $2, $3, $3, $4, $5, $6, 'pending', $7, $7, $8, $9,
               NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '15 minutes')
       RETURNING id, business_id, conversation_id, customer_wa_number, order_reference,
                 total_amount, currency, payment_status AS status, paynow_link,
                 paynow_reference, paynow_poll_url, created_at, completed_at, expires_at`,
      [
        businessId,
        conversationId ?? null,
        customerWaNumber,
        orderReference,
        totalAmount,
        currency,
        paynowResult.paymentUrl,
        paynowResult.paynowReference,
        paynowResult.pollUrl,
      ],
    );

    const orderRow = orderResult.rows[0];

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderRow.id, item.productId, item.productName || 'Product', item.quantity, item.unitPrice],
      );
    }

    await client.query('COMMIT');

    const order: Order = {
      id: orderRow.id,
      businessId: orderRow.business_id,
      conversationId: orderRow.conversation_id,
      customerWaNumber: orderRow.customer_wa_number,
      orderReference: orderRow.order_reference,
      totalAmount: Number(orderRow.total_amount),
      currency: orderRow.currency,
      status: orderRow.status as Order['status'],
      paynowLink: orderRow.paynow_link,
      paynowReference: orderRow.paynow_reference,
      paynowPollUrl: orderRow.paynow_poll_url,
      createdAt: orderRow.created_at,
      completedAt: orderRow.completed_at,
      expiresAt: orderRow.expires_at,
      items,
    };

    return { order, paymentUrl: paynowResult.paymentUrl ?? '' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Paynow API client ────────────────────────────────────────────────────────

/**
 * Initiate a Paynow payment and return the payment URL + poll URL.
 * Uses config.paynow credentials.
 */
export async function initiatePaynowPayment(
  orderReference: string,
  email: string,
  amount: number,
  _currency: string,
  description: string,
): Promise<PaynowLinkResult> {
  const { integrationId, integrationKey, returnUrl, resultUrl } = config.paynow;

  if (!integrationId || !integrationKey) {
    return { success: false, paymentUrl: null, pollUrl: null, paynowReference: null, error: 'Paynow not configured.' };
  }

  // Build Paynow initiate transaction request (URL-encoded form)
  // Field order matters for hash computation — must match exactly
  const fields: Record<string, string> = {
    id: integrationId,
    reference: orderReference,
    amount: amount.toFixed(2),
    additionalinfo: description,
    returnurl: returnUrl,
    resulturl: resultUrl,
    authemail: email,
    status: 'Message',
  };

  // Paynow hash: SHA512 of all field values concatenated in order (excluding hash field) + integrationKey
  // Per Paynow docs: https://developers.paynow.co.zw/docs/generating_hash.html
  const hashInput = Object.values(fields).join('') + integrationKey;
  const hash = await computeSha512(hashInput);

  const params = new URLSearchParams({ ...fields, hash: hash.toUpperCase() });

  let response: Response;
  try {
    response = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { success: false, paymentUrl: null, pollUrl: null, paynowReference: null, error: msg };
  }

  const text = await response.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));

  if (parsed['status']?.toLowerCase() === 'ok') {
    return {
      success: true,
      paymentUrl: parsed['browserurl'] ?? null,
      pollUrl: parsed['pollurl'] ?? null,
      paynowReference: parsed['paynowreference'] ?? null,
    };
  }

  return {
    success: false,
    paymentUrl: null,
    pollUrl: null,
    paynowReference: null,
    error: parsed['error'] ?? 'Paynow initiation failed.',
  };
}

async function computeMd5(input: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('md5').update(input).digest('hex');
}

async function computeSha512(input: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha512').update(input, 'utf8').digest('hex');
}

// ─── Task 9.2: Paynow Webhook + Polling ──────────────────────────────────────

/**
 * Validate a Paynow webhook payload hash.
 * Paynow computes: MD5(all field values concatenated in order, excluding 'hash') + integrationKey
 * Returns true if the hash in the payload matches the expected hash.
 */
async function validatePaynowWebhookHash(payload: Record<string, string>): Promise<boolean> {
  const { integrationKey } = config.paynow;
  if (!integrationKey) return false;

  const receivedHash = (payload['hash'] ?? '').toUpperCase();
  if (!receivedHash) return false;

  // Concatenate all field values except 'hash', in the order they appear
  const hashInput =
    Object.entries(payload)
      .filter(([key]) => key.toLowerCase() !== 'hash')
      .map(([, value]) => value)
      .join('') + integrationKey;

  const expectedHash = (await computeSha512(hashInput)).toUpperCase();
  return receivedHash === expectedHash;
}

/**
 * Handle an inbound Paynow payment status webhook.
 * On confirmed payment: dispatch receipt, update revenue, decrement stock.
 */
export async function handlePaynowWebhook(payload: Record<string, string>): Promise<void> {
  // Validate Paynow hash signature
  const isValid = await validatePaynowWebhookHash(payload);
  if (!isValid) {
    throw new Error('Invalid Paynow webhook hash.');
  }

  const reference = payload['reference'] ?? '';
  const status = (payload['status'] ?? '').toLowerCase();
  const paynowReference = payload['paynowreference'] ?? '';

  if (!reference) return;

  const orderResult = await pool.query<{ id: string; business_id: string; customer_wa_number: string; status: string }>(
    `SELECT id, business_id, customer_wa_number, payment_status AS status FROM orders WHERE order_reference = $1`,
    [reference],
  );
  if (orderResult.rows.length === 0) return;

  const order = orderResult.rows[0];
  if (order.status !== 'pending') return; // already processed

  if (status === 'paid') {
    await confirmPayment(order.id, paynowReference);
  } else if (status === 'cancelled' || status === 'failed') {
    await pool.query(
      `UPDATE orders SET payment_status = 'failed', paynow_reference = $1 WHERE id = $2`,
      [paynowReference, order.id],
    );
  }
}

/**
 * Poll Paynow for the status of an order.
 * Fallback for when webhooks are not received.
 * Uses the stored paynow_poll_url from the order record.
 */
export async function pollPaynowStatus(orderId: string): Promise<void> {
  const orderResult = await pool.query<{
    id: string;
    business_id: string;
    paynow_reference: string | null;
    paynow_poll_url: string | null;
    status: string;
    order_reference: string;
  }>(
    `SELECT id, business_id, paynow_reference, paynow_poll_url, payment_status AS status, order_reference FROM orders WHERE id = $1`,
    [orderId],
  );

  if (orderResult.rows.length === 0) return;
  const order = orderResult.rows[0];
  if (order.status !== 'pending') return;

  // Use stored poll URL; fall back to constructing from paynow_reference if not stored
  const pollUrl =
    order.paynow_poll_url ??
    (order.paynow_reference
      ? `https://www.paynow.co.zw/interface/returntransaction/${order.paynow_reference}`
      : null);

  if (!pollUrl) return;

  let response: Response;
  try {
    response = await fetch(pollUrl);
  } catch {
    return; // network error — try again later
  }

  const text = await response.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));
  const status = (parsed['status'] ?? '').toLowerCase();

  if (status === 'paid') {
    await confirmPayment(order.id, parsed['paynowreference'] ?? order.paynow_reference ?? '');
  } else if (status === 'cancelled' || status === 'failed') {
    await pool.query(`UPDATE orders SET payment_status = 'failed' WHERE id = $1`, [order.id]);
  }
}

// ─── Task 9.3: Receipt Dispatch (Property 21) ────────────────────────────────

/**
 * Send a WhatsApp receipt message to the customer after payment is confirmed.
 * Property 21: receipt must contain order_reference, items, total_amount, timestamp.
 */
export async function dispatchReceipt(
  businessId: string,
  customerWaNumber: string,
  orderReference: string,
  items: OrderItem[],
  totalAmount: number,
  currency: string,
  timestamp: Date,
): Promise<void> {
  const itemLines = items
    .map((i) => {
      const lineTotal = (i.unitPrice * i.quantity).toFixed(2);
      return `  • ${i.productName}\n    Qty: ${i.quantity}  ×  ${currency} ${i.unitPrice.toFixed(2)}  =  ${currency} ${lineTotal}`;
    })
    .join('\n');

  const dateStr = timestamp.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const body =
    `✅ *Payment Confirmed!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Order Reference:* ${orderReference}\n` +
    `📅 *Date:* ${dateStr}\n\n` +
    `🛍️ *Items Purchased:*\n${itemLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total Paid: ${currency} ${totalAmount.toFixed(2)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Thank you for your purchase! 🎉\n` +
    `Your order is being processed. We'll notify you once it's on its way.`;

  await sendMessage(businessId, { type: 'text', to: customerWaNumber, body });
}

// ─── Task 9.4: Payment Link Expiry (Property 22) ─────────────────────────────

/**
 * Mark expired orders and notify customers.
 * Property 22: order status = 'expired' after 15 minutes.
 */
export async function expireStaleOrders(): Promise<void> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    customer_wa_number: string;
    order_reference: string;
  }>(
    `UPDATE orders
     SET payment_status = 'expired', updated_at = NOW()
     WHERE payment_status = 'pending'
       AND payment_link_expires_at IS NOT NULL
       AND payment_link_expires_at < NOW()
     RETURNING id, business_id, customer_wa_number, order_reference`,
  );

  for (const row of result.rows) {
    await sendMessage(row.business_id, {
      type: 'text',
      to: row.customer_wa_number,
      body: `Your payment link for order ${row.order_reference} has expired. Please start a new order if you wish to continue.`,
    });
  }
}

/**
 * Check and expire a single order if past its expiry time.
 * Returns true if the order was expired.
 */
export async function expireOrderIfStale(orderId: string): Promise<boolean> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    customer_wa_number: string;
    order_reference: string;
  }>(
    `UPDATE orders
     SET payment_status = 'expired', updated_at = NOW()
     WHERE id = $1
       AND payment_status = 'pending'
       AND payment_link_expires_at IS NOT NULL
       AND payment_link_expires_at < NOW()
     RETURNING id, business_id, customer_wa_number, order_reference`,
    [orderId],
  );

  if (result.rows.length === 0) return false;

  const row = result.rows[0];
  await sendMessage(row.business_id, {
    type: 'text',
    to: row.customer_wa_number,
    body: `Your payment link for order ${row.order_reference} has expired. Please start a new order if you wish to continue.`,
  });
  return true;
}

// ─── Task 9.5 + 9.6 + 9.7: Confirm Payment ───────────────────────────────────

/**
 * Confirm a payment: update order status, dispatch receipt,
 * decrement stock (Property 24), update revenue balance (Task 9.7).
 * Property 23: transaction record has all 5 fields.
 */
export async function confirmPayment(orderId: string, paynowReference: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark order completed
    const orderResult = await client.query<{
      id: string;
      business_id: string;
      customer_wa_number: string;
      order_reference: string;
      total_amount: string;
      currency: string;
    }>(
      `UPDATE orders
       SET payment_status = 'completed', paynow_reference = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND payment_status = 'pending'
       RETURNING id, business_id, customer_wa_number, order_reference, total_amount, currency`,
      [paynowReference, orderId],
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    const order = orderResult.rows[0];
    const totalAmount = Number(order.total_amount);

    // Fetch order items
    const itemsResult = await client.query<{
      product_id: string;
      quantity: number;
      unit_price: string;
    }>(
      `SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = $1`,
      [orderId],
    );

    // Task 9.6 — Property 24: decrement stock for each item
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1, updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [item.quantity, item.product_id, order.business_id],
      );
    }

    // Task 9.7: upsert revenue balance — update both column sets for compatibility
    await client.query(
      `INSERT INTO revenue_balances (business_id, available_balance, total_lifetime_revenue, available_usd, lifetime_usd, updated_at)
       VALUES ($1, $2, $2, $2, $2, NOW())
       ON CONFLICT (business_id) DO UPDATE
         SET available_balance      = revenue_balances.available_balance + $2,
             total_lifetime_revenue = revenue_balances.total_lifetime_revenue + $2,
             available_usd          = revenue_balances.available_usd + $2,
             lifetime_usd           = revenue_balances.lifetime_usd + $2,
             updated_at             = NOW()`,
      [order.business_id, totalAmount],
    );

    await client.query('COMMIT');

    // Fetch product names for receipt
    const productIds = itemsResult.rows.map((i) => i.product_id);
    const productsResult = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM products WHERE id = ANY($1)`,
      [productIds],
    );
    const nameMap = new Map(productsResult.rows.map((r) => [r.id, r.name]));

    const receiptItems: OrderItem[] = itemsResult.rows.map((i) => ({
      productId: i.product_id,
      productName: nameMap.get(i.product_id) ?? i.product_id,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
    }));

    // Task 9.3 — Property 21: dispatch receipt
    await dispatchReceipt(
      order.business_id,
      order.customer_wa_number,
      order.order_reference,
      receiptItems,
      totalAmount,
      order.currency,
      new Date(),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Task 9.7: Revenue Balance ────────────────────────────────────────────────

export async function getRevenueBalance(businessId: string): Promise<RevenueBalance | null> {
  const result = await pool.query<{
    business_id: string;
    available_balance: string;
    total_lifetime_revenue: string;
    updated_at: Date | null;
  }>(
    `SELECT business_id, available_balance, total_lifetime_revenue, updated_at
     FROM revenue_balances WHERE business_id = $1`,
    [businessId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    businessId: row.business_id,
    availableUsd: Number(row.available_balance),
    lifetimeUsd: Number(row.total_lifetime_revenue),
    updatedAt: row.updated_at,
  };
}

// ─── Task 9.8: Withdrawal Request Validation (Property 33) ───────────────────

/**
 * Create a withdrawal request.
 * Property 33: if amount > available balance, reject with current balance.
 */
export async function createWithdrawalRequest(
  businessId: string,
  amountUsd: number,
  paynowMerchantRef: string,
): Promise<{ withdrawal: WithdrawalRequest; autoProcessed: boolean }> {
  // Check available balance
  const balance = await getRevenueBalance(businessId);
  const available = balance?.availableUsd ?? 0;

  if (amountUsd > available) {
    const err = new Error(`Requested amount exceeds available balance.`) as Error & {
      statusCode: number;
      availableBalance: number;
    };
    err.statusCode = 422;
    err.availableBalance = available;
    throw err;
  }

  const result = await pool.query<{
    id: string;
    business_id: string;
    amount_usd: string;
    status: string;
    paynow_merchant_ref: string | null;
    paynow_payout_ref: string | null;
    requested_at: Date;
    processed_at: Date | null;
    approved_by: string | null;
  }>(
    `INSERT INTO withdrawal_requests (business_id, amount_usd, amount, currency, status, paynow_merchant_ref)
     VALUES ($1, $2, $2, 'USD', 'pending', $3)
     RETURNING *`,
    [businessId, amountUsd, paynowMerchantRef],
  );

  const row = result.rows[0];
  const withdrawal: WithdrawalRequest = {
    id: row.id,
    businessId: row.business_id,
    amountUsd: Number(row.amount_usd),
    status: row.status as WithdrawalRequest['status'],
    paynowMerchantRef: row.paynow_merchant_ref,
    paynowPayoutRef: row.paynow_payout_ref,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    approvedBy: row.approved_by,
  };

  // Task 9.10 — Property 39: auto-process if below threshold
  const threshold = config.withdrawal.autoProcessThreshold;
  let autoProcessed = false;
  if (amountUsd < threshold) {
    await processWithdrawal(withdrawal.id, null);
    autoProcessed = true;
  }

  return { withdrawal, autoProcessed };
}

// ─── Task 9.9: Paynow Payout Initiation ──────────────────────────────────────

/**
 * Initiate a Paynow payout for an approved withdrawal.
 * Updates withdrawal status to 'processed' with paynow_payout_ref.
 */
export async function processWithdrawal(
  withdrawalId: string,
  approvedBy: string | null,
): Promise<WithdrawalRequest> {
  // Fetch withdrawal
  const wResult = await pool.query<{
    id: string;
    business_id: string;
    amount_usd: string;
    paynow_merchant_ref: string | null;
    status: string;
  }>(
    `SELECT id, business_id, amount_usd, paynow_merchant_ref, status
     FROM withdrawal_requests WHERE id = $1`,
    [withdrawalId],
  );

  if (wResult.rows.length === 0) throw new Error('Withdrawal not found.');
  const w = wResult.rows[0];
  if (w.status === 'processed') throw new Error('Withdrawal already processed.');

  // Initiate Paynow payout (stub — real implementation calls Paynow B2C API)
  const payoutRef = await initiatePaynowPayout(
    w.business_id,
    Number(w.amount_usd),
    w.paynow_merchant_ref ?? '',
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deduct from available balance — update both column sets
    await client.query(
      `UPDATE revenue_balances
       SET available_balance = available_balance - $1,
           available_usd     = available_usd - $1,
           updated_at        = NOW()
       WHERE business_id = $2`,
      [Number(w.amount_usd), w.business_id],
    );

    // Mark withdrawal processed
    const updated = await client.query<{
      id: string;
      business_id: string;
      amount_usd: string;
      status: string;
      paynow_merchant_ref: string | null;
      paynow_payout_ref: string | null;
      requested_at: Date;
      processed_at: Date | null;
      approved_by: string | null;
    }>(
      `UPDATE withdrawal_requests
       SET status = 'processed', paynow_payout_ref = $1, processed_at = NOW(), approved_by = $2
       WHERE id = $3
       RETURNING *`,
      [payoutRef, approvedBy, withdrawalId],
    );

    await client.query('COMMIT');

    const row = updated.rows[0];
    return {
      id: row.id,
      businessId: row.business_id,
      amountUsd: Number(row.amount_usd),
      status: row.status as WithdrawalRequest['status'],
      paynowMerchantRef: row.paynow_merchant_ref,
      paynowPayoutRef: row.paynow_payout_ref,
      requestedAt: row.requested_at,
      processedAt: row.processed_at,
      approvedBy: row.approved_by,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initiate a Paynow B2C payout.
 * Returns a payout reference string.
 */
async function initiatePaynowPayout(
  businessId: string,
  amountUsd: number,
  merchantRef: string,
): Promise<string> {
  // TODO: Implement real Paynow B2C payout API call
  // For now returns a generated reference — replace with actual Paynow B2C integration
  void businessId; void amountUsd; void merchantRef;
  return `PAYOUT-${businessId.slice(0, 8)}-${Date.now()}`;
}

// ─── Task 9.10: Auto-Processing Threshold (Property 39) ──────────────────────

/**
 * Returns the configured auto-withdrawal threshold.
 */
export function getAutoWithdrawalThreshold(): number {
  return config.withdrawal.autoProcessThreshold;
}

/**
 * Returns true if the given amount should be auto-processed.
 * Property 39: strictly below threshold → auto-processed.
 */
export function shouldAutoProcess(amountUsd: number): boolean {
  return amountUsd < getAutoWithdrawalThreshold();
}

// ─── Helpers: get order with items ───────────────────────────────────────────

export async function getOrderWithItems(orderId: string): Promise<Order | null> {
  const orderResult = await pool.query<{
    id: string;
    business_id: string;
    conversation_id: string | null;
    customer_wa_number: string;
    order_reference: string;
    total_amount: string;
    currency: string;
    status: string;
    paynow_link: string | null;
    paynow_reference: string | null;
    paynow_poll_url: string | null;
    created_at: Date;
    completed_at: Date | null;
    expires_at: Date | null;
  }>(
    `SELECT *, payment_status AS status, payment_link AS paynow_link,
             payment_link_expires_at AS expires_at
     FROM orders WHERE id = $1`,
    [orderId],
  );

  if (orderResult.rows.length === 0) return null;
  const row = orderResult.rows[0];

  const itemsResult = await pool.query<{
    product_id: string;
    quantity: number;
    unit_price: string;
  }>(
    `SELECT oi.product_id, oi.quantity, oi.unit_price, p.name AS product_name
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [orderId],
  );

  const items: OrderItem[] = (itemsResult.rows as Array<{
    product_id: string;
    quantity: number;
    unit_price: string;
    product_name?: string;
  }>).map((i) => ({
    productId: i.product_id,
    productName: i.product_name ?? i.product_id,
    quantity: i.quantity,
    unitPrice: Number(i.unit_price),
  }));

  return {
    id: row.id,
    businessId: row.business_id,
    conversationId: row.conversation_id,
    customerWaNumber: row.customer_wa_number,
    orderReference: row.order_reference,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status as Order['status'],
    paynowLink: row.paynow_link,
    paynowReference: row.paynow_reference,
    paynowPollUrl: row.paynow_poll_url,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    items,
  };
}

// ─── Task 18.2: Payment Settings ─────────────────────────────────────────────

export interface PaymentSettings {
  inChatPaymentsEnabled: boolean;
  externalPaymentDetails: Record<string, string> | null;
}

/**
 * Returns true if details has at least one non-null, non-empty entry.
 * Property 42: disabling requires valid external details.
 */
export function isExternalDetailsValid(
  details: Record<string, unknown> | null | undefined,
): boolean {
  if (!details) return false;
  // New structured format: { methods: [...] }
  const methods = details.methods as Array<Record<string, string>> | undefined;
  if (Array.isArray(methods)) {
    return methods.some((m) => m.account && m.account.trim() !== '');
  }
  // Legacy flat format fallback
  return Object.values(details).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
}

/**
 * Get payment settings for a business.
 */
export async function getPaymentSettings(businessId: string): Promise<PaymentSettings> {
  const result = await pool.query<{
    in_chat_payments_enabled: boolean;
    external_payment_details: Record<string, string> | null;
  }>(
    `SELECT in_chat_payments_enabled, external_payment_details
     FROM businesses WHERE id = $1`,
    [businessId],
  );
  if (result.rows.length === 0) {
    throw new Error('Business not found.');
  }
  const row = result.rows[0];
  return {
    inChatPaymentsEnabled: row.in_chat_payments_enabled,
    externalPaymentDetails: row.external_payment_details,
  };
}

/**
 * Update payment settings for a business.
 * Validates: if inChatPaymentsEnabled = false, externalPaymentDetails must have
 * at least one non-null, non-empty entry.
 */
export async function updatePaymentSettings(
  businessId: string,
  settings: PaymentSettings,
): Promise<PaymentSettings> {
  if (!settings.inChatPaymentsEnabled) {
    if (!isExternalDetailsValid(settings.externalPaymentDetails)) {
      const err = new Error(
        'External payment details required when in-chat payments are disabled.',
      ) as Error & { statusCode: number };
      err.statusCode = 422;
      throw err;
    }
  }

  await pool.query(
    `UPDATE businesses
     SET in_chat_payments_enabled = $1, external_payment_details = $2
     WHERE id = $3`,
    [settings.inChatPaymentsEnabled, settings.externalPaymentDetails, businessId],
  );

  return settings;
}

// ─── Task 18.4: Payment Settings Round-Trip helper ───────────────────────────

/**
 * Build a PaymentSettings response object from raw values.
 * Property 44: round-trip — stored and retrieved values are identical.
 */
export function buildPaymentSettingsResponse(
  enabled: boolean,
  details: Record<string, string> | null,
): PaymentSettings {
  return { inChatPaymentsEnabled: enabled, externalPaymentDetails: details };
}

/**
 * Build an order confirmation message sent immediately when a Paynow link is generated.
 * This is the "pending payment" state — before the customer pays.
 */
export function buildOrderConfirmationMessage(
  orderReference: string,
  items: OrderItem[],
  totalAmount: number,
  currency: string,
  expiresInMinutes = 15,
): string {
  const itemLines = items
    .map((i) => {
      const lineTotal = (i.unitPrice * i.quantity).toFixed(2);
      return `  • ${i.productName}  ×${i.quantity}  —  ${currency} ${lineTotal}`;
    })
    .join('\n');

  return (
    `🛒 *Order Placed!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Ref:* ${orderReference}\n\n` +
    `${itemLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total: ${currency} ${totalAmount.toFixed(2)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⏱️ Payment link expires in *${expiresInMinutes} minutes*.\n` +
    `Complete payment to confirm your order.`
  );
}

// ─── Task 18.5: Invoice Message Builder ──────────────────────────────────────

export interface InvoiceMessage {
  orderReference: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  externalPaymentDetails: Record<string, string>;
}

/**
 * Build a WhatsApp invoice text message for external payment flow.
 * Property 41: invoice contains order reference, items, total amount,
 *              and at least one external payment detail entry.
 * Property 45: invoice does NOT contain a Paynow URL.
 */
export function buildInvoiceMessage(invoice: InvoiceMessage): string {
  const itemLines = invoice.items
    .map((i) => {
      const lineTotal = (i.unitPrice * i.quantity).toFixed(2);
      return `  • ${i.productName}\n    Qty: ${i.quantity}  ×  ${invoice.currency} ${i.unitPrice.toFixed(2)}  =  ${invoice.currency} ${lineTotal}`;
    })
    .join('\n');

  // Support both new structured format { methods: [...] } and legacy flat format
  let paymentLines: string;
  const details = invoice.externalPaymentDetails as Record<string, unknown>;
  const methods = details?.methods as Array<Record<string, string>> | undefined;

  if (Array.isArray(methods) && methods.length > 0) {
    paymentLines = methods
      .filter((m) => m.account)
      .map((m) => {
        const providerLabel = m.label || m.bank_name || m.provider || 'Payment';
        let line = `  📌 *${providerLabel}*\n     Account: ${m.account}`;
        if (m.name) line += `\n     Name: ${m.name}`;
        if (m.branch) line += `\n     Branch: ${m.branch}`;
        if (m.instructions) line += `\n     Note: ${m.instructions}`;
        return line;
      })
      .join('\n\n');
  } else {
    paymentLines = Object.entries(details ?? {})
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([k, v]) => `  • ${k.replace(/_/g, ' ')}: ${v}`)
      .join('\n');
  }

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    `🧾 *INVOICE*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Order Reference:* ${invoice.orderReference}\n` +
    `📅 *Date:* ${dateStr}\n\n` +
    `🛍️ *Order Details:*\n${itemLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total Due: ${invoice.currency} ${invoice.totalAmount.toFixed(2)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💳 *Payment Instructions:*\n${paymentLines}\n\n` +
    `⚠️ *Important:* Please use *${invoice.orderReference}* as your payment reference.\n\n` +
    `Once payment is made, reply "PAID" and we'll confirm your order. Thank you! 🙏`
  );
}

/**
 * Determine the order flow based on in_chat_payments_enabled flag.
 * Property 40: when disabled, paynowLink is null.
 * Property 43: toggle applies immediately.
 */
export function determineOrderFlow(inChatPaymentsEnabled: boolean): {
  usePaynow: boolean;
  paynowLink: string | null;
} {
  if (inChatPaymentsEnabled) {
    return { usePaynow: true, paynowLink: 'pending' }; // actual link generated by Paynow API
  }
  return { usePaynow: false, paynowLink: null };
}
