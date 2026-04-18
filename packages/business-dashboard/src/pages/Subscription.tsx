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

interface BillingPeriod {
  id: string;
  months: number;
  discountPercent: number;
  label: string;
}

interface PaynowInitResult {
  paymentUrl: string;
  paynowReference: string;
  pollUrl: string;
  totalAmount: number;
  discountPercent: number;
  billingMonths: number;
}

const TIER_MAP: Record<string, string> = {
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
};

const TIER_THEME: Record<string, { gradient: string; accent: string; badge: string; icon: JSX.Element }> = {
  silver: {
    gradient: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)',
    accent: '#38a169',
    badge: '#276749',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38a169" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoValidation, setPromoValidation] = useState<{ valid: boolean; message: string; discountedPrice?: number; discountAmount?: number; promoCodeId?: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  const loadSub = () =>
    apiFetch<SubscriptionInfo>('/dashboard/subscription')
      .then(setSub)
      .catch(() => {});

  useEffect(() => {
    loadSub();
    apiFetch<{ plans: Plan[] }>('/subscription/plans')
      .then((r) => setPlans(r.plans))
      .catch(() => {});
    apiFetch<{ periods: BillingPeriod[] }>('/subscription/billing-periods')
      .then((r) => setPeriods(r.periods))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sub && sub.planName && sub.planName !== 'None') {
      const tier = TIER_MAP[sub.planName] ?? sub.planName.toLowerCase();
      setSelectedPlan(tier);
    }
  }, [sub]);

  useEffect(() => {
    setPromoValidation(null);
  }, [selectedPlan, selectedMonths]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('paynow_ref');
    const pollUrl = params.get('poll_url');
    const tier = params.get('tier');
    if (ref && tier) {
      setMsg('Payment initiated. Checking status...');
      window.history.replaceState({}, '', window.location.pathname);
      pollForPayment(ref, pollUrl ?? '', tier);
    }
  }, []);

  const pollForPayment = async (ref: string, pollUrl: string, tier: string) => {
    setPolling(true);
    setMsg('Waiting for payment confirmation...');
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

  const getEffectivePrice = (plan: Plan): { monthly: number; total: number; discount: number; saving: number } => {
    const period = periods.find(p => p.months === selectedMonths);
    const discountPct = period ? period.discountPercent : 0;
    const baseTotal = plan.priceUsd * selectedMonths;
    const saving = baseTotal * (discountPct / 100);
    const total = baseTotal - saving;
    const monthly = total / selectedMonths;
    return { monthly, total, discount: discountPct, saving };
  };

  const subscribe = async () => {
    if (!selectedPlan) return;
    if (sub && TIER_MAP[sub.planName] === selectedPlan && selectedMonths === 1) {
      setMsg('This is already your active plan.');
      return;
    }
    setError('');
    setMsg('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { tier: selectedPlan, billingMonths: selectedMonths };
      if (promoValidation?.valid && promoValidation.promoCodeId) {
        body.promoCode = promoCode;
        body.promoCodeId = promoValidation.promoCodeId;
      }
      const result = await apiFetch<PaynowInitResult>('/subscription/initiate-payment', {
        method: 'POST',
        body: JSON.stringify(body),
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

  const checkPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    const plan = plans.find(p => p.tier === selectedPlan);
    if (!plan) return;
    const { total } = getEffectivePrice(plan);
    setPromoChecking(true);
    setPromoValidation(null);
    try {
      const result = await apiFetch<{ valid: boolean; message: string; discountedPrice?: number; discountAmount?: number; promoCodeId?: string }>('/subscription/validate-promo', {
        method: 'POST',
        body: JSON.stringify({ code: promoCode, tier: selectedPlan, originalPrice: total }),
      });
      setPromoValidation(result);
    } catch {
      setPromoValidation({ valid: false, message: 'Failed to validate code.' });
    } finally {
      setPromoChecking(false);
    }
  };

  const activeTier = sub && sub.planName !== 'None'
    ? (TIER_MAP[sub.planName] ?? sub.planName.toLowerCase())
    : null;

  const rawPct = sub ? Math.min(100, isNaN(sub.creditUsagePercent) ? 0 : sub.creditUsagePercent) : 0;
  const barWidth = rawPct === 0 ? 0 : Math.max(rawPct, 1.5);
  const displayPct = rawPct < 1 ? rawPct.toFixed(1) : String(Math.round(rawPct));
  const barColor = rawPct >= 95 ? '#e53e3e' : rawPct >= 75 ? '#dd6b20' : '#38a169';
  const usedTokens = sub ? Math.round(sub.creditUsageUsd * 1000).toLocaleString() : '0';
  const capTokens = sub ? Math.round(sub.creditCapUsd * 1000).toLocaleString() : '0';

  const selectedPlanObj = plans.find(p => p.tier === selectedPlan);
  const effectivePrice = selectedPlanObj ? getEffectivePrice(selectedPlanObj) : null;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1a202c' }}>Subscription</h2>
      </div>

      {sub && sub.planName !== 'None' && (() => {
        const theme = TIER_THEME[activeTier ?? 'silver'] ?? TIER_THEME.silver;
        return (
          <div style={{ marginBottom: 28, padding: '20px 24px', background: theme.gradient, borderRadius: 12, border: `1px solid ${theme.accent}40`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {theme.icon}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.badge, textTransform: 'uppercase', letterSpacing: 1 }}>Active Plan</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: theme.badge }}>{sub.planName}</div>
              </div>
              <span style={{ marginLeft: 'auto', background: theme.badge, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, color: theme.badge }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Renews {new Date(sub.renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: theme.badge }}>AI Token Usage</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{displayPct}%</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 4, height: 8, width: '100%', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ background: barColor, borderRadius: 4, height: 8, width: `${barWidth}%`, minWidth: rawPct > 0 ? 4 : 0, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: theme.badge }}>{usedTokens} / {capTokens} tokens used this cycle</div>
            </div>
          </div>
        );
      })()}

      <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#2d3748', display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Available Plans
      </h3>

      {error && (
        <div style={{ color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>
      )}
      {msg && (
        <div style={{ color: polling ? '#744210' : '#276749', background: polling ? '#fffff0' : '#f0fff4', border: `1px solid ${polling ? '#f6e05e' : '#9ae6b4'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {plans.map((p) => {
          const isActive = activeTier === p.tier;
          const isSelected = selectedPlan === p.tier;
          const theme = TIER_THEME[p.tier] ?? TIER_THEME.silver;
          const ep = getEffectivePrice(p);
          return (
            <label key={p.tier} onClick={() => setSelectedPlan(p.tier)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10, border: isSelected ? `2px solid ${theme.accent}` : '2px solid #e2e8f0', background: isSelected ? theme.gradient : '#fff', cursor: 'pointer', transition: 'border-color 0.15s', boxShadow: isSelected ? `0 0 0 3px ${theme.accent}22` : '0 1px 3px rgba(0,0,0,0.06)' }}>
              <input type="radio" name="plan" value={p.tier} checked={isSelected} onChange={() => setSelectedPlan(p.tier)} style={{ accentColor: theme.accent, width: 16, height: 16, flexShrink: 0 }} />
              <span style={{ flexShrink: 0 }}>{theme.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: theme.badge }}>{p.displayName}</span>
                  {isActive && <span style={{ background: theme.badge, color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active</span>}
                </div>
                <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>{(p.tokenBudgetUsd * 1000).toLocaleString()} AI tokens / month</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {selectedMonths > 1 && ep.discount > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: '#a0aec0', textDecoration: 'line-through' }}>${p.priceUsd.toFixed(2)}/mo</div>
                    <div>
                      <span style={{ fontSize: 17, fontWeight: 700, color: theme.badge }}>${ep.monthly.toFixed(2)}</span>
                      <span style={{ fontSize: 11, color: '#a0aec0' }}>/mo</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#38a169', fontWeight: 600 }}>Save {ep.discount}%</div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 17, fontWeight: 700, color: theme.badge }}>${p.priceUsd.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: '#a0aec0' }}>/mo</span>
                  </>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {periods.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 10 }}>Billing Period</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedMonths(1)}
              style={{ padding: '8px 16px', borderRadius: 8, border: selectedMonths === 1 ? '2px solid #3182ce' : '2px solid #e2e8f0', background: selectedMonths === 1 ? '#ebf8ff' : '#fff', color: selectedMonths === 1 ? '#2b6cb0' : '#4a5568', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              Monthly
            </button>
            {periods.map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedMonths(period.months)}
                style={{ position: 'relative', padding: '8px 16px', borderRadius: 8, border: selectedMonths === period.months ? '2px solid #3182ce' : '2px solid #e2e8f0', background: selectedMonths === period.months ? '#ebf8ff' : '#fff', color: selectedMonths === period.months ? '#2b6cb0' : '#4a5568', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {period.label}
                {period.discountPercent > 0 && (
                  <span style={{ position: 'absolute', top: -8, right: -8, background: '#38a169', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                    -{period.discountPercent}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {effectivePrice && selectedMonths > 1 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 10, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#276749', fontWeight: 600 }}>
              {selectedMonths}-month total
              {effectivePrice.discount > 0 && ` (${effectivePrice.discount}% off)`}
            </span>
            <div style={{ textAlign: 'right' }}>
              {effectivePrice.discount > 0 && (
                <div style={{ fontSize: 11, color: '#a0aec0', textDecoration: 'line-through' }}>
                  ${(selectedPlanObj!.priceUsd * selectedMonths).toFixed(2)}
                </div>
              )}
              <span style={{ fontSize: 18, fontWeight: 700, color: '#276749' }}>${effectivePrice.total.toFixed(2)}</span>
            </div>
          </div>
          {effectivePrice.saving > 0 && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#38a169' }}>
              You save ${effectivePrice.saving.toFixed(2)} compared to monthly billing
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16, padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 8 }}>Have a promo code?</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoValidation(null); }} placeholder="Enter code (e.g. LAUNCH50)" style={{ flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }} />
          <button type="button" onClick={checkPromo} disabled={!promoCode.trim() || !selectedPlan || promoChecking} style={{ padding: '8px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (!promoCode.trim() || !selectedPlan) ? 0.5 : 1 }}>
            {promoChecking ? '...' : 'Apply'}
          </button>
        </div>
        {promoValidation && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: promoValidation.valid ? '#f0fff4' : '#fff5f5', border: `1px solid ${promoValidation.valid ? '#9ae6b4' : '#feb2b2'}`, fontSize: 13, color: promoValidation.valid ? '#276749' : '#c53030' }}>
            {promoValidation.valid ? 'Promo applied!' : promoValidation.message}
          </div>
        )}
      </div>

      <button
        onClick={subscribe}
        disabled={!selectedPlan || loading || polling || (activeTier === selectedPlan && selectedMonths === 1)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', background: (!selectedPlan || loading || polling || (activeTier === selectedPlan && selectedMonths === 1)) ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', borderRadius: 8, cursor: (!selectedPlan || loading || polling || (activeTier === selectedPlan && selectedMonths === 1)) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}
      >
        {loading ? 'Redirecting to Paynow...' : polling ? 'Awaiting payment...' : (activeTier === selectedPlan && selectedMonths === 1) ? 'Current Plan' : effectivePrice && selectedMonths > 1 ? `Pay $${effectivePrice.total.toFixed(2)} with Paynow` : promoValidation?.valid && promoValidation.discountedPrice !== undefined ? `Pay $${promoValidation.discountedPrice.toFixed(2)} with Paynow` : 'Pay with Paynow'}
      </button>
    </div>
  );
}
