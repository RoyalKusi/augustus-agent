/**
 * Promo Code Service
 */

import { pool } from '../../db/client.js';

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  applicableTiers: string[];
  maxUses: number | null;
  usesCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface PromoValidation {
  valid: boolean;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  message: string;
  promoCodeId: string;
}

interface PromoRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  applicable_tiers: string[];
  max_uses: number | null;
  uses_count: number;
  valid_from: Date;
  valid_until: Date | null;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function rowToPromo(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    applicableTiers: row.applicable_tiers ?? [],
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    validFrom: row.valid_from.toISOString(),
    validUntil: row.valid_until ? row.valid_until.toISOString() : null,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

// ─── Admin: CRUD ──────────────────────────────────────────────────────────────

export async function createPromoCode(data: {
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  applicableTiers?: string[];
  maxUses?: number | null;
  validFrom?: string;
  validUntil?: string | null;
  createdBy: string;
}): Promise<PromoCode> {
  const result = await pool.query<PromoRow>(
    `INSERT INTO promo_codes
       (code, description, discount_type, discount_value, applicable_tiers,
        max_uses, valid_from, valid_until, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.code.toUpperCase().trim(),
      data.description ?? null,
      data.discountType,
      data.discountValue,
      data.applicableTiers ?? [],
      data.maxUses ?? null,
      data.validFrom ?? new Date().toISOString(),
      data.validUntil ?? null,
      data.createdBy,
    ],
  );
  return rowToPromo(result.rows[0]);
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const result = await pool.query<PromoRow>(
    `SELECT * FROM promo_codes ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToPromo);
}

export async function updatePromoCode(
  id: string,
  updates: Partial<{
    description: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    applicableTiers: string[];
    maxUses: number | null;
    validUntil: string | null;
    isActive: boolean;
  }>,
): Promise<PromoCode> {
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let idx = 1;
  if (updates.description !== undefined) { sets.push(`description = $${idx++}`); params.push(updates.description); }
  if (updates.discountType !== undefined) { sets.push(`discount_type = $${idx++}`); params.push(updates.discountType); }
  if (updates.discountValue !== undefined) { sets.push(`discount_value = $${idx++}`); params.push(updates.discountValue); }
  if (updates.applicableTiers !== undefined) { sets.push(`applicable_tiers = $${idx++}`); params.push(updates.applicableTiers); }
  if (updates.maxUses !== undefined) { sets.push(`max_uses = $${idx++}`); params.push(updates.maxUses); }
  if (updates.validUntil !== undefined) { sets.push(`valid_until = $${idx++}`); params.push(updates.validUntil); }
  if (updates.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(updates.isActive); }
  params.push(id);
  const result = await pool.query<PromoRow>(
    `UPDATE promo_codes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );
  if (!result.rows[0]) throw new Error('Promo code not found.');
  return rowToPromo(result.rows[0]);
}

export async function deletePromoCode(id: string): Promise<void> {
  await pool.query(`DELETE FROM promo_codes WHERE id = $1`, [id]);
}

export async function getPromoMetrics(id: string): Promise<{
  promo: PromoCode;
  redemptions: Array<{
    businessId: string;
    businessName: string;
    tier: string;
    originalPrice: number;
    discountedPrice: number;
    discountAmount: number;
    redeemedAt: string;
  }>;
  totalRedemptions: number;
  totalDiscountGiven: number;
  totalRevenue: number;
}> {
  const promoResult = await pool.query<PromoRow>(`SELECT * FROM promo_codes WHERE id = $1`, [id]);
  if (!promoResult.rows[0]) throw new Error('Promo code not found.');
  const promo = rowToPromo(promoResult.rows[0]);

  const redemptionsResult = await pool.query<{
    business_id: string;
    business_name: string;
    tier: string;
    original_price: string;
    discounted_price: string;
    discount_amount: string;
    redeemed_at: Date;
  }>(
    `SELECT r.business_id, b.name AS business_name, r.tier,
            r.original_price, r.discounted_price, r.discount_amount, r.redeemed_at
     FROM promo_code_redemptions r
     JOIN businesses b ON b.id = r.business_id
     WHERE r.promo_code_id = $1
     ORDER BY r.redeemed_at DESC`,
    [id],
  );

  const redemptions = redemptionsResult.rows.map(r => ({
    businessId: r.business_id,
    businessName: r.business_name,
    tier: r.tier,
    originalPrice: Number(r.original_price),
    discountedPrice: Number(r.discounted_price),
    discountAmount: Number(r.discount_amount),
    redeemedAt: r.redeemed_at.toISOString(),
  }));

  const totalDiscountGiven = redemptions.reduce((s, r) => s + r.discountAmount, 0);
  const totalRevenue = redemptions.reduce((s, r) => s + r.discountedPrice, 0);

  return { promo, redemptions, totalRedemptions: redemptions.length, totalDiscountGiven, totalRevenue };
}

// ─── Business: validate + record redemption ───────────────────────────────────

export async function validatePromoCode(
  code: string,
  tier: string,
  originalPrice: number,
  businessId: string,
): Promise<PromoValidation> {
  const result = await pool.query<PromoRow>(
    `SELECT * FROM promo_codes WHERE code = $1`,
    [code.toUpperCase().trim()],
  );

  const promo = result.rows[0];

  if (!promo) return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: 'Invalid promo code.', promoCodeId: '' };
  if (!promo.is_active) return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: 'This promo code is no longer active.', promoCodeId: '' };
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: 'This promo code has expired.', promoCodeId: '' };
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: 'This promo code has reached its usage limit.', promoCodeId: '' };

  // Check tier applicability
  if (promo.applicable_tiers && promo.applicable_tiers.length > 0 && !promo.applicable_tiers.includes(tier)) {
    return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: `This code is only valid for: ${promo.applicable_tiers.join(', ')} plan(s).`, promoCodeId: '' };
  }

  // Check if already redeemed by this business
  const alreadyUsed = await pool.query(
    `SELECT 1 FROM promo_code_redemptions WHERE promo_code_id = $1 AND business_id = $2`,
    [promo.id, businessId],
  );
  if (alreadyUsed.rows.length > 0) return { valid: false, code, discountType: 'percent', discountValue: 0, originalPrice, discountedPrice: originalPrice, discountAmount: 0, message: 'You have already used this promo code.', promoCodeId: '' };

  const discountValue = Number(promo.discount_value);
  let discountAmount: number;
  if (promo.discount_type === 'percent') {
    discountAmount = Math.round((originalPrice * discountValue / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(discountValue, originalPrice);
  }
  const discountedPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

  return {
    valid: true,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue,
    originalPrice,
    discountedPrice,
    discountAmount,
    message: promo.discount_type === 'percent'
      ? `${discountValue}% off — you save $${discountAmount.toFixed(2)}!`
      : `$${discountValue} off — you save $${discountAmount.toFixed(2)}!`,
    promoCodeId: promo.id,
  };
}

export async function recordPromoRedemption(
  promoCodeId: string,
  businessId: string,
  tier: string,
  originalPrice: number,
  discountedPrice: number,
  discountAmount: number,
  paynowReference?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO promo_code_redemptions
       (promo_code_id, business_id, tier, original_price, discounted_price, discount_amount, paynow_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (promo_code_id, business_id) DO NOTHING`,
    [promoCodeId, businessId, tier, originalPrice, discountedPrice, discountAmount, paynowReference ?? null],
  );
  // Increment uses count
  await pool.query(
    `UPDATE promo_codes SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = $1`,
    [promoCodeId],
  );
}
