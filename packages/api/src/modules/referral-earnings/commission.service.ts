import { pool } from '../../db/client.js';

export interface CommissionSettings {
  commissionPercentage: number;
  earningsPeriodMonths: number;
  updatedAt: Date;
}

export class CommissionService {
  async getSettings(): Promise<CommissionSettings> {
    const result = await pool.query<{
      commission_percentage: string;
      earnings_period_months: number;
      updated_at: Date;
    }>(
      `SELECT commission_percentage, earnings_period_months, updated_at 
       FROM referral_commission_settings 
       WHERE id = 1`
    );

    if (result.rows.length === 0) {
      throw new Error('Commission settings not initialized');
    }

    const row = result.rows[0];
    return {
      commissionPercentage: parseFloat(row.commission_percentage),
      earningsPeriodMonths: row.earnings_period_months,
      updatedAt: row.updated_at,
    };
  }

  async updateSettings(
    commissionPercentage?: number,
    earningsPeriodMonths?: number
  ): Promise<CommissionSettings> {
    if (commissionPercentage !== undefined) {
      this.validatePercentage(commissionPercentage);
    }

    if (earningsPeriodMonths !== undefined) {
      this.validatePeriod(earningsPeriodMonths);
    }

    const updates: string[] = [];
    const values: (number | string)[] = [];
    let paramIndex = 1;

    if (commissionPercentage !== undefined) {
      updates.push(`commission_percentage = $${paramIndex++}`);
      values.push(commissionPercentage);
    }

    if (earningsPeriodMonths !== undefined) {
      updates.push(`earnings_period_months = $${paramIndex++}`);
      values.push(earningsPeriodMonths);
    }

    updates.push(`updated_at = NOW()`);

    const result = await pool.query<{
      commission_percentage: string;
      earnings_period_months: number;
      updated_at: Date;
    }>(
      `UPDATE referral_commission_settings 
       SET ${updates.join(', ')} 
       WHERE id = 1 
       RETURNING commission_percentage, earnings_period_months, updated_at`,
      values
    );

    const row = result.rows[0];
    return {
      commissionPercentage: parseFloat(row.commission_percentage),
      earningsPeriodMonths: row.earnings_period_months,
      updatedAt: row.updated_at,
    };
  }

  private validatePercentage(value: number): void {
    if (value < 0 || value > 100) {
      throw new Error('Commission percentage must be between 0 and 100');
    }
  }

  private validatePeriod(value: number): void {
    if (value <= 0 || !Number.isInteger(value)) {
      throw new Error('Earnings period must be a positive integer');
    }
  }
}

export const commissionService = new CommissionService();
