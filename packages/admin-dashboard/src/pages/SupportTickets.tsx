import { useEffect, useState } from 'react';
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
        return (
          <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10, background: '#fff', overflow: 'hidden' }}>
            {/* Header */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12 }}
              onClick={() => setExpanded(isOpen ? null : t.id)}
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
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px', background: '#f7fafc' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: '#2d3748', whiteSpace: 'pre-wrap' }}>{t.description}</p>

                {t.attachmentUrl && (
                  <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                    <a href={t.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: '#3182ce' }}>
                      View Attachment
                    </a>
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
            )}
          </div>
        );
      })}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: '6px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
const errorStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '10px 14px', fontSize: 14, marginBottom: 12 };
