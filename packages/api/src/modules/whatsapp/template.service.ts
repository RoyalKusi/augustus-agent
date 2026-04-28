/**
 * WhatsApp Message Template Service
 *
 * Manages message templates for Meta Business API compliance.
 * Templates are required for:
 * - Business-initiated messages (outside 24h window)
 * - Broadcast messages
 * - Demonstrating proper usage for business_messaging permission approval
 *
 * Categories:
 * - UTILITY: Transactional (order confirmations, receipts, shipping updates)
 * - MARKETING: Promotional (product announcements, offers, broadcasts)
 * - AUTHENTICATION: OTP / verification codes
 */

import { pool } from '../../db/client.js';
import { config } from '../../config.js';
import { getCredentials } from './whatsapp-integration.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface MessageTemplate {
  id: string;
  businessId: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  metaTemplateId: string | null;
  headerType: string | null;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  buttons: TemplateButton[] | null;
  exampleParams: string[] | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  language?: string;
  headerType?: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButton[];
  exampleParams?: string[];
}

// ─── Platform Standard Templates ─────────────────────────────────────────────

/**
 * Standard templates every business should have.
 * These cover the core use cases and demonstrate proper template usage to Meta.
 */
export const PLATFORM_TEMPLATES: Omit<CreateTemplateInput, 'language'>[] = [
  // ── UTILITY: Transactional ────────────────────────────────────────────────

  {
    name: 'order_confirmation',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '🛒 Order Confirmed',
    bodyText: 'Hi {{1}}, your order *{{2}}* has been confirmed!\n\n📦 Items: {{3}}\n💰 Total: {{4}}\n\nWe\'ll notify you when it\'s ready. Thank you for shopping with us!',
    footerText: 'Reply HELP for support',
    buttons: [{ type: 'QUICK_REPLY', text: 'Track Order' }],
    exampleParams: ['John', 'ORD-ABC123', 'AIRMAX x1', 'USD 50.00'],
  },

  {
    name: 'payment_receipt',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '✅ Payment Received',
    bodyText: 'Hi {{1}}, we\'ve received your payment of *{{2}}* for order *{{3}}*.\n\nYour order is now being processed. You\'ll receive an update shortly.',
    footerText: 'Keep this as your receipt',
    exampleParams: ['John', 'USD 50.00', 'ORD-ABC123'],
  },

  {
    name: 'payment_link',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '💳 Complete Your Payment',
    bodyText: 'Hi {{1}}, your order *{{2}}* is ready for payment.\n\n💰 Amount: *{{3}}*\n⏱️ Link expires in 15 minutes.\n\nTap the button below to pay securely:',
    footerText: 'Secure payment powered by Paynow',
    buttons: [{ type: 'URL', text: 'Pay Now', url: '{{4}}' }],
    exampleParams: ['John', 'ORD-ABC123', 'USD 50.00', 'https://paynow.co.zw/pay/xxx'],
  },

  {
    name: 'order_status_update',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '📦 Order Update',
    bodyText: 'Hi {{1}}, your order *{{2}}* status has been updated to: *{{3}}*.\n\n{{4}}',
    exampleParams: ['John', 'ORD-ABC123', 'Shipped', 'Your order is on its way!'],
  },

  {
    name: 'payment_link_expired',
    category: 'UTILITY',
    bodyText: 'Hi {{1}}, your payment link for order *{{2}}* has expired.\n\nPlease start a new order if you\'d like to continue. We\'re here to help!',
    exampleParams: ['John', 'ORD-ABC123'],
  },

  {
    name: 'invoice',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '🧾 Invoice',
    bodyText: 'Hi {{1}}, here is your invoice for order *{{2}}*.\n\n📋 Items: {{3}}\n💰 Total Due: *{{4}}*\n\n💳 Payment Instructions:\n{{5}}\n\n⚠️ Use *{{2}}* as your payment reference.',
    footerText: 'Reply PAID once payment is made',
    exampleParams: ['John', 'ORD-ABC123', 'AIRMAX x1 - USD 50.00', 'USD 50.00', 'EcoCash: 0771234567'],
  },

  // ── MARKETING: Promotional ────────────────────────────────────────────────

  {
    name: 'product_announcement',
    category: 'MARKETING',
    headerType: 'IMAGE',
    bodyText: 'Hi {{1}}! 🎉 We just added *{{2}}* to our catalogue!\n\n{{3}}\n\n💰 Price: *{{4}}*\n\nLimited stock — grab yours now!',
    buttons: [
      { type: 'QUICK_REPLY', text: '🛒 Order Now' },
      { type: 'QUICK_REPLY', text: 'Tell Me More' },
    ],
    exampleParams: ['John', 'AIRMAX Pro', 'Premium quality sneakers in all sizes.', 'USD 65.00'],
  },

  {
    name: 'promotional_offer',
    category: 'MARKETING',
    headerType: 'TEXT',
    headerText: '🔥 Special Offer',
    bodyText: 'Hi {{1}}! Don\'t miss out — *{{2}}* is now available at *{{3}}* (was {{4}}).\n\n⏰ Offer ends {{5}}. Shop now before it\'s gone!',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Shop Now' },
      { type: 'QUICK_REPLY', text: 'Not Interested' },
    ],
    exampleParams: ['John', 'AIRMAX', 'USD 40.00', 'USD 50.00', 'Sunday midnight'],
  },

  {
    name: 'broadcast_message',
    category: 'MARKETING',
    bodyText: 'Hi {{1}}! {{2}}\n\n{{3}}',
    buttons: [{ type: 'QUICK_REPLY', text: 'Reply' }],
    exampleParams: ['John', 'We have exciting news for you!', 'Check out our latest products and offers.'],
  },

  {
    name: 'reengagement',
    category: 'MARKETING',
    bodyText: 'Hi {{1}}, we miss you! 👋\n\nIt\'s been a while since your last visit. We have new products you might love.\n\n{{2}}',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Show Me' },
      { type: 'QUICK_REPLY', text: 'Unsubscribe' },
    ],
    exampleParams: ['John', 'Check out our latest arrivals!'],
  },

  // ── UTILITY: Notifications ────────────────────────────────────────────────

  {
    name: 'lead_alert_owner',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '🔥 Hot Lead Alert',
    bodyText: 'A customer (*{{1}}*) is ready to buy *{{2}}*!\n\nCheck your Conversations dashboard to follow up or take over the chat.',
    exampleParams: ['263771234567', 'AIRMAX'],
  },

  {
    name: 'order_paid_owner',
    category: 'UTILITY',
    headerType: 'TEXT',
    headerText: '💰 New Order Paid',
    bodyText: 'New order received!\n\n📋 Ref: *{{1}}*\n👤 Customer: {{2}}\n🛍️ Items: {{3}}\n💰 Total: *{{4}}*\n\nCheck your Orders dashboard.',
    exampleParams: ['ORD-ABC123', '263771234567', 'AIRMAX x1', 'USD 50.00'],
  },
];

