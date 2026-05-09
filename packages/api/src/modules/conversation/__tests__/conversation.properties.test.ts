import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as fc from 'fast-check';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.CLAUDE_MODEL = 'claude-sonnet-4-6';
  process.env.CLAUDE_API_KEY = 'test-key';
});

vi.mock('../../../db/client.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../../../redis/conversation.js', () => ({
  getConversationContext: vi.fn(),
  appendMessage: vi.fn(),
  clearConversationContext: vi.fn(),
}));
vi.mock('../../token-budget/token-budget.service.js', () => ({
  checkBudget: vi.fn(),
  recordInferenceCost: vi.fn(),
  shouldSendUnavailabilityMessage: vi.fn(),
}));
vi.mock('../../whatsapp/message-dispatcher.js', () => ({ sendMessage: vi.fn(), sendTypingIndicator: vi.fn().mockResolvedValue(undefined) }));

import { pool } from '../../../db/client.js';
import * as redisConv from '../../../redis/conversation.js';
import * as tokenBudget from '../../token-budget/token-budget.service.js';
import { sendMessage } from '../../whatsapp/message-dispatcher.js';
import {
  filterContextWindow, isManualInterventionActive, buildSystemPrompt,
  detectLanguage, parseClaudeResponse, isSessionExpired,
  CLAUDE_SONNET_MODEL, MAX_CONTEXT_MESSAGES, CONTEXT_WINDOW_MS,
  processInboundMessage, type ConversationRow, type InboundMessage,
} from '../conversation-engine.service.js';

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

const strArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => !s.includes('\0'));
const uuidArb = fc.uuid();
const msgArb = (nowMs: number) =>
  fc.record({ role: fc.constantFrom('user' as const, 'assistant' as const), content: strArb, ageMs: fc.integer({ min: 0, max: 7200000 }) })
    .map(({ role, content, ageMs }) => ({ role, content, timestamp: nowMs - ageMs }));
const msgListArb = (nowMs: number) => fc.array(msgArb(nowMs), { minLength: 0, maxLength: 50 });
const convRowArb = (manual: boolean) =>
  fc.record({ id: uuidArb, business_id: uuidArb, customer_wa_number: strArb, message_count: fc.integer({ min: 0, max: 100 }) })
    .map((r): ConversationRow => ({ ...r, session_start: new Date(Date.now() - 30 * 60 * 1000), session_end: null, manual_intervention_active: manual, manual_agent_id: null, intervention_start: null, intervention_end: null, context_summary: null, status: 'active' }));

function makeConv(manual: boolean, overrides: Partial<ConversationRow> = {}): ConversationRow {
  return { id: 'conv-test', business_id: 'biz-test', customer_wa_number: '+1234567890', session_start: new Date(Date.now() - 5 * 60 * 1000), session_end: null, message_count: 3, manual_intervention_active: manual, manual_agent_id: manual ? 'agent-1' : null, intervention_start: manual ? new Date() : null, intervention_end: null, context_summary: null, status: 'active', ...overrides };
}

// Property 13: Claude Sonnet Is the Inference Model
// Feature: augustus-ai-sales-platform, Property 13: Claude Sonnet Is the Inference Model
// **Validates: Requirements 5.3**
describe('Property 13: Claude Sonnet Is the Inference Model', () => {
  it('CLAUDE_SONNET_MODEL is set to claude-sonnet-4-6', () => { expect(CLAUDE_SONNET_MODEL).toBe('claude-sonnet-4-6'); });
  it('model parameter sent to Claude API always equals CLAUDE_SONNET_MODEL', async () => {
    await fc.assert(fc.asyncProperty(strArb, strArb, async (sp, um) => {
      let body: Record<string, unknown> | null = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_u, init) => { body = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 }); });
      const { callClaudeSonnet } = await import('../conversation-engine.service.js');
      await callClaudeSonnet(sp, [], um);
      expect(body).not.toBeNull(); expect(body!['model']).toBe(CLAUDE_SONNET_MODEL);
    }), { numRuns: 25 });
  });
  it('model is never gpt', async () => {
    await fc.assert(fc.asyncProperty(strArb, strArb, async (sp, um) => {
      let m: string | null = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_u, init) => { m = (JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>)['model'] as string; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 5, output_tokens: 3 } }), { status: 200 }); });
      const { callClaudeSonnet } = await import('../conversation-engine.service.js');
      await callClaudeSonnet(sp, [], um);
      expect(m).not.toBeNull(); expect(m!.toLowerCase()).not.toContain('gpt');
    }), { numRuns: 25 });
  });
});

