import { useEffect, useState, useRef } from 'react';
import type React from 'react';

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

// Detect invoice/order confirmation messages
function isInvoiceMessage(text: string): boolean {
  return text.includes('INVOICE') || text.includes('Order Placed!') || text.includes('Order Reference:') || text.includes('Payment Confirmed');
}

// Render WhatsApp markdown: *bold*, _italic_, strip ━━━ separators
function renderWhatsAppMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Skip separator lines
    if (/^━+$/.test(line.trim())) {
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: '4px 0' }} />;
    }

    // Parse inline *bold* and _italic_
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*([^*]+)\*/);
      const italicMatch = remaining.match(/_([^_]+)_/);

      const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;
      const italicIdx = italicMatch ? remaining.indexOf(italicMatch[0]) : Infinity;

      if (boldMatch && boldIdx <= italicIdx) {
        if (boldIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>);
        parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldIdx + boldMatch[0].length);
      } else if (italicMatch && italicIdx < Infinity) {
        if (italicIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, italicIdx)}</span>);
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicIdx + italicMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    return <div key={i} style={{ minHeight: line.trim() === '' ? 6 : undefined }}>{parts}</div>;
  });
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outbound';
  const products = isOut ? parseProductList(msg.content) : null;
  const isInvoice = isOut && isInvoiceMessage(msg.content);
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

  if (isInvoice) {
    // Render invoice/order confirmation as a clean formatted card
    return (
      <div style={{ maxWidth: 300, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px 12px 2px 12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {msg.content.includes('INVOICE') ? '🧾 Invoice' : msg.content.includes('Payment Confirmed') ? '✅ Payment Confirmed' : '🛒 Order Placed'}
          </div>
        </div>
        <div style={{ padding: '10px 14px', fontSize: 13, color: '#2d3748', lineHeight: 1.6 }}>
          {renderWhatsAppMarkdown(msg.content)}
        </div>
        <div style={{ padding: '4px 14px 8px', fontSize: 10, color: '#a0aec0', textAlign: 'right' }}>{time}</div>
      </div>
    );
  }

  // Standard bubble with WhatsApp markdown rendering
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
      background: isOut ? '#3182ce' : '#edf2f7',
      color: isOut ? '#fff' : '#2d3748',
      maxWidth: 280,
    }}>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        {renderWhatsAppMarkdown(msg.content)}
      </div>
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

  // Broadcast state
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number } | null>(null);
  const [broadcastTemplates, setBroadcastTemplates] = useState<Array<{ name: string; category: string; bodyText: string; exampleParams: string[] | null }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateParams, setTemplateParams] = useState<string[]>([]);

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

  const sendBroadcast = async () => {
    if (!selectedTemplate || selectedRecipients.size === 0) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    setActionError('');
    try {
      const result = await api<{ sent: number; failed: number }>('/dashboard/broadcast', {
        method: 'POST',
        body: JSON.stringify({ templateName: selectedTemplate, templateParams, recipients: Array.from(selectedRecipients) }),
      });
      setBroadcastResult(result);
      setSelectedTemplate('');
      setTemplateParams([]);
      setSelectedRecipients(new Set());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  // Load approved templates when broadcast panel opens
  const openBroadcast = async () => {
    setBroadcastOpen(b => !b);
    setBroadcastResult(null);
    setActionError('');
    if (!broadcastOpen) {
      try {
        const data = await api<{ templates: Array<{ name: string; category: string; bodyText: string; exampleParams: string[] | null }> }>('/dashboard/broadcast/templates');
        setBroadcastTemplates(data.templates ?? []);
      } catch { setBroadcastTemplates([]); }
    }
  };

  const activeTemplate = broadcastTemplates.find(t => t.name === selectedTemplate);
  const filteredTemplates = selectedCategory === 'all' ? broadcastTemplates : broadcastTemplates.filter(t => t.category === selectedCategory);
  const paramCount = activeTemplate ? (activeTemplate.bodyText.match(/\{\{\d+\}\}/g) ?? []).length : 0;

  return (
    <div style={{ maxWidth: 820 }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Active Conversations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>🟢 Live · {lastUpdate.toLocaleTimeString()} · v2</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openBroadcast}
            style={{ ...ghostBtn, background: broadcastOpen ? '#ebf8ff' : undefined, color: broadcastOpen ? '#2b6cb0' : undefined }}>
            📢 Broadcast
          </button>
          <button onClick={loadConvs} style={primaryBtn}>↻ Refresh</button>
        </div>
      </div>

      {/* Broadcast panel */}
      {broadcastOpen && (
        <div style={{ background: '#fff', border: '1px solid #bee3f8', borderRadius: 10, padding: '18px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📢</span>
            <h3 style={{ margin: 0, fontSize: 15, color: '#1a202c' }}>Broadcast Message</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#718096' }}>Uses approved WhatsApp templates only</span>
          </div>

          {broadcastTemplates.length === 0 ? (
            <div style={{ padding: '16px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, fontSize: 13, color: '#c53030' }}>
              ⚠️ No approved templates available. Go to <strong>WhatsApp Setup → Templates</strong> to submit templates for Meta approval.
            </div>
          ) : (
            <>
              {/* Step 1: Category filter */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>1. Select Template Category</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['all', 'UTILITY', 'MARKETING', 'AUTHENTICATION'].map(cat => {
                    const count = cat === 'all' ? broadcastTemplates.length : broadcastTemplates.filter(t => t.category === cat).length;
                    if (count === 0 && cat !== 'all') return null;
                    return (
                      <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedTemplate(''); setTemplateParams([]); }}
                        style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          background: selectedCategory === cat ? '#2563eb' : '#f7fafc',
                          color: selectedCategory === cat ? '#fff' : '#4a5568',
                          borderColor: selectedCategory === cat ? '#2563eb' : '#e2e8f0' }}>
                        {cat === 'all' ? `All (${count})` : `${cat} (${count})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Template picker */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>2. Select Template</label>
                <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); setTemplateParams([]); }}
                  style={{ width: '100%', padding: '9px 12px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none' }}>
                  <option value="">— Choose a template —</option>
                  {filteredTemplates.map(t => (
                    <option key={t.name} value={t.name}>{t.name} [{t.category}]</option>
                  ))}
                </select>
              </div>

              {/* Step 3: Template preview + params */}
              {activeTemplate && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568', display: 'block', marginBottom: 6 }}>3. Template Preview & Parameters</label>
                  <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2d3748', marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {activeTemplate.bodyText}
                  </div>
                  {paramCount > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.from({ length: paramCount }, (_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#718096', minWidth: 60 }}>{`{{${i + 1}}}`}</span>
                          <input value={templateParams[i] ?? ''} onChange={e => {
                            const p = [...templateParams];
                            p[i] = e.target.value;
                            setTemplateParams(p);
                          }} placeholder={activeTemplate.exampleParams?.[i] ?? `Parameter ${i + 1}`}
                            style={{ flex: 1, padding: '7px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, outline: 'none' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step 4: Recipients */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#4a5568' }}>{broadcastTemplates.length > 0 ? '4.' : '2.'} Select Recipients ({selectedRecipients.size} selected)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelectedRecipients(new Set(filtered.map(c => c.customerWaNumber)))}
                  style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>Select all</button>
                <button onClick={() => setSelectedRecipients(new Set())}
                  style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px' }}>Clear</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto', padding: 8, background: '#f7fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {filtered.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 16, border: `1px solid ${selectedRecipients.has(c.customerWaNumber) ? '#3182ce' : '#e2e8f0'}`, background: selectedRecipients.has(c.customerWaNumber) ? '#ebf8ff' : '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                  <input type="checkbox" checked={selectedRecipients.has(c.customerWaNumber)}
                    onChange={() => setSelectedRecipients(prev => { const n = new Set(prev); n.has(c.customerWaNumber) ? n.delete(c.customerWaNumber) : n.add(c.customerWaNumber); return n; })}
                    style={{ accentColor: '#3182ce', width: 11, height: 11 }} />
                  {c.customerWaNumber}
                </label>
              ))}
            </div>
          </div>

          {broadcastResult && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f0fff4', border: '1px solid #9ae6b4', fontSize: 13, color: '#276749', marginBottom: 10 }}>
              ✅ Sent to {broadcastResult.sent} contact{broadcastResult.sent !== 1 ? 's' : ''}{broadcastResult.failed > 0 ? ` · ${broadcastResult.failed} failed` : ''}
            </div>
          )}

          <button onClick={sendBroadcast}
            disabled={broadcasting || !selectedTemplate || selectedRecipients.size === 0}
            style={{ ...primaryBtn, opacity: (broadcasting || !selectedTemplate || selectedRecipients.size === 0) ? 0.6 : 1 }}>
            {broadcasting ? '⏳ Sending…' : `📤 Send to ${selectedRecipients.size} contact${selectedRecipients.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

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
