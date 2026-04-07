import type { FastifyRequest, FastifyReply } from 'fastify';
declare module 'fastify' {
    interface FastifyRequest {
        operatorId: string;
    }
}
export declare function authenticateOperator(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=admin.middleware.d.ts.map