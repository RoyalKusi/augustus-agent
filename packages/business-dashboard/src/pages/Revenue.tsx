import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueBalance {
  balance?: {
    availableUsd: number;
    lifetimeUsd: number;
  } | null;
  // direct fields if returned flat
  availableUsd?: number;
  lifetimeUsd?: number;
}

interface WithdrawalItem {
  id: string;
  amountUsd: number;
  status: string;
  reference?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#92400e', bg: '#fef3c7' },
  processed: { color: '#14532d', bg: '#bbf7d0' },
  failed:    { color: '#991b1b', bg: '#fee2e2' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Revenue() {
  const [availableUsd, setAvailableUsd] = useState<number | null>(null);
  const [lifetimeUsd, setLifetimeUsd] = useState<number | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [amount, setAmount] = useState('');
  const [merchantRef, setMerchantRef] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBalance = () =>
    apiFetch<RevenueBalance>('/payments/balance')
      .then((r) => {
        const b = r.balance ?? r;
        setAvailableUsd(b.availableUsd ?? 0);
        setLifetimeUsd(b.lifetimeUsd ?? 0);
      })
      .catch(() => { setAvailableUsd(0); setLifetimeUsd(0); });

  const loadWithdrawals = () =>
    apiFetch<{ withdrawals: WithdrawalItem[] }>('/dashboard/withdrawals')
      .then((r) => setWithdrawals(r.withdrawals ?? []))
      .catch(() => {});

  useEffect(() => { loadBalance(); loadWithdrawals(); }, []);

  const requestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) throw new Error('Enter a valid amount greater than 0.');
      if (!merchantRef.trim()) throw new Error('Paynow merchant reference is required.');

      await apiFetch('/payments/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount_usd: amt,
          paynow_merchant_ref: merchantRef.trim(),
        }),
      });
      setMsg('Withdrawal request submitted successfully.');
      setAmount('');
      setMerchantRef('');
      loadBalance();
      loadWithdrawals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit withdrawal.');
    } finally {
      setLoading(false);
    }
  };

  const available = availableUsd ?? 0;

  return (
    <div style={{ maxWidth: 780 }}>
      <h2 style={{ marginBottom: 4 }}>Revenue & Withdrawals</h2>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Manage your earnings and request payouts.
      </p>

      {/* Balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div style={cardStyle}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096', fontWeight: 600 }}>AVAILABLE BALANCE</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#2d3748' }}>
            ${available.toFixed(2)}
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#718096', fontWeight: 600 }}>LIFETIME REVENUE</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#2d3748' }}>
            ${(lifetimeUsd ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Withdrawal form */}
      <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Request Withdrawal</h3>

        {error && <p style={errStyle}>{error}</p>}
        {msg && <p style={okStyle}>{msg}</p>}

        <form onSubmit={requestWithdrawal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={available}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={inputStyle}
              />
              {available > 0 && (
                <p style={{ fontSize: 11, color: '#718096', margin: '3px 0 0' }}>
                  Max: ${available.toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Paynow Merchant Reference *</label>
              <input
                type="text"
                placeholder="Your Paynow merchant ref"
                value={merchantRef}
                onChange={(e) => setMerchantRef(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <button type="submit" disabled={loading || available <= 0} style={{ ...btnStyle, opacity: available <= 0 ? 0.5 : 1 }}>
              {loading ? 'Submitting…' : 'Request Withdrawal'}
            </button>
            {available <= 0 && <span style={{ marginLeft: 10, fontSize: 12, color: '#a0aec0' }}>No balance available</span>}
          </div>
        </form>
      </div>

      {/* Withdrawal history */}
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>
        Withdrawal History {withdrawals.length > 0 && <span style={{ color: '#718096', fontWeight: 400 }}>({withdrawals.length})</span>}
      </h3>

      {withdrawals.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8, fontSize: 14 }}>
          No withdrawals yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {withdrawals.map((w) => {
            const sm = STATUS_STYLE[w.status] ?? { color: '#4a5568', bg: '#e2e8f0' };
            return (
              <div key={w.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#2d3748' }}>${w.amountUsd.toFixed(2)}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#a0aec0' }}>
                    {new Date(w.requestedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {w.reference && <> · Ref: <span style={{ fontFamily: 'monospace' }}>{w.reference}</span></>}
                    {w.processedAt && <> · Processed {new Date(w.processedAt).toLocaleDateString()}</>}
                  </p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: sm.color, background: sm.bg, whiteSpace: 'nowrap' }}>
                  {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '9px 22px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
const okStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 10px' };
