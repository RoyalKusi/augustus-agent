import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './jwt.js';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache the SPA index.html at module load time so browser refreshes always get it.
// Tries multiple candidate paths to handle both local dev and production layouts.
function loadSpaIndexHtml(): Buffer | null {
  const candidates = [
    // Production: packages/api/dist/auth/ → packages/business-dashboard/dist/
    join(__dirname, '../../../business-dashboard/dist/index.html'),
    // Alternative production layout
    join(__dirname, '../../business-dashboard/dist/index.html'),
    // Local dev fallback
    join(__dirname, '../../../../packages/business-dashboard/dist/index.html'),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p);
    } catch { /* try next */ }
  }
  return null;
}

// Load once at startup — avoids repeated filesystem reads and path resolution failures
const SPA_INDEX_HTML: Buffer | null = loadSpaIndexHtml();

declare module 'fastify' {
  interface FastifyRequest {
    businessId: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  // No Authorization header — check if this is a browser navigation (GET + accepts HTML).
  // Serve the SPA index.html so React Router handles the route client-side.
  // This prevents the raw JSON 401 from appearing as "pretty print" text on page refresh.
  if (!authHeader?.startsWith('Bearer ')) {
    if (request.method === 'GET') {
      const accept = request.headers.accept ?? '';
      if (accept.includes('text/html') || accept.includes('*/*')) {
        if (SPA_INDEX_HTML) {
          return reply.type('text/html').send(SPA_INDEX_HTML);
        }
      }
    }
    return reply.status(401).send({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    // For browser navigations with an expired/invalid token, serve the SPA
    // so React can handle the redirect to login gracefully
    if (request.method === 'GET') {
      const accept = request.headers.accept ?? '';
      if (accept.includes('text/html') || accept.includes('*/*')) {
        if (SPA_INDEX_HTML) {
          return reply.type('text/html').send(SPA_INDEX_HTML);
        }
      }
    }
    return reply.status(401).send({ error: 'Invalid or expired token.' });
  }
  request.businessId = payload.businessId;
}
