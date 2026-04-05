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
import {
  startConversationEngineConsumer,
  stopConversationEngineConsumer,
} from './modules/conversation/conversation-engine.service.js';

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
        // Serve index.html for /admin-app and any deep path (SPA client-side routing)
        const serveAdminIndex = (_req: unknown, reply: { type: (t: string) => { send: (s: unknown) => void } }) => {
          reply.type('text/html').send(createReadStream(join(adminDist, 'index.html')));
        };
        app.get('/admin-app', serveAdminIndex);
        app.get('/admin-app/*', serveAdminIndex);
      }

      if (existsSync(businessDist)) {
        await app.register(staticPlugin, {
          root: businessDist,
          prefix: '/',
          decorateReply: false,
          wildcard: false,
        });
        // SPA fallback — serve index.html for any unmatched route
        app.setNotFoundHandler((_req, reply) => {
          reply.type('text/html').send(createReadStream(join(businessDist, 'index.html')));
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

    const shutdown = () => {
      stopConversationEngineConsumer();
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
