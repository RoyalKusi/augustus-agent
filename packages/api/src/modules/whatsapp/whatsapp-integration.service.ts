import { pool } from '../../db/client.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { config } from '../../config.js';

export interface WhatsAppCredentials {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
}

export interface WhatsAppIntegration {
  id: string;
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  status: 'active' | 'inactive' | 'error';
  errorMessage: string | null;
  displayPhoneNumber?: string;
  verifiedName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IntegrationRow {
  id: string;
  business_id: string;
  waba_id: string;
  phone_number_id: string;
  access_token_encrypted: string;
  webhook_verify_token: string;
  status: 'active' | 'inactive' | 'error';
  error_message: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToIntegration(row: IntegrationRow): WhatsAppIntegration {
  return {
    id: row.id,
    businessId: row.business_id,
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    accessToken: decrypt(row.access_token_encrypted),
    webhookVerifyToken: row.webhook_verify_token,
    status: row.status,
    errorMessage: row.error_message,
    displayPhoneNumber: row.display_phone_number ?? undefined,
    verifiedName: row.verified_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Store or replace WhatsApp credentials for a business.
 * The access token is encrypted at rest using AES-256-GCM.
 */
export async function storeCredentials(
  businessId: string,
  wabaId: string,
  phoneNumberId: string,
  accessToken: string,
  webhookVerifyToken: string,
  displayPhoneNumber?: string,
  verifiedName?: string,
): Promise<WhatsAppIntegration> {
  const encryptedToken = encrypt(accessToken);

  const result = await pool.query<IntegrationRow>(
    `INSERT INTO whatsapp_integrations
       (business_id, waba_id, phone_number_id, access_token_encrypted, webhook_verify_token, status, display_phone_number, verified_name)
     VALUES ($1, $2, $3, $4, $5, 'inactive', $6, $7)
     ON CONFLICT (business_id) DO UPDATE SET
       waba_id               = EXCLUDED.waba_id,
       phone_number_id       = EXCLUDED.phone_number_id,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       webhook_verify_token  = EXCLUDED.webhook_verify_token,
       status                = 'inactive',
       error_message         = NULL,
       display_phone_number  = COALESCE(EXCLUDED.display_phone_number, whatsapp_integrations.display_phone_number),
       verified_name         = COALESCE(EXCLUDED.verified_name, whatsapp_integrations.verified_name),
       updated_at            = NOW()
     RETURNING *`,
    [businessId, wabaId, phoneNumberId, encryptedToken, webhookVerifyToken, displayPhoneNumber ?? null, verifiedName ?? null],
  );

  return rowToIntegration(result.rows[0]);
}

/**
 * Retrieve decrypted WhatsApp credentials for a business.
 * Returns null if no integration exists.
 */
export async function getCredentials(businessId: string): Promise<WhatsAppIntegration | null> {
  const result = await pool.query<IntegrationRow>(
    `SELECT * FROM whatsapp_integrations WHERE business_id = $1`,
    [businessId],
  );

  if (result.rows.length === 0) return null;
  return rowToIntegration(result.rows[0]);
}

/**
 * Update one or more credential fields for an existing integration.
 * Only provided fields are updated; the access token is re-encrypted if supplied.
 */
export async function updateCredentials(
  businessId: string,
  updates: Partial<Omit<WhatsAppCredentials, 'webhookVerifyToken'> & { webhookVerifyToken?: string }>,
): Promise<WhatsAppIntegration> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.wabaId !== undefined) {
    setClauses.push(`waba_id = $${idx++}`);
    values.push(updates.wabaId);
  }
  if (updates.phoneNumberId !== undefined) {
    setClauses.push(`phone_number_id = $${idx++}`);
    values.push(updates.phoneNumberId);
  }
  if (updates.accessToken !== undefined) {
    setClauses.push(`access_token_encrypted = $${idx++}`);
    values.push(encrypt(updates.accessToken));
  }
  if (updates.webhookVerifyToken !== undefined) {
    setClauses.push(`webhook_verify_token = $${idx++}`);
    values.push(updates.webhookVerifyToken);
  }

  values.push(businessId);

  const result = await pool.query<IntegrationRow>(
    `UPDATE whatsapp_integrations SET ${setClauses.join(', ')}
     WHERE business_id = $${idx}
     RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    throw new Error('WhatsApp integration not found for this business.');
  }

  return rowToIntegration(result.rows[0]);
}

/**
 * Update the integration status (and optional error message).
 */
export async function updateStatus(
  businessId: string,
  status: 'active' | 'inactive' | 'error',
  errorMessage?: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE whatsapp_integrations
     SET status = $1, error_message = $2, updated_at = NOW()
     WHERE business_id = $3`,
    [status, errorMessage ?? null, businessId],
  );
}

/**
 * Delete the WhatsApp integration record for a business.
 */
export async function deleteCredentials(businessId: string): Promise<void> {
  await pool.query(
    `DELETE FROM whatsapp_integrations WHERE business_id = $1`,
    [businessId],
  );
}

export interface RegisterWebhookResult {
  success: boolean;
  errorMessage?: string;
}

export interface DeregisterWebhookResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * Register a webhook subscription with the Meta Cloud API for the given business.
 *
 * Sequence:
 *  1. Load stored credentials for the business.
 *  2. POST to Meta Graph API /subscribed_apps with the callback URL and verify token.
 *  3. Meta will send a GET hub.challenge to the Webhook_Receiver; the receiver responds
 *     with the challenge value, completing verification.
 *  4. On success: set status = 'active' and record registered_at.
 *  5. On failure: set status = 'error' with a descriptive error_message, but RETAIN credentials.
 *
 * Req 4.2 — verify within 30 seconds.
 * Req 4.3 — retain credentials on failure, return descriptive error.
 * Req 4.4 — set status = 'active' on success.
 */
export async function registerWebhook(businessId: string): Promise<RegisterWebhookResult> {
  const integration = await getCredentials(businessId);
  if (!integration) {
    return { success: false, errorMessage: 'No WhatsApp integration found for this business.' };
  }

  const { wabaId, accessToken, webhookVerifyToken } = integration;
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? config.meta.graphApiVersion;
  const url = `https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`;

  // Build the global webhook callback URL — always points to the single /webhooks/whatsapp endpoint
  const callbackUrl = `${config.baseUrl}/webhooks/whatsapp`;
  const verifyToken = webhookVerifyToken || config.meta.verifyToken;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }),
      signal: AbortSignal.timeout(30_000), // Req 4.2: 30-second limit
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? `Webhook registration request failed: ${err.message}`
        : 'Webhook registration request failed due to a network error.';