// Property 14: Session Context Window Boundary
// Feature: augustus-ai-sales-platform, Property 14: Session Context Window Boundary
// **Validates: Requirements 5.6**
describe('Property 14: Session Context Window Boundary', () => {
  it('filtered context never exceeds 30 messages', () => { const n = Date.now(); fc.assert(fc.property(msgListArb(n), (msgs) => { expect(filterContextWindow(msgs, n).length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES); }), { numRuns: 25 }); });
  it('filtered context never contains messages older than 60 minutes', () => { const n = Date.now(); fc.assert(fc.property(msgListArb(n), (msgs) => { const r = filterContextWindow(msgs, n); const c = n - CONTEXT_WINDOW_MS; for (const m of r) expect(m.timestamp).toBeGreaterThanOrEqual(c); }), { numRuns: 25 }); });
  it('result satisfies both constraints simultaneously', () => { const n = Date.now(); fc.assert(fc.property(msgListArb(n), (msgs) => { const r = filterContextWindow(msgs, n); const c = n - CONTEXT_WINDOW_MS; expect(r.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES); for (const m of r) expect(m.timestamp).toBeGreaterThanOrEqual(c); }), { numRuns: 25 }); });
  it('message exactly at 60-minute boundary is included', () => { const n = Date.now(); expect(filterContextWindow([{ role: 'user' as const, content: 'b', timestamp: n - CONTEXT_WINDOW_MS }], n).length).toBe(1); });
  it('message 1ms past 60-minute boundary is excluded', () => { const n = Date.now(); expect(filterContextWindow([{ role: 'user' as const, content: 'o', timestamp: n - CONTEXT_WINDOW_MS - 1 }], n).length).toBe(0); });
  it('when 40 messages in window, only most recent 30 returned', () => { const n = Date.now(); const msgs = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, content: 'x', timestamp: n - (39 - i) * 1000 })); const r = filterContextWindow(msgs, n); expect(r.length).toBe(MAX_CONTEXT_MESSAGES); const expected30 = msgs.slice(10); expect(r.map((m) => m.timestamp)).toEqual(expected30.map((m) => m.timestamp)); });
  it('isSessionExpired true at 30 messages', () => { const n = Date.now(); expect(isSessionExpired(30, n - 10 * 60 * 1000, n)).toBe(true); });
  it('isSessionExpired true at 60 minutes', () => { const n = Date.now(); expect(isSessionExpired(5, n - CONTEXT_WINDOW_MS, n)).toBe(true); });
  it('isSessionExpired false below both thresholds', () => { fc.assert(fc.property(fc.integer({ min: 0, max: 29 }), fc.integer({ min: 0, max: 59 }), (mc, am) => { const n = Date.now(); expect(isSessionExpired(mc, n - am * 60 * 1000, n)).toBe(false); }), { numRuns: 25 }); });
});

