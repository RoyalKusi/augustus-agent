import type { FastifyInstance } from 'fastify';
import {
  storeCredentials,
  getCredentials,
  updateCredentials,
  deleteCredentials,
  registerWebhook,
  deregisterWebhook,
  exchangeEmbeddedSignupCode,
} from './whatsapp-integration.service.js';
import { config } from '../../config.js';
import { authenticate } from '../../auth/middleware.js';

export async function whatsappIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  // GET /integration — retrieve current integration (credentials masked)
  app.get('/integration', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;

    try {
      const integration = await getCredentials(businessId);
      if (!integration) {
        return reply.status(404).send({ error: 'No WhatsApp integration found.' });
      }

      // Never expose the raw access token over the API
      const { accessToken: _token, ...safe } = integration;
      return reply.send({ ...safe, accessTokenSet: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve integration.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /integration — create or replace credentials
  app.post('/integration', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;
    const { wabaId, phoneNumberId, accessToken, webhookVerifyToken } = request.body as {
      wabaId: string;
      phoneNumberId: string;
      accessToken: string;
      webhookVerifyToken: string;
    };

    if (!wabaId || !phoneNumberId || !accessToken || !webhookVerifyToken) {
      return reply.status(400).send({ error: 'wabaId, phoneNumberId, accessToken, and webhookVerifyToken are required.' });
    }

    try {
      const integration = await storeCredentials(businessId, wabaId, phoneNumberId, accessToken, webhookVerifyToken);
      const { accessToken: _token, ...safe } = integration;
      return reply.status(201).send({ ...safe, accessTokenSet: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to store credentials.';
      return reply.status(500).send({ error: message });
    }
  });

  // PATCH /integration — update individual credential fields
  app.patch('/integration', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;
    const updates = request.body as {
      wabaId?: string;
      phoneNumberId?: string;
      accessToken?: string;
      webhookVerifyToken?: string;
    };

    try {
      const integration = await updateCredentials(businessId, updates);
      const { accessToken: _token, ...safe } = integration;
      return reply.send({ ...safe, accessTokenSet: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update credentials.';
      const status = message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: message });
    }
  });

  // DELETE /integration — remove integration record
  app.delete('/integration', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;

    try {
      await deleteCredentials(businessId);
      return reply.status(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete integration.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /integration/register-webhook — trigger Meta Cloud API webhook registration
  app.post('/integration/register-webhook', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;

    try {
      const result = await registerWebhook(businessId);
      if (!result.success) {
        return reply.status(502).send({ error: result.errorMessage });
      }
      return reply.send({ status: 'active' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Webhook registration failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // DELETE /integration/webhook — deregister Meta Cloud API webhook (Req 4.6)
  app.delete('/integration/webhook', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;

    try {
      const result = await deregisterWebhook(businessId);
      if (!result.success) {
        const status = result.errorMessage?.includes('No WhatsApp integration found') ? 404 : 502;
        return reply.status(status).send({ error: result.errorMessage });
      }
      return reply.send({ status: 'inactive' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Webhook deregistration failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /integration/embedded-signup-config — return public Meta config for the frontend SDK
  // No auth needed for the app ID (it's public), but we keep it behind the auth middleware
  // so only logged-in businesses can read it.
  app.get('/integration/embedded-signup-config', async (_request, reply) => {
    return reply.send({
      appId: config.meta.appId,
      configId: config.meta.embeddedSignupConfigId,
      graphApiVersion: config.meta.graphApiVersion,
    });
  });

  // POST /integration/exchange-token — Embedded Signup: exchange short-lived code
  app.post('/integration/exchange-token', async (request, reply) => {
    const businessId = (request as unknown as { businessId: string }).businessId;
    const { code } = request.body as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: 'code is required.' });
    }

    try {
      const result = await exchangeEmbeddedSignupCode(businessId, code);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token exchange failed.';
      return reply.status(502).send({ error: message });
    }
  });
}
