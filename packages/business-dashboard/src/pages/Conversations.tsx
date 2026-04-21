import { useEffect, useState, useRef } from 'react';

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

// Detect if a message contains a product listing (numbered list with prices)
function parseProductList(text: string): Array<{ name: string; price: string }> | null {
  const lines = text.split('\n').filter(l => l.trim());
  const productLines = lines.filter(l => /^\d+\.\s+.+\s+[A-Z]{3}\s+[\d.]+/.test(l) || /^\d+\.\s+\*?.+\*?\s+—\s+[A-Z]{3}/.test(l));
  if (productLines.length < 2) return null;
  return productLines.map(l => {
    const match = l.match(/^\d+\.\s+\*?([^*\n—]+)\*?\s*(?:—\s*)?([A-Z]{3}\s+[\d.]+)/);
    return match ? { name: match[1].trim(), price: match[2].trim() } : { name: l.replace(/^\d+\.\s+/, ''), price: '' };
  });
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  const products = isOut ? parseProductList(msg.content) : null;
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (products && products.length >= 2) {
    // Render as product pill cards
    const headerText = msg.content.split('\n')[0].replace(/[*_]/g, '');
    return (
      <div style={{ maxWidth: 280 }}>
        <div style={{ background: '#ebf8ff', borderRadius: '12px 12px 2px 12px', padding: '10px 12px', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#2b6cb0', fontWeight: 600, marginBottom: 8 }}>{headerText}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {products.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #bee3f8' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2d3748' }}>{p.name}</span>
                {p.price && <span style={{ fontSize: 12, color: '#3182ce', fontWeight: 700, marginLeft: 8, whiteSpace: 'nowrap' }}>{p.price}</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#90cdf4', marginTop: 6, textAlign: 'right' }}>{time}</div>
        </div>
      </div>
    );
  }

  // Standard bubble
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      background: isOut ? '#3182ce' : '#edf2f7',
      color: isOut ? '#fff' : '#2d3748',
    }}>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
      <div style={{ fontSize: 11, color: isOut ? 'rgba(255,255,255,0.7)' : '#a0aec0', marginTop: 2 }}>{time}</div>
    </div>
  );
}

const AGENT_ID = 'dashboard-agent';

const LEAD_LABELS = [
  { value: 'hot',      emoji: '🔥', label: 'Hot',      color: '#c53030', bg: '#fff5f5' },
  { value: 'warm',     emoji: '🌡️', label: 'Warm',     color: '#c05621', bg: '#fffaf0' },
  { value: 'browsing', emoji: '👀', label: 'Browsing', color: '#2b6cb0', bg: '#ebf8ff' },
  { value: 'cold',     emoji: '❄️', label: 'Cold',     color: '#4a5568', bg: '#f7fafc' },
];

