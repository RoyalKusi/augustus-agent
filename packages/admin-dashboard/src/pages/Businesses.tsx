import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

interface Business {
  id: string;
  name: string;
  email: string;
  status: string;
  plan?: string | null;
  createdAt?: string;
}

interface BusinessesResponse {
  businesses: Business[];
  total: number;
  page: number;
  totalPages: number;
}

interface BlastResult {
  sent: number;
  failed: number;
  total: number;
  failures: string[];
}

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Email blast modal state
  const [showBlast, setShowBlast] = useState(false);
  const [blastSubject, setBlastSubject] = useState('');
  const [blastBody, setBlastBody] = useState('');
  const [blastSending, setBlastSending] = useState(false);
  const [blastResult, setBlastResult] = useState<BlastResult | null>(null);
  const [blastError, setBlastError] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);
      params.set('page', String(p));
      params.set('limit', '50');
      const data = await apiFetch<BusinessesResponse>(`/admin/businesses?${params.toString()}`);
      setBusinesses(data.businesses);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
      setSelected(new Set());
      setSelectAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  const suspend = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/suspend`, { method: 'POST' });
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const reactivate = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/reactivate`, { method: 'POST' });
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(businesses.map(b => b.id)));
      setSelectAll(true);
    }
  };

  const openBlast = () => {
    setBlastResult(null);
    setBlastError('');
    setBlastSubject('');
    setBlastBody('');
    setShowBlast(true);
  };

  const sendBlast = async () => {
    if (!blastSubject.trim() || !blastBody.trim()) {
      setBlastError('Subject and message body are required.');
      return;
    }
    setBlastSending(true);
    setBlastError('');
    setBlastResult(null);
    try {
      const body: Record<string, unknown> = {
        subject: blastSubject,
        htmlBody: blastBody.replace(/\n/g, '<br>'),
        textBody: blastBody,
      };
      if (selected.size > 0) {
        body.businessIds = Array.from(selected);
      } else {
        // Send to all with current filters applied
        const filters: Record<string, string> = {};
        if (statusFilter !== 'all') filters.status = statusFilter;
        if (planFilter !== 'all') filters.plan = planFilter;
        if (Object.keys(filters).length > 0) body.filters = filters;
      }
      const result = await apiFetch<BlastResult>('/admin/businesses/email-blast', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setBlastResult(result);
    } catch (err) {
      setBlastError(err instanceof Error ? err.message : 'Failed to send emails.');
    } finally {
      setBlastSending(false);
    }
  };

  const recipientLabel = selected.size > 0
    ? `${selected.size} selected business${selected.size === 1 ? '' : 'es'}`
    : `All businesses${statusFilter !== 'all' || planFilter !== 'all' ? ' (filtered)' : ''} (${total})`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ marginTop: 0 }}>Business Accounts</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#718096' }}>{total} total</span>
          <button
            onClick={openBlast}
            style={{ padding: '6px 14px', background: '#6b46c1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {selected.size > 0 ? `Email ${selected.size} Selected` : 'Email All'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14, minWidth: 220 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
        >
          <option value="all">All Plans</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
        <button type="submit" style={{ padding: '6px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
          Search
        </button>
      </form>

      {selected.size > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 6, fontSize: 13, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong>{selected.size}</strong> business{selected.size === 1 ? '' : 'es'} selected
          <button onClick={() => { setSelected(new Set()); setSelectAll(false); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2b6cb0', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
            Clear selection
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {actionError && <p style={{ color: 'red' }}>{actionError}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#edf2f7' }}>
              <th style={{ ...th, width: 36 }}>
                <input
                  type="checkbox"
                  checked={selectAll && selected.size === businesses.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                  title="Select all on this page"
                />
              </th>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Plan</th>
              <th style={th}>Status</th>
              <th style={th}>Registered</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0', background: selected.has(b.id) ? '#ebf8ff' : undefined }}>
                <td style={{ ...td, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggleSelect(b.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={td}>{b.name}</td>
                <td style={td}>{b.email}</td>
                <td style={td}>{b.plan ?? '—'}</td>
                <td style={td}>{b.status}</td>
                <td style={td}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {b.status !== 'suspended' ? (
                      <button onClick={() => suspend(b.id)} style={btnDanger}>Suspend</button>
                    ) : (
                      <button onClick={() => reactivate(b.id)} style={btnSuccess}>Reactivate</button>
                    )}
                    <button
                      onClick={() => navigate(`/admin/businesses/${b.id}/dashboard`)}
                      style={btnSecondary}
                    >
                      View Dashboard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', color: '#718096' }}>
                  No businesses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button
            onClick={() => { setPage(p => p - 1); load(page - 1); }}
            disabled={page <= 1 || loading}
            style={{ ...btnSecondary, opacity: page <= 1 ? 0.4 : 1 }}
          >← Prev</button>
          <span style={{ fontSize: 13, color: '#718096' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => { setPage(p => p + 1); load(page + 1); }}
            disabled={page >= totalPages || loading}
            style={{ ...btnSecondary, opacity: page >= totalPages ? 0.4 : 1 }}
          >Next →</button>
        </div>
      )}

      {/* Email Blast Modal */}
      {showBlast && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#1a202c' }}>Send Email</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>
                  To: <strong>{recipientLabel}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowBlast(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#a0aec0', lineHeight: 1, padding: 4 }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px' }}>
              {blastResult ? (
                /* Result view */
                <div>
                  <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>
                      {blastResult.failed === 0 ? '✅' : '⚠️'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1a202c', marginBottom: 6 }}>
                      {blastResult.failed === 0 ? 'All emails sent!' : 'Emails sent with some failures'}
                    </div>
                    <div style={{ fontSize: 14, color: '#718096' }}>
                      {blastResult.sent} sent · {blastResult.failed} failed · {blastResult.total} total
                    </div>
                  </div>
                  {blastResult.failures.length > 0 && (
                    <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#c53030', marginBottom: 6 }}>Failed addresses:</div>
                      {blastResult.failures.map(f => (
                        <div key={f} style={{ fontSize: 12, color: '#c53030', fontFamily: 'monospace' }}>{f}</div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowBlast(false)}
                    style={{ width: '100%', padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Compose view */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: '10px 14px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#4a5568' }}>
                    <strong>Tip:</strong> Use <code style={{ background: '#edf2f7', padding: '1px 5px', borderRadius: 3 }}>{'{{name}}'}</code> to personalise with the recipient's business name.
                  </div>

                  <div>
                    <label style={labelStyle}>Subject *</label>
                    <input
                      type="text"
                      value={blastSubject}
                      onChange={e => setBlastSubject(e.target.value)}
                      placeholder="e.g. Important update from Augustus"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Message *</label>
                    <textarea
                      value={blastBody}
                      onChange={e => setBlastBody(e.target.value)}
                      rows={10}
                      placeholder={`Hi {{name}},\n\nWrite your message here...\n\nBest regards,\nThe Augustus Team`}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#a0aec0' }}>
                      Line breaks are preserved. HTML is supported.
                    </p>
                  </div>

                  {blastError && (
                    <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, fontSize: 13, color: '#c53030' }}>
                      {blastError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button
                      onClick={sendBlast}
                      disabled={blastSending || !blastSubject.trim() || !blastBody.trim()}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: blastSending || !blastSubject.trim() || !blastBody.trim() ? '#a0aec0' : '#6b46c1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: blastSending ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {blastSending ? `Sending to ${recipientLabel}…` : `Send to ${recipientLabel}`}
                    </button>
                    <button
                      onClick={() => setShowBlast(false)}
                      disabled={blastSending}
                      style={{ padding: '10px 20px', background: 'transparent', color: '#718096', border: '1px solid #cbd5e0', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSuccess: React.CSSProperties = { padding: '4px 10px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', boxSizing: 'border-box' };
