import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Withdrawal {
  id: string;
  businessName: string;
  amountUsd: number;
  requestedAt: string;
  paynowMerchantRef?: string;
  status?: string;
  processedAt?: string;
  paynowPayoutRef?: string;
}

export default function Withdrawals() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [pending, setPending] = useState<Withdrawal[]>([]);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadPending = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ withdrawals: Withdrawal[] }>('/admin/withdrawals/pending');
      setPending(data.withdrawals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ withdrawals: Withdrawal[] }>('/admin/withdrawals/history');
      setHistory(data.withdrawals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load withdrawal history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'pending') loadPending();
    else loadHistory();
  }, [tab]);

  const approve = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/withdrawals/${id}/approve`, { method: 'POST' });
      await loadPending();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Withdrawals</h2>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {(['pending', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid #3182ce' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400,
              fontSize: 14,
              marginBottom: -2,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {actionError && <p style={{ color: 'red' }}>{actionError}</p>}
      {loading && <p>Loading...</p>}

      {!loading && tab === 'pending' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#edf2f7' }}>
              <th style={th}>Business</th>
              <th style={th}>Amount (USD)</th>
              <th style={th}>Requested</th>
              <th style={th}>Paynow Merchant Ref</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((w) => (
              <tr key={w.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{w.businessName}</td>
                <td style={td}>${w.amountUsd.toFixed(2)}</td>
                <td style={td}>{new Date(w.requestedAt).toLocaleString()}</td>
                <td style={td}>{w.paynowMerchantRef ?? '—'}</td>
                <td style={td}>
                  <button onClick={() => approve(w.id)} style={btnSuccess}>Approve</button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, color: '#718096', textAlign: 'center' }}>No pending withdrawals.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {!loading && tab === 'history' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#edf2f7' }}>
              <th style={th}>Business</th>
              <th style={th}>Amount (USD)</th>
              <th style={th}>Status</th>
              <th style={th}>Requested</th>
              <th style={th}>Processed</th>
              <th style={th}>Paynow Ref</th>
            </tr>
          </thead>
          <tbody>
            {history.map((w) => (
              <tr key={w.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{w.businessName}</td>
                <td style={td}>${w.amountUsd.toFixed(2)}</td>
                <td style={td}>{w.status ?? '—'}</td>
                <td style={td}>{new Date(w.requestedAt).toLocaleString()}</td>
                <td style={td}>{w.processedAt ? new Date(w.processedAt).toLocaleString() : '—'}</td>
                <td style={td}>{w.paynowPayoutRef ?? '—'}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: '#718096', textAlign: 'center' }}>No history.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
const btnSuccess: React.CSSProperties = { padding: '4px 10px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
