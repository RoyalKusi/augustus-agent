import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, createReadStream, readFileSync } from 'fs';
import { runMigrations } from './db/client.js';
import { pool } from './db/client.js';
import { authRoutes } from './modules/auth/index.js';
import { subscriptionRoutes } from './modules/subscription/index.js';
import { catalogueRoutes } from './modules/catalogue/index.js';
import { trainingRoutes } from './modules/training/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';
import { adminRoutes } from './modules/admin/index.js';
import { webhookRoutes } from './modules/webhook/webhook.routes.js';
import { whatsappIntegrationRoutes } from './modules/whatsapp/whatsapp-integration.routes.js';
import { templateRoutes } from './modules/whatsapp/template.routes.js';
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
import { cleanupOldNotifications } from './modules/notification/in-app-notification.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Catch unhandled rejections so the process doesn't die silently
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
});

// Warn loudly if critical env vars are missing or still at localhost defaults
const isProdEnv = process.env.NODE_ENV === 'production';
if (isProdEnv) {
  if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost')) {
    console.error('[Config] CRITICAL: FRONTEND_URL is not set or points to localhost. Password reset and verification emails will contain broken links. Set FRONTEND_URL=https://augustus.silverconne.com on Hostinger.');
  }
  if (!process.env.EMAIL_API_KEY) {
    console.error('[Config] CRITICAL: EMAIL_API_KEY is not set. No emails will be sent (password reset, verification, etc.).');
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    console.error('[Config] CRITICAL: ENCRYPTION_KEY is not set or is not a 64-character hex string. WhatsApp access tokens cannot be encrypted — the WhatsApp connection flow will fail. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  if (!process.env.PAYNOW_RESULT_URL || process.env.PAYNOW_RESULT_URL.includes('example.com')) {
    console.warn('[Config] WARNING: PAYNOW_RESULT_URL is not set or uses example.com default. Paynow webhooks will not reach the server — subscriptions will not auto-activate after payment. Set PAYNOW_RESULT_URL=https://augustus.silverconne.com/webhooks/paynow/subscription');
  }
  if (!process.env.PAYNOW_RETURN_URL || process.env.PAYNOW_RETURN_URL.includes('example.com')) {
    console.warn('[Config] WARNING: PAYNOW_RETURN_URL is not set or uses example.com default. Users will not be redirected back after payment. Set PAYNOW_RETURN_URL=https://augustus.silverconne.com/dashboard/subscription');
  }
}

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
    app.get('/health/config', async () => ({
      frontendUrl: process.env.FRONTEND_URL ?? '(not set — defaulting to localhost:5173)',
      emailProvider: process.env.EMAIL_PROVIDER ?? 'sendgrid',
      emailApiKeySet: !!(process.env.EMAIL_API_KEY),
      emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'noreply@augustus.ai',
      paynowResultUrl: process.env.PAYNOW_RESULT_URL ?? '(not set — defaulting to augustus.silverconne.com/webhooks/paynow/subscription)',
      paynowReturnUrl: process.env.PAYNOW_RETURN_URL ?? '(not set — defaulting to augustus.silverconne.com/dashboard/subscription)',
      paynowIntegrationIdSet: !!(process.env.PAYNOW_INTEGRATION_ID),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    }));

    // Diagnostic: list conversations and their actual message counts
    app.get('/diag/conversations', async (_req, reply) => {
      try {
        const convs = await pool.query(
          `SELECT c.id, c.customer_wa_number, c.message_count AS counter, c.status, c.business_id,
                  COUNT(m.id)::int AS actual_messages
           FROM conversations c
           LEFT JOIN messages m ON m.conversation_id = c.id
           GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 20`
        );
        return reply.send({ conversations: convs.rows });
      } catch (err) { return reply.status(500).send({ error: String(err) }); }
    });

    // Diagnostic: get messages for a specific conversation
    app.get('/diag/messages/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const msgs = await pool.query(
          `SELECT id, direction, LEFT(content, 80) AS content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 30`,
          [id]
        );
        return reply.send({ conversationId: id, count: msgs.rows.length, messages: msgs.rows });
      } catch (err) { return reply.status(500).send({ error: String(err) }); }
    });

    // Test carousel sending — all scenarios
    // GET /diag/test-carousel?businessId=X&to=PHONE&scenario=multi|single-image|single-noimage|no-products|images-fail
    app.get('/diag/test-carousel', async (req, reply) => {
      const { businessId, to, scenario = 'multi' } = req.query as { businessId?: string; to?: string; scenario?: string };
      if (!businessId || !to) return reply.status(400).send({ error: 'businessId and to are required' });

      try {
        const { sendMessage } = await import('./modules/whatsapp/message-dispatcher.js');

        // Fetch real products for this business
        const products = await pool.query(
          `SELECT id, name, price, currency, image_urls, description FROM products WHERE business_id = $1 AND is_active = TRUE AND stock_quantity > 0 ORDER BY name LIMIT 10`,
          [businessId]
        );

        if (products.rows.length === 0) {
          return reply.send({ scenario, result: 'no_products', message: 'No active products found for this business' });
        }

        const makeProduct = (p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name),
          price: Number(p.price),
          currency: String(p.currency),
          imageUrl: (p.image_urls as string[])?.[0] ?? undefined,
          description: p.description ? String(p.description).slice(0, 60) : undefined,
        });

        let result;
        let description = '';

        switch (scenario) {
          case 'multi': {
            // 2-10 products with images — native carousel
            const prods = products.rows.slice(0, Math.min(10, products.rows.length)).map(makeProduct);
            description = `Sending ${prods.length} products as native carousel`;
            result = await sendMessage(businessId, { type: 'carousel', to, products: prods });
            break;
          }
          case 'single-image': {
            // 1 product with image
            const p = makeProduct(products.rows[0]);
            description = `Sending 1 product (${p.name}) with image: ${p.imageUrl ?? 'none'}`;
            result = await sendMessage(businessId, { type: 'carousel', to, products: [p] });
            if (result.success) {
              // Send order button separately
              await sendMessage(businessId, {
                type: 'quick_reply', to,
                body: `Would you like to order *${p.name}*?`,
                buttons: [{ id: `order_${p.id}`, title: '🛒 Order Now' }],
              });
            }
            break;
          }
          case 'single-noimage': {
            // 1 product without image — force no image
            const p = { ...makeProduct(products.rows[0]), imageUrl: undefined };
            description = `Sending 1 product (${p.name}) WITHOUT image`;
            result = await sendMessage(businessId, { type: 'carousel', to, products: [p] });
            if (result.success) {
              await sendMessage(businessId, {
                type: 'quick_reply', to,
                body: `Would you like to order *${p.name}*?`,
                buttons: [{ id: `order_${p.id}`, title: '🛒 Order Now' }],
              });
            }
            break;
          }
          case 'images-fail': {
            // Simulate image failure — use broken image URLs
            const prods = products.rows.slice(0, Math.min(3, products.rows.length)).map(p => ({
              ...makeProduct(p),
              imageUrl: 'https://broken-url-that-does-not-exist.example.com/image.jpg',
            }));
            description = `Sending ${prods.length} products with BROKEN image URLs`;
            result = await sendMessage(businessId, { type: 'carousel', to, products: prods });
            if (!result.success) {
              // Fallback to text list
              const list = prods.map((p, i) => `${i + 1}. *${p.name}* — ${p.currency} ${p.price.toFixed(2)}`).join('\n');
              const fallback = `Here are our products (images are temporarily unavailable, sorry about that!):\n\n${list}\n\nJust reply with the name of what you'd like to order 👆`;
              await sendMessage(businessId, { type: 'text', to, body: fallback });
              result = { success: true, fallback: true, message: 'Sent as text fallback' };
            }
            break;
          }
          case 'no-products': {
            // Simulate no products available
            description = 'Simulating no products available scenario';
            const msg = "I'm sorry, those items appear to be out of stock right now. Let me know if you'd like to see what else we have available.";
            result = await sendMessage(businessId, { type: 'text', to, body: msg });
            break;
          }
          case 'text-only': {
            // All products without images — text list
            const prods = products.rows.slice(0, 5).map(p => ({ ...makeProduct(p), imageUrl: undefined }));
            const list = prods.map((p, i) => `${i + 1}. *${p.name}* — ${p.currency} ${p.price.toFixed(2)}${p.description ? '\n   ' + p.description : ''}`).join('\n\n');
            const msg = `Here are our available products:\n\n${list}\n\nJust reply with the name of what you'd like to order 👆`;
            description = `Sending ${prods.length} products as plain text (no images)`;
            result = await sendMessage(businessId, { type: 'text', to, body: msg });
            break;
          }
          case 'mixed': {
            // Mixed: some products with images, some without
            const prods = products.rows.slice(0, Math.min(4, products.rows.length)).map((p, i) => ({
              ...makeProduct(p),
              // Alternate: even index keeps image, odd index strips it
              imageUrl: i % 2 === 0 ? makeProduct(p).imageUrl : undefined,
            }));
            description = `Sending ${prods.length} products MIXED (${prods.filter(p => p.imageUrl).length} with images, ${prods.filter(p => !p.imageUrl).length} without)`;
            result = await sendMessage(businessId, { type: 'carousel', to, products: prods });
            // If fails, retry without images
            if (!result.success && prods.some(p => p.imageUrl)) {
              const noImgProds = prods.map(p => ({ ...p, imageUrl: undefined }));
              result = await sendMessage(businessId, { type: 'carousel', to, products: noImgProds });
              (result as unknown as Record<string, unknown>)['retried'] = true;
            }
            break;
          }
          default:
            return reply.status(400).send({ error: `Unknown scenario: ${scenario}. Use: multi, single-image, single-noimage, images-fail, no-products, text-only, mixed` });
        }

        return reply.send({
          scenario,
          description,
          productCount: products.rows.length,
          result,
        });
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
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
    await app.register(templateRoutes);
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
        // API paths are handled by their own registered routes above.
        // IMPORTANT: Only list prefixes that are PURELY API (never browser-navigable SPA routes).
        // /dashboard/ is used by both API and SPA — don't block it here.
        const apiPrefixes = ['/auth/', '/whatsapp/', '/payments/', '/conversations/',
          '/webhooks/', '/admin/', '/catalogue/', '/training/', '/subscription/', '/health', '/legal/', '/diag/'];

        app.setNotFoundHandler((req, reply) => {
          const path = req.url.split('?')[0];
          const isApiPath = apiPrefixes.some(p => path.startsWith(p));
          // For API paths that weren't matched, return JSON 404
          if (isApiPath) {
            return reply.status(404).send({ error: 'Not found' });
          }
          // For all other GET requests (SPA routes including /dashboard/*), serve index.html
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
