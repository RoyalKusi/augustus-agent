import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
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
import {
  startConversationEngineConsumer,
  stopConversationEngineConsumer,
} from './modules/conversation/conversation-engine.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Allow empty JSON bodies globally — many POST routes don't need a body.
// The webhook route registers its own scoped parser (with rawBody capture) which overrides this.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  const str = (body as string) ?? '';
  if (!str.trim()) { done(null, {}); return; }
  try { done(null, JSON.parse(str)); } catch (err) { done(err as Error, undefined); }
});

await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// CORS — allow configured origins or all origins in development
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

await app.register(cors, {
  origin: process.env.NODE_ENV === 'development' ? true : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.get('/health', async () => {
  return { status: 'ok', service: 'augustus-api' };
});

// Auth routes: /auth/register, /auth/verify-email, /auth/login,
//              /auth/request-password-reset, /auth/reset-password
await app.register(authRoutes);

// Subscription routes: /subscription/plans, /subscription, /subscription/activate,
//                      /subscription/upgrade, /subscription/downgrade,
//                      /webhooks/paynow/subscription
await app.register(subscriptionRoutes);

// Catalogue routes: /catalogue/products, /catalogue/products/:id,
//                   /catalogue/products/import, /catalogue/products/:id/revenue,
//                   /catalogue/combos, /catalogue/combos/:id, /catalogue/combos/active
await app.register(catalogueRoutes);

// Training routes: /training, /training/:id
await app.register(trainingRoutes);

// Dashboard routes: /dashboard/subscription, /dashboard/credit-usage,
//                   /dashboard/conversations, /dashboard/orders, /dashboard/revenue,
//                   /dashboard/orders/export, /dashboard/withdrawals, /dashboard/support
await app.register(dashboardRoutes);

// Admin routes: /admin/auth/login, /admin/auth/enroll-mfa, /admin/auth/verify-mfa,
//               /admin/businesses, /admin/businesses/:id/suspend, /admin/businesses/:id/reactivate,
//               /admin/metrics/ai, /admin/metrics/meta, /admin/metrics/platform-cost,
//               /admin/metrics/subscriptions, /admin/businesses/:id/token-override,
//               /admin/withdrawals/pending, /admin/withdrawals/:id/approve,
//               /admin/withdrawals/history, /admin/businesses/:id/dashboard,
//               /admin/api-keys/status
await app.register(adminRoutes);

// Webhook routes: GET+POST /webhooks/whatsapp, GET+POST /webhooks/whatsapp/:businessId
await app.register(webhookRoutes);

// WhatsApp integration routes: /whatsapp/integration, /whatsapp/integration/register-webhook, etc.
await app.register(whatsappIntegrationRoutes, { prefix: '/whatsapp' });

// Payment routes: /payment/initiate, /payment/result, /payment/status/:id
await app.register(paymentRoutes);

// Intervention routes: /intervention
await app.register(interventionRoutes);

// ── Static file serving (production only) ────────────────────────────────────
// Serve built React apps when running in production.
// Business dashboard → served at /  (with SPA fallback)
// Admin dashboard    → served at /admin-app/ (with SPA fallback)
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const businessDist = join(__dirname, '../../business-dashboard/dist');
  const adminDist = join(__dirname, '../../admin-dashboard/dist');

  if (existsSync(adminDist)) {
    await app.register(staticPlugin, {
      root: adminDist,
      prefix: '/admin-app/',
      decorateReply: false,
    });
    // SPA fallback for admin dashboard
    app.get('/admin-app/*', (_req, reply) => {
      reply.sendFile('index.html', adminDist);
    });
  }

  if (existsSync(businessDist)) {
    await app.register(staticPlugin, {
      root: businessDist,
      prefix: '/',
      decorateReply: false,
    });
    // SPA fallback — must be last so API routes take priority
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html', businessDist);
    });
  }
}

const start = async () => {
  try {
    // Run pending migrations before starting the server
    await runMigrations();

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });

    // Start the Conversation Engine queue consumer (task 7.1)
    void startConversationEngineConsumer();

    // Graceful shutdown
    const shutdown = () => {
      stopConversationEngineConsumer();
      app.close(() => process.exit(0));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
