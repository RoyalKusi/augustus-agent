import { authService } from './service.js';
export async function authRoutes(app) {
    // POST /auth/register
    app.post('/auth/register', async (request, reply) => {
        const { businessName, ownerName, email, password } = request.body;
        try {
            const result = await authService.register({ businessName, ownerName, email, password });
            return reply.status(201).send(result);
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 400).send({ error: e.message });
        }
    });
    // GET /auth/verify-email?token=...
    app.get('/auth/verify-email', async (request, reply) => {
        const { token } = request.query;
        try {
            await authService.verifyEmail(token);
            return reply.send({ message: 'Email verified.' });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 400).send({ error: e.message });
        }
    });
    // POST /auth/login
    app.post('/auth/login', async (request, reply) => {
        const { email, password } = request.body;
        try {
            const result = await authService.login(email, password);
            return reply.send(result);
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 401).send({ error: e.message });
        }
    });
    // POST /auth/request-password-reset
    app.post('/auth/request-password-reset', async (request, reply) => {
        const { email } = request.body;
        await authService.requestPasswordReset(email).catch(() => { });
        return reply.send({ message: 'If that email is registered, a reset link has been sent.' });
    });
    // POST /auth/reset-password
    app.post('/auth/reset-password', async (request, reply) => {
        const { token, newPassword } = request.body;
        try {
            await authService.resetPassword(token, newPassword);
            return reply.send({ message: 'Password reset successfully.' });
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 400).send({ error: e.message });
        }
    });
}
//# sourceMappingURL=routes.js.map