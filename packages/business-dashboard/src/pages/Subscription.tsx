import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface SubscriptionInfo {
  planName: string;
  renewalDate: string;
  creditUsageUsd: number;
  creditCapUsd: number;
  creditUsagePercent: number;
}

interface Plan {
  tier: string;
  priceUsd: number;
  tokenBudgetUsd: number;
  displayName: string;
}

interface PaynowInitResult {
  paymentUrl: string;
  paynowReference: string;
  pollUrl: string;
}

const TIER_MAP: Record<string, string> = {
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
};

// Per-tier visual theming
const TIER_THEME: Record<string, { gradient: string; accent: string; badge: string; icon: JSX.Element }> = {
  silver: {
    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%)',
    accent: '#718096',
    badge: '#4a5568',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
  },
  gold: {
    gradient: 'linear-gradient(135deg, #fefcbf 0%, #f6e05e 100%)',
    accent: '#b7791f',
    badge: '#975a16',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b7791f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  platinum: {
    gradient: 'linear-gradient(135deg, #e9d8fd 0%, #b794f4 100%)',
    accent: '#6b46c1',
    badge: '#553c9a',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b46c1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
};

export default function Subscription() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const loadSub = () =>
    apiFetch<SubscriptionInfo>('/dashboard/subscription')
      .then(setSub)
      .catch(() => {});

  useEffect(() => {
    loadSub();
    apiFetch<{ plans: Plan[] }>('/subscription/plans')
      .then((r) => setPlans(r.plans))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sub && sub.planName && sub.planName !== 'None') {
      const tier = TIER_MAP[sub.planName] ?? sub.planName.toLowerCase();
      setSelectedPlan(tier);
    }
  }, [sub]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('paynow_ref');
    const pollUrl = params.get('poll_url');
    const tier = params.get('tier');
    if (ref && tier) {
      setMsg('Payment initiated. Checking status…');
      window.history.replaceState({}, '', window.location.pathname);
      pollForPayment(ref, pollUrl ?? '', tier);
    }
  }, []);

  const pollForPayment = async (ref: string, pollUrl: string, tier: string) => {
    setPolling(true);
    setMsg('Waiting for payment confirmation…');
    let attempts = 0;
    const maxAttempts = 20;
    const poll = async () => {
      try {
        const result = await apiFetch<{ status: string }>('/subscription/poll-payment', {
          method: 'POST',
          body: JSON.stringify({ paynowReference: ref, pollUrl, tier }),
        });
        if (result.status === 'paid') {
          setMsg('Payment confirmed! Subscription activated.');
          setPolling(false);
          await loadSub();
          return;
        } else if (result.status === 'failed') {
          setError('Payment failed or was cancelled. Please try again.');
          setPolling(false);
          return;
        }
        attempts++;
        if (attempts < maxAttempts) setTimeout(poll, 6000);
        else {
          setMsg('Payment is still pending. It will activate once confirmed by Paynow.');
          setPolling(false);
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) setTimeout(poll, 6000);
        else setPolling(false);
      }
    };
    poll();
  };

  const subscribe = async () => {
    if (!selectedPlan) return;
    if (sub && TIER_MAP[sub.planName] === selectedPlan) {
      setMsg('This is already your active plan.');
      return;
    }
    setError('');
    setMsg('');
    setLoading(true);
    try {
      const result = await apiFetch<PaynowInitResult>('/subscription/initiate-payment', {
        method: 'POST',
        body: JSON.stringify({ tier: selectedPlan }),
      });
      if (!result.paymentUrl) {
        setError('Failed to get payment URL from Paynow. Please try again.');
        return;
      }
      window.location.href = result.paymentUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const activeTier = sub && sub.planName !== 'None'
    ? (TIER_MAP[sub.planName] ?? sub.planName.toLowerCase())
    : null;

  // Progress bar — keep fractional precision, show min sliver when any usage exists
  const rawPct = sub ? Math.min(100, isNaN(sub.creditUsagePercent) ? 0 : sub.creditUsagePercent) : 0;
  const barWidth = rawPct === 0 ? 0 : Math.max(rawPct, 1.5);
  const displayPct = rawPct < 1 ? rawPct.toFixed(1) : String(Math.round(rawPct));
  const barColor = rawPct >= 95 ? '#e53e3e' : rawPct >= 75 ? '#dd6b20' : '#38a169';
  const usedTokens = sub ? Math.round(sub.creditUsageUsd * 1000).toLocaleString() : '0';
  const capTokens = sub ? Math.round(sub.creditCapUsd * 1000).toLocaleString() : '0';

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1a202c' }}>Subscription</h2>
      </div>

      {/* Active plan card */}
      {sub && sub.planName !== 'None' && (() => {
        const theme = TIER_THEME[activeTier ?? 'silver'] ?? TIER_THEME.silver;
        return (
          <div style={{
            marginBottom: 28,
            padding: '20px 24px',
            background: theme.gradient,
            borderRadius: 12,
            border: `1px solid ${theme.accent}40`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {theme.icon}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.badge, textTransform: 'uppercase', letterSpacing: 1 }}>Active Plan</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: theme.badge }}>{sub.planName}</div>
              </div>
              <span style={{
                marginLeft: 'auto',
                background: theme.badge,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 20,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>Active</span>
            </div>

            {/* Renewal row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, color: theme.badge }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Renews {new Date(sub.renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            {/* Credit usage */}
            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: theme.badge }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
                    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
                    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
                    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
                    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
                  </svg>
                  AI Token Usage
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{displayPct}%</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 4, height: 8, width: '100%', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  background: barColor,
                  borderRadius: 4,
                  height: 8,
                  width: `${barWidth}%`,
                  minWidth: rawPct > 0 ? 4 : 0,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: theme.badge }}>
                {usedTokens} / {capTokens} tokens used this cycle
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plan selection */}
      <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#2d3748', display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Available Plans
      </h3>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}
      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: polling ? '#744210' : '#276749', background: polling ? '#fffff0' : '#f0fff4', border: `1px solid ${polling ? '#f6e05e' : '#9ae6b4'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {msg}
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {plans.map((p) => {
          const isActive = activeTier === p.tier;
          const isSelected = selectedPlan === p.tier;
          const theme = TIER_THEME[p.tier] ?? TIER_THEME.silver;
          return (
            <label
              key={p.tier}
              onClick={() => setSelectedPlan(p.tier)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderRadius: 10,
                border: isSelected ? `2px solid ${theme.accent}` : '2px solid #e2e8f0',
                background: isSelected ? `${theme.gradient}` : '#fff',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isSelected ? `0 0 0 3px ${theme.accent}22` : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {/* Radio */}
              <input
                type="radio"
                name="plan"
                value={p.tier}
                checked={isSelected}
                onChange={() => setSelectedPlan(p.tier)}
                style={{ accentColor: theme.accent, width: 16, height: 16, flexShrink: 0 }}
              />

              {/* Tier icon */}
              <span style={{ flexShrink: 0 }}>{theme.icon}</span>

              {/* Plan info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: theme.badge }}>{p.displayName}</span>
                  {isActive && (
                    <span style={{
                      background: theme.badge,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 20,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                  {(p.tokenBudgetUsd * 1000).toLocaleString()} AI tokens / month
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: theme.badge }}>${p.priceUsd}</span>
                <span style={{ fontSize: 11, color: '#a0aec0' }}>/mo</span>
              </div>
            </label>
          );
        })}
      </div>

      {/* CTA button */}
      <button
        onClick={subscribe}
        disabled={!selectedPlan || loading || polling || activeTier === selectedPlan}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 28px',
          background: (!selectedPlan || loading || polling || activeTier === selectedPlan) ? '#a0aec0' : '#3182ce',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: (!selectedPlan || loading || polling || activeTier === selectedPlan) ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 14,
          transition: 'background 0.15s',
        }}
      >
        {activeTier === selectedPlan ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Current Plan
          </>
        ) : loading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
              <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
            Redirecting to Paynow…
          </>
        ) : polling ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Awaiting payment…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Pay with Paynow
          </>
        )}
      </button>
    </div>
  );
}
