import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../api';

interface Conversation {
  id: string;
  customerWaNumber: string;
  messageCount: number;
  manualInterventionActive: boolean;
  status: string;
  sessionStart: string;
  leadLabel: string | null;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: string;
}

const AGENT_ID = 'dashboard-agent';
const MAX_BROADCAST_LENGTH = 1000;

const LEAD_LABELS: Array<{ value: string | null; emoji: string; label: string; color: string; bg: string }> = [
  { value: 'hot',      emoji: '🔥', label: 'Hot',      color: '#c53030', bg: '#fff5f5' },
  { value: 'warm',     emoji: '🌡️', label: 'Warm',     color: '#c05621', bg: '#fffaf0' },
  { value: 'browsing', emoji: '👀', label: 'Browsing', color: '#2b6cb0', bg: '#ebf8ff' },
  { value: 'cold',     emoji: '❄️', label: 'Cold',     color: '#4a5568', bg: '#f7fafc' },
];

function LeadBadge({ label }: { label: string | null }) {
  if (!label) return null;
  const l = LEAD_LABELS.find(x => x.value === label);
  if (!l) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: l.bg, color: l.color, border: `1px solid ${l.color}30` }}>
      {l.emoji} {l.label}
    </span>
  );
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>({});
  const [convLoading, setConvLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [labelMenuOpen, setLabelMenuOpen] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null | 'all'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const expandedRef = useRef<Record<string, boolean>>({});

  // Broadcast state
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>('/dashboard/conversations');
      setConversations(data.conversations ?? []);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('session has expired')) setError(msg || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string, showLoading = false) => {
    if (showLoading) setConvLoading(prev => ({ ...prev, [convId]: true }));
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/dashboard/conversations/${convId}/messages`);
      const newMessages = data.messages ?? [];
      setConvMessages((prevMessages) => {
        const oldMessages = prevMessages[convId] ?? [];
        const hasNewMessages = newMessages.length > oldMessages.length;
        if (hasNewMessages) {
          setTimeout(() => {
            const el = threadRefs.current[convId];
            if (el) el.scrollTop = el.scrollHeight;
          }, 100);
        }
        return { ...prevMessages, [convId]: newMessages };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg && !msg.includes('session has expired') && !msg.includes('expired') && showLoading) {
        setActionError(`Failed to load messages: ${msg}`);
      }
    } finally {
      if (showLoading) setConvLoading(prev => ({ ...prev, [convId]: false }));
    }
  }, []);

  useEffect(() => {
    Object.keys(expanded).forEach((convId) => {
      if (expanded[convId]) {
        const el = threadRefs.current[convId];
        if (el) el.scrollTop = el.scrollHeight;
      }
    });
  }, [convMessages, expanded]);

  useEffect(() => {
    load();
    const listInterval = setInterval(load, 5_000);
    return () => clearInterval(listInterval);
  }, [load]);

  useEffect(() => {
    // Use ref so the interval always sees the latest expanded state without needing to restart
    const msgInterval = setInterval(() => {
      Object.keys(expandedRef.current).forEach((convId) => {
        if (expandedRef.current[convId]) loadMessages(convId);
      });
    }, 3_000);
    return () => clearInterval(msgInterval);
  }, [loadMessages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), ...Object.keys(expandedRef.current).filter(id => expandedRef.current[id]).map(id => loadMessages(id))]);
    } finally { setRefreshing(false); }
  };

  const toggleExpand = async (conv: Conversation) => {
    const next = !expanded[conv.id];
    expandedRef.current = { ...expandedRef.current, [conv.id]: next };
    setExpanded((e) => ({ ...e, [conv.id]: next }));
    if (next) await loadMessages(conv.id, true);
  };

  const toggleIntervention = async (conv: Conversation) => {
    setActionError('');
    try {
      if (conv.manualInterventionActive) {
        await apiFetch(`/conversations/${conv.id}/intervention/deactivate`, { method: 'POST' });
      } else {
        await apiFetch(`/conversations/${conv.id}/intervention/activate`, { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID }) });
      }
      await load();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Action failed'); }
  };

  const sendMessage = async (conv: Conversation) => {
    const text = messages[conv.id]?.trim();
    if (!text) return;
    setSending((s) => ({ ...s, [conv.id]: true }));
    setActionError('');
    try {
      await apiFetch(`/conversations/${conv.id}/intervention/message`, { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID, message: text }) });
      setMessages((m) => ({ ...m, [conv.id]: '' }));
      await Promise.all([loadMessages(conv.id, true), load()]);
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to send message'); }
    finally { setSending((s) => ({ ...s, [conv.id]: false })); }
  };

  const handleKeyDown = (e: React.KeyboardEvent, conv: Conversation) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(conv); }
  };

  const setLabel = async (convId: string, label: string | null) => {
    setLabelMenuOpen(null);
    try {
      await apiFetch(`/dashboard/conversations/${convId}/label`, { method: 'PATCH', body: JSON.stringify({ label }) });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, leadLabel: label } : c));
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to set label'); }
  };

  const toggleRecipient = (number: string) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number); else next.add(number);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredConversations.map(c => c.customerWaNumber);
    setSelectedRecipients(new Set(visible));
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim() || selectedRecipients.size === 0) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const result = await apiFetch<{ sent: number; failed: number }>('/dashboard/broadcast', {
        method: 'POST',
        body: JSON.stringify({ message: broadcastMsg, recipients: Array.from(selectedRecipients) }),
      });
      setBroadcastResult(result);
      setBroadcastMsg('');
      setSelectedRecipients(new Set());
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Broadcast failed'); }
    finally { setBroadcasting(false); }
  };

  const filteredConversations = filterLabel === 'all'
    ? conversations
    : conversations.filter(c => c.leadLabel === filterLabel);

  return (
    <div style={{ maxWidth: 820 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Active Conversations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>
            🟢 Live updates · Last refreshed: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setBroadcastOpen(b => !b); setBroadcastResult(null); }} style={{ ...ghostBtn, background: broadcastOpen ? '#ebf8ff' : undefined, color: broadcastOpen ? '#2b6cb0' : undefined }}>
            📢 Broadcast
          </button>
          <button onClick={handleRefresh} disabled={refreshing} style={{ ...primaryBtn, opacity: refreshing ? 0.7 : 1 }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>↻</span>
            {refreshing ? ' Refreshing…' : ' Refresh'}
          </button>
        </div>
      </div>

      {/* Lead filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilterLabel('all')} style={{ ...filterPill, background: filterLabel === 'all' ? '#2d3748' : '#f7fafc', color: filterLabel === 'all' ? '#fff' : '#4a5568', border: '1px solid #e2e8f0' }}>
          All ({conversations.length})
        </button>
        {LEAD_LABELS.map(l => {
          const count = conversations.filter(c => c.leadLabel === l.value).length;
          if (count === 0) return null;
          return (
            <button key={l.value} onClick={() => setFilterLabel(filterLabel === l.value ? 'all' : l.value)} style={{ ...filterPill, background: filterLabel === l.value ? l.color : l.bg, color: filterLabel === l.value ? '#fff' : l.color, border: `1px solid ${l.color}40` }}>
              {l.emoji} {l.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Broadcast panel */}
      {broadcastOpen && (
        <div style={{ background: '#fff', border: '1px solid #bee3f8', borderRadius: 10, padding: '18px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📢</span>
            <h3 style={{ margin: 0, fontSize: 15, color: '#1a202c' }}>Broadcast Message</h3>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#718096' }}>Send to multiple contacts at once</span>
          </div>

          {/* Recipient selection */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>Select Recipients ({selectedRecipients.size} selected)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={selectAll} style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>Select all visible</button>
                <button onClick={() => setSelectedRecipients(new Set())} style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>Clear</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto', padding: 8, background: '#f7fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {filteredConversations.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: `1px solid ${selectedRecipients.has(c.customerWaNumber) ? '#3182ce' : '#e2e8f0'}`, background: selectedRecipients.has(c.customerWaNumber) ? '#ebf8ff' : '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' }}>
                  <input type="checkbox" checked={selectedRecipients.has(c.customerWaNumber)} onChange={() => toggleRecipient(c.customerWaNumber)} style={{ accentColor: '#3182ce', width: 12, height: 12 }} />
                  {c.customerWaNumber}
                  {c.leadLabel && <span style={{ fontSize: 10 }}>{LEAD_LABELS.find(l => l.value === c.leadLabel)?.emoji}</span>}
                </label>
              ))}
              {filteredConversations.length === 0 && <span style={{ fontSize: 12, color: '#a0aec0' }}>No conversations to select</span>}
            </div>
          </div>

          {/* Message composer */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={labelStyle}>Message</label>
              <span style={{ fontSize: 11, color: broadcastMsg.length > MAX_BROADCAST_LENGTH ? '#c53030' : '#a0aec0' }}>
                {broadcastMsg.length}/{MAX_BROADCAST_LENGTH}
              </span>
            </div>
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="Type your broadcast message here… Keep it concise and relevant."
              maxLength={MAX_BROADCAST_LENGTH}
              rows={4}
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'sans-serif' }}
            />
          </div>

          {broadcastResult && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f0fff4', border: '1px solid #9ae6b4', fontSize: 13, color: '#276749', marginBottom: 10 }}>
              ✅ Sent to {broadcastResult.sent} contact{broadcastResult.sent !== 1 ? 's' : ''}{broadcastResult.failed > 0 ? ` · ${broadcastResult.failed} failed` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={sendBroadcast}
              disabled={broadcasting || !broadcastMsg.trim() || selectedRecipients.size === 0 || broadcastMsg.length > MAX_BROADCAST_LENGTH}
              style={{ ...primaryBtn, opacity: (broadcasting || !broadcastMsg.trim() || selectedRecipients.size === 0) ? 0.6 : 1 }}
            >
              {broadcasting ? '⏳ Sending…' : `📤 Send to ${selectedRecipients.size} contact${selectedRecipients.size !== 1 ? 's' : ''}`}
            </button>
            <span style={{ fontSize: 12, color: '#a0aec0' }}>Max 100 recipients · 1000 chars</span>
          </div>
        </div>
      )}

      {error && <p style={errorStyle}>{error}</p>}
      {actionError && (
        <div style={{ ...errorStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {actionError}
          <button onClick={() => setActionError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#c53030', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      {loading && <p style={{ color: '#718096' }}>Loading conversations…</p>}

      {!loading && filteredConversations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <p style={{ margin: 0 }}>{filterLabel === 'all' ? 'No active conversations yet.' : `No ${filterLabel} leads.`}</p>
        </div>
      )}

      {filteredConversations.map((conv) => (
        <div key={conv.id} style={cardStyle(conv.manualInterventionActive, conv.leadLabel)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{conv.customerWaNumber}</span>
                <span style={badgeStyle(conv.manualInterventionActive)}>
                  {conv.manualInterventionActive ? '🧑 Manual' : '🤖 AI'}
                </span>
                <LeadBadge label={conv.leadLabel} />
              </div>
              <div style={{ fontSize: 12, color: '#718096', marginTop: 3 }}>
                {conv.messageCount} messages · Started {new Date(conv.sessionStart).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Lead label picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setLabelMenuOpen(labelMenuOpen === conv.id ? null : conv.id)}
                  style={{ ...ghostBtn, fontSize: 12, padding: '5px 10px' }}
                  title="Set lead label"
                >
                  🏷️ {conv.leadLabel ? LEAD_LABELS.find(l => l.value === conv.leadLabel)?.emoji : '—'}
                </button>
                {labelMenuOpen === conv.id && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 140, overflow: 'hidden' }}>
                    {LEAD_LABELS.map(l => (
                      <button key={l.value} onClick={() => setLabel(conv.id, l.value)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: conv.leadLabel === l.value ? l.bg : 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: l.color, fontWeight: conv.leadLabel === l.value ? 600 : 400, textAlign: 'left' }}>
                        {l.emoji} {l.label}
                      </button>
                    ))}
                    <button onClick={() => setLabel(conv.id, null)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', borderTop: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 12, color: '#a0aec0', textAlign: 'left' }}>
                      ✕ Remove label
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => toggleExpand(conv)} style={ghostBtn}>
                {expanded[conv.id] ? 'Hide' : 'View'}
              </button>
              <button onClick={() => toggleIntervention(conv)} style={conv.manualInterventionActive ? successBtn : dangerBtn}>
                {conv.manualInterventionActive ? 'Hand back to AI' : 'Take over'}
              </button>
            </div>
          </div>

          {expanded[conv.id] && (
            <div style={{ marginTop: 12 }}>
              <div ref={(el) => { threadRefs.current[conv.id] = el; }} style={threadStyle}>
                {convLoading[conv.id] ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0', color: '#718096', fontSize: 13 }}>
                    <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #cbd5e0', borderTopColor: '#3182ce', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Loading messages…
                  </div>
                ) : (convMessages[conv.id] ?? []).length === 0 ? (
                  <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', margin: '12px 0' }}>No messages yet.</p>
                ) : (
                  (convMessages[conv.id] ?? []).map((msg) => (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      <div style={bubbleStyle(msg.direction)}>
                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        <div style={{ fontSize: 11, color: msg.direction === 'outbound' ? 'rgba(255,255,255,0.7)' : '#a0aec0', marginTop: 2 }}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {conv.manualInterventionActive ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="Type a message… (Enter to send)"
                    value={messages[conv.id] ?? ''}
                    onChange={(e) => setMessages((m) => ({ ...m, [conv.id]: e.target.value }))}
                    onKeyDown={(e) => handleKeyDown(e, conv)}
                    style={inputStyle}
                    autoFocus
                  />
                  <button onClick={() => sendMessage(conv)} disabled={sending[conv.id] || !messages[conv.id]?.trim()} style={primaryBtn}>
                    {sending[conv.id] ? '…' : 'Send'}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 8, marginBottom: 0 }}>
                  Click "Take over" to send messages as an agent.
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Close label menu on outside click */}
      {labelMenuOpen && <div onClick={() => setLabelMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
    </div>
  );
}

const LEAD_BORDER: Record<string, string> = { hot: '#fc8181', warm: '#f6ad55', browsing: '#63b3ed', cold: '#cbd5e0' };

const cardStyle = (intervention: boolean, leadLabel: string | null): React.CSSProperties => ({
  border: `1px solid ${intervention ? '#feb2b2' : leadLabel ? LEAD_BORDER[leadLabel] ?? '#e2e8f0' : '#e2e8f0'}`,
  borderLeft: `4px solid ${intervention ? '#e53e3e' : leadLabel === 'hot' ? '#e53e3e' : leadLabel === 'warm' ? '#dd6b20' : leadLabel === 'browsing' ? '#3182ce' : leadLabel === 'cold' ? '#718096' : '#3182ce'}`,
  borderRadius: 8, padding: '14px 16px', marginBottom: 12,
  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
});
const badgeStyle = (intervention: boolean): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
  background: intervention ? '#fed7d7' : '#ebf8ff',
  color: intervention ? '#c53030' : '#2b6cb0',
});
const filterPill: React.CSSProperties = { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' };
const threadStyle: React.CSSProperties = { background: '#f7fafc', borderRadius: 6, padding: '10px 12px', maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0' };
const bubbleStyle = (direction: 'inbound' | 'outbound'): React.CSSProperties => ({
  maxWidth: '72%', padding: '8px 12px',
  borderRadius: direction === 'outbound' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
  background: direction === 'outbound' ? '#3182ce' : '#edf2f7',
  color: direction === 'outbound' ? '#fff' : '#2d3748',
});
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568' };
const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, outline: 'none' };
const primaryBtn: React.CSSProperties = { padding: '7px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 };
const ghostBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#4a5568' };
const dangerBtn: React.CSSProperties = { padding: '6px 12px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const successBtn: React.CSSProperties = { padding: '6px 12px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const errorStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
