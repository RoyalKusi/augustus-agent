/**
 * Admin Dashboard Routes
 * Requirements: 14, 15, 16, 17
 */
import { authenticateOperator } from './admin.middleware.js';
import { operatorLogin, enrollMfa, verifyMfaEnrollment, listBusinesses, suspendBusiness, reactivateBusiness, getAiMetrics, getMetaMetrics, getPlatformCostMetrics, setTokenOverride, getSubscriptionMetrics, listPendingWithdrawals, listAllWithdrawals, approveWithdrawal, getBusinessDashboardView, getApiKeyStatus, listAllSupportTickets, updateSupportTicketStatus, } from './admin.service.js';
export async function adminRoutes(app) {
    // ─── Task 13.1: Operator auth ───────────────────────────────────────────────
    app.post('/admin/auth/login', async (request, reply) => {
        const { email, password, totpCode } = request.body;
        try {
            const result = await operatorLogin(email, password, totpCode ?? '');
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed.';
            return reply.status(401).send({ error: message });
        }
    });
    // POST /admin/auth/enroll-mfa  (requires operator token)
    app.post('/admin/auth/enroll-mfa', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await enrollMfa(request.operatorId);
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'MFA enrollment failed.';
            return reply.status(400).send({ error: message });
        }
    });
    // POST /admin/auth/verify-mfa  (requires operator token)
    app.post('/admin/auth/verify-mfa', { preHandler: authenticateOperator }, async (request, reply) => {
        const { code } = request.body;
        try {
            await verifyMfaEnrollment(request.operatorId, code);
            return reply.send({ message: 'MFA enabled successfully.' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'MFA verification failed.';
            return reply.status(400).send({ error: message });
        }
    });
    // ─── Task 13.2: Business list ───────────────────────────────────────────────
    // GET /admin/businesses
    app.get('/admin/businesses', { preHandler: authenticateOperator }, async (request, reply) => {
        const { search, status, plan } = request.query;
        try {
            const result = await listBusinesses({ search, status, plan });
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list businesses.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.3: Suspend business ───────────────────────────────────────────
    // POST /admin/businesses/:id/suspend
    app.post('/admin/businesses/:id/suspend', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        try {
            await suspendBusiness(id, request.operatorId);
            return reply.send({ message: 'Business suspended.' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to suspend business.';
            const status = message.includes('not found') ? 404 : 400;
            return reply.status(status).send({ error: message });
        }
    });
    // ─── Task 13.4: Reactivate business ────────────────────────────────────────
    // POST /admin/businesses/:id/reactivate
    app.post('/admin/businesses/:id/reactivate', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        try {
            await reactivateBusiness(id, request.operatorId);
            return reply.send({ message: 'Business reactivated.' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to reactivate business.';
            const status = message.includes('not found') ? 404 : 400;
            return reply.status(status).send({ error: message });
        }
    });
    // ─── Task 13.6: AI metrics ──────────────────────────────────────────────────
    // GET /admin/metrics/ai
    app.get('/admin/metrics/ai', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await getAiMetrics();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get AI metrics.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.7: Meta metrics ────────────────────────────────────────────────
    // GET /admin/metrics/meta
    app.get('/admin/metrics/meta', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await getMetaMetrics();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get Meta metrics.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.8: Platform cost metrics ──────────────────────────────────────
    // GET /admin/metrics/platform-cost
    app.get('/admin/metrics/platform-cost', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await getPlatformCostMetrics();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get platform cost metrics.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.9: Token override ──────────────────────────────────────────────
    // POST /admin/businesses/:id/token-override
    app.post('/admin/businesses/:id/token-override', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        const { monthlyCapUsd } = request.body;
        try {
            await setTokenOverride(id, monthlyCapUsd, request.operatorId);
            return reply.send({ message: 'Token override applied.' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to set token override.';
            return reply.status(400).send({ error: message });
        }
    });
    // ─── Task 13.10: Subscription metrics ──────────────────────────────────────
    // GET /admin/metrics/subscriptions
    app.get('/admin/metrics/subscriptions', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await getSubscriptionMetrics();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get subscription metrics.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.11: Withdrawal management ─────────────────────────────────────
    // GET /admin/withdrawals/pending
    app.get('/admin/withdrawals/pending', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await listPendingWithdrawals();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list withdrawals.';
            return reply.status(500).send({ error: message });
        }
    });
    // POST /admin/withdrawals/:id/approve
    app.post('/admin/withdrawals/:id/approve', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        try {
            await approveWithdrawal(id, request.operatorId);
            return reply.send({ message: 'Withdrawal approved.' });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to approve withdrawal.';
            const status = message.includes('not found') ? 404 : 400;
            return reply.status(status).send({ error: message });
        }
    });
    // GET /admin/withdrawals/history
    app.get('/admin/withdrawals/history', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await listAllWithdrawals();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list withdrawal history.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.14: Business dashboard view ───────────────────────────────────
    // GET /admin/businesses/:id/dashboard
    app.get('/admin/businesses/:id/dashboard', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        try {
            const result = await getBusinessDashboardView(id);
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get business dashboard.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Task 13.15: API key status ─────────────────────────────────────────────
    // GET /admin/api-keys/status
    app.get('/admin/api-keys/status', { preHandler: authenticateOperator }, async (request, reply) => {
        try {
            const result = await getApiKeyStatus();
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to get API key status.';
            return reply.status(500).send({ error: message });
        }
    });
    // ─── Support Ticket Management ────────────────────────────────────────────
    // GET /admin/support — list all support tickets across all businesses
    app.get('/admin/support', { preHandler: authenticateOperator }, async (request, reply) => {
        const { status, search } = request.query;
        try {
            const result = await listAllSupportTickets({ status, search });
            return reply.send(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to list support tickets.';
            return reply.status(500).send({ error: message });
        }
    });
    // PATCH /admin/support/:id/status — update a ticket's status
    app.patch('/admin/support/:id/status', { preHandler: authenticateOperator }, async (request, reply) => {
        const { id } = request.params;
        const { status } = request.body;
        if (!status)
            return reply.status(400).send({ error: 'Missing required field: status.' });
        try {
            const ticket = await updateSupportTicketStatus(id, status, request.operatorId);
            return reply.send(ticket);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update ticket.';
            const code = message.includes('not found') ? 404 : message.includes('Invalid') ? 400 : 500;
            return reply.status(code).send({ error: message });
        }
    });
}
//# sourceMappingURL=admin.routes.js.map