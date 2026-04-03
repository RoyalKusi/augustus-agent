/**
 * Training Data Service
 * Requirements: 10.1–10.4
 * Properties: 29
 */

import { pool } from '../../db/client.js';
import { config } from '../../config.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainingDataType = 'description' | 'faq' | 'tone_guidelines' | 'logo' | 'document';

export interface TrainingDataEntry {
  id: string;
  businessId: string;
  type: TrainingDataType;
  content: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  createdAt: Date;
  updatedAt: Date | null;
}

interface TrainingDataRow {
  id: string;
  business_id: string;
  data_type: TrainingDataType;
  content: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  created_at: Date;
  updated_at: Date | null;
}

// ─── Task 11.2: File size validation (Property 29) ───────────────────────────

/**
 * Returns true if the file size is within the 10 MB limit.
 * Property 29: any file > 10 MB must be rejected.
 */
export function isFileSizeValid(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_BYTES;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToEntry(row: TrainingDataRow): TrainingDataEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.data_type,
    content: row.content,
    fileUrl: row.file_url,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Task 11.1: CRUD ──────────────────────────────────────────────────────────

export async function createTrainingEntry(
  businessId: string,
  data: {
    type: TrainingDataType;
    content?: string;
    fileUrl?: string;
    fileSizeBytes?: number;
  },
): Promise<TrainingDataEntry> {
  const result = await pool.query<TrainingDataRow>(
    `INSERT INTO training_data (business_id, data_type, content, file_url, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      businessId,
      data.type,
      data.content ?? null,
      data.fileUrl ?? null,
      data.fileSizeBytes ?? null,
    ],
  );
  return rowToEntry(result.rows[0]);
}

export async function listTrainingEntries(businessId: string): Promise<TrainingDataEntry[]> {
  const result = await pool.query<TrainingDataRow>(
    `SELECT * FROM training_data WHERE business_id = $1 ORDER BY created_at DESC`,
    [businessId],
  );
  return result.rows.map(rowToEntry);
}

export async function deleteTrainingEntry(
  businessId: string,
  entryId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM training_data WHERE id = $1 AND business_id = $2`,
    [entryId, businessId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Task 11.4: WhatsApp profile update ──────────────────────────────────────

/**
 * Updates the WhatsApp Business profile picture for a business.
 * Best-effort: logs errors but does not throw.
 */
export async function updateWhatsAppProfile(
  businessId: string,
  logoUrl: string,
): Promise<void> {
  try {
    const result = await pool.query<{
      phone_number_id: string;
      access_token_encrypted: string;
    }>(
      `SELECT phone_number_id, access_token_encrypted
       FROM whatsapp_integrations
       WHERE business_id = $1 AND status = 'active'
       LIMIT 1`,
      [businessId],
    );

    if (result.rows.length === 0) {
      console.warn(`[TrainingService] No active WhatsApp integration for business ${businessId}`);
      return;
    }

    const { phone_number_id, access_token_encrypted } = result.rows[0];
    const graphApiVersion = config.meta.graphApiVersion;
    const url = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/whatsapp_business_profile`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token_encrypted}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile_picture_handle: logoUrl }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(
        `[TrainingService] WhatsApp profile update failed for business ${businessId}: ${response.status} ${errText}`,
      );
    }
  } catch (err) {
    console.error(`[TrainingService] updateWhatsAppProfile error for business ${businessId}:`, err);
  }
}
