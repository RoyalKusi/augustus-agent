import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../api';

interface Conversation {
  id: string;
  customerWaNumber: string;
  messageCount: number;
  manualInterventionActive: boolean;
  status: string;
  sessionStart: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: string;
}

const AGENT_ID = 'dashboard-agent';

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>('/dashboard/conversations');
      setConversations(data.conversations ?? []);
      setError(''); // clear any previous error on success
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Don't show error for auth failures — apiFetch already redirects to login
      if (!msg.includes('session') && !msg.includes('expired') && !msg.includes('permission')) {
        setError(msg || 'Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/dashboard/conversations/${convId}/messages`);
      setConvMessages((m) => ({ ...m, [convId]: data.messages ?? [] }));
    } catch { /* silently ignore */ }
  }, []);

  // Auto-scroll thread to bottom when new messages arrive
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
    const listInterval = setInterval(load, 10_000);
    return () => clearInterval(listInterval);
  }, [load]);

  // 3s polling for expanded conversations
  useEffect(() => {
    const msgInterval = setInterval(() => {
      Object.keys(expanded).forEach((convId) => {
        if (expanded[convId]) loadMessages(convId);
      });
    }, 3_000);
    return () => clearInterval(msgInterval);
  }, [expanded, loadMessages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        load(),
        ...Object.keys(expanded).filter(id => expanded[id]).map(id => loadMessages(id)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpand = async (conv: Conversation) => {
    const next = !expanded[conv.id];
    setExpanded((e) => ({ ...e, [conv.id]: next }));
    if (next) await loadMessages(conv.id);
  };

  const toggleIntervention = async (conv: Conversation) => {
    setActionError('');
    try {
      if (conv.manualInterventionActive) {
        await apiFetch(`/conversations/${conv.id}/intervention/deactivate`, { method: 'POST' });
      } else {
        await apiFetch(`/conversations/${conv.id}/intervention/activate`, {
          method: 'POST',
          body: JSON.stringify({ agent_id: AGENT_ID }),
        });
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const sendMessage = async (conv: Conversation) => {
    const text = messages[conv.id]?.trim();
    if (!text) return;
    setSending((s) => ({ ...s, [conv.id]: true }));
    setActionError('');
    try {
      await apiFetch(`/conversations/${conv.id}/intervention/message`, {
        method: 'POST',
        body: JSON.stringify({ agent_id: AGENT_ID, message: text }),
      });
      setMessages((m) => ({ ...m, [conv.id]: '' }));
      await Promise.all([loadMessages(conv.id), load()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending((s) => ({ ...s, [conv.id]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, conv: Conversation) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(conv); }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Active Conversations</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '7px 16px',
            background: refreshing ? '#bee3f8' : '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
        >
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {error && <p style={errorStyle}>{error}</p>}
      {actionError && <p style={errorStyle}>{actionError}</p>}
      {loading && <p style={{ color: '#718096' }}>Loading conversations…</p>}

      {!loading && conversations.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <p style={{ margin: 0 }}>No active conversations yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>Conversations will appear here when customers message your WhatsApp number.</p>
        </div>
      )}

      {conversations.map((conv) => (
        <div key={conv.id} style={cardStyle(conv.manualInterventionActive)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{conv.customerWaNumber}</span>
                <span style={badgeStyle(conv.manualInterventionActive)}>
                  {conv.manualInterventionActive ? '🧑 Manual' : '🤖 AI'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#718096', marginTop: 3 }}>
                {conv.messageCount} messages · Started {new Date(conv.sessionStart).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
                {(convMessages[conv.id] ?? []).length === 0 ? (
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
    </div>
  );
}

const cardStyle = (intervention: boolean): React.CSSProperties => ({
  border: `1px solid ${intervention ? '#feb2b2' : '#e2e8f0'}`,
  borderLeft: `4px solid ${intervention ? '#e53e3e' : '#3182ce'}`,
  borderRadius: 8, padding: '14px 16px', marginBottom: 12,
  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
});
const badgeStyle = (intervention: boolean): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
  background: intervention ? '#fed7d7' : '#ebf8ff',
  color: intervention ? '#c53030' : '#2b6cb0',
});
const threadStyle: React.CSSProperties = {
  background: '#f7fafc', borderRadius: 6, padding: '10px 12px',
  maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0',
};
const bubbleStyle = (direction: 'inbound' | 'outbound'): React.CSSProperties => ({
  maxWidth: '72%', padding: '8px 12px',
  borderRadius: direction === 'outbound' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
  background: direction === 'outbound' ? '#3182ce' : '#edf2f7',
  color: direction === 'outbound' ? '#fff' : '#2d3748',
});
const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, outline: 'none' };
const primaryBtn: React.CSSProperties = { padding: '8px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const ghostBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#4a5568' };
const dangerBtn: React.CSSProperties = { padding: '6px 12px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const successBtn: React.CSSProperties = { padding: '6px 12px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const errorStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
