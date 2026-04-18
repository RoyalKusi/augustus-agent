import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, createReadStream, readFileSync } from 'fs';
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
import { promoRoutes } from './modules/promo/promo.routes.js';
import { inAppNotificationRoutes } from './modules/notification/in-app-notification.routes.js';
import {
  startConversationEngineConsumer,
  stopConversationEngineConsumer,
  consumerRunning,
  CONSUMER_NAME,
} from './modules/conversation/conversation-engine.service.js';
import { expireStaleOrders } from './modules/payment/payment.service.js';
import { runBillingCycleResetJob } from './modules/token-budget/token-budget.service.js';
import { sendRenewalReminders, applyPendingDowngrades, retryFailedPayments } from './modules/subscription/subscription.service.js';

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
      const str = (body as string) ?? '';
      if (!str.trim()) { done(null, {}); return; }
      try { done(null, JSON.parse(str)); } catch (err) { done(err as Error, undefined); }
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
    app.get('/health/paths', async () => {
      const businessDist = join(__dirname, '../../business-dashboard/dist');
      const adminDist = join(__dirname, '../../admin-dashboard/dist');
      const { readdirSync } = await import('fs');
      const listDir = (p: string) => { try { return readdirSync(p); } catch { return null; } };
      return {
        __dirname,
        businessDist,
        adminDist,
        businessDistExists: existsSync(businessDist),
        adminDistExists: existsSync(adminDist),
        businessDistFiles: listDir(businessDist),
        businessAssetsFiles: listDir(join(businessDist, 'assets')),
      };
    });

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
    await app.register(promoRoutes);
    await app.register(inAppNotificationRoutes);

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
        const serveAdminIndex = (_req: unknown, reply: { type: (t: string) => { send: (s: unknown) => void } }) => {
          reply.type('text/html').send(createReadStream(join(adminDist, 'index.html')));
        };
        app.get('/admin-app', serveAdminIndex);
        app.get('/admin-app/*', serveAdminIndex);
      }

      if (existsSync(businessDist)) {
        const indexHtmlPath = join(businessDist, 'index.html');
        const indexHtml = readFileSync(indexHtmlPath); // read once at startup

        // Serve static assets (JS, CSS, images) — only exact file matches
        await app.register(staticPlugin, {
          root: businessDist,
          prefix: '/',
          decorateReply: false,
          wildcard: false,
          index: false,   // don't auto-serve index.html — we handle that below
          serve: true,
        });

        // SPA fallback: serve index.html for all browser navigations to non-API paths
        // API paths are handled by their own registered routes above
        const apiPrefixes = ['/auth/', '/dashboard/', '/whatsapp/', '/payments/', '/conversations/',
          '/webhooks/', '/admin/', '/catalogue/', '/training/', '/subscription/', '/health', '/legal/'];

        app.setNotFoundHandler((req, reply) => {
          const path = req.url.split('?')[0];
          const isApiPath = apiPrefixes.some(p => path.startsWith(p));
          // For API paths that weren't matched, return JSON 404
          if (isApiPath) {
            return reply.status(404).send({ error: 'Not found' });
          }
          // For all other GET requests (SPA routes), serve index.html
          if (req.method === 'GET') {
            return reply.type('text/html').send(indexHtml);
          }
          return reply.status(404).send({ error: 'Not found' });
        });
      }
    }

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`[Startup] Server listening on port ${port}`);

    // Run migrations — fatal if any migration fails
    try {
      await runMigrations();
    } catch (migErr) {
      console.error('[Startup] Migration failed — cannot start server:', migErr);
      process.exit(1);
    }

    void startConversationEngineConsumer();

    // ── Scheduled jobs ────────────────────────────────────────────────────
    const alertJobFailure = (jobName: string, err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] ${jobName} failed: ${msg}`);
      // Send alert email to ops (best-effort, non-blocking)
      import('./modules/notification/notification.service.js').then(({ sendEmail }) => {
        void sendEmail(
          'silveraugustus12@gmail.com',
          `[Augustus] Scheduled job failed: ${jobName}`,
          `<h3>Scheduled Job Failure</h3><p><strong>Job:</strong> ${jobName}</p><p><strong>Error:</strong> ${msg}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
          `Scheduled job failed: ${jobName}\nError: ${msg}\nTime: ${new Date().toISOString()}`,
        ).catch(() => {});
      }).catch(() => {});
    };

    // Expire stale payment links every 2 minutes
    const expireInterval = setInterval(() => {
      expireStaleOrders().catch((err) => alertJobFailure('expireStaleOrders', err));
    }, 2 * 60 * 1000);

    // Daily jobs: billing cycle reset + subscription renewal reminders + downgrade/retry (run at startup then every 24h)
    const runDailyJobs = () => {
      runBillingCycleResetJob().catch((err) => alertJobFailure('runBillingCycleResetJob', err));
      sendRenewalReminders().catch((err) => alertJobFailure('sendRenewalReminders', err));
      applyPendingDowngrades().catch((err) => alertJobFailure('applyPendingDowngrades', err));
      retryFailedPayments().catch((err) => alertJobFailure('retryFailedPayments', err));
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
  } catch (err) {
    console.error('[Startup] Fatal error:', err);
    process.exit(1);
  }
};

start();
