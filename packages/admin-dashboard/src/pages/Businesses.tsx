import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Business {
  id: string;
  name: string;
  email: string;
  status: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  createdAt?: string;
}

interface BusinessesResponse {
  businesses: Business[];
  total: number;
  page: number;
  totalPages: number;
}

interface ActivateForm {
  businessId: string;
  businessName: string;
  tier: string;
  billingMonths: number;
}

interface DeactivateForm {
  businessId: string;
  businessName: string;
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active:    { bg: '#c6f6d5', color: '#276749', label: 'Active' },
    suspended: { bg: '#feebc8', color: '#c05621', label: 'Suspended' },
    cancelled: { bg: '#fed7d7', color: '#c53030', label: 'Cancelled' },
  };
  const s = map[status] ?? { bg: '#e2e8f0', color: '#4a5568', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  );
}

function planBadge(plan: string | null | undefined, subStatus: string | null | undefined) {
  if (!plan) return <span style={{ color: '#a0aec0', fontSize: 13 }}>—</span>;
  const isExpired = subStatus && subStatus !== 'active';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
        background: '#ebf8ff', color: '#2b6cb0', textTransform: 'capitalize',
      }}>
        {plan}
      </span>
      {isExpired && (
        <span style={{
          padding: '2px 7px', borderRadius: 12, fontSize: 10, fontWeight: 700,
          background: subStatus === 'cancelled' ? '#fed7d7' : '#feebc8',
          color: subStatus === 'cancelled' ? '#c53030' : '#c05621',
          textTransform: 'uppercase',
        }}>
          {subStatus}
        </span>
      )}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  // Activate modal
  const [activateForm, setActivateForm] = useState<ActivateForm | null>(null);
  const [activating, setActivating] = useState(false);

  // Deactivate modal
  const [deactivateForm, setDeactivateForm] = useState<DeactivateForm | null>(null);
  const [deactivating, setDeactivating] = useState(false);

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

  const clearMessages = () => { setActionMsg(''); setActionError(''); };

  // ── Suspend / Reactivate ──────────────────────────────────────────────────

  const suspend = async (id: string) => {
    clearMessages();
    try {
      await apiFetch(`/admin/businesses/${id}/suspend`, { method: 'POST' });
      setActionMsg('Business suspended.');
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const reactivate = async (id: string) => {
    clearMessages();
    try {
      await apiFetch(`/admin/businesses/${id}/reactivate`, { method: 'POST' });
      setActionMsg('Business reactivated.');
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // ── Activate subscription ─────────────────────────────────────────────────

  const submitActivate = async () => {
    if (!activateForm) return;
    setActivating(true);
    clearMessages();
    try {
      await apiFetch(`/admin/businesses/${activateForm.businessId}/activate-subscription`, {
        method: 'POST',
        body: JSON.stringify({ tier: activateForm.tier, billingMonths: activateForm.billingMonths }),
      });
      setActionMsg(`${activateForm.tier} subscription activated for ${activateForm.businessName}.`);
      setActivateForm(null);
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  // ── Deactivate subscription ───────────────────────────────────────────────

  const submitDeactivate = async () => {
    if (!deactivateForm) return;
    setDeactivating(true);
    clearMessages();
    try {
      const result = await apiFetch<{ message: string; cancelledCount: number }>(
        `/admin/businesses/${deactivateForm.businessId}/deactivate`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: deactivateForm.reason || 'Manual deactivation by operator' }),
        },
      );
      setActionMsg(result.message);
      setDeactivateForm(null);
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Deactivation failed');
    } finally {
      setDeactivating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1a202c' }}>Business Accounts</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>{total} total accounts</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Plans</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
        <button type="submit" style={btnPrimary}>Search</button>
        <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setPlanFilter('all'); setPage(1); load(1); }} style={btnGhost}>
          Clear
        </button>
      </form>

      {/* Feedback banners */}
      {actionMsg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, fontSize: 13, color: '#276749', display: 'flex', justifyContent: 'space-between' }}>
          ✅ {actionMsg}
          <button onClick={() => setActionMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#276749', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      {actionError && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, fontSize: 13, color: '#c53030', display: 'flex', justifyContent: 'space-between' }}>
          ❌ {actionError}
          <button onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c53030', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, fontSize: 13, color: '#c53030' }}>{error}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#718096' }}>Loading…</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={th}>Business</th>
                <th style={th}>Plan</th>
                <th style={th}>Account Status</th>
                <th style={th}>Registered</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b, i) => (
                <tr
                  key={b.id}
                  style={{
                    borderBottom: i < businesses.length - 1 ? '1px solid #f0f4f8' : 'none',
                    background: b.status === 'suspended' ? '#fffaf0' : '#fff',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Business info */}
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#1a202c' }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>{b.email}</div>
                  </td>

                  {/* Plan */}
                  <td style={td}>{planBadge(b.plan, b.subscriptionStatus)}</td>

                  {/* Account status */}
                  <td style={td}>{statusBadge(b.status)}</td>

                  {/* Registered */}
                  <td style={{ ...td, color: '#718096', fontSize: 12 }}>
                    {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* View dashboard */}
                      <button
                        onClick={() => navigate(`/admin/businesses/${b.id}/dashboard`)}
                        style={btnSmallSecondary}
                        title="View business dashboard"
                      >
                        View
                      </button>

                      {/* Activate subscription — only show when no active subscription */}
                      {b.subscriptionStatus !== 'active' && (
                        <button
                          onClick={() => setActivateForm({ businessId: b.id, businessName: b.name, tier: 'silver', billingMonths: 1 })}
                          style={btnSmallGreen}
                          title="Activate or renew subscription"
                        >
                          Activate Sub
                        </button>
                      )}

                      {/* Deactivate — the key new button */}
                      {(b.status === 'active' || (b.subscriptionStatus === 'active')) && (
                        <button
                          onClick={() => setDeactivateForm({ businessId: b.id, businessName: b.name, reason: '' })}
                          style={btnSmallRed}
                          title="Cancel subscription and suspend account"
                        >
                          Deactivate
                        </button>
                      )}

                      {/* Suspend / Reactivate account */}
                      {b.status !== 'suspended' ? (
                        <button onClick={() => suspend(b.id)} style={btnSmallOrange} title="Suspend account only (keeps subscription)">
                          Suspend
                        </button>
                      ) : (
                        <button onClick={() => reactivate(b.id)} style={btnSmallGreen} title="Reactivate suspended account">
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {businesses.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#a0aec0' }}>
                    No businesses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page <= 1 || loading} style={{ ...btnGhost, opacity: page <= 1 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#718096' }}>Page {page} of {totalPages}</span>
          <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page >= totalPages || loading} style={{ ...btnGhost, opacity: page >= totalPages ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      )}

      {/* ── Activate Subscription Modal ─────────────────────────────────────── */}
      {activateForm && (
        <Modal title="Activate Subscription" onClose={() => setActivateForm(null)}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4a5568' }}>
            Activating subscription for <strong>{activateForm.businessName}</strong>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              Plan Tier
              <select
                value={activateForm.tier}
                onChange={(e) => setActivateForm({ ...activateForm, tier: e.target.value })}
                style={{ ...selectStyle, width: '100%', marginTop: 4 }}
              >
                <option value="silver">Silver — $31.99/mo</option>
                <option value="gold">Gold — $61.99/mo</option>
                <option value="platinum">Platinum — $129.99/mo</option>
              </select>
            </label>
            <label style={labelStyle}>
              Billing Months
              <input
                type="number"
                min={1}
                max={12}
                value={activateForm.billingMonths}
                onChange={(e) => setActivateForm({ ...activateForm, billingMonths: Number(e.target.value) })}
                style={{ ...inputStyle, width: '100%', marginTop: 4 }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={submitActivate} disabled={activating} style={{ ...btnPrimary, flex: 1 }}>
              {activating ? 'Activating…' : 'Activate Subscription'}
            </button>
            <button onClick={() => setActivateForm(null)} style={btnGhost}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Deactivate Modal ────────────────────────────────────────────────── */}
      {deactivateForm && (
        <Modal title="Deactivate Account" onClose={() => setDeactivateForm(null)}>
          <div style={{ padding: '12px 14px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#c53030', marginBottom: 4 }}>⚠️ This will:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#c53030', lineHeight: 1.8 }}>
              <li>Cancel all active subscriptions for <strong>{deactivateForm.businessName}</strong></li>
              <li>Set the business account status to <strong>Suspended</strong></li>
              <li>Block AI Sales Agent responses immediately</li>
              <li>Write an audit log entry</li>
            </ul>
          </div>
          <label style={labelStyle}>
            Reason (optional)
            <input
              type="text"
              placeholder="e.g. Non-payment, policy violation…"
              value={deactivateForm.reason}
              onChange={(e) => setDeactivateForm({ ...deactivateForm, reason: e.target.value })}
              style={{ ...inputStyle, width: '100%', marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={submitDeactivate}
              disabled={deactivating}
              style={{ ...btnPrimary, flex: 1, background: deactivating ? '#a0aec0' : '#e53e3e' }}
            >
              {deactivating ? 'Deactivating…' : 'Confirm Deactivation'}
            </button>
            <button onClick={() => setDeactivateForm(null)} style={btnGhost}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1a202c' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#a0aec0', lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px 22px' }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };
const inputStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, outline: 'none' };
const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, background: '#fff', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568' };
const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnGhost: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnSmallSecondary: React.CSSProperties = { padding: '4px 10px', background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSmallGreen: React.CSSProperties = { padding: '4px 10px', background: '#f0fff4', color: '#276749', border: '1px solid #9ae6b4', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSmallRed: React.CSSProperties = { padding: '4px 10px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSmallOrange: React.CSSProperties = { padding: '4px 10px', background: '#fffaf0', color: '#c05621', border: '1px solid #fbd38d', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
