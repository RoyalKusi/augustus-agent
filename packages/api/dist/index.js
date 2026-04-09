import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, createReadStream } from 'fs';
import { runMigrations } from './db/client.js';
import { authRoutes } from './modules/auth/index.js';
import { subscriptionRoutes } from './modules/subscription/index.js';
import { catalogueRoutes } from './modules/catalogue/index.js';
import { trainingRoutes } from './modules/training/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';
import { adminRoutes } from './modules/admin/index.js';
import { webhookRoutes } from './modules/webhook/webhook.routes.js';
import { whatsappIntegrationRoutes } from './modules/whatsapp/whatsapp-integration.routes.js';
import { paymentRoutes } from './modules/payment/payment.routes.js';
import { interventionRoutes } from './modules/intervention/intervention.routes.js';
import { legalRoutes } from './routes/legal.js';
import { startConversationEngineConsumer, stopConversationEngineConsumer, consumerRunning, CONSUMER_NAME, } from './modules/conversation/conversation-engine.service.js';
import { expireStaleOrders } from './modules/payment/payment.service.js';
import { runBillingCycleResetJob } from './modules/token-budget/token-budget.service.js';
import { sendRenewalReminders } from './modules/subscription/subscription.service.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Catch unhandled rejections so the process doesn't die silently
process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled rejection:', reason);
});
const start = async () => {
    try {
        const app = Fastify({ logger: true });
        // Allow empty JSON bodies globally
        app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
            const str = body ?? '';
            if (!str.trim()) {
                done(null, {});
                return;
            }
            try {
                done(null, JSON.parse(str));
            }
            catch (err) {
                done(err, undefined);
            }
        });
        await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
        const allowedOrigins = process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
            : ['http://localhost:5173', 'http://localhost:5174'];
        await app.register(cors, {
            origin: process.env.NODE_ENV === 'development' ? true : allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        });
        app.get('/health', async () => ({ status: 'ok', service: 'augustus-api' }));
        app.get('/health/consumer', async () => ({ consumerRunning, consumers: CONSUMER_NAME }));
        await app.register(authRoutes);
        await app.register(subscriptionRoutes);
        await app.register(catalogueRoutes);
        await app.register(trainingRoutes);
        await app.register(dashboardRoutes);
        await app.register(adminRoutes);
        await app.register(webhookRoutes);
        await app.register(whatsappIntegrationRoutes, { prefix: '/whatsapp' });
        await app.register(paymentRoutes);
        await app.register(interventionRoutes);
        await app.register(legalRoutes);
        // Static file serving (production only)
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
            const businessDist = join(__dirname, '../../business-dashboard/dist');
            const adminDist = join(__dirname, '../../admin-dashboard/dist');
            if (existsSync(adminDist)) {
                await app.register(staticPlugin, {
                    root: adminDist,
                    prefix: '/admin-app/',
                    decorateReply: true,
                    wildcard: false,
                });
                const serveAdminIndex = (_req, reply) => {
                    reply.type('text/html').send(createReadStream(join(adminDist, 'index.html')));
                };
                app.get('/admin-app', serveAdminIndex);
                app.get('/admin-app/*', serveAdminIndex);
            }
            if (existsSync(businessDist)) {
                // Serve static assets — wildcard: true so all files under /assets/ are served
                await app.register(staticPlugin, {
                    root: businessDist,
                    prefix: '/assets/',
                    decorateReply: false,
                    wildcard: true,
                });
                // Intercept browser page navigations (Accept: text/html) on SPA paths
                const spaPrefixes = ['/dashboard', '/login', '/register', '/forgot-password',
                    '/verify-email', '/reset-password', '/subscription'];
                const indexHtmlPath = join(businessDist, 'index.html');
                app.addHook('onRequest', async (request, reply) => {
                    const accept = request.headers['accept'] ?? '';
                    const path = request.url.split('?')[0];
                    const isBrowserNav = accept.includes('text/html') && request.method === 'GET';
                    const isSpaPath = spaPrefixes.some((p) => path === p || path.startsWith(p + '/'));
                    if (isBrowserNav && isSpaPath) {
                        const { readFile } = await import('fs/promises');
                        const html = await readFile(indexHtmlPath);
                        reply.type('text/html').send(html);
                    }
                });
                // Root path serves index.html
                app.get('/', async (_req, reply) => {
                    const { readFile } = await import('fs/promises');
                    const html = await readFile(indexHtmlPath);
                    reply.type('text/html').send(html);
                });
                // Catch-all GET fallback for SPA routes not matched above
                app.setNotFoundHandler((req, reply) => {
                    if (req.method === 'GET') {
                        reply.type('text/html').send(createReadStream(indexHtmlPath));
                    }
                    else {
                        reply.status(404).send({ error: 'Not found' });
                    }
                });
            }
        }
        const port = Number(process.env.PORT) || 3000;
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`[Startup] Server listening on port ${port}`);
        // Run migrations in background after server is up (non-fatal, non-blocking)
        runMigrations().catch((migErr) => {
            console.error('[Startup] Migration error (non-fatal):', migErr);
        });
        void startConversationEngineConsumer();
        // ── Scheduled jobs ────────────────────────────────────────────────────
        // Expire stale payment links every 2 minutes
        const expireInterval = setInterval(() => {
            expireStaleOrders().catch((err) => console.error('[Scheduler] expireStaleOrders failed:', err));
        }, 2 * 60 * 1000);
        // Daily jobs: billing cycle reset + subscription renewal reminders (run at startup then every 24h)
        const runDailyJobs = () => {
            runBillingCycleResetJob().catch((err) => console.error('[Scheduler] runBillingCycleResetJob failed:', err));
            sendRenewalReminders().catch((err) => console.error('[Scheduler] sendRenewalReminders failed:', err));
        };
        runDailyJobs();
        const dailyInterval = setInterval(runDailyJobs, 24 * 60 * 60 * 1000);
        const shutdown = () => {
            stopConversationEngineConsumer();
            clearInterval(expireInterval);
            clearInterval(dailyInterval);
            app.close(() => process.exit(0));
        };
        process.once('SIGTERM', shutdown);
        process.once('SIGINT', shutdown);
    }
    catch (err) {
        console.error('[Startup] Fatal error:', err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map