// Simple direct fetch — no wrappers, no token expiry checks, just raw fetch
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('augustus_token') ?? '';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [msgInput, setMsgInput] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [convMessages, setConvMessages] = useState<Record<string, Message[] | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const expandedRef = useRef<Record<string, boolean>>({});

  // Load conversations list
  const loadConvs = async () => {
    try {
      const data = await api<{ conversations: Conversation[] }>('/dashboard/conversations');
      setConversations(data.conversations ?? []);
      setLastUpdate(new Date());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  // Load messages for one conversation
  const loadMsgs = async (convId: string) => {
    try {
      const data = await api<{ messages: Message[] }>(`/dashboard/conversations/${convId}/messages`);
      const msgs = data.messages ?? [];
      setConvMessages(prev => ({ ...prev, [convId]: msgs }));
      // Always scroll to bottom after loading
      setTimeout(() => {
        const el = threadRefs.current[convId];
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    } catch (e) {
      console.error('loadMsgs error', convId, e);
    }
  };

  // Poll conversations every 5s
  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 5000);
    return () => clearInterval(t);
  }, []);

  // Poll messages for expanded conversations every 3s
  useEffect(() => {
    const t = setInterval(() => {
      Object.keys(expandedRef.current).forEach(id => {
        if (expandedRef.current[id]) loadMsgs(id);
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const toggleExpand = async (conv: Conversation) => {
    const next = !expanded[conv.id];
    expandedRef.current[conv.id] = next;
    setExpanded(e => ({ ...e, [conv.id]: next }));
    if (next) {
      setConvMessages(prev => ({ ...prev, [conv.id]: null })); // null = loading
      await loadMsgs(conv.id);
    }
  };

  const toggleIntervention = async (conv: Conversation) => {
    setActionError('');
    try {
      if (conv.manualInterventionActive) {
        await api(`/conversations/${conv.id}/intervention/deactivate`, { method: 'POST' });
      } else {
        await api(`/conversations/${conv.id}/intervention/activate`, { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID }) });
      }
      await loadConvs();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Failed'); }
  };

  const sendMessage = async (conv: Conversation) => {
    const text = msgInput[conv.id]?.trim();
    if (!text) return;
    setSending(s => ({ ...s, [conv.id]: true }));
    setActionError('');
    try {
      await api(`/conversations/${conv.id}/intervention/message`, { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID, message: text }) });
      setMsgInput(m => ({ ...m, [conv.id]: '' }));
      await loadMsgs(conv.id);
      await loadConvs();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Failed to send'); }
    finally { setSending(s => ({ ...s, [conv.id]: false })); }
  };

  const setLabel = async (convId: string, label: string | null) => {
    try {
      await api(`/dashboard/conversations/${convId}/label`, { method: 'PATCH', body: JSON.stringify({ label }) });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, leadLabel: label } : c));
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Failed'); }
  };

  const filtered = filterLabel === 'all' ? conversations : conversations.filter(c => c.leadLabel === filterLabel);

  return (
    <div style={{ maxWidth: 820 }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Active Conversations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>🟢 Live · {lastUpdate.toLocaleTimeString()}</p>
        </div>
        <button onClick={loadConvs} style={primaryBtn}>↻ Refresh</button>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilterLabel('all')} style={{ ...pill, background: filterLabel === 'all' ? '#2d3748' : '#f7fafc', color: filterLabel === 'all' ? '#fff' : '#4a5568', border: '1px solid #e2e8f0' }}>
          All ({conversations.length})
        </button>
        {LEAD_LABELS.map(l => {
          const cnt = conversations.filter(c => c.leadLabel === l.value).length;
          if (!cnt) return null;
          return (
            <button key={l.value} onClick={() => setFilterLabel(filterLabel === l.value ? 'all' : l.value)}
              style={{ ...pill, background: filterLabel === l.value ? l.color : l.bg, color: filterLabel === l.value ? '#fff' : l.color, border: `1px solid ${l.color}40` }}>
              {l.emoji} {l.label} ({cnt})
            </button>
          );
        })}
      </div>

      {error && <p style={errStyle}>{error}</p>}
      {actionError && <p style={{ ...errStyle, marginBottom: 12 }}>{actionError} <button onClick={() => setActionError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#c53030' }}>×</button></p>}
      {loading && <p style={{ color: '#718096' }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0' }}>
          <div style={{ fontSize: 40 }}>💬</div>
          <p style={{ margin: 0 }}>No conversations yet.</p>
        </div>
      )}

      {filtered.map(conv => (
        <div key={conv.id} style={card(conv.manualInterventionActive, conv.leadLabel)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{conv.customerWaNumber}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: conv.manualInterventionActive ? '#fed7d7' : '#ebf8ff', color: conv.manualInterventionActive ? '#c53030' : '#2b6cb0' }}>
                  {conv.manualInterventionActive ? '🧑 Manual' : '🤖 AI'}
                </span>
                {conv.leadLabel && (() => { const l = LEAD_LABELS.find(x => x.value === conv.leadLabel); return l ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: l.bg, color: l.color }}>{l.emoji} {l.label}</span> : null; })()}
              </div>
              <div style={{ fontSize: 12, color: '#718096', marginTop: 3 }}>
                {conv.messageCount} messages · {new Date(conv.sessionStart).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Label picker */}
              <select value={conv.leadLabel ?? ''} onChange={e => setLabel(conv.id, e.target.value || null)}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e0', cursor: 'pointer' }}>
                <option value="">🏷️ Label</option>
                {LEAD_LABELS.map(l => <option key={l.value} value={l.value ?? ''}>{l.emoji} {l.label}</option>)}
              </select>
              <button onClick={() => toggleExpand(conv)} style={ghostBtn}>{expanded[conv.id] ? 'Hide' : 'View'}</button>
              <button onClick={() => toggleIntervention(conv)} style={conv.manualInterventionActive ? successBtn : dangerBtn}>
                {conv.manualInterventionActive ? 'Hand back to AI' : 'Take over'}
              </button>
            </div>
          </div>

          {expanded[conv.id] && (
            <div style={{ marginTop: 12 }}>
              <div ref={el => { threadRefs.current[conv.id] = el; }} style={thread}>
                {convMessages[conv.id] === null || convMessages[conv.id] === undefined ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0', color: '#718096', fontSize: 13 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid #cbd5e0', borderTopColor: '#3182ce', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Loading messages…
                  </div>
                ) : convMessages[conv.id]!.length === 0 ? (
                  <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', margin: '12px 0' }}>No messages yet.</p>
                ) : (
                  convMessages[conv.id]!.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      <div style={{ maxWidth: '80%' }}>
                        <MessageBubble msg={msg} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              {conv.manualInterventionActive ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="Type a message… (Enter to send)"
                    value={msgInput[conv.id] ?? ''}
                    onChange={e => setMsgInput(m => ({ ...m, [conv.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(conv); } }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, outline: 'none' }}
                    autoFocus
                  />
                  <button onClick={() => sendMessage(conv)} disabled={sending[conv.id] || !msgInput[conv.id]?.trim()} style={primaryBtn}>
                    {sending[conv.id] ? '…' : 'Send'}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 8, marginBottom: 0 }}>Click "Take over" to send messages.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const LEAD_BORDER: Record<string, string> = { hot: '#fc8181', warm: '#f6ad55', browsing: '#63b3ed', cold: '#cbd5e0' };
const card = (intervention: boolean, leadLabel: string | null): React.CSSProperties => ({
  border: `1px solid ${intervention ? '#feb2b2' : leadLabel ? LEAD_BORDER[leadLabel] ?? '#e2e8f0' : '#e2e8f0'}`,
  borderLeft: `4px solid ${intervention ? '#e53e3e' : leadLabel === 'hot' ? '#e53e3e' : leadLabel === 'warm' ? '#dd6b20' : leadLabel === 'browsing' ? '#3182ce' : leadLabel === 'cold' ? '#718096' : '#3182ce'}`,
  borderRadius: 8, padding: '14px 16px', marginBottom: 12, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
});
const thread: React.CSSProperties = { background: '#f7fafc', borderRadius: 6, padding: '10px 12px', maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0' };
const pill: React.CSSProperties = { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { padding: '7px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const ghostBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#4a5568' };
const dangerBtn: React.CSSProperties = { padding: '6px 12px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const successBtn: React.CSSProperties = { padding: '6px 12px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14 };
