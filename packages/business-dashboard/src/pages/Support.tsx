import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Ticket {
  id: string;
  reference: string;
  subject: string;
  description: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

function normalize(t: Ticket): Ticket {
  return {
    ...t,
    createdAt: t.createdAt ?? t.created_at ?? '',
    updatedAt: t.updatedAt ?? t.updated_at ?? '',
  };
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: '#1e40af', bg: '#dbeafe' },
  in_progress: { label: 'In Progress', color: '#92400e', bg: '#fef3c7' },
  closed:      { label: 'Closed',      color: '#374151', bg: '#f3f4f6' },
};

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [form, setForm] = useState({ subject: '', description: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () =>
    apiFetch<{ tickets: Ticket[] }>('/dashboard/support')
      .then((r) => setTickets((r.tickets ?? []).map(normalize)))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      await apiFetch('/dashboard/support', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMsg('Ticket submitted. You will receive an email confirmation shortly.');
      setForm({ subject: '', description: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginBottom: 4 }}>Support</h2>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Submit a ticket and our team will get back to you shortly.
      </p>

      {/* New ticket form */}
      <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>New Ticket</h3>

        {error && <p style={errStyle}>{error}</p>}
        {msg && <p style={okStyle}>{msg}</p>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Subject *</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
              placeholder="Brief summary of your issue"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              rows={5}
              placeholder="Describe your issue in detail…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
          <div>
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>

      {/* Tickets list */}
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>
        My Tickets {tickets.length > 0 && <span style={{ color: '#718096', fontWeight: 400 }}>({tickets.length})</span>}
      </h3>

      {tickets.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8, fontSize: 14 }}>
          No tickets yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map((t) => {
            const sm = STATUS_STYLE[t.status] ?? { label: t.status, color: '#4a5568', bg: '#e2e8f0' };
            const updatedAt = t.updatedAt ?? t.updated_at ?? '';
            return (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#2d3748' }}>{t.subject}</p>
                    <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>{t.description}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#a0aec0' }}>
                      Ref: <span style={{ fontFamily: 'monospace' }}>{t.reference}</span>
                      {updatedAt && ` · Updated ${new Date(updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: sm.color, background: sm.bg, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {sm.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '9px 22px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
const okStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
