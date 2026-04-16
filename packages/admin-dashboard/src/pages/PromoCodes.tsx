import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  applicableTiers: string[];
  maxUses: number | null;
  usesCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Redemption {
  businessId: string;
  businessName: string;
  tier: string;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  redeemedAt: string;
}

interface PromoMetrics {
  promo: PromoCode;
  redemptions: Redemption[];
  totalRedemptions: number;
  totalDiscountGiven: number;
  totalRevenue: number;
}

const TIERS = ['silver', 'gold', 'platinum'];

const EMPTY_FORM = {
  code: '', description: '', discountType: 'percent' as 'percent' | 'fixed',
  discountValue: '', applicableTiers: [] as string[], maxUses: '', validUntil: '',
};

export default function PromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PromoMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const load = () =>
    apiFetch<{ promoCodes: PromoCode[] }>('/admin/promo-codes')
      .then(r => setCodes(r.promoCodes ?? []))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const loadMetrics = async (id: string) => {
    setSelectedId(id);
    setMetricsLoading(true);
    try {
      const m = await apiFetch<PromoMetrics>(`/admin/promo-codes/${id}/metrics`);
      setMetrics(m);
    } catch { setMetrics(null); }
    finally { setMetricsLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setSaving(true);
    try {
      await apiFetch('/admin/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code,
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          applicableTiers: form.applicableTiers.length ? form.applicableTiers : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          validUntil: form.validUntil || null,
        }),
      });
      setMsg(`Promo code "${form.code.toUpperCase()}" created.`);
      setForm(EMPTY_FORM);
      setCreating(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promo code.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (code: PromoCode) => {
    try {
      await apiFetch(`/admin/promo-codes/${code.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !code.isActive }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    }
  };

  const deleteCode = async (id: string) => {
    if (!confirm('Delete this promo code? This cannot be undone.')) return;
    try {
      await apiFetch(`/admin/promo-codes/${id}`, { method: 'DELETE' });
      if (selectedId === id) { setSelectedId(null); setMetrics(null); }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    }
  };

  const toggleTier = (tier: string) =>
    setForm(f => ({
      ...f,
      applicableTiers: f.applicableTiers.includes(tier)
        ? f.applicableTiers.filter(t => t !== tier)
        : [...f.applicableTiers, tier],
    }));

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: 20 }}>Promo Codes</h2>
        </div>
        <button onClick={() => { setCreating(c => !c); setError(''); setMsg(''); }} style={creating ? ghostBtn : primaryBtn}>
          {creating ? 'Cancel' : '+ New Code'}
        </button>
      </div>
      <p style={{ color: '#718096', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        Create discount codes for subscription plans. Track redemptions and revenue impact per code.
      </p>

      {error && <div style={errStyle}>{error}</div>}
      {msg && <div style={okStyle}>{msg}</div>}

      {/* Create form */}
      {creating && (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>New Promo Code</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="e.g. LAUNCH50" style={inputStyle} />
              <p style={hintStyle}>Customers enter this at checkout</p>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Launch discount" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Discount Type *</label>
              <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'fixed' }))} style={inputStyle}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Discount Value *</label>
              <input type="number" step="0.01" min="0.01" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} required placeholder={form.discountType === 'percent' ? '20' : '5.00'} style={inputStyle} />
              <p style={hintStyle}>{form.discountType === 'percent' ? 'Enter percentage (e.g. 20 = 20% off)' : 'Enter dollar amount off'}</p>
            </div>
            <div>
              <label style={labelStyle}>Max Uses</label>
              <input type="number" min="1" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="Leave blank for unlimited" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Valid Until</label>
              <input type="datetime-local" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} style={inputStyle} />
              <p style={hintStyle}>Leave blank for no expiry</p>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Applicable Plans</label>
            <p style={hintStyle}>Leave all unchecked to apply to all plans</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {TIERS.map(tier => (
                <label key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: `1px solid ${form.applicableTiers.includes(tier) ? '#3182ce' : '#e2e8f0'}`, borderRadius: 6, cursor: 'pointer', background: form.applicableTiers.includes(tier) ? '#ebf8ff' : '#fff', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>
                  <input type="checkbox" checked={form.applicableTiers.includes(tier)} onChange={() => toggleTier(tier)} style={{ accentColor: '#3182ce' }} />
                  {tier}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} style={primaryBtn}>{saving ? 'Creating…' : 'Create Promo Code'}</button>
        </form>
      )}

      {/* Codes list + metrics split */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Codes table */}
        <div>
          {codes.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8 }}>No promo codes yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {codes.map(c => (
                <div key={c.id} style={{ background: '#fff', border: `1px solid ${selectedId === c.id ? '#3182ce' : '#e2e8f0'}`, borderRadius: 10, padding: '14px 16px', boxShadow: selectedId === c.id ? '0 0 0 2px #bee3f8' : '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => loadMetrics(c.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#2d3748', background: '#f7fafc', padding: '2px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>{c.code}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.discountType === 'percent' ? '#3182ce' : '#38a169' }}>
                          {c.discountType === 'percent' ? `${c.discountValue}% off` : `$${c.discountValue} off`}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: c.isActive ? '#c6f6d5' : '#fed7d7', color: c.isActive ? '#276749' : '#c53030' }}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
                        {c.description && <span>{c.description} · </span>}
                        {c.usesCount} use{c.usesCount !== 1 ? 's' : ''}{c.maxUses ? ` / ${c.maxUses}` : ''}
                        {c.applicableTiers.length > 0 && <span> · {c.applicableTiers.join(', ')}</span>}
                        {c.validUntil && <span> · expires {new Date(c.validUntil).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleActive(c)} style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px', color: c.isActive ? '#c53030' : '#276749', borderColor: c.isActive ? '#feb2b2' : '#9ae6b4' }}>
                        {c.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteCode(c.id)} style={{ ...ghostBtn, fontSize: 11, padding: '4px 10px', color: '#c53030', borderColor: '#feb2b2' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metrics panel */}
        {selectedId && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 20px', height: 'fit-content' }}>
            {metricsLoading ? (
              <p style={{ color: '#718096', fontSize: 14 }}>Loading metrics…</p>
            ) : metrics ? (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', background: '#f7fafc', padding: '2px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>{metrics.promo.code}</span>
                  Metrics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <StatBox label="Redemptions" value={String(metrics.totalRedemptions)} color="#3182ce" />
                  <StatBox label="Discount Given" value={`$${metrics.totalDiscountGiven.toFixed(2)}`} color="#e53e3e" />
                  <StatBox label="Revenue" value={`$${metrics.totalRevenue.toFixed(2)}`} color="#38a169" />
                </div>
                {metrics.redemptions.length === 0 ? (
                  <p style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No redemptions yet</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f7fafc' }}>
                          {['Business', 'Plan', 'Original', 'Paid', 'Saved', 'Date'].map(h => (
                            <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#4a5568', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.redemptions.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '6px 8px', color: '#2d3748' }}>{r.businessName}</td>
                            <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{r.tier}</td>
                            <td style={{ padding: '6px 8px', color: '#718096', textDecoration: 'line-through' }}>${r.originalPrice.toFixed(2)}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 600, color: '#276749' }}>${r.discountedPrice.toFixed(2)}</td>
                            <td style={{ padding: '6px 8px', color: '#e53e3e' }}>-${r.discountAmount.toFixed(2)}</td>
                            <td style={{ padding: '6px 8px', color: '#a0aec0' }}>{new Date(r.redeemedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#f7fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 };
const hintStyle: React.CSSProperties = { fontSize: 11, color: '#a0aec0', margin: '3px 0 0' };
const inputStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '8px 18px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const ghostBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#4a5568' };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 };
const okStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 };