    await pool.query(
      `UPDATE whatsapp_integrations
       SET status = 'error', error_message = $1, updated_at = NOW()
       WHERE business_id = $2`,
      [errorMessage, businessId],
    );

    return { success: false, errorMessage };
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      // ignore JSON parse errors
    }
    const errorMessage = detail
      ? `Meta Cloud API rejected webhook registration: ${detail}`
      : `Meta Cloud API returned HTTP ${response.status} during webhook registration.`;

    await pool.query(
      `UPDATE whatsapp_integrations
       SET status = 'error', error_message = $1, updated_at = NOW()
       WHERE business_id = $2`,
      [errorMessage, businessId],
    );

    return { success: false, errorMessage };
  }

  // Success — set status active and record registered_at
  await pool.query(
    `UPDATE whatsapp_integrations
     SET status = 'active', error_message = NULL,
         registered_at = NOW(), updated_at = NOW()
     WHERE business_id = $1`,
    [businessId],
  );

  return { success: true };
}

/**
 * Deregister the webhook subscription with the Meta Cloud API for the given business.
 *
 * Sequence:
 *  1. Load stored credentials for the business.
 *  2. DELETE https://graph.facebook.com/{version}/{wabaId}/subscribed_apps
 *  3. On success: set status = 'inactive' and clear registered_at.
 *  4. On failure: set status = 'error' with a descriptive error_message, but RETAIN credentials.
 *
 * Req 4.6 — deregister within 60 seconds.
 */
