import { useEffect, useState } from 'react';
import { Settings, TrendingUp, Users, DollarSign, Calendar, Save, AlertCircle, Sparkles, Info, CheckCircle2, XCircle } from 'lucide-react';

interface CommissionSettings {
  commissionPercentage: number;
  earningsPeriodMonths: number;
  updatedAt: string;
}

interface SystemStats {
  totalEarningsUsd: number;
  totalValidReferrals: number;
  totalSubscribedReferrals: number;
  averageEarningsPerReferral: number;
}

export default function ReferralCommission() {
  const [settings, setSettings] = useState<CommissionSettings | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [commissionPercentage, setCommissionPercentage] = useState<number>(10);
  const [earningsPeriodMonths, setEarningsPeriodMonths] = useState<number>(12);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('augustus_operator_token');
      if (!token) { setError('Authentication required'); return; }
      const settingsRes = await fetch(`${import.meta.env.VITE_API_URL}/admin/referral-commission/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!settingsRes.ok) throw new Error('Failed to fetch settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData);
      setCommissionPercentage(settingsData.commissionPercentage);
      setEarningsPeriodMonths(settingsData.earningsPeriodMonths);
      const statsRes = await fetch(`${import.meta.env.VITE_API_URL}/admin/referral-commission/system-stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (!statsRes.ok) throw new Error('Failed to fetch statistics');
      setStats(await statsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const token = localStorage.getItem('augustus_operator_token');
      if (!token) { setError('Authentication required'); return; }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/referral-commission/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPercentage, earningsPeriodMonths }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to update settings'); }
      setSettings(await res.json());
      setSuccess('Settings updated successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings && (commissionPercentage !== settings.commissionPercentage || earningsPeriodMonths !== settings.earningsPeriodMonths);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: 'linear-gradient(135deg, #eff6ff, #eef2ff, #f5f3ff)' }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #bfdbfe', animation: 'spin 1s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid transparent', borderTopColor: '#2563eb', animation: 'spin 1s linear infinite' }} />
        </div>
        <p style={{ marginTop: 16, color: '#4b5563', fontWeight: 600 }}>Loading commission settings...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc, #eff6ff, #eef2ff)', padding: '24px' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.12) !important; }
        .stat-icon { transition: transform 0.2s; }
        .stat-card:hover .stat-icon { transform: scale(1.1); }
        .save-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(37,99,235,0.4) !important; }
        .reset-btn:hover { background: #e5e7eb !important; }
        .input-field:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Hero Header */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)', borderRadius: 24, padding: '40px 48px', marginBottom: 24, boxShadow: '0 20px 60px rgba(37,99,235,0.35)' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 256, height: 256, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 192, height: 192, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.2)', borderRadius: 18, backdropFilter: 'blur(8px)' }}>
              <Sparkles size={32} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Referral Commission Settings</h1>
              <p style={{ margin: '6px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>Configure and manage your referral program rewards</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ background: '#fff', borderLeft: '4px solid #ef4444', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: 8, background: '#fee2e2', borderRadius: 12 }}><XCircle size={22} color="#dc2626" /></div>
            <div><h3 style={{ margin: 0, fontWeight: 700, color: '#7f1d1d', fontSize: 16 }}>Error</h3><p style={{ margin: '4px 0 0', color: '#b91c1c' }}>{error}</p></div>
          </div>
        )}
        {success && (
          <div style={{ background: '#fff', borderLeft: '4px solid #22c55e', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: 8, background: '#dcfce7', borderRadius: 12 }}><CheckCircle2 size={22} color="#16a34a" /></div>
            <div><h3 style={{ margin: 0, fontWeight: 700, color: '#14532d', fontSize: 16 }}>Success</h3><p style={{ margin: '4px 0 0', color: '#15803d' }}>{success}</p></div>
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
          {[
            { label: 'Total Earnings', value: `$${stats?.totalEarningsUsd.toFixed(2) ?? '0.00'}`, sub: 'System-wide referral earnings', badge: 'USD', icon: <DollarSign size={28} color="#fff" />, grad: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: '#dbeafe', badgeColor: '#1d4ed8', badgeBg: '#eff6ff' },
            { label: 'Valid Referrals', value: String(stats?.totalValidReferrals ?? 0), sub: 'Referrals earning commissions', badge: 'Active', icon: <Users size={28} color="#fff" />, grad: 'linear-gradient(135deg,#22c55e,#16a34a)', border: '#dcfce7', badgeColor: '#15803d', badgeBg: '#f0fdf4' },
            { label: 'Subscribed', value: String(stats?.totalSubscribedReferrals ?? 0), sub: 'Active subscriptions', badge: 'Growth', icon: <TrendingUp size={28} color="#fff" />, grad: 'linear-gradient(135deg,#a855f7,#7c3aed)', border: '#f3e8ff', badgeColor: '#6d28d9', badgeBg: '#faf5ff' },
            { label: 'Per Referral', value: `$${stats?.averageEarningsPerReferral.toFixed(2) ?? '0.00'}`, sub: 'Average earnings', badge: 'Avg', icon: <TrendingUp size={28} color="#fff" />, grad: 'linear-gradient(135deg,#f97316,#ea580c)', border: '#ffedd5', badgeColor: '#c2410c', badgeBg: '#fff7ed' },
          ].map((card) => (
            <div key={card.label} className="stat-card" style={{ background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: `1px solid ${card.border}`, transition: 'all 0.25s', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="stat-icon" style={{ padding: 16, background: card.grad, borderRadius: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{card.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: card.badgeColor, background: card.badgeBg, padding: '4px 12px', borderRadius: 20 }}>{card.badge}</span>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</p>
              <p style={{ margin: '0 0 6px', fontSize: 36, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Settings Form */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)', padding: '28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 14 }}><Settings size={24} color="#fff" /></div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>Commission Configuration</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Adjust rates and periods for your referral program</p>
              </div>
            </div>
          </div>

          <div style={{ padding: '36px' }}>
            {/* Commission % */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%', display: 'inline-block' }} />
                  Commission Percentage
                </label>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>0–100%</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input type="number" min="0" max="100" step="0.1" value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(parseFloat(e.target.value) || 0)}
                  className="input-field"
                  style={{ width: '100%', padding: '18px 60px 18px 20px', border: '2px solid #e5e7eb', borderRadius: 16, fontSize: 24, fontWeight: 700, boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                />
                <span style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 22, fontWeight: 800, color: '#9ca3af' }}>%</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} color="#9ca3af" /> Percentage of subscription payments earned as commission
              </p>
              <div style={{ marginTop: 14, padding: '18px 20px', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', borderRadius: 16, border: '2px solid #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ padding: 8, background: '#2563eb', borderRadius: 10 }}><Sparkles size={16} color="#fff" /></div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Example Calculation</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8' }}>
                      With <strong>{commissionPercentage}%</strong> commission, a <strong>$100</strong> subscription earns{' '}
                      <strong style={{ color: '#1d4ed8' }}>${(commissionPercentage * 1).toFixed(2)}</strong> in referral commission.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings Period */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, background: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />
                  <Calendar size={18} color="#7c3aed" />
                  Earnings Period
                </label>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>1–60 months</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input type="number" min="1" max="60" step="1" value={earningsPeriodMonths}
                  onChange={(e) => setEarningsPeriodMonths(parseInt(e.target.value) || 1)}
                  className="input-field"
                  style={{ width: '100%', padding: '18px 100px 18px 20px', border: '2px solid #e5e7eb', borderRadius: 16, fontSize: 24, fontWeight: 700, boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                />
                <span style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 700, color: '#9ca3af' }}>months</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} color="#9ca3af" /> Duration for which referrers earn commissions from referred businesses
              </p>
              <div style={{ marginTop: 14, padding: '18px 20px', background: 'linear-gradient(135deg, #faf5ff, #fdf2f8)', borderRadius: 16, border: '2px solid #e9d5ff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ padding: 8, background: '#7c3aed', borderRadius: 10 }}><Calendar size={16} color="#fff" /></div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>Example Timeline</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#6d28d9' }}>
                      With <strong>{earningsPeriodMonths} {earningsPeriodMonths === 1 ? 'month' : 'months'}</strong>, referrers earn commissions on all subscription payments for the entire duration after registration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {settings && (
              <div style={{ paddingTop: 24, borderTop: '2px solid #f3f4f6', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontWeight: 700, color: '#374151' }}>Last updated:</span>
                  <span style={{ color: '#6b7280' }}>{new Date(settings.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <button onClick={handleSave} disabled={!hasChanges || saving} className="save-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 16, fontWeight: 700, fontSize: 15, border: 'none', cursor: hasChanges && !saving ? 'pointer' : 'not-allowed', background: hasChanges && !saving ? 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)' : '#e5e7eb', color: hasChanges && !saving ? '#fff' : '#9ca3af', boxShadow: hasChanges && !saving ? '0 4px 16px rgba(37,99,235,0.3)' : 'none', transition: 'all 0.2s' }}>
                {saving ? (
                  <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Saving...</>
                ) : (
                  <><Save size={18} />Save Changes</>
                )}
              </button>
              {hasChanges && !saving && (
                <button onClick={() => { if (settings) { setCommissionPercentage(settings.commissionPercentage); setEarningsPeriodMonths(settings.earningsPeriodMonths); } }}
                  className="reset-btn"
                  style={{ padding: '14px 28px', borderRadius: 16, fontWeight: 700, fontSize: 15, border: '2px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer', transition: 'background 0.2s' }}>
                  Reset Changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)', borderRadius: 24, padding: '40px 48px', boxShadow: '0 20px 60px rgba(99,102,241,0.35)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 192, height: 192, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 16 }}><AlertCircle size={24} color="#fff" /></div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>How Referral Commissions Work</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[
                { icon: <DollarSign size={20} color="#fff" />, title: 'Commission Rate', desc: 'Referrers earn a percentage of every subscription payment made by businesses they refer.' },
                { icon: <Calendar size={20} color="#fff" />, title: 'Earnings Period', desc: 'Commissions are earned for a specified duration after the referred business registers.' },
                { icon: <Sparkles size={20} color="#fff" />, title: 'Automatic Calculation', desc: 'Earnings are calculated automatically when referred businesses make subscription payments.' },
                { icon: <Users size={20} color="#fff" />, title: 'Wallet Credit', desc: "Commissions are credited to the referrer's wallet and can be withdrawn or used for payments." },
              ].map((item) => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', borderRadius: 18, padding: '20px 22px', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ padding: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 10, flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: '#fff', fontSize: 14 }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
