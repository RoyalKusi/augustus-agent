import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

interface Ticket {
  id: string;
  businessName: string;
  businessEmail: string;
  reference: string;
  subject: string;
  description: string;
  attachmentUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: 'admin' | 'business';
  senderId: string;
  body: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open:        { bg: '#ebf8ff', color: '#2b6cb0' },
  in_progress: { bg: '#fffbeb', color: '#b7791f' },
  closed:      { bg: '#f0fff4', color: '#276749' },
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Messaging state
  const [messages, setMessages] = useState<Record<string, TicketMessage[]>>({});
  const [messagesLoading, setMessagesLoading] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<Record<string, string>>({});
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const qs = params.toString();
      const data = await apiFetch<{ tickets: Ticket[] }>(`/admin/support${qs ? `?${qs}` : ''}`);
      setTickets(data.tickets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const loadMessages = async (ticketId: string) => {
    setMessagesLoading(ticketId);
    try {
      const data = await apiFetch<{ messages: TicketMessage[] }>(`/admin/support/${ticketId}/messages`);
      setMessages((prev) => ({ ...prev, [ticketId]: data.messages ?? [] }));
    } catch {
      // non-fatal — thread just won't show
    } finally {
      setMessagesLoading(null);
    }
  };

  const handleExpand = (ticketId: string) => {
    if (expanded === ticketId) {
      setExpanded(null);
    } else {
      setExpanded(ticketId);
      loadMessages(ticketId);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    setActionError('');
    try {
      await apiFetch(`/admin/support/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
      setExpanded(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const sendReply = async (ticketId: string) => {
    const body = (replyText[ticketId] ?? '').trim();
    if (!body) return;
    setSendingReply(ticketId);
    setReplyError((prev) => ({ ...prev, [ticketId]: '' }));
    try {
      const msg = await apiFetch<TicketMessage>(`/admin/support/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => ({ ...prev, [ticketId]: [...(prev[ticketId] ?? []), msg] }));
      setReplyText((prev) => ({ ...prev, [ticketId]: '' }));
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setReplyError((prev) => ({
        ...prev,
        [ticketId]: err instanceof Error ? err.message : 'Failed to send reply',
      }));
    } finally {
      setSendingReply(null);
    }
  };

  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Support Tickets</h2>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by subject, reference, or business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14, minWidth: 260 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" style={primaryBtn}>Search</button>
      </form>

      {error && <p style={errorStyle}>{error}</p>}
      {actionError && <p style={errorStyle}>{actionError}</p>}
      {loading && <p style={{ color: '#718096' }}>Loading...</p>}

      {!loading && tickets.length === 0 && (
        <p style={{ color: '#a0aec0', textAlign: 'center', padding: '32px 0' }}>No support tickets found.</p>
      )}

      {tickets.map((t) => {
        const colors = STATUS_COLORS[t.status] ?? { bg: '#f7fafc', color: '#4a5568' };
        const isOpen = expanded === t.id;
        const threadMessages = messages[t.id] ?? [];
        const reply = replyText[t.id] ?? '';

        return (
          <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10, background: '#fff', overflow: 'hidden' }}>
            {/* Header */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12 }}
              onClick={() => handleExpand(t.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.subject}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: colors.bg, color: colors.color, fontWeight: 600 }}>
                    {statusLabel(t.status)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                  {t.reference} · {t.businessName} ({t.businessEmail}) · {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span style={{ color: '#a0aec0', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #e2e8f0', background: '#f7fafc' }}>
                {/* Original description */}
                <div style={{ padding: '16px 16px 0' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 14, color: '#2d3748', whiteSpace: 'pre-wrap' }}>{t.description}</p>

                  {t.attachmentUrl && (
                    <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                      <a href={t.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: '#3182ce' }}>
                        View Attachment
                      </a>
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#718096' }}>Update status:</span>
                    {['open', 'in_progress', 'closed'].filter((s) => s !== t.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(t.id, s)}
                        disabled={updating === t.id}
                        style={{
                          padding: '5px 12px',
                          background: s === 'closed' ? '#38a169' : s === 'in_progress' ? '#d69e2e' : '#3182ce',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 600,
                          opacity: updating === t.id ? 0.6 : 1,
                        }}
                      >
                        {updating === t.id ? '...' : `Mark ${statusLabel(s)}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message thread */}
                <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#4a5568' }}>
                    Conversation
                  </p>

                  {messagesLoading === t.id && (
                    <p style={{ fontSize: 13, color: '#718096' }}>Loading messages…</p>
                  )}

                  {messagesLoading !== t.id && threadMessages.length === 0 && (
                    <p style={{ fontSize: 13, color: '#a0aec0', marginBottom: 10 }}>No messages yet. Send the first reply below.</p>
                  )}

                  {threadMessages.map((msg) => {
                    const isAdmin = msg.senderType === 'admin';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '75%',
                            background: isAdmin ? '#3182ce' : '#fff',
                            color: isAdmin ? '#fff' : '#2d3748',
                            border: isAdmin ? 'none' : '1px solid #e2e8f0',
                            borderRadius: isAdmin ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            padding: '8px 12px',
                            fontSize: 13,
                          }}
                        >
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7, textAlign: isAdmin ? 'right' : 'left' }}>
                            {isAdmin ? 'Admin' : t.businessName} · {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />

                  {/* Reply box */}
                  {replyError[t.id] && <p style={{ ...errorStyle, marginTop: 8 }}>{replyError[t.id]}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
                    <textarea
                      rows={2}
                      placeholder="Type a reply…"
                      value={reply}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void sendReply(t.id);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e0',
                        fontSize: 13,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={() => void sendReply(t.id)}
                      disabled={sendingReply === t.id || !reply.trim()}
                      style={{
                        ...primaryBtn,
                        opacity: sendingReply === t.id || !reply.trim() ? 0.6 : 1,
                        cursor: sendingReply === t.id || !reply.trim() ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sendingReply === t.id ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#a0aec0', margin: '4px 0 0' }}>
                    Press Enter to send · Shift+Enter for new line · Business will be notified by email
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: '6px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
const errorStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
