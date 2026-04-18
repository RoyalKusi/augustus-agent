import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface BillingPeriod {
  id: string;
  months: number;
  discountPercent: number;
  label: string;
  isActive: boolean;
  updatedAt: string;
}

interface PlanConfig {
  tier: string;
  displayName: string;
  priceUsd: number;
  tokenBudgetUsd: number;
  isAvailable: boolean;
  updatedAt: string;
}

const TIER_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  silver:   { color: '#4a5568', bg: '#f7fafc', border: '#cbd5e0' },
  gold:     { color: '#b7791f', bg: '#fffff0', border: '#f6e05e' },
  platinum: { color: '#6b46c1', bg: '#faf5ff', border: '#d6bcfa' },
};

const TIER_ICON: Record<string, JSX.Element> = {
  silver: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  gold: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  platinum: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
};

export default function PlanManagement() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<PlanConfig>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { text: string; ok: boolean }>>({});

  // Billing periods state
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState<Record<string, Partial<BillingPeriod>>>({});
  const [savingPeriod, setSavingPeriod] = useState<Record<string, boolean>>({});
  const [periodMessages, setPeriodMessages] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [newPeriod, setNewPeriod] = useState({ months: '', discountPercent: '', label: '' });
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [addPeriodMsg, setAddPeriodMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<{ plans: PlanConfig[] }>('/admin/plans')
      .then(r => { setPlans(r.plans); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadPeriods = () => {
    setPeriodsLoading(true);
    apiFetch<{ periods: BillingPeriod[] }>('/admin/billing-periods')
      .then(r => { setPeriods(r.periods); setPeriodsLoading(false); })
      .catch(() => setPeriodsLoading(false));
  };

  useEffect(() => { load(); loadPeriods(); }, []);

  const startEdit = (plan: PlanConfig) => {
    setEditing(e => ({
      ...e,
      [plan.tier]: {
        displayName: plan.displayName,
        priceUsd: plan.priceUsd,
        tokenBudgetUsd: plan.tokenBudgetUsd,
        isAvailable: plan.isAvailable,
      },
    }));
    setMessages(m => ({ ...m, [plan.tier]: { text: '', ok: true } }));
  };

  const cancelEdit = (tier: string) => {
    setEditing(e => { const n = { ...e }; delete n[tier]; return n; });
  };

  const save = async (tier: string) => {
    const draft = editing[tier];
    if (!draft) return;
    setSaving(s => ({ ...s, [tier]: true }));
    setMessages(m => ({ ...m, [tier]: { text: '', ok: true } }));
    try {
      await apiFetch(`/admin/plans/${tier}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      setMessages(m => ({ ...m, [tier]: { text: 'Saved successfully.', ok: true } }));
      cancelEdit(tier);
      load();
    } catch (err) {
      setMessages(m => ({ ...m, [tier]: { text: err instanceof Error ? err.message : 'Save failed.', ok: false } }));
    } finally {
      setSaving(s => ({ ...s, [tier]: false }));
    }
  };

  const toggleAvailable = async (plan: PlanConfig) => {
    setSaving(s => ({ ...s, [plan.tier]: true }));
    try {
      await apiFetch(`/admin/plans/${plan.tier}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable: !plan.isAvailable }),
      });
      setMessages(m => ({ ...m, [plan.tier]: { text: `Plan ${!plan.isAvailable ? 'enabled' : 'disabled'}.`, ok: true } }));
      load();
    } catch (err) {
      setMessages(m => ({ ...m, [plan.tier]: { text: err instanceof Error ? err.message : 'Failed.', ok: false } }));
    } finally {
      setSaving(s => ({ ...s, [plan.tier]: false }));
    }
  };

  const field = (tier: string, key: keyof PlanConfig) =>
    editing[tier] !== undefined ? (editing[tier] as Record<string, unknown>)[key] : undefined;

  const setField = (tier: string, key: keyof PlanConfig, value: unknown) => {
    setEditing(e => ({ ...e, [tier]: { ...e[tier], [key]: value } }));
  };

  const savePeriod = async (id: string) => {
    const draft = editingPeriod[id];
    if (!draft) return;
    setSavingPeriod(s => ({ ...s, [id]: true }));
    try {
      await apiFetch(`/admin/billing-periods/${id}`, { method: 'PUT', body: JSON.stringify(draft) });
      setPeriodMessages(m => ({ ...m, [id]: { text: 'Saved.', ok: true } }));
      setEditingPeriod(e => { const n = { ...e }; delete n[id]; return n; });
      loadPeriods();
    } catch (err) {
      setPeriodMessages(m => ({ ...m, [id]: { text: err instanceof Error ? err.message : 'Failed.', ok: false } }));
    } finally {
      setSavingPeriod(s => ({ ...s, [id]: false }));
    }
  };

  const togglePeriod = async (period: BillingPeriod) => {
    setSavingPeriod(s => ({ ...s, [period.id]: true }));
    try {
      await apiFetch(`/admin/billing-periods/${period.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !period.isActive }) });
      loadPeriods();
    } catch { /* ignore */ } finally {
      setSavingPeriod(s => ({ ...s, [period.id]: false }));
    }
  };

  const addPeriod = async () => {
    const months = parseInt(newPeriod.months, 10);
    const discountPercent = parseFloat(newPeriod.discountPercent) || 0;
    if (!months || months < 1) { setAddPeriodMsg({ text: 'Enter a valid number of months.', ok: false }); return; }
    setAddingPeriod(true);
    setAddPeriodMsg(null);
    try {
      await apiFetch('/admin/billing-periods', { method: 'POST', body: JSON.stringify({ months, discountPercent, label: newPeriod.label || `${months} Month${months > 1 ? 's' : ''}` }) });
      setNewPeriod({ months: '', discountPercent: '', label: '' });
      setAddPeriodMsg({ text: 'Period added.', ok: true });
      loadPeriods();
    } catch (err) {
      setAddPeriodMsg({ text: err instanceof Error ? err.message : 'Failed.', ok: false });
    } finally {
      setAddingPeriod(false);
    }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1a202c' }}>Plan Management</h2>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#718096' }}>
        Configure pricing, AI token budgets, display names, and availability for each subscription tier.
        Changes take effect immediately for new subscriptions.
      </p>

      {loading && <p style={{ color: '#718096' }}>Loading plans…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {plans.map(plan => {
          const isEditing = editing[plan.tier] !== undefined;
          const isSaving = saving[plan.tier] ?? false;
          const msg = messages[plan.tier];
          const accent = TIER_ACCENT[plan.tier] ?? TIER_ACCENT.silver;

          return (
            <div key={plan.tier} style={{
              background: '#fff',
              border: `1px solid ${isEditing ? accent.border : '#e2e8f0'}`,
              borderLeft: `4px solid ${accent.border}`,
              borderRadius: 10,
              padding: '20px 24px',
              boxShadow: isEditing ? `0 0 0 3px ${accent.border}55` : '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'box-shadow 0.15s',
            }}>
              {/* Plan header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ color: accent.color }}>{TIER_ICON[plan.tier]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: accent.color }}>
                      {isEditing ? (field(plan.tier, 'displayName') as string ?? plan.displayName) : plan.displayName}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: plan.isAvailable ? '#c6f6d5' : '#fed7d7',
                      color: plan.isAvailable ? '#276749' : '#c53030',
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {plan.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                    Last updated: {new Date(plan.updatedAt).toLocaleString()}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => toggleAvailable(plan)}
                        disabled={isSaving}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${plan.isAvailable ? '#feb2b2' : '#9ae6b4'}`,
                          background: plan.isAvailable ? '#fff5f5' : '#f0fff4',
                          color: plan.isAvailable ? '#c53030' : '#276749',
                        }}
                      >
                        {plan.isAvailable ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => startEdit(plan)}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                          border: '1px solid #bee3f8', background: '#ebf8ff', color: '#2b6cb0',
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Read-only view */}
              {!isEditing && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <StatBox label="Monthly Price" value={`$${plan.priceUsd.toFixed(2)}`} accent={accent.color} />
                  <StatBox label="AI Token Budget" value={`$${plan.tokenBudgetUsd.toFixed(2)} / mo`} accent={accent.color} />
                  <StatBox label="Token Credits" value={`${(plan.tokenBudgetUsd * 1000).toLocaleString()} credits`} accent={accent.color} />
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <FormField
                      label="Display Name"
                      value={field(plan.tier, 'displayName') as string ?? plan.displayName}
                      onChange={v => setField(plan.tier, 'displayName', v)}
                      type="text"
                    />
                    <FormField
                      label="Monthly Price (USD)"
                      value={String(field(plan.tier, 'priceUsd') ?? plan.priceUsd)}
                      onChange={v => setField(plan.tier, 'priceUsd', parseFloat(v) || 0)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      prefix="$"
                    />
                    <FormField
                      label="AI Token Budget (USD / month)"
                      value={String(field(plan.tier, 'tokenBudgetUsd') ?? plan.tokenBudgetUsd)}
                      onChange={v => setField(plan.tier, 'tokenBudgetUsd', parseFloat(v) || 0)}
                      type="number"
                      min="0.01"
                      step="0.01"
                      prefix="$"
                      hint={`= ${((parseFloat(String(field(plan.tier, 'tokenBudgetUsd') ?? plan.tokenBudgetUsd)) || 0) * 1000).toLocaleString()} credits`}
                    />
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 6 }}>
                        Availability
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={field(plan.tier, 'isAvailable') as boolean ?? plan.isAvailable}
                          onChange={e => setField(plan.tier, 'isAvailable', e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: '#38a169' }}
                        />
                        <span style={{ color: '#2d3748' }}>
                          {(field(plan.tier, 'isAvailable') as boolean ?? plan.isAvailable)
                            ? 'Available to users'
                            : 'Hidden from users'}
                        </span>
                      </label>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#a0aec0' }}>
                        Disabled plans won't appear on the subscription page.
                      </p>
                    </div>
                  </div>

                  {/* Preview */}
                  <div style={{ background: accent.bg, border: `1px solid ${accent.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: accent.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Preview</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: accent.color }}>
                        ${(parseFloat(String(field(plan.tier, 'priceUsd') ?? plan.priceUsd)) || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 12, color: '#a0aec0' }}>/month</span>
                      <span style={{ marginLeft: 12, fontSize: 13, color: '#718096' }}>
                        {((parseFloat(String(field(plan.tier, 'tokenBudgetUsd') ?? plan.tokenBudgetUsd)) || 0) * 1000).toLocaleString()} AI credits
                      </span>
                    </div>
                  </div>

                  {msg?.text && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: msg.ok ? '#276749' : '#c53030' }}>{msg.text}</p>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => save(plan.tier)}
                      disabled={isSaving}
                      style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        background: isSaving ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none',
                      }}
                    >
                      {isSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => cancelEdit(plan.tier)}
                      disabled={isSaving}
                      style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', color: '#718096', border: '1px solid #cbd5e0',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Non-editing message */}
              {!isEditing && msg?.text && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: msg.ok ? '#276749' : '#c53030' }}>{msg.text}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div style={{ marginTop: 24, padding: '12px 16px', background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 8, fontSize: 13, color: '#2b6cb0' }}>
        <strong>Note:</strong> Price and token budget changes apply to new subscriptions only. Existing active subscriptions retain their original terms until renewal.
      </div>

      {/* Billing Periods */}
      <div style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3 style={{ margin: 0, fontSize: 17, color: '#1a202c' }}>Billing Periods</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#718096' }}>
          Configure multi-month billing options with discounts. Businesses see these as choices on the subscription page.
        </p>

        {periodsLoading && <p style={{ color: '#718096', fontSize: 13 }}>Loading periods...</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {periods.map(period => {
            const isEditing = editingPeriod[period.id] !== undefined;
            const isSaving = savingPeriod[period.id] ?? false;
            const msg = periodMessages[period.id];
            const draft = editingPeriod[period.id] ?? {};
            return (
              <div key={period.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>Label</label>
                        <input type="text" value={(draft.label ?? period.label) as string} onChange={e => setEditingPeriod(ep => ({ ...ep, [period.id]: { ...ep[period.id], label: e.target.value } }))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 13, width: 160 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>Discount %</label>
                        <input type="number" min="0" max="99" step="0.5" value={(draft.discountPercent ?? period.discountPercent) as number} onChange={e => setEditingPeriod(ep => ({ ...ep, [period.id]: { ...ep[period.id], discountPercent: parseFloat(e.target.value) || 0 } }))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 13, width: 80 }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#2d3748' }}>{period.label}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#718096' }}>{period.months} month{period.months > 1 ? 's' : ''}</span>
                      {period.discountPercent > 0 && (
                        <span style={{ marginLeft: 8, background: '#c6f6d5', color: '#276749', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{period.discountPercent}% off</span>
                      )}
                    </div>
                  )}
                  {msg?.text && <p style={{ margin: '4px 0 0', fontSize: 12, color: msg.ok ? '#276749' : '#c53030' }}>{msg.text}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: period.isActive ? '#c6f6d5' : '#fed7d7', color: period.isActive ? '#276749' : '#c53030' }}>
                    {period.isActive ? 'Active' : 'Hidden'}
                  </span>
                  {isEditing ? (
                    <>
                      <button onClick={() => savePeriod(period.id)} disabled={isSaving} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', background: '#3182ce', color: '#fff', border: 'none' }}>{isSaving ? '...' : 'Save'}</button>
                      <button onClick={() => setEditingPeriod(e => { const n = { ...e }; delete n[period.id]; return n; })} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#718096', border: '1px solid #cbd5e0' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => togglePeriod(period)} disabled={isSaving} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${period.isActive ? '#feb2b2' : '#9ae6b4'}`, background: period.isActive ? '#fff5f5' : '#f0fff4', color: period.isActive ? '#c53030' : '#276749' }}>
                        {period.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => setEditingPeriod(e => ({ ...e, [period.id]: { label: period.label, discountPercent: period.discountPercent, isActive: period.isActive } }))} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: '1px solid #bee3f8', background: '#ebf8ff', color: '#2b6cb0' }}>Edit</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new period */}
        <div style={{ background: '#f7fafc', border: '1px dashed #cbd5e0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 10 }}>Add New Period</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>Months</label>
              <input type="number" min="1" value={newPeriod.months} onChange={e => setNewPeriod(p => ({ ...p, months: e.target.value }))} placeholder="e.g. 18" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 13, width: 80 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>Discount %</label>
              <input type="number" min="0" max="99" step="0.5" value={newPeriod.discountPercent} onChange={e => setNewPeriod(p => ({ ...p, discountPercent: e.target.value }))} placeholder="e.g. 12" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 13, width: 80 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>Label (optional)</label>
              <input type="text" value={newPeriod.label} onChange={e => setNewPeriod(p => ({ ...p, label: e.target.value }))} placeholder="e.g. 18 Months" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 13, width: 160 }} />
            </div>
            <button onClick={addPeriod} disabled={addingPeriod || !newPeriod.months} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer', background: '#3182ce', color: '#fff', border: 'none', opacity: !newPeriod.months ? 0.5 : 1 }}>
              {addingPeriod ? 'Adding...' : '+ Add'}
            </button>
          </div>
          {addPeriodMsg && <p style={{ margin: '8px 0 0', fontSize: 12, color: addPeriodMsg.ok ? '#276749' : '#c53030' }}>{addPeriodMsg.text}</p>}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: '#f7fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 11, color: '#a0aec0', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function FormField({
  label, value, onChange, type, min, step, prefix, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; min?: string; step?: string; prefix?: string; hint?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e0', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
        {prefix && (
          <span style={{ padding: '0 10px', background: '#f7fafc', color: '#718096', fontSize: 14, borderRight: '1px solid #e2e8f0', height: '100%', display: 'flex', alignItems: 'center' }}>
            {prefix}
          </span>
        )}
        <input
          type={type ?? 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          min={min}
          step={step}
          style={{ flex: 1, padding: '8px 10px', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
        />
      </div>
      {hint && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#a0aec0' }}>{hint}</p>}
    </div>
  );
}
