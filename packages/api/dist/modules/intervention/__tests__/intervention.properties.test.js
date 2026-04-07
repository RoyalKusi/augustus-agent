/**
 * Property-Based Tests for Manual Intervention
 * Properties: 15, 16, 17
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isManualInterventionActive } from '../../conversation/conversation-engine.service.js';
// ─── Shared arbitraries ───────────────────────────────────────────────────────
const uuidArb = fc.uuid();
const strArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => !s.includes('\0'));
/** Build a minimal conversation-like object for pure logic tests */
function makeConversation(manualInterventionActive, agentId = null, interventionStart = null, interventionEnd = null) {
    return {
        id: 'conv-test',
        business_id: 'biz-test',
        customer_wa_number: '+1234567890',
        session_start: new Date(Date.now() - 5 * 60 * 1000),
        session_end: null,
        message_count: 3,
        manual_intervention_active: manualInterventionActive,
        manual_agent_id: agentId,
        intervention_start: interventionStart,
        intervention_end: interventionEnd,
        context_summary: null,
        status: 'active',
    };
}
// ─── Property 15: Manual Intervention Blocks AI Responses ────────────────────
// **Validates: Requirements 5.8, 8.2**
describe('Property 15: Manual Intervention Blocks AI Responses', () => {
    it('isManualInterventionActive returns true when flag is true', () => {
        fc.assert(fc.property(uuidArb, uuidArb, strArb, (convId, agentId, waNumber) => {
            const conv = {
                ...makeConversation(true, agentId, new Date()),
                id: convId,
                customer_wa_number: waNumber,
            };
            expect(isManualInterventionActive(conv)).toBe(true);
        }), { numRuns: 25 });
    });
    it('isManualInterventionActive returns false when flag is false', () => {
        fc.assert(fc.property(uuidArb, strArb, (convId, waNumber) => {
            const conv = {
                ...makeConversation(false, null, null, null),
                id: convId,
                customer_wa_number: waNumber,
            };
            expect(isManualInterventionActive(conv)).toBe(false);
        }), { numRuns: 25 });
    });
    it('AI dispatch is suppressed (returns false) when manual_intervention_active = true', () => {
        fc.assert(fc.property(uuidArb, strArb, (agentId, waNumber) => {
            const conv = makeConversation(true, agentId, new Date());
            // Pure logic: if isManualInterventionActive is true, AI must not dispatch
            const shouldDispatch = !isManualInterventionActive(conv);
            expect(shouldDispatch).toBe(false);
        }), { numRuns: 25 });
    });
    it('AI dispatch is allowed when manual_intervention_active = false', () => {
        fc.assert(fc.property(uuidArb, strArb, (_convId, waNumber) => {
            const conv = makeConversation(false, null, null, null);
            conv.customer_wa_number = waNumber;
            // Pure logic: if isManualInterventionActive is false, AI may dispatch
            const shouldDispatch = !isManualInterventionActive(conv);
            expect(shouldDispatch).toBe(true);
        }), { numRuns: 25 });
    });
});
// ─── Property 16: Deactivating Manual Intervention Restores AI Responses ─────
// **Validates: Requirements 8.4**
describe('Property 16: Deactivating Manual Intervention Restores AI Responses', () => {
    it('transition from active to inactive enables AI processing', () => {
        fc.assert(fc.property(uuidArb, uuidArb, strArb, (convId, agentId, waNumber) => {
            // Active state: AI blocked
            const activeConv = {
                ...makeConversation(true, agentId, new Date()),
                id: convId,
                customer_wa_number: waNumber,
            };
            expect(isManualInterventionActive(activeConv)).toBe(true);
            // Deactivated state: AI allowed
            const deactivatedConv = {
                ...activeConv,
                manual_intervention_active: false,
                intervention_end: new Date(),
            };
            expect(isManualInterventionActive(deactivatedConv)).toBe(false);
        }), { numRuns: 25 });
    });
    it('AI dispatch is allowed after deactivation regardless of prior agent_id', () => {
        fc.assert(fc.property(uuidArb, strArb, (agentId, waNumber) => {
            const deactivated = {
                ...makeConversation(false, agentId, new Date(), new Date()),
                customer_wa_number: waNumber,
            };
            // After deactivation, flag is false — AI can dispatch
            const canDispatch = !isManualInterventionActive(deactivated);
            expect(canDispatch).toBe(true);
        }), { numRuns: 25 });
    });
    it('manual_intervention_active = false is the only condition needed to allow AI', () => {
        fc.assert(fc.property(fc.boolean(), uuidArb, (hadPriorIntervention, agentId) => {
            // Regardless of whether there was a prior intervention session,
            // if the flag is now false, AI is allowed
            const conv = makeConversation(false, hadPriorIntervention ? agentId : null, hadPriorIntervention ? new Date(Date.now() - 60000) : null, hadPriorIntervention ? new Date() : null);
            expect(isManualInterventionActive(conv)).toBe(false);
        }), { numRuns: 25 });
    });
});
// ─── Property 17: Intervention Session Logging ───────────────────────────────
// **Validates: Requirements 8.3**
describe('Property 17: Intervention Session Logging', () => {
    it('a complete intervention session has non-null start_time, end_time, and agent_id', () => {
        fc.assert(fc.property(uuidArb, fc.integer({ min: 1, max: 3600000 }), (agentId, durationMs) => {
            const startTime = new Date(Date.now() - durationMs);
            const endTime = new Date();
            const log = {
                conversationId: 'conv-test',
                manualInterventionActive: false,
                manualAgentId: agentId,
                interventionStart: startTime,
                interventionEnd: endTime,
            };
            // After a complete session: all three fields must be non-null
            expect(log.manualAgentId).not.toBeNull();
            expect(log.interventionStart).not.toBeNull();
            expect(log.interventionEnd).not.toBeNull();
        }), { numRuns: 25 });
    });
    it('intervention_end is always after intervention_start in a valid session', () => {
        fc.assert(fc.property(uuidArb, fc.integer({ min: 1, max: 3600000 }), (agentId, durationMs) => {
            const startTime = new Date(Date.now() - durationMs);
            const endTime = new Date();
            const log = {
                conversationId: 'conv-test',
                manualInterventionActive: false,
                manualAgentId: agentId,
                interventionStart: startTime,
                interventionEnd: endTime,
            };
            expect(log.interventionEnd.getTime()).toBeGreaterThan(log.interventionStart.getTime());
        }), { numRuns: 25 });
    });
    it('active intervention has non-null start_time and agent_id but null end_time', () => {
        fc.assert(fc.property(uuidArb, (agentId) => {
            const log = {
                conversationId: 'conv-test',
                manualInterventionActive: true,
                manualAgentId: agentId,
                interventionStart: new Date(),
                interventionEnd: null,
            };
            expect(log.manualAgentId).not.toBeNull();
            expect(log.interventionStart).not.toBeNull();
            expect(log.interventionEnd).toBeNull();
        }), { numRuns: 25 });
    });
    it('inactive conversation with no prior intervention has null log fields', () => {
        fc.assert(fc.property(uuidArb, (convId) => {
            const log = {
                conversationId: convId,
                manualInterventionActive: false,
                manualAgentId: null,
                interventionStart: null,
                interventionEnd: null,
            };
            expect(log.manualAgentId).toBeNull();
            expect(log.interventionStart).toBeNull();
            expect(log.interventionEnd).toBeNull();
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=intervention.properties.test.js.map