/**
 * Manual Intervention Service
 * Requirements: 8.1–8.5
 * Properties: 15, 16, 17
 */

import { pool } from '../../db/client.js';
import { sendMessage } from '../whatsapp/message-dispatcher.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InterventionLog {
  conversationId: string;
  manualInterventionActive: boolean;
  manualAgentId: string | null;
  interventionStart: Date | null;
  interventionEnd: Date | null;
}

// ─── Task 10.1: Activate Manual Intervention ─────────────────────────────────

/**
 * Activate manual intervention for a conversation.
 * Sets manual_intervention_active = true atomically, records start time and agent.
 * Property 15: AI must not dispatch while this flag is true.
 */
export async function activateIntervention(
  conversationId: string,
  businessId: string,
  agentId: string,
): Promise<void> {
  const result = await pool.query(
    `UPDATE conversations
     SET manual_intervention_active = TRUE,
         intervention_agent_id = $1,
         intervention_started_at = NOW(),
         intervention_ended_at = NULL,
         updated_at = NOW()
     WHERE id = $2 AND business_id = $3`,
    [agentId, conversationId, businessId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Conversation not found or access denied.');
  }
}

// ─── Task 10.1: Deactivate Manual Intervention ───────────────────────────────

/**
 * Deactivate manual intervention for a conversation.
 * Sets manual_intervention_active = false, records end time.
 * Property 16: AI resumes processing after this flag is cleared.
 */
export async function deactivateIntervention(
  conversationId: string,
  businessId: string,
): Promise<void> {
  const result = await pool.query(
    `UPDATE conversations
     SET manual_intervention_active = FALSE,
         intervention_ended_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Conversation not found or access denied.');
  }
}

// ─── Task 10.3: Send Agent Message During Intervention ───────────────────────

/**
 * Dispatch a message from a business agent to the customer via WhatsApp.
 * Only dispatches if manual_intervention_active = true for the conversation.
 */
export async function sendAgentMessage(
  conversationId: string,
  businessId: string,
  agentId: string,
  messageText: string,
): Promise<void> {
  const result = await pool.query<{
    customer_wa_number: string;
    manual_intervention_active: boolean;
  }>(
    `SELECT customer_wa_number, manual_intervention_active
     FROM conversations
     WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId],
  );

  if (result.rows.length === 0) {
    throw new Error('Conversation not found or access denied.');
  }

  const conversation = result.rows[0];

  if (!conversation.manual_intervention_active) {
    throw new Error('Manual intervention is not active for this conversation.');
  }

  await sendMessage(businessId, {
    type: 'text',
    to: conversation.customer_wa_number,
    body: messageText,
  });

  // Persist the agent message and update conversation message count
  await pool.query(
    `INSERT INTO messages (conversation_id, business_id, direction, message_type, content, created_at)
     VALUES ($1, $2, 'outbound', 'text', $3, NOW())`,
    [conversationId, businessId, messageText],
  );

  await pool.query(
    `UPDATE conversations SET message_count = message_count + 1, updated_at = NOW() WHERE id = $1`,
    [conversationId],
  );
}

// ─── Task 10.5: Intervention Session Log ─────────────────────────────────────

/**
 * Return the intervention log fields for a conversation.
 * Property 17: log has non-null start_time, end_time, agent_id after a complete session.
 */
export async function getInterventionLog(
  conversationId: string,
  businessId: string,
): Promise<InterventionLog> {
  const result = await pool.query<{
    id: string;
    manual_intervention_active: boolean;
    intervention_agent_id: string | null;
    intervention_started_at: Date | null;
    intervention_ended_at: Date | null;
  }>(
    `SELECT id, manual_intervention_active, intervention_agent_id,
            intervention_started_at, intervention_ended_at
     FROM conversations
     WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId],
  );

  if (result.rows.length === 0) {
    throw new Error('Conversation not found or access denied.');
  }

  const row = result.rows[0];
  return {
    conversationId: row.id,
    manualInterventionActive: row.manual_intervention_active,
    manualAgentId: row.intervention_agent_id,
    interventionStart: row.intervention_started_at,
    interventionEnd: row.intervention_ended_at,
  };
}
