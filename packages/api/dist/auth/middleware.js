import { verifyToken } from './jwt.js';
export async function authenticate(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header.' });
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
        return reply.status(401).send({ error: 'Invalid or expired token.' });
    }
    request.businessId = payload.businessId;
}
//# sourceMappingURL=middleware.js.map