// ─── Template Service ─────────────────────────────────────────────────────────

export class TemplateService {

  /**
   * Get all templates for a business.
   */
  async listTemplates(businessId: string): Promise<MessageTemplate[]> {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT * FROM message_templates WHERE business_id = $1 ORDER BY category, name`,
      [businessId],
    );
    return result.rows.map(this.mapRow);
  }

  /**
   * Get a single template by name.
   */
  async getTemplate(businessId: string, name: string, language = 'en_US'): Promise<MessageTemplate | null> {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT * FROM message_templates WHERE business_id = $1 AND name = $2 AND language = $3`,
      [businessId, name, language],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Create or update a template in the local DB.
   */
  async upsertTemplate(businessId: string, input: CreateTemplateInput): Promise<MessageTemplate> {
    const language = input.language ?? 'en_US';
    const result = await pool.query<Record<string, unknown>>(
      `INSERT INTO message_templates
         (business_id, name, category, language, header_type, header_text, body_text,
          footer_text, buttons, example_params, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
       ON CONFLICT (business_id, name, language) DO UPDATE SET
         category = EXCLUDED.category,
         header_type = EXCLUDED.header_type,
         header_text = EXCLUDED.header_text,
         body_text = EXCLUDED.body_text,
         footer_text = EXCLUDED.footer_text,
         buttons = EXCLUDED.buttons,
         example_params = EXCLUDED.example_params,
         updated_at = NOW()
       RETURNING *`,
      [
        businessId, input.name, input.category, language,
        input.headerType ?? null, input.headerText ?? null, input.bodyText,
        input.footerText ?? null,
        input.buttons ? JSON.stringify(input.buttons) : null,
        input.exampleParams ? JSON.stringify(input.exampleParams) : null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Submit a template to Meta for approval via the Graph API.
   * Returns the Meta template ID on success.
   */
  async submitToMeta(businessId: string, templateName: string, language = 'en_US'): Promise<{ metaTemplateId: string; status: string }> {
    const template = await this.getTemplate(businessId, templateName, language);
    if (!template) throw new Error(`Template '${templateName}' not found.`);

    const integration = await getCredentials(businessId);
    if (!integration) throw new Error('No WhatsApp integration found.');

    const { accessToken, wabaId } = integration;
    if (!wabaId) throw new Error('WABA ID not set. Complete WhatsApp setup first.');

    const graphVersion = config.meta.graphApiVersion;

    // Build the components array for Meta's API
    const components: Record<string, unknown>[] = [];

    if (template.headerType && template.headerType !== 'NONE') {
      if (template.headerType === 'TEXT' && template.headerText) {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: template.headerText,
        });
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType)) {
        components.push({
          type: 'HEADER',
          format: template.headerType,
          example: { header_handle: ['https://placehold.co/400x400/e2e8f0/718096/png?text=Product'] },
        });
      }
    }

    // Body with example values
    const bodyComponent: Record<string, unknown> = {
      type: 'BODY',
      text: template.bodyText,
    };
    if (template.exampleParams && template.exampleParams.length > 0) {
      bodyComponent.example = { body_text: [template.exampleParams] };
    }
    components.push(bodyComponent);

    if (template.footerText) {
      components.push({ type: 'FOOTER', text: template.footerText });
    }

    if (template.buttons && template.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: template.buttons.map(btn => {
          if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
          if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.url };
          if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
          return btn;
        }),
      });
    }

    const payload = {
      name: template.name,
      category: template.category,
      language: template.language,
      components,
    };

    const res = await fetch(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const body = await res.json() as { id?: string; status?: string; error?: { message?: string } };

    if (!res.ok) {
      throw new Error(body.error?.message ?? `Meta API error ${res.status}`);
    }

    const metaTemplateId = body.id ?? '';
    const status = (body.status ?? 'PENDING').toUpperCase() as TemplateStatus;

    // Update local DB with Meta's response
    await pool.query(
      `UPDATE message_templates SET meta_template_id = $1, status = $2, updated_at = NOW()
       WHERE business_id = $3 AND name = $4 AND language = $5`,
      [metaTemplateId, status, businessId, templateName, language],
    );

    return { metaTemplateId, status };
  }

  /**
   * Sync template statuses from Meta (check approval status).
   * Matches templates by meta_template_id first, then falls back to name+language.
   */
  async syncStatusFromMeta(businessId: string): Promise<{ synced: number; approved: number; rejected: number; error?: string }> {
    const integration = await getCredentials(businessId);
    if (!integration?.wabaId) return { synced: 0, approved: 0, rejected: 0, error: 'No WhatsApp integration or WABA ID not set.' };

    const { accessToken, wabaId } = integration;
    const graphVersion = config.meta.graphApiVersion;

    let res: Response;
    try {
      res = await fetch(
        `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates?fields=id,name,language,status,rejected_reason,category&limit=200`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (err) {
      return { synced: 0, approved: 0, rejected: 0, error: err instanceof Error ? err.message : 'Network error' };
    }

    if (!res.ok) {
      let errMsg = `Meta API error ${res.status}`;
      try {
        const errBody = await res.json() as { error?: { message?: string } };
        errMsg = errBody.error?.message ?? errMsg;
      } catch { /* ignore */ }
      return { synced: 0, approved: 0, rejected: 0, error: errMsg };
    }

    const body = await res.json() as {
      data?: Array<{
        id: string;
        name: string;
        language: string;
        status: string;
        rejected_reason?: string;
        category?: string;
      }>
    };
    const metaTemplates = body.data ?? [];

    let approved = 0;
    let rejected = 0;
    let synced = 0;

    for (const t of metaTemplates) {
      const status = t.status.toUpperCase() as TemplateStatus;
      if (status === 'APPROVED') approved++;
      if (status === 'REJECTED') rejected++;

      // Try to match by meta_template_id first (most reliable)
      const byId = await pool.query(
        `UPDATE message_templates
         SET status = $1, rejection_reason = $2, updated_at = NOW()
         WHERE business_id = $3 AND meta_template_id = $4
         RETURNING id`,
        [status, t.rejected_reason ?? null, businessId, t.id],
      );

      if ((byId.rowCount ?? 0) > 0) {
        synced++;
        continue;
      }

      // Fallback: match by name + language (for templates submitted but ID not yet stored)
      const byName = await pool.query(
        `UPDATE message_templates
         SET status = $1, rejection_reason = $2, meta_template_id = $3, updated_at = NOW()
         WHERE business_id = $4 AND name = $5 AND language = $6
         RETURNING id`,
        [status, t.rejected_reason ?? null, t.id, businessId, t.name, t.language],
      );

      if ((byName.rowCount ?? 0) > 0) {
        synced++;
      }
    }

    return { synced, approved, rejected };
  }

  /**
   * Delete a template from local DB and optionally from Meta.
   */
  async deleteTemplate(businessId: string, templateName: string, language = 'en_US', deleteFromMeta = true): Promise<{ deletedLocally: boolean; deletedFromMeta: boolean; error?: string }> {
    // Get template first to check if it has a Meta ID
    const template = await this.getTemplate(businessId, templateName, language);
    if (!template) throw new Error(`Template '${templateName}' not found.`);

    let deletedFromMeta = false;
    let metaError: string | undefined;

    // Delete from Meta if it was submitted and deleteFromMeta is true
    if (deleteFromMeta && template.metaTemplateId) {
      try {
        const integration = await getCredentials(businessId);
        if (integration?.wabaId && integration.accessToken) {
          const graphVersion = config.meta.graphApiVersion;
          const res = await fetch(
            `https://graph.facebook.com/${graphVersion}/${template.metaTemplateId}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${integration.accessToken}` },
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (res.ok) {
            deletedFromMeta = true;
          } else {
            const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
            metaError = body.error?.message ?? `Meta API error ${res.status}`;
          }
        }
      } catch (err) {
        metaError = err instanceof Error ? err.message : 'Failed to delete from Meta';
      }
    }

    // Always delete from local DB regardless of Meta result
    await pool.query(
      `DELETE FROM message_templates WHERE business_id = $1 AND name = $2 AND language = $3`,
      [businessId, templateName, language],
    );

    return { deletedLocally: true, deletedFromMeta, error: metaError };
  }

  async seedPlatformTemplates(businessId: string): Promise<number> {
    let created = 0;
    for (const tmpl of PLATFORM_TEMPLATES) {
      const existing = await this.getTemplate(businessId, tmpl.name);
      if (!existing) {
        await this.upsertTemplate(businessId, { ...tmpl, language: 'en_US' });
        created++;
      }
    }
    return created;
  }

  async sendTemplateMessage(
    businessId: string,
    to: string,
    templateName: string,
    params: string[],
    language = 'en_US',
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = await this.getTemplate(businessId, templateName, language);
    if (!template) return { success: false, error: `Template '${templateName}' not found.` };
    if (template.status !== 'APPROVED') {
      return { success: false, error: `Template '${templateName}' is not approved (status: ${template.status}).` };
    }

    const integration = await getCredentials(businessId);
    if (!integration) return { success: false, error: 'No WhatsApp integration.' };

    const { phoneNumberId, accessToken } = integration;
    const graphVersion = config.meta.graphApiVersion;

    // Build parameter components
    const components: Record<string, unknown>[] = [];

    if (params.length > 0) {
      components.push({
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: p })),
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components.length > 0 ? components : undefined,
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        },
      );

      const body = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } };

      if (!res.ok) {
        return { success: false, error: body.error?.message ?? `HTTP ${res.status}` };
      }

      return { success: true, messageId: body.messages?.[0]?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  private mapRow(row: Record<string, unknown>): MessageTemplate {
    return {
      id: String(row.id),
      businessId: String(row.business_id),
      name: String(row.name),
      category: row.category as TemplateCategory,
      language: String(row.language),
      status: row.status as TemplateStatus,
      metaTemplateId: row.meta_template_id ? String(row.meta_template_id) : null,
      headerType: row.header_type ? String(row.header_type) : null,
      headerText: row.header_text ? String(row.header_text) : null,
      bodyText: String(row.body_text),
      footerText: row.footer_text ? String(row.footer_text) : null,
      buttons: row.buttons ? (row.buttons as TemplateButton[]) : null,
      exampleParams: row.example_params ? (row.example_params as string[]) : null,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

export const templateService = new TemplateService();
