import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './jwt.js';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lazily load the SPA index.html so the middleware can serve it for browser navigations
function getSpaIndexHtml(): Buffer | null {
  try {
    const businessDist = join(__dirname, '../../../business-dashboard/dist');
    const indexPath = join(businessDist, 'index.html');
    if (existsSync(indexPath)) return readFileSync(indexPath);
  } catch { /* ignore */ }
  return null;
}

declare module 'fastify' {
  interface FastifyRequest {
    businessId: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  // No Authorization header — check if this is a browser navigation (GET + accepts HTML)
  // If so, serve the SPA index.html so React Router can handle the route client-side
  if (!authHeader?.startsWith('Bearer ')) {
    if (request.method === 'GET') {
      const accept = request.headers.accept ?? '';
      if (accept.includes('text/html')) {
        const html = getSpaIndexHtml();
        if (html) {
          return reply.type('text/html').send(html);
        }
      }
    }
    return reply.status(401).send({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return reply.status(401).send({ error: 'Invalid or expired token.' });
  }
  request.businessId = payload.businessId;
}
