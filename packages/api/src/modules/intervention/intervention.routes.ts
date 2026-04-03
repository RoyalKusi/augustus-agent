/**
 * Manual Intervention HTTP Routes
 * Requirements: 8.1–8.5
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import {
  activateIntervention,
  deactivateIntervention,
  sendAgentMessage,
  getInterventionLog,
} from './intervention.service.js';

export async function interventionRoutes(app: FastifyInstance): Promise<void> {
  // POST /conversations/:id/intervention/activate
  app.post(
    '/conversations/:id/intervention/activate',
    { preHandler: authenticate },
    async (request, reply) => {
      const businessId = request.businessId;
      const { id: conversationId } = request.params as { id: string };
      const body = request.body as { agent_id?: string };

      if (!body.agent_id) {
        return reply.status(400).send({ error: 'Missing required field: agent_id.' });
      }

      try {
        await activateIntervention(conversationId, businessId, body.agent_id);
        return reply.status(200).send({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to activate intervention.';
        const status = message.includes('not found') ? 404 : 500;
        return reply.status(status).send({ error: message });
      }
    },
  );

  // POST /conversations/:id/intervention/deactivate
  app.post(
    '/conversations/:id/intervention/deactivate',
    { preHandler: authenticate },
    async (request, reply) => {
      const businessId = request.businessId;
      const { id: conversationId } = request.params as { id: string };

      try {
        await deactivateIntervention(conversationId, businessId);
        return reply.status(200).send({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deactivate intervention.';
        const status = message.includes('not found') ? 404 : 500;
        return reply.status(status).send({ error: message });
      }
    },
  );

  // POST /conversations/:id/intervention/message
  app.post(
    '/conversations/:id/intervention/message',
    { preHandler: authenticate },
    async (request, reply) => {
      const businessId = request.businessId;
      const { id: conversationId } = request.params as { id: string };
      const body = request.body as { agent_id?: string; message?: string };

      if (!body.agent_id || !body.message) {
        return reply.status(400).send({ error: 'Missing required fields: agent_id, message.' });
      }

      try {
        await sendAgentMessage(conversationId, businessId, body.agent_id, body.message);
        return reply.status(200).send({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send agent message.';
        if (message.includes('not found')) return reply.status(404).send({ error: message });
        if (message.includes('not active')) return reply.status(409).send({ error: message });
        return reply.status(500).send({ error: message });
      }
    },
  );

  // GET /conversations/:id/intervention/log
  app.get(
    '/conversations/:id/intervention/log',
    { preHandler: authenticate },
    async (request, reply) => {
      const businessId = request.businessId;
      const { id: conversationId } = request.params as { id: string };

      try {
        const log = await getInterventionLog(conversationId, businessId);
        return reply.send(log);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch intervention log.';
        const status = message.includes('not found') ? 404 : 500;
        return reply.status(status).send({ error: message });
      }
    },
  );
}
