/**
 * Message Template Routes
 * Manages WhatsApp message templates for Meta approval and compliance.
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import { templateService } from './template.service.js';

export async function templateRoutes(app: FastifyInstance): Promise<void> {

  // GET /whatsapp/templates — list all templates for the business
  app.get('/whatsapp/templates', { preHandler: authenticate }, async (request, reply) => {
    try {
      const templates = await templateService.listTemplates(request.businessId);
      return reply.send({ templates });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to list templates.' });
    }
  });

  // POST /whatsapp/templates — create or update a template
  app.post('/whatsapp/templates', { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as {
      name?: string;
      category?: string;
      language?: string;
      headerType?: string;
      headerText?: string;
      bodyText?: string;
      footerText?: string;
      buttons?: unknown[];
      exampleParams?: string[];
    };

    if (!body.name || !body.category || !body.bodyText) {
      return reply.status(400).send({ error: 'name, category, and bodyText are required.' });
    }

    const validCategories = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
    if (!validCategories.includes(body.category)) {
      return reply.status(400).send({ error: `category must be one of: ${validCategories.join(', ')}` });
    }

    try {
      const template = await templateService.upsertTemplate(request.businessId, {
        name: body.name,
        category: body.category as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION',
        language: body.language,
        headerType: body.headerType,
        headerText: body.headerText,
        bodyText: body.bodyText,
        footerText: body.footerText,
        buttons: body.buttons as never,
        exampleParams: body.exampleParams,
      });
      return reply.status(201).send({ template });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to create template.' });
    }
  });

  // POST /whatsapp/templates/:name/submit — submit template to Meta for approval
  app.post('/whatsapp/templates/:name/submit', { preHandler: authenticate }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const { language } = request.query as { language?: string };
    try {
      const result = await templateService.submitToMeta(request.businessId, name, language ?? 'en_US');
      return reply.send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit template.';
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /whatsapp/templates/sync — sync approval statuses from Meta
  app.post('/whatsapp/templates/sync', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await templateService.syncStatusFromMeta(request.businessId);
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Sync failed.' });
    }
  });

  // POST /whatsapp/templates/seed — seed platform standard templates
  app.post('/whatsapp/templates/seed', { preHandler: authenticate }, async (request, reply) => {
    try {
      const created = await templateService.seedPlatformTemplates(request.businessId);
      return reply.send({ created, message: `${created} platform templates seeded.` });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Seed failed.' });
    }
  });

  // POST /whatsapp/templates/:name/send — send a template message to a number
  app.post('/whatsapp/templates/:name/send', { preHandler: authenticate }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const body = request.body as { to?: string; params?: string[]; language?: string };

    if (!body.to) return reply.status(400).send({ error: 'to is required.' });

    try {
      const result = await templateService.sendTemplateMessage(
        request.businessId,
        body.to,
        name,
        body.params ?? [],
        body.language ?? 'en_US',
      );
      if (!result.success) return reply.status(400).send({ error: result.error });
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Send failed.' });
    }
  });

  // POST /whatsapp/templates/submit-all — submit all pending templates to Meta
  app.post('/whatsapp/templates/submit-all', { preHandler: authenticate }, async (request, reply) => {
    try {
      const templates = await templateService.listTemplates(request.businessId);
      const pending = templates.filter(t => t.status === 'PENDING' && !t.metaTemplateId);

      const results = [];
      for (const t of pending) {
        try {
          const r = await templateService.submitToMeta(request.businessId, t.name, t.language);
          results.push({ name: t.name, ...r, success: true });
        } catch (err) {
          results.push({ name: t.name, success: false, error: err instanceof Error ? err.message : 'Failed' });
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }

      const submitted = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return reply.send({ submitted, failed, results });
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed.' });
    }
  });
}
