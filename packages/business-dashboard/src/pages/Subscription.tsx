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

// Map displayName → tier for reverse lookup
const TIER_MAP: Record<string, string> = {
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
};

export default function Subscription() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [pendingPollUrl, setPendingPollUrl] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<string | null>(null);

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

  // Pre-select the active plan when sub loads
  useEffect(() => {
    if (sub && sub.planName && sub.planName !== 'None') {
      const tier = TIER_MAP[sub.planName] ?? sub.planName.toLowerCase();
      setSelectedPlan(tier);
    }
  }, [sub]);

  // Check URL params for return from Paynow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('paynow_ref');
    const pollUrl = params.get('poll_url');
    const tier = params.get('tier');
    if (ref && pollUrl && tier) {
      setPendingRef(ref);
      setPendingPollUrl(pollUrl);
      setPendingTier(tier);
      setMsg('Payment initiated. Checking status…');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Start polling
      pollForPayment(ref, pollUrl, tier);
    }
  }, []);

  const pollForPayment = async (ref: string, pollUrl: string, tier: string) => {
    setPolling(true);
    setMsg('Waiting for payment confirmation…');
    let attempts = 0;
    const maxAttempts = 20; // poll for up to ~2 minutes

    const poll = async () => {
      try {
        const result = await apiFetch<{ status: string }>('/subscription/poll-payment', {
          method: 'POST',
          body: JSON.stringify({ paynowReference: ref, pollUrl, tier }),
        });

        if (result.status === 'paid') {
          setMsg('Payment confirmed! Subscription activated.');
          setPolling(false);
          setPendingRef(null);
          setPendingPollUrl(null);
          setPendingTier(null);
          await loadSub();
          return;
        } else if (result.status === 'failed' || result.status === 'cancelled') {
          setError('Payment failed or was cancelled. Please try again.');
          setPolling(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 6000);
        } else {
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
    // Don't re-subscribe to the same active plan
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

      // Redirect to Paynow payment page
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

  const pct = sub ? Math.min(100, Math.round(sub.creditUsagePercent)) : 0;
  const activeTier = sub && sub.planName !== 'None' ? (TIER_MAP[sub.planName] ?? sub.planName.toLowerCase()) : null;

  return (
    <div>
      <h2>Subscription</h2>
      {sub && sub.planName !== 'None' && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f0fff4', borderRadius: 8, border: '1px solid #9ae6b4' }}>
          <p style={{ margin: '0 0 4px' }}>
            <strong>Active Plan:</strong> {sub.planName}
          </p>
          <p style={{ margin: '0 0 4px' }}>
            <strong>Renewal:</strong> {new Date(sub.renewalDate).toLocaleDateString()}
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Credit Usage:</strong> {pct}% (${sub.creditUsageUsd.toFixed(2)} / ${sub.creditCapUsd.toFixed(2)})
          </p>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 10, width: 300 }}>
            <div style={{ background: pct >= 95 ? '#e53e3e' : '#38a169', borderRadius: 4, height: 10, width: `${pct}%` }} />
          </div>
        </div>
      )}

      <h3>Available Plans</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {msg && <p style={{ color: polling ? '#d69e2e' : '#276749' }}>{msg}</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 520 }}>
        <thead>
          <tr>
            <th style={th}>Select</th>
            <th style={th}>Plan</th>
            <th style={th}>Price / month</th>
            <th style={th}>AI Budget</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => {
            const isActive = activeTier === p.tier;
            return (
              <tr key={p.tier} style={{ background: isActive ? '#f0fff4' : undefined }}>
                <td style={td}>
                  <input
                    type="radio"
                    name="plan"
                    value={p.tier}
                    checked={selectedPlan === p.tier}
                    onChange={() => setSelectedPlan(p.tier)}
                  />
                </td>
                <td style={td}>
                  {p.displayName}
                  {isActive && <span style={{ marginLeft: 8, fontSize: 11, color: '#276749', fontWeight: 600 }}>ACTIVE</span>}
                </td>
                <td style={td}>${p.priceUsd}/mo</td>
                <td style={td}>${p.tokenBudgetUsd} AI credits</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        onClick={subscribe}
        disabled={!selectedPlan || loading || polling || (activeTier === selectedPlan)}
        style={{ ...btnStyle, opacity: (!selectedPlan || loading || polling || activeTier === selectedPlan) ? 0.6 : 1 }}
      >
        {loading ? 'Redirecting to Paynow…' : polling ? 'Awaiting payment…' : activeTier === selectedPlan ? 'Current Plan' : 'Pay with Paynow'}
      </button>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #ccc', fontSize: 13 };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: 14 };
const btnStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 24px',
  background: '#3182ce',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
};