// Property 15: Manual Intervention Blocks AI Responses
// Feature: augustus-ai-sales-platform, Property 15: Manual Intervention Blocks AI Responses
// **Validates: Requirements 5.8, 8.2**
describe('Property 15: Manual Intervention Blocks AI Responses', () => {
  it('isManualInterventionActive true when flag is true', () => { fc.assert(fc.property(convRowArb(true), (c) => { expect(isManualInterventionActive(c)).toBe(true); }), { numRuns: 25 }); });
  it('isManualInterventionActive false when flag is false', () => { fc.assert(fc.property(convRowArb(false), (c) => { expect(isManualInterventionActive(c)).toBe(false); }), { numRuns: 25 }); });
  it('processInboundMessage dispatches no AI message when manual_intervention_active = true', async () => {
    await fc.assert(fc.asyncProperty(uuidArb, strArb, strArb, async (bid, cwa, mt) => {
      vi.mocked(pool.query).mockReset();
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [makeConv(true, { id: 'c1', business_id: bid, customer_wa_number: cwa })], rowCount: 1 } as never);
      // INSERT inbound message + UPDATE message_count
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as never);
      vi.mocked(sendMessage).mockReset();
      const r = await processInboundMessage({ businessId: bid, customerWaNumber: cwa, messageText: mt, messageId: 'm1', timestamp: Date.now() } as InboundMessage);
      expect(r.dispatched).toBe(false); expect(r.skippedManualIntervention).toBe(true); expect(sendMessage).not.toHaveBeenCalled();
    }), { numRuns: 25 });
  });
  it('no Claude API fetch when manual intervention active', async () => {
    await fc.assert(fc.asyncProperty(uuidArb, strArb, strArb, async (bid, cwa, mt) => {
      vi.mocked(pool.query).mockReset();
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [makeConv(true, { id: 'c2', business_id: bid, customer_wa_number: cwa })], rowCount: 1 } as never);
      vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as never);
      const spy = vi.spyOn(globalThis, 'fetch');
      await processInboundMessage({ businessId: bid, customerWaNumber: cwa, messageText: mt, messageId: 'm2', timestamp: Date.now() } as InboundMessage);
      expect(spy.mock.calls.filter((c) => typeof c[0] === 'string' && (c[0] as string).includes('anthropic.com')).length).toBe(0);
    }), { numRuns: 25 });
  });
});

// Property 16: Deactivating Manual Intervention Restores AI Responses
// Feature: augustus-ai-sales-platform, Property 16: Deactivating Manual Intervention Restores AI Responses
// **Validates: Requirements 8.4**
describe('Property 16: Deactivating Manual Intervention Restores AI Responses', () => {
  it('isManualInterventionActive false after deactivation', () => { fc.assert(fc.property(convRowArb(false), (c) => { expect(isManualInterventionActive(c)).toBe(false); }), { numRuns: 25 }); });
  it('transition active->inactive enables AI processing', () => {
    fc.assert(fc.property(fc.record({ id: uuidArb, business_id: uuidArb, customer_wa_number: strArb, message_count: fc.integer({ min: 0, max: 10 }) }), (base) => {
      const a: ConversationRow = { ...base, session_start: new Date(), session_end: null, manual_intervention_active: true, manual_agent_id: 'a1', intervention_start: new Date(), intervention_end: null, context_summary: null, status: 'active' };
      const d: ConversationRow = { ...a, manual_intervention_active: false, intervention_end: new Date() };
      expect(isManualInterventionActive(a)).toBe(true); expect(isManualInterventionActive(d)).toBe(false);
    }), { numRuns: 25 });
  });
  it('processInboundMessage proceeds to AI when manual_intervention_active = false', async () => {
    await fc.assert(fc.asyncProperty(uuidArb, strArb, strArb, async (bid, cwa, mt) => {
      const mq = vi.mocked(pool.query); mq.mockReset();
      // getOrCreateConversation
      mq.mockResolvedValueOnce({ rows: [makeConv(false, { id: 'c3', business_id: bid, customer_wa_number: cwa, message_count: 2 })], rowCount: 1 } as never);
      vi.mocked(tokenBudget.checkBudget).mockResolvedValueOnce({ allowed: true, remainingUsd: 10, accumulatedCostUsd: 0, capUsd: 10, suspended: false });
      vi.mocked(redisConv.getConversationContext).mockResolvedValueOnce([]);
      // Parallel queries: loadTrainingData, loadInStockProducts, settingsResult, updatedConv, pastSessionsResult
      mq.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // training data
      mq.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // products
      mq.mockResolvedValueOnce({ rows: [{ in_chat_payments_enabled: true, external_payment_details: null }], rowCount: 1 } as never); // settings
      mq.mockResolvedValueOnce({ rows: [{ context_summary: null }], rowCount: 1 } as never); // updatedConv
      mq.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never); // pastSessions
      // lastMessageResult
      mq.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // Claude API call
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hi!' }], usage: { input_tokens: 50, output_tokens: 20 } }), { status: 200 }));
      // getBusinessEmail
      mq.mockResolvedValueOnce({ rows: [{ email: 'b@e.com' }], rowCount: 1 } as never);
      vi.mocked(tokenBudget.recordInferenceCost).mockResolvedValueOnce({ allowed: true, remainingUsd: 9.99, accumulatedCostUsd: 0.01, capUsd: 10, suspended: false });
      vi.mocked(sendMessage).mockResolvedValueOnce({ success: true, messageId: 'o1' });
      // persistConversationTurn (2 inserts + 1 update)
      mq.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
      mq.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
      mq.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
      vi.mocked(redisConv.appendMessage).mockResolvedValue(undefined);
      const r = await processInboundMessage({ businessId: bid, customerWaNumber: cwa, messageText: mt, messageId: 'm3', timestamp: Date.now() } as InboundMessage);
      expect(r.dispatched).toBe(true); expect(r.skippedManualIntervention).toBeUndefined(); expect(sendMessage).toHaveBeenCalled();
    }), { numRuns: 25 });
  });
});

