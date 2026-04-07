/**
 * Manual Intervention Service
 * Requirements: 8.1–8.5
 * Properties: 15, 16, 17
 */
export interface InterventionLog {
    conversationId: string;
    manualInterventionActive: boolean;
    manualAgentId: string | null;
    interventionStart: Date | null;
    interventionEnd: Date | null;
}
/**
 * Activate manual intervention for a conversation.
 * Sets manual_intervention_active = true atomically, records start time and agent.
 * Property 15: AI must not dispatch while this flag is true.
 */
export declare function activateIntervention(conversationId: string, businessId: string, agentId: string): Promise<void>;
/**
 * Deactivate manual intervention for a conversation.
 * Sets manual_intervention_active = false, records end time.
 * Property 16: AI resumes processing after this flag is cleared.
 */
export declare function deactivateIntervention(conversationId: string, businessId: string): Promise<void>;
/**
 * Dispatch a message from a business agent to the customer via WhatsApp.
 * Only dispatches if manual_intervention_active = true for the conversation.
 */
export declare function sendAgentMessage(conversationId: string, businessId: string, agentId: string, messageText: string): Promise<void>;
/**
 * Return the intervention log fields for a conversation.
 * Property 17: log has non-null start_time, end_time, agent_id after a complete session.
 */
export declare function getInterventionLog(conversationId: string, businessId: string): Promise<InterventionLog>;
//# sourceMappingURL=intervention.service.d.ts.map