/**
 * Training Data Service
 * Requirements: 10.1–10.4
 * Properties: 29
 */

import { pool } from '../../db/client.js';
import { config } from '../../config.js';
import { decrypt } from '../../utils/crypto.js';

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
 * Uploads image bytes to Meta's Resumable Upload API and returns a
 * profile_picture_handle that can be used with whatsapp_business_profile.
 *
 * Flow per Meta docs:
 *   1. POST /app/uploads  → upload session id
 *   2. POST /{session_id} → file_handle
 */
async function uploadImageToMeta(
  imageBuffer: Buffer,
  mimeType: string,
  accessToken: string,
): Promise<string> {
  const { appId, graphApiVersion } = config.meta;

  // Step 1: create upload session
  const sessionRes = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${appId}/uploads?` +
      new URLSearchParams({
        file_length: String(imageBuffer.length),
        file_type: mimeType,
        access_token: accessToken,
      }),
    { method: 'POST' },
  );

  if (!sessionRes.ok) {
    const txt = await sessionRes.text().catch(() => '');
    throw new Error(`Meta upload session failed: ${sessionRes.status} ${txt}`);
  }

  const { id: uploadSessionId } = (await sessionRes.json()) as { id: string };

  // Step 2: upload the file bytes
  const uploadRes = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${uploadSessionId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: '0',
        'Content-Type': mimeType,
      },
      body: imageBuffer,
    },
  );

  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error(`Meta file upload failed: ${uploadRes.status} ${txt}`);
  }

  const { h: fileHandle } = (await uploadRes.json()) as { h: string };
  return fileHandle;
}

/**
 * Fetches image bytes from a public URL.
 */
async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch logo from ${url}: ${res.status}`);
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

/**
 * Syncs the business logo to the connected WhatsApp Business phone number profile photo.
 *
 * Two-step Meta API flow:
 *   1. Upload image bytes via Resumable Upload API → get profile_picture_handle
 *   2. POST /{phoneNumberId}/whatsapp_business_profile with the handle
 *
 * Best-effort: logs errors but does not throw so it never blocks the upload response.
 */
export async function updateWhatsAppProfile(
  businessId: string,
  logoUrl: string,
  imageBuffer?: Buffer,
  mimeType?: string,
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
      console.warn(`[WhatsAppProfile] No active WhatsApp integration for business ${businessId} — skipping profile photo sync`);
      return;
    }

    const { phone_number_id, access_token_encrypted } = result.rows[0];
    // Decrypt the stored token before using it
    const accessToken = decrypt(access_token_encrypted);
    const { graphApiVersion } = config.meta;

    // Step 1: use provided buffer or fetch the logo bytes from S3/CDN
    let buf: Buffer;
    let mime: string;
    if (imageBuffer && mimeType) {
      buf = imageBuffer;
      mime = mimeType;
    } else {
      const fetched = await fetchImageBuffer(logoUrl);
      buf = fetched.buffer;
      mime = fetched.mimeType;
    }

    // Step 2: upload to Meta Resumable Upload API → get handle
    const profilePictureHandle = await uploadImageToMeta(buf, mime, accessToken);

    // Step 3: set the handle on the WhatsApp Business profile
    const profileUrl = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/whatsapp_business_profile`;
    const profileRes = await fetch(profileUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        profile_picture_handle: profilePictureHandle,
      }),
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text().catch(() => '');
      console.error(`[WhatsAppProfile] Profile update failed for business ${businessId}: ${profileRes.status} ${errText}`);
    } else {
      console.info(`[WhatsAppProfile] Profile photo synced for business ${businessId}`);
    }
  } catch (err) {
    console.error(`[WhatsAppProfile] updateWhatsAppProfile error for business ${businessId}:`, err);
  }
}
