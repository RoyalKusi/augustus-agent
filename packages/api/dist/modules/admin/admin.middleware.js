import { verifyOperatorToken } from './admin.service.js';
export async function authenticateOperator(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header.' });
    }
    const token = authHeader.slice(7);
    const payload = verifyOperatorToken(token);
    if (!payload) {
        return reply.status(401).send({ error: 'Invalid or expired token.' });
    }
    if (payload.role !== 'operator') {
        return reply.status(403).send({ error: 'Operator access required.' });
    }
    request.operatorId = payload.operatorId;
}
//# sourceMappingURL=admin.middleware.js.map