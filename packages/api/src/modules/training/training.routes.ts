/**
 * Training Data HTTP Routes
 * Requirements: 10.1–10.4
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import { uploadFile } from '../../storage/upload.js';
import { randomUUID } from 'crypto';
import {
  createTrainingEntry,
  listTrainingEntries,
  deleteTrainingEntry,
  updateWhatsAppProfile,
  isFileSizeValid,
  MAX_FILE_SIZE_BYTES,
  type TrainingDataType,
} from './training.service.js';

const VALID_TYPES: TrainingDataType[] = ['description', 'faq', 'tone_guidelines', 'logo', 'document'];

export async function trainingRoutes(app: FastifyInstance): Promise<void> {
  // POST /training/upload — upload a file (PDF, image) and create a training entry
  app.post('/training/upload', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      if (!request.isMultipart()) {
        return reply.status(400).send({ error: 'Request must be multipart/form-data.' });
      }

      let type: TrainingDataType = 'document';
      let label = '';
      let fileBuffer: Buffer | null = null;
      let filename = 'upload';
      let mimetype = 'application/octet-stream';

      // Process parts — must fully consume each part before moving to next
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          const val = String(part.value ?? '').trim();
          if (part.fieldname === 'type' && val) type = val as TrainingDataType;
          if (part.fieldname === 'label') label = val;
        } else {
          // Collect all chunks synchronously within this iteration
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
          }
          fileBuffer = Buffer.concat(chunks);
          filename = part.filename || 'upload';
          mimetype = part.mimetype || 'application/octet-stream';
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ error: 'No file provided or file is empty.' });
      }

      // Property 29: 10 MB limit
      if (!isFileSizeValid(fileBuffer.length)) {
        return reply.status(422).send({
          error: `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`,
        });
      }

      if (!VALID_TYPES.includes(type)) type = 'document';

      const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin';
      const key = `training/${businessId}/${randomUUID()}.${ext}`;
      const fileUrl = await uploadFile(key, fileBuffer, mimetype);

      const displayName = label || filename;
      const entry = await createTrainingEntry(businessId, {
        type,
        content: displayName,
        fileUrl,
        fileSizeBytes: fileBuffer.length,
      });

      if (type === 'logo' && fileUrl) {
        void updateWhatsAppProfile(businessId, fileUrl);
      }

      return reply.status(201).send(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      app.log.error({ err }, '[training/upload] error');
      return reply.status(500).send({ error: message });
    }
  });

  // POST /training — add text-based training entry
  app.post('/training', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      type?: string;
      content?: string;
    };

    const type = body.type as TrainingDataType | undefined;

    if (!type || !VALID_TYPES.includes(type)) {
      return reply.status(400).send({
        error: `Invalid or missing 'type'. Must be one of: ${VALID_TYPES.join(', ')}.`,
      });
    }

    if (!body.content?.trim()) {
      return reply.status(400).send({ error: `'content' is required.` });
    }

    try {
      const entry = await createTrainingEntry(businessId, {
        type,
        content: body.content,
      });
      return reply.status(201).send(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save training data.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /training — list all training data entries
  app.get('/training', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      const entries = await listTrainingEntries(businessId);
      return reply.send({ entries });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch training data.';
      return reply.status(500).send({ error: message });
    }
  });

  // DELETE /training/:id — delete a training entry
  app.delete('/training/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };
    const deleted = await deleteTrainingEntry(businessId, id);
    if (!deleted) return reply.status(404).send({ error: 'Training entry not found.' });
    return reply.status(204).send();
  });
}
