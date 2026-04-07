/**
 * Business Dashboard Service
 * Requirements: 2.9, 3.7, 8.1, 11.1–11.4, 12.5, 13.1–13.4
 * Properties: 30, 31, 32, 34, 35
 */
import { pool } from '../../db/client.js';
import { sendSupportTicketAck, sendSupportTicketStatusUpdate } from '../notification/index.js';
// ─── Pure utility functions ───────────────────────────────────────────────────
/**
 * Mask a WhatsApp number to show only the last 4 characters.
 * Property 30: always returns ****{last4}
 */
export function maskWaNumber(waNumber) {
    const last4 = waNumber.slice(-4);
    return `****${last4}`;
}
/**
 * Generate a unique support ticket reference.
 * Property 35: format TKT-{timestamp}-{random}
 */
export function generateTicketReference() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `TKT-${ts}-${rand}`;
}
/**
 * Check if a ticket reference is unique among existing references.
 * Property 35: returns false if ref is already in existingRefs
 */
export function isTicketReferenceUnique(ref, existingRefs) {
    return !existingRefs.includes(ref);
}
export async function getSubscriptionOverview(businessId) {
    const subResult = await pool.query(`SELECT plan, renewal_date FROM subscriptions
     WHERE business_id = $1 AND status = 'active'
     LIMIT 1`, [businessId]);
    const usageResult = await pool.query(`SELECT accumulated_cost_usd FROM token_usage
     WHERE business_id = $1
     ORDER BY billing_cycle_start DESC
     LIMIT 1`, [businessId]);
    const sub = subResult.rows[0];
    const usage = usageResult.rows[0];
    const tierCaps = { silver: 5, gold: 15, platinum: 50 };
    const planName = sub?.plan
        ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)
        : 'None';
    const renewalDate = sub?.renewal_date ? sub.renewal_date.toISOString() : null;
    const creditUsageUsd = usage ? Number(usage.accumulated_cost_usd) : 0;
    const creditCapUsd = sub ? (tierCaps[sub.plan] ?? 5) : 5;
    const creditUsagePercent = creditCapUsd > 0 ? Math.round((creditUsageUsd / creditCapUsd) * 10000) / 100 : 0;
    return { planName, renewalDate, creditUsageUsd, creditCapUsd, creditUsagePercent };
}
export async function getCreditUsage(businessId) {
    // Get accumulated cost from token_usage
    const usageResult = await pool.query(`SELECT accumulated_cost_usd FROM token_usage
     WHERE business_id = $1
     ORDER BY billing_cycle_start DESC
     LIMIT 1`, [businessId]);
    // Get tier cap and business status from subscription + business
    const subResult = await pool.query(`SELECT s.plan, b.status AS business_status
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.business_id = $1 AND s.status = 'active'
     LIMIT 1`, [businessId]);
    const row = usageResult.rows[0];
    const sub = subResult.rows[0];
    const currentCostUsd = row ? Number(row.accumulated_cost_usd) : 0;
    const tierCaps = { silver: 12, gold: 30, platinum: 70 };
    const monthlyCap = sub ? (tierCaps[sub.plan] ?? 12) : 12;
    const usagePercent = monthlyCap > 0 ? Math.round((currentCostUsd / monthlyCap) * 10000) / 100 : 0;
    const status = sub?.business_status === 'suspended' ? 'suspended' : 'active';
    return { currentCostUsd, monthlyCap, usagePercent, status };
}
export async function getActiveConversations(businessId) {
    const result = await pool.query(`SELECT id, COALESCE(customer_wa_number, customer_phone) AS customer_wa_number,
            status, message_count, manual_intervention_active,
            COALESCE(session_start, session_started_at) AS session_start
     FROM conversations
     WHERE business_id = $1 AND status = 'active'
     ORDER BY COALESCE(session_start, session_started_at) DESC`, [businessId]);
    const conversations = result.rows.map((row) => ({
        id: row.id,
        customerWaNumber: maskWaNumber(row.customer_wa_number ?? '0000'),
        status: row.status,
        messageCount: row.message_count,
        manualInterventionActive: row.manual_intervention_active,
        sessionStart: row.session_start ? row.session_start.toISOString() : new Date().toISOString(),
    }));
    return { conversations };
}
export async function getOrdersSummary(businessId, filters = {}) {
    const conditions = ['o.business_id = $1'];
    const params = [businessId];
    let idx = 2;
    if (filters.dateFrom) {
        conditions.push(`o.created_at >= $${idx++}`);
        params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push(`o.created_at <= $${idx++}`);
        params.push(filters.dateTo);
    }
    if (filters.status) {
        conditions.push(`o.payment_status = $${idx++}`);
        params.push(filters.status);
    }
    if (filters.productName) {
        conditions.push(`EXISTS (
        SELECT 1 FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id AND p.name ILIKE $${idx++}
      )`);
        params.push(`%${filters.productName}%`);
    }
    const where = conditions.join(' AND ');
    const result = await pool.query(`SELECT o.id, o.order_reference,
            COALESCE(o.customer_wa_number, o.customer_phone) AS customer_wa_number,
            o.payment_status AS status,
            o.total_amount, o.currency, o.created_at
     FROM orders o
     WHERE ${where}
     ORDER BY o.created_at DESC`, params);
    const orders = result.rows.map((row) => ({
        id: row.id,
        orderReference: row.order_reference,
        customerWaNumber: maskWaNumber(row.customer_wa_number),
        status: row.status,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at.toISOString(),
    }));
    return { orders, total: orders.length };
}
export async function getRevenueSummary(businessId) {
    const result = await pool.query(`SELECT
       COALESCE(SUM(total_amount), 0) AS total_revenue,
       COUNT(*) AS total_orders,
       COALESCE(MAX(currency), 'USD') AS currency
     FROM orders
     WHERE business_id = $1 AND payment_status = 'completed'`, [businessId]);
    const row = result.rows[0];
    const totalRevenue = Number(row.total_revenue);
    const totalOrders = Number(row.total_orders);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const currency = row.currency ?? 'USD';
    return { totalRevenue, totalOrders, averageOrderValue, currency };
}
// ─── Task 12.8: Orders CSV Export ────────────────────────────────────────────
export async function getOrdersCsv(businessId) {
    const result = await pool.query(`SELECT order_reference, COALESCE(customer_wa_number, customer_phone) AS customer_wa_number,
            payment_status AS status, total_amount, currency, created_at
     FROM orders
     WHERE business_id = $1
     ORDER BY created_at DESC`, [businessId]);
    const header = 'Order Reference,Customer (masked),Status,Total Amount,Currency,Date';
    const rows = result.rows.map((row) => {
        const masked = maskWaNumber(row.customer_wa_number);
        const amount = Number(row.total_amount).toFixed(2);
        const date = row.created_at.toISOString();
        return `${row.order_reference},${masked},${row.status},${amount},${row.currency},${date}`;
    });
    return [header, ...rows].join('\n');
}
export async function getWithdrawalHistory(businessId) {
    const result = await pool.query(`SELECT id, COALESCE(amount_usd, amount) AS amount_usd, status, requested_at, processed_at, paynow_payout_ref
     FROM withdrawal_requests
     WHERE business_id = $1
     ORDER BY requested_at DESC`, [businessId]);
    const withdrawals = result.rows.map((row) => ({
        id: row.id,
        amountUsd: Number(row.amount_usd),
        status: row.status,
        requestedAt: row.requested_at.toISOString(),
        processedAt: row.processed_at ? row.processed_at.toISOString() : null,
        reference: row.paynow_payout_ref,
    }));
    return { withdrawals };
}
// ─── Order Status Update ──────────────────────────────────────────────────────
const VALID_ORDER_STATUSES = ['pending', 'pending_external_payment', 'completed', 'processing', 'shipped', 'cancelled', 'expired', 'failed'];
export async function updateOrderStatus(businessId, orderId, newStatus) {
    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
        throw new Error(`Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`);
    }
    const result = await pool.query(`UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *, payment_status AS status, COALESCE(customer_wa_number, customer_phone) AS customer_wa_number`, [newStatus, orderId, businessId]);
    if (result.rows.length === 0)
        throw new Error('Order not found.');
    const row = result.rows[0];
    return {
        id: row.id,
        orderReference: row.order_reference,
        customerWaNumber: maskWaNumber(row.customer_wa_number),
        status: row.status,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        createdAt: row.created_at.toISOString(),
    };
}
export async function createSupportTicket(businessId, subject, description, attachmentUrl) {
    // Generate a unique reference
    let reference = generateTicketReference();
    // Ensure uniqueness against existing refs
    const existing = await pool.query(`SELECT ticket_reference FROM support_tickets WHERE business_id = $1`, [businessId]);
    const existingRefs = existing.rows.map((r) => r.ticket_reference);
    while (!isTicketReferenceUnique(reference, existingRefs)) {
        reference = generateTicketReference();
    }
    const result = await pool.query(`INSERT INTO support_tickets (business_id, ticket_reference, subject, description, attachment_url, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     RETURNING *`, [businessId, reference, subject, description, attachmentUrl ?? null]);
    const row = result.rows[0];
    // Task 14.3: Send acknowledgement email (best-effort, non-blocking)
    void (async () => {
        try {
            const bizResult = await pool.query(`SELECT email FROM businesses WHERE id = $1`, [businessId]);
            const email = bizResult.rows[0]?.email;
            if (email) {
                await sendSupportTicketAck(email, reference, subject);
            }
        }
        catch (err) {
            console.error('[Dashboard] Failed to send support ticket ack email:', err);
        }
    })();
    return {
        id: row.id,
        businessId: row.business_id,
        reference: row.ticket_reference,
        subject: row.subject,
        description: row.description,
        attachmentUrl: row.attachment_url,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
// ─── Task 14.4: Update support ticket status ─────────────────────────────────
export async function updateSupportTicketStatus(businessId, ticketId, newStatus) {
    const validStatuses = ['open', 'in_progress', 'closed'];
    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    const result = await pool.query(`UPDATE support_tickets
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND business_id = $3
     RETURNING *`, [newStatus, ticketId, businessId]);
    if (result.rows.length === 0) {
        throw new Error('Support ticket not found.');
    }
    const row = result.rows[0];
    // Task 14.4: Send status change notification (best-effort, non-blocking)
    void (async () => {
        try {
            const bizResult = await pool.query(`SELECT email FROM businesses WHERE id = $1`, [businessId]);
            const email = bizResult.rows[0]?.email;
            if (email) {
                await sendSupportTicketStatusUpdate(email, row.ticket_reference, newStatus);
            }
        }
        catch (err) {
            console.error('[Dashboard] Failed to send ticket status update email:', err);
        }
    })();
    return {
        id: row.id,
        businessId: row.business_id,
        reference: row.ticket_reference,
        subject: row.subject,
        description: row.description,
        attachmentUrl: row.attachment_url,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}
export async function listSupportTickets(businessId) {
    const result = await pool.query(`SELECT * FROM support_tickets
     WHERE business_id = $1
     ORDER BY created_at DESC`, [businessId]);
    const tickets = result.rows.map((row) => ({
        id: row.id,
        businessId: row.business_id,
        reference: row.ticket_reference,
        subject: row.subject,
        description: row.description,
        attachmentUrl: row.attachment_url,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    }));
    return { tickets };
}
//# sourceMappingURL=dashboard.service.js.map