export async function deregisterWebhook(businessId: string): Promise<DeregisterWebhookResult> {
  const integration = await getCredentials(businessId);
  if (!integration) {
    return { success: false, errorMessage: 'No WhatsApp integration found for this business.' };
  }

  const { wabaId, accessToken } = integration;
  const graphVersion = process.env.META_GRAPH_API_VERSION ?? config.meta.graphApiVersion;
  const url = `https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(60_000), // Req 4.6: 60-second limit
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? `Webhook deregistration request failed: ${err.message}`
        : 'Webhook deregistration request failed due to a network error.';

    await pool.query(
      `UPDATE whatsapp_integrations
       SET status = 'error', error_message = $1, updated_at = NOW()
       WHERE business_id = $2`,
      [errorMessage, businessId],
    );

    return { success: false, errorMessage };
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      // ignore JSON parse errors
    }
    const errorMessage = detail
      ? `Meta Cloud API rejected webhook deregistration: ${detail}`
      : `Meta Cloud API returned HTTP ${response.status} during webhook deregistration.`;

    await pool.query(
      `UPDATE whatsapp_integrations
       SET status = 'error', error_message = $1, updated_at = NOW()
       WHERE business_id = $2`,
      [errorMessage, businessId],
    );

    return { success: false, errorMessage };
  }

  // Success — set status inactive and clear registered_at
  await pool.query(
    `UPDATE whatsapp_integrations
     SET status = 'inactive', error_message = NULL,
         registered_at = NULL, updated_at = NOW()
     WHERE business_id = $1`,
    [businessId],
  );

  return { success: true };
}

// --- Embedded Signup: token exchange ----------------------------------------

export interface ExchangeTokenResult {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  codeVerificationStatus: string;
  nameStatus: string;
  registrationStatus: 'registered' | 'already_registered' | 'skipped' | 'failed';
  registrationError: string | null;
  webhookStatus: 'active' | 'pending';
  webhookError: string | null;
}

/**
 * Exchange a short-lived Embedded Signup code for a long-lived access token,
 * then discover the WABA ID and Phone Number ID from the token's granted scopes.
 * Stores credentials and registers the webhook in one shot.
 */
export async function exchangeEmbeddedSignupCode(
  businessId: string,
  code: string,
): Promise<ExchangeTokenResult> {
  const graphVersion = config.meta.graphApiVersion;
  const appId = config.meta.appId;
  const appSecret = config.meta.appSecret;

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured.');
  }

  // Step 1: Exchange code → access token
  const tokenUrl =
    `https://graph.facebook.com/${graphVersion}/oauth/access_token` +
    `?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;

  const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(15_000) });
  if (!tokenRes.ok) {
    const body = (await tokenRes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body?.error?.message ?? `Token exchange failed (HTTP ${tokenRes.status})`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Step 2: Inspect token to get WABA ID from granular_scopes
  const appToken = `${appId}|${appSecret}`;
  const debugRes = await fetch(
    `https://graph.facebook.com/${graphVersion}/debug_token?input_token=${access_token}&access_token=${encodeURIComponent(appToken)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  const debugData = (await debugRes.json()) as {
    data?: {
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
  };

  const wabaScope = debugData?.data?.granular_scopes?.find(
    (s) => s.scope === 'whatsapp_business_management',
  );
  const wabaId = wabaScope?.target_ids?.[0];

  if (!wabaId) {
    throw new Error('No WhatsApp Business Account found in the granted permissions.');
  }

  // Step 3: Get phone number from WABA with verification status
  const phoneRes = await fetch(
    `https://graph.facebook.com/${graphVersion}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,name_status`,
    {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const phoneData = (await phoneRes.json()) as {
    data?: Array<{
      id: string;
      display_phone_number: string;
      verified_name: string;
      code_verification_status?: string;
      name_status?: string;
    }>;
  };
  const phone = phoneData?.data?.[0];

  if (!phone) {
    throw new Error('No phone number found on this WhatsApp Business Account.');
  }

  // Step 4: Store credentials
  await storeCredentials(
    businessId,
    wabaId,
    phone.id,
    access_token,
    config.meta.verifyToken,
    phone.display_phone_number,
    phone.verified_name,
  );

  const nameStatus = phone.name_status ?? 'UNKNOWN';
  const codeVerificationStatus = phone.code_verification_status ?? 'UNKNOWN';

  // Step 4b: Phone number verification (if not already verified)
  // Per Meta docs: code_verification_status must be VERIFIED before registration.
  // During embedded signup the user verifies the number in the flow, so it should
  // already be VERIFIED. If not, we cannot proceed with registration.
  if (codeVerificationStatus !== 'VERIFIED') {
    console.warn(`[WhatsApp] Phone ${phone.id} code_verification_status=${codeVerificationStatus} — registration may fail`);
  }

  // Step 4c: Register phone number for Cloud API use
  // Per Meta docs: POST /{phone-id}/register with messaging_product and pin.
  // name_status NONE or EXPIRED means no valid certificate — cannot register.
  // code 80007 = already registered (success), 133016 = rate limited.
  let registrationStatus: ExchangeTokenResult['registrationStatus'] = 'failed';
  let registrationError: string | null = null;

  if (nameStatus === 'NONE' || nameStatus === 'EXPIRED') {
    registrationStatus = 'skipped';
    registrationError = `Display name status is ${nameStatus} — number cannot be registered until a valid display name is approved in Meta Business Manager.`;
    console.warn('[WhatsApp] Registration skipped:', registrationError);
  } else {
    try {
      const regRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phone.id}/register`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '000000',
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (regRes.ok) {
        registrationStatus = 'registered';
        console.log('[WhatsApp] Phone number registered for Cloud API successfully');
      } else {
        const regBody = (await regRes.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
        const errCode = regBody?.error?.code;
        if (errCode === 80007) {
          // Already registered — this is fine
          registrationStatus = 'already_registered';
          console.log('[WhatsApp] Phone number already registered for Cloud API');
        } else if (errCode === 133016) {
          registrationStatus = 'failed';
          registrationError = 'Registration rate limit reached (10 requests per 72 hours). Please try again later.';
          console.warn('[WhatsApp]', registrationError);
        } else {
          registrationStatus = 'failed';
          registrationError = regBody?.error?.message ?? `Registration failed (HTTP ${regRes.status})`;
          console.warn('[WhatsApp] Phone number registration failed:', registrationError);
        }
      }
    } catch (regErr) {
      registrationStatus = 'failed';
      registrationError = regErr instanceof Error ? regErr.message : 'Registration request failed';
      console.warn('[WhatsApp] Phone number registration error:', registrationError);
    }
  }

  // Update DB with registration error if any
  if (registrationError) {
    await pool.query(
      `UPDATE whatsapp_integrations SET error_message = $1, updated_at = NOW() WHERE business_id = $2`,
      [registrationError, businessId],
    );
  }

  // Step 5: Subscribe WABA to webhooks
  const webhookResult = await registerWebhook(businessId);

  return {
    wabaId,
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number,
    verifiedName: phone.verified_name,
    codeVerificationStatus,
    nameStatus,
    registrationStatus,
    registrationError,
    webhookStatus: webhookResult.success ? 'active' : 'pending',
    webhookError: webhookResult.errorMessage ?? null,
  };
}
