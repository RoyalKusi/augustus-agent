import type { FastifyRequest, FastifyReply } from 'fastify';
declare module 'fastify' {
    interface FastifyRequest {
        businessId: string;
    }
}
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=middleware.d.ts.map