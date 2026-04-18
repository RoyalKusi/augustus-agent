import { pool } from '../../db/client.js';
import { commissionService } from './commission.service.js';

export interface ReferralEarnings {
  referralId: string;
  earningsUsd: number;
  commissionPercentageUsed: number;
  calculatedAt: Date;
}

export interface ReferralWithEarnings {
  id: string;
  referrerId: string;
  referredId: string;
  referredEmail: string;
  referredName: string;
  status: 'registered' | 'subscribed';
  earningsUsd: number | null;
  commissionPercentageUsed: number | null;
  createdAt: Date;
  earningsCalculatedAt: Date | null;
}

export interface BusinessEarnings {
  businessId: string;
  businessName: string;
  totalEarningsUsd: number;
  validReferralsCount: number;
  referrals: ReferralWithEarnings[];
}

export interface SystemEarningsStats {
  totalEarningsUsd: number;
  totalValidReferrals: number;
  totalSubscribedReferrals: number;
  averageEarningsPerReferral: number;
}

export class EarningsService {
  async calculateEarnings(
    referralId: string,
    subscriptionPriceUsd: number
  ): Promise<ReferralEarnings> {
    const settings = await commissionService.getSettings();
    const earnings = Number(
      (subscriptionPriceUsd * (settings.commissionPercentage / 100)).toFixed(2)
    );

    const calculatedAt = new Date();

    await pool.query(
      `UPDATE referrals 
       SET earnings_usd = $1,
           commission_percentage_used = $2,
           earnings_calculated_at = $3
       WHERE id = $4`,
      [earnings, settings.commissionPercentage, calculatedAt, referralId]
    );

    return {
      referralId,
      earningsUsd: earnings,
      commissionPercentageUsed: settings.commissionPercentage,
      calculatedAt,
    };
  }

  async getBusinessEarnings(businessId: string): Promise<BusinessEarnings> {
    const settings = await commissionService.getSettings();

    // Get business name
    const businessResult = await pool.query<{ name: string }>(
      `SELECT name FROM businesses WHERE id = $1`,
      [businessId]
    );

    if (businessResult.rows.length === 0) {
      throw new Error('Business not found');
    }

    const businessName = businessResult.rows[0].name;

    // Get referrals within earnings period
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - settings.earningsPeriodMonths);

    const result = await pool.query<{
      id: string;
      referrer_id: string;
      referred_id: string;
      referred_email: string;
      referred_name: string;
      status: 'registered' | 'subscribed';
      earnings_usd: string | null;
      commission_percentage_used: string | null;
      created_at: Date;
      earnings_calculated_at: Date | null;
    }>(
      `SELECT id, referrer_id, referred_id, referred_email, referred_name, 
              status, earnings_usd, commission_percentage_used, 
              created_at, earnings_calculated_at
       FROM referrals
       WHERE referrer_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [businessId, cutoffDate]
    );

    const referrals: ReferralWithEarnings[] = result.rows.map((row) => ({
      id: row.id,
      referrerId: row.referrer_id,
      referredId: row.referred_id,
      referredEmail: row.referred_email,
      referredName: row.referred_name,
      status: row.status,
      earningsUsd: row.earnings_usd ? parseFloat(row.earnings_usd) : null,
      commissionPercentageUsed: row.commission_percentage_used
        ? parseFloat(row.commission_percentage_used)
        : null,
      createdAt: row.created_at,
      earningsCalculatedAt: row.earnings_calculated_at,
    }));

    const totalEarningsUsd = referrals.reduce(
      (sum, ref) => sum + (ref.earningsUsd || 0),
      0
    );

    return {
      businessId,
      businessName,
      totalEarningsUsd: Number(totalEarningsUsd.toFixed(2)),
      validReferralsCount: referrals.length,
      referrals,
    };
  }

  async getSystemStats(): Promise<SystemEarningsStats> {
    const settings = await commissionService.getSettings();

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - settings.earningsPeriodMonths);

    const result = await pool.query<{
      total_earnings: string | null;
      total_valid_referrals: string;
      total_subscribed_referrals: string;
    }>(
      `SELECT 
         COALESCE(SUM(earnings_usd), 0) as total_earnings,
         COUNT(*) as total_valid_referrals,
         COUNT(CASE WHEN status = 'subscribed' THEN 1 END) as total_subscribed_referrals
       FROM referrals
       WHERE created_at >= $1`,
      [cutoffDate]
    );

    const row = result.rows[0];
    const totalEarnings = parseFloat(row.total_earnings || '0');
    const totalSubscribed = parseInt(row.total_subscribed_referrals, 10);
    const averageEarnings =
      totalSubscribed > 0 ? totalEarnings / totalSubscribed : 0;

    return {
      totalEarningsUsd: Number(totalEarnings.toFixed(2)),
      totalValidReferrals: parseInt(row.total_valid_referrals, 10),
      totalSubscribedReferrals: totalSubscribed,
      averageEarningsPerReferral: Number(averageEarnings.toFixed(2)),
    };
  }

  private isWithinEarningsPeriod(
    createdAt: Date,
    periodMonths: number
  ): boolean {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
    return createdAt >= cutoffDate;
  }
}

export const earningsService = new EarningsService();
