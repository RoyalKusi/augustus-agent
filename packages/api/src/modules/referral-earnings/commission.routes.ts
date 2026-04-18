import type { FastifyInstance } from 'fastify';
import { authenticateOperator } from '../admin/admin.middleware.js';
import { commissionService } from './commission.service.js';
import { earningsService } from './earnings.service.js';

export function commissionRoutes(app: FastifyInstance) {
  // POST /admin/referral-commission/settings - Update commission settings
  app.post(
    '/admin/referral-commission/settings',
    { preHandler: authenticateOperator },
    async (request, reply) => {
      try {
        const { commissionPercentage, earningsPeriodMonths } = request.body as {
          commissionPercentage?: number;
          earningsPeriodMonths?: number;
        };

        const settings = await commissionService.updateSettings(
          commissionPercentage,
          earningsPeriodMonths
        );

        return reply.send({
          commissionPercentage: settings.commissionPercentage,
          earningsPeriodMonths: settings.earningsPeriodMonths,
          updatedAt: settings.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        
        if (message.includes('must be between') || message.includes('must be a positive')) {
          return reply.status(400).send({ error: message });
        }
        
        return reply.status(500).send({ error: message });
      }
    }
  );

  // GET /admin/referral-commission/settings - Get current commission settings
  app.get(
    '/admin/referral-commission/settings',
    { preHandler: authenticateOperator },
    async (request, reply) => {
      try {
        const settings = await commissionService.getSettings();

        return reply.send({
          commissionPercentage: settings.commissionPercentage,
          earningsPeriodMonths: settings.earningsPeriodMonths,
          updatedAt: settings.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get settings';
        return reply.status(500).send({ error: message });
      }
    }
  );

  // GET /admin/businesses/:id/earnings - Get earnings for a specific business
  app.get(
    '/admin/businesses/:id/earnings',
    { preHandler: authenticateOperator },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const earnings = await earningsService.getBusinessEarnings(id);

        return reply.send({
          businessId: earnings.businessId,
          businessName: earnings.businessName,
          totalEarningsUsd: earnings.totalEarningsUsd,
          validReferralsCount: earnings.validReferralsCount,
          referrals: earnings.referrals.map((ref) => ({
            id: ref.id,
            referredEmail: ref.referredEmail,
            referredName: ref.referredName,
            status: ref.status,
            earningsUsd: ref.earningsUsd,
            commissionPercentageUsed: ref.commissionPercentageUsed,
            createdAt: ref.createdAt.toISOString(),
            earningsCalculatedAt: ref.earningsCalculatedAt?.toISOString() || null,
          })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get earnings';
        
        if (message === 'Business not found') {
          return reply.status(404).send({ error: message });
        }
        
        return reply.status(500).send({ error: message });
      }
    }
  );

  // GET /admin/referral-commission/system-stats - Get system-wide referral earnings statistics
  app.get(
    '/admin/referral-commission/system-stats',
    { preHandler: authenticateOperator },
    async (request, reply) => {
      try {
        const stats = await earningsService.getSystemStats();

        return reply.send({
          totalEarningsUsd: stats.totalEarningsUsd,
          totalValidReferrals: stats.totalValidReferrals,
          totalSubscribedReferrals: stats.totalSubscribedReferrals,
          averageEarningsPerReferral: stats.averageEarningsPerReferral,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get system stats';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