describe('buildSystemPrompt', () => {
  it('always includes non-disclosure instruction', () => { fc.assert(fc.property(fc.constantFrom('English', 'French', 'Spanish'), fc.option(strArb, { nil: null }), (lang, cs) => { const p = buildSystemPrompt(null, [], lang, cs); expect(p.toLowerCase()).toContain('never reveal'); expect(p.toLowerCase()).toContain('instructions'); }), { numRuns: 25 }); });
  it('always includes language instruction', () => { fc.assert(fc.property(fc.constantFrom('English', 'French', 'Spanish', 'Arabic', 'Chinese'), (lang) => { const p = buildSystemPrompt(null, [], lang, null); expect(p).toContain(lang); expect(p.toLowerCase()).toContain('reply only in'); }), { numRuns: 25 }); });
});

describe('parseClaudeResponse', () => {
  it('parses CAROUSEL_TRIGGER correctly', () => { fc.assert(fc.property(fc.array(uuidArb, { minLength: 1, maxLength: 10 }), strArb, (ids, prefix) => { const a = parseClaudeResponse(prefix + ' CAROUSEL_TRIGGER:[' + ids.join(',') + ']'); expect(a.type).toBe('carousel'); expect(a.products).toEqual(ids); }), { numRuns: 25 }); });
  it('returns text action for plain responses', () => { fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('CAROUSEL_TRIGGER') && !s.includes('PAYMENT_TRIGGER')), (text) => { const a = parseClaudeResponse(text); expect(a.type).toBe('text'); expect(a.text).toBe(text); }), { numRuns: 25 }); });
});

describe('detectLanguage', () => {
  it('detects Chinese', () => { expect(detectLanguage('\u4e2d\u6587')).toBe('Chinese'); });
  it('detects Arabic', () => { expect(detectLanguage('\u0645\u0631\u062d\u0628\u0627')).toBe('Arabic'); });
  it('defaults to English for ASCII', () => { fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[\x20-\x7e]+$/.test(s)), (t) => { expect(detectLanguage(t)).toBe('English'); }), { numRuns: 25 }); });
});



