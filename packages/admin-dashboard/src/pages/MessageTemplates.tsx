import { useEffect, useState } from 'react';
import { adminApiFetch } from '../api';
import { FileText, Plus, Send, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

interface Template {
  id: string;
  business_id?: string;
  businessId?: string;
  business_name?: string;
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  meta_template_id?: string;
  metaTemplateId?: string;
  body_text?: string;
  bodyText?: string;
  header_text?: string;
  footer_text?: string;
  rejection_reason?: string;
  created_at?: string;
}

interface Business {
  id: string;
  name: string;
  email: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  APPROVED: { bg: '#f0fff4', color: '#276749', icon: <CheckCircle2 size={14} /> },
  PENDING: { bg: '#fffbeb', color: '#92400e', icon: <Clock size={14} /> },
  REJECTED: { bg: '#fff5f5', color: '#9b2c2c', icon: <XCircle size={14} /> },
  PAUSED: { bg: '#f7fafc', color: '#4a5568', icon: <Clock size={14} /> },
  DISABLED: { bg: '#f7fafc', color: '#718096', icon: <XCircle size={14} /> },
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  UTILITY: { bg: '#ebf8ff', color: '#2b6cb0' },
  MARKETING: { bg: '#faf5ff', color: '#6b46c1' },
  AUTHENTICATION: { bg: '#fff5f5', color: '#c53030' },
};

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessId: '',
    name: '',
    category: 'UTILITY' as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION',
    language: 'en_US',
    headerType: 'TEXT',
    headerText: '',
    bodyText: '',
    footerText: '',
    exampleParams: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tmplData, bizData] = await Promise.all([
        adminApiFetch<{ templates: Template[] }>('/admin/templates'),
        adminApiFetch<{ businesses: Business[]; total: number }>('/admin/businesses?limit=200'),
      ]);
      setTemplates(tmplData.templates ?? []);
      setBusinesses(bizData.businesses ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const seedTemplates = async (businessId: string) => {
    setSubmitting(`seed-${businessId}`);
    setActionMsg(''); setActionError('');
    try {
      const r = await adminApiFetch<{ created: number; message: string }>(`/admin/templates/seed/${businessId}`, { method: 'POST' });
      setActionMsg(r.message);
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSubmitting(null);
    }
  };

  const submitTemplate = async (businessId: string, name: string) => {
    setSubmitting(`${businessId}-${name}`);
    setActionMsg(''); setActionError('');
    try {
      const r = await adminApiFetch<{ metaTemplateId: string; status: string }>(
        `/admin/templates/submit/${businessId}/${name}`, { method: 'POST' }
      );
      setActionMsg(`✅ Template '${name}' submitted to Meta. Status: ${r.status}`);
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submit failed';
      setActionError(`❌ ${msg}`);
    } finally {
      setSubmitting(null);
    }
  };

  const submitAll = async (businessId: string) => {
    setSubmitting(`submit-all-${businessId}`);
    setActionMsg(''); setActionError('');
    try {
      const r = await adminApiFetch<{ submitted: number; failed: number }>(
        `/admin/templates/submit-all/${businessId}`, { method: 'POST' }
      );
      setActionMsg(`✅ Submitted ${r.submitted} templates to Meta. ${r.failed > 0 ? `${r.failed} failed.` : ''}`);
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Submit all failed');
    } finally {
      setSubmitting(null);
    }
  };

  const syncStatus = async (businessId: string) => {
    setSubmitting(`sync-${businessId}`);
    setActionMsg(''); setActionError('');
    try {
      const r = await adminApiFetch<{ synced: number; approved: number; rejected: number }>(
        `/admin/templates/sync/${businessId}`, { method: 'POST' }
      );
      setActionMsg(`Synced ${r.synced} templates. ${r.approved} approved, ${r.rejected} rejected.`);
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSubmitting(null);
    }
  };

  const deleteTemplate = async (businessId: string, name: string) => {
    if (!confirm(`Delete template '${name}'? This will also remove it from Meta if it was submitted.`)) return;
    setSubmitting(`delete-${businessId}-${name}`);
    setActionMsg(''); setActionError('');
    try {
      const r = await adminApiFetch<{ deletedLocally: boolean; deletedFromMeta: boolean; error?: string }>(
        `/admin/templates/${businessId}/${name}`, { method: 'DELETE' }
      );
      const metaNote = r.deletedFromMeta ? ' (removed from Meta too)' : r.error ? ` (Meta: ${r.error})` : ' (local only — not yet submitted to Meta)';
      setActionMsg(`✅ Template '${name}' deleted${metaNote}`);
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(null);
    }
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting('create');
    setActionMsg(''); setActionError('');
    try {
      const params = form.exampleParams.split(',').map(s => s.trim()).filter(Boolean);
      await adminApiFetch('/admin/templates', {
        method: 'POST',
        body: JSON.stringify({
          businessId: form.businessId,
          name: form.name.toLowerCase().replace(/\s+/g, '_'),
          category: form.category,
          language: form.language,
          headerType: form.headerType || undefined,
          headerText: form.headerText || undefined,
          bodyText: form.bodyText,
          footerText: form.footerText || undefined,
          exampleParams: params.length > 0 ? params : undefined,
        }),
      });
      setActionMsg(`✅ Template '${form.name}' created.`);
      setShowCreate(false);
      setForm({ businessId: '', name: '', category: 'UTILITY', language: 'en_US', headerType: 'TEXT', headerText: '', bodyText: '', footerText: '', exampleParams: '' });
      await fetchData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = templates.filter(t => {
    const bizId = t.business_id ?? t.businessId ?? '';
    if (selectedBiz !== 'all' && bizId !== selectedBiz) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    return true;
  });

  const stats = {
    total: templates.length,
    approved: templates.filter(t => t.status === 'APPROVED').length,
    pending: templates.filter(t => t.status === 'PENDING').length,
    rejected: templates.filter(t => t.status === 'REJECTED').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc, #eff6ff)', padding: 24 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .action-btn:hover { opacity: 0.85 !important; }
        .tmpl-row:hover { background: #f8fafc !important; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)', borderRadius: 24, padding: '36px 48px', marginBottom: 24, boxShadow: '0 20px 60px rgba(37,99,235,0.3)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ padding: 14, background: 'rgba(255,255,255,0.2)', borderRadius: 18 }}>
                <FileText size={32} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff' }}>Message Templates</h1>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>
                  Manage WhatsApp templates for Meta business_messaging approval
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={fetchData} className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <RefreshCw size={15} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
              </button>
              <button onClick={() => setShowCreate(true)} className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#fff', border: 'none', borderRadius: 10, color: '#2563eb', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                <Plus size={15} /> New Template
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: '#2563eb', bg: '#eff6ff' },
            { label: 'Approved', value: stats.approved, color: '#276749', bg: '#f0fff4' },
            { label: 'Pending', value: stats.pending, color: '#92400e', bg: '#fffbeb' },
            { label: 'Rejected', value: stats.rejected, color: '#9b2c2c', bg: '#fff5f5' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: '16px 20px', border: `1px solid ${s.color}20` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {actionMsg && <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 12, padding: '12px 18px', marginBottom: 16, color: '#276749', fontSize: 14 }}>{actionMsg}</div>}
        {actionError && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 12, padding: '12px 18px', marginBottom: 16, color: '#c53030', fontSize: 14 }}>{actionError}</div>}

        {/* Create Template Modal */}
        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800 }}>Create Template</h2>
              <form onSubmit={createTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Business</label>
                  <select value={form.businessId} onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))} required style={sel}>
                    <option value="">Select business…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name} ({b.email})</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Template Name (snake_case)</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="order_confirmation" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as never }))} style={sel}>
                      <option value="UTILITY">UTILITY (Transactional)</option>
                      <option value="MARKETING">MARKETING (Promotional)</option>
                      <option value="AUTHENTICATION">AUTHENTICATION (OTP)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Header Type</label>
                    <select value={form.headerType} onChange={e => setForm(f => ({ ...f, headerType: e.target.value }))} style={sel}>
                      <option value="">None</option>
                      <option value="TEXT">Text</option>
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Video</option>
                      <option value="DOCUMENT">Document</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Header Text</label>
                    <input value={form.headerText} onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))} placeholder="Order Confirmed" style={inp} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Body Text (use {`{{1}}`}, {`{{2}}`} for variables)</label>
                  <textarea value={form.bodyText} onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} required rows={4}
                    placeholder="Hi {{1}}, your order {{2}} has been confirmed!" style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>Footer Text (optional)</label>
                  <input value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder="Reply HELP for support" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Example Params (comma-separated, matching {`{{1}}`}, {`{{2}}`}…)</label>
                  <input value={form.exampleParams} onChange={e => setForm(f => ({ ...f, exampleParams: e.target.value }))} placeholder="John, ORD-123, USD 50.00" style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" disabled={submitting === 'create'}
                    style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    {submitting === 'create' ? 'Creating…' : 'Create Template'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)}
                    style={{ padding: '12px 20px', background: '#f3f4f6', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filters + Business Actions */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Business</label>
            <select value={selectedBiz} onChange={e => setSelectedBiz(e.target.value)} style={sel}>
              <option value="all">All Businesses</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={sel}>
              <option value="all">All Categories</option>
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
          {selectedBiz !== 'all' && (
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button onClick={() => seedTemplates(selectedBiz)} disabled={!!submitting} className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                <Zap size={13} /> {submitting === `seed-${selectedBiz}` ? 'Seeding…' : 'Seed Platform Templates'}
              </button>
              <button onClick={() => submitAll(selectedBiz)} disabled={!!submitting} className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, color: '#276749', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                <Send size={13} /> {submitting === `submit-all-${selectedBiz}` ? 'Submitting…' : 'Submit All to Meta'}
              </button>
              <button onClick={() => syncStatus(selectedBiz)} disabled={!!submitting} className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, color: '#6b46c1', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                <RefreshCw size={13} style={{ animation: submitting === `sync-${selectedBiz}` ? 'spin 0.8s linear infinite' : 'none' }} />
                {submitting === `sync-${selectedBiz}` ? 'Syncing…' : 'Sync from Meta'}
              </button>
            </div>
          )}
        </div>

        {/* Templates Table */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #dbeafe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#a0aec0' }}>
              <FileText size={48} color="#e2e8f0" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#4a5568' }}>No templates found</p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>Select a business and click "Seed Platform Templates" to get started</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Template Name', 'Business', 'Category', 'Status', 'Meta ID', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const bizId = t.business_id ?? t.businessId ?? '';
                  const metaId = t.meta_template_id ?? t.metaTemplateId;
                  const body = t.body_text ?? t.bodyText ?? '';
                  const statusStyle = STATUS_COLORS[t.status] ?? STATUS_COLORS.PENDING;
                  const catStyle = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.UTILITY;
                  const isSubmitting = submitting === `${bizId}-${t.name}`;
                  return (
                    <tr key={t.id ?? i} className="tmpl-row" style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a202c', fontFamily: 'monospace' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#718096', marginTop: 2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{body.slice(0, 60)}{body.length > 60 ? '…' : ''}</div>
                        {t.rejection_reason && <div style={{ fontSize: 11, color: '#c53030', marginTop: 2 }}>❌ {t.rejection_reason}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#4a5568' }}>{t.business_name ?? bizId.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: catStyle.bg, color: catStyle.color }}>{t.category}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.icon} {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#718096', fontFamily: 'monospace' }}>
                        {metaId ? metaId.slice(0, 12) + '…' : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.status === 'PENDING' && !metaId && (
                            <button onClick={() => submitTemplate(bizId, t.name)} disabled={!!submitting} className="action-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              <Send size={11} /> {isSubmitting ? 'Submitting…' : 'Submit to Meta'}
                            </button>
                          )}
                          {t.status === 'APPROVED' && (
                            <span style={{ fontSize: 11, color: '#276749', fontWeight: 600 }}>✅ Ready to use</span>
                          )}
                          {t.status === 'REJECTED' && (
                            <button onClick={() => submitTemplate(bizId, t.name)} disabled={!!submitting} className="action-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#c53030', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              <RefreshCw size={11} /> Resubmit
                            </button>
                          )}
                          <button onClick={() => deleteTemplate(bizId, t.name)} disabled={!!submitting} className="action-btn"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'transparent', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const sel: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none' };
