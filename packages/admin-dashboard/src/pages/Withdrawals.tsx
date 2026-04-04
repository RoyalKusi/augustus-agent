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

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#92400e', bg: '#fef3c7' },
  processed: { color: '#14532d', bg: '#bbf7d0' },
  failed:    { color: '#991b1b', bg: '#fee2e2' },
};

export default function Withdrawals() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [pending, setPending] = useState<Withdrawal[]>([]);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [approving, setApproving] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch<{ withdrawals: Withdrawal[] }>('/admin/withdrawals/pending');
      setPending(data.withdrawals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending withdrawals');
    } finally { setLoading(false); }
  };

  const loadHistory = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch<{ withdrawals: Withdrawal[] }>('/admin/withdrawals/history');
      setHistory(data.withdrawals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load withdrawal history');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'pending') loadPending();
    else loadHistory();
  }, [tab]);

  const approve = async (id: string) => {
    setActionError(''); setApproving(id);
    try {
      await apiFetch(`/admin/withdrawals/${id}/approve`, { method: 'POST' });
      await loadPending();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally { setApproving(null); }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Withdrawals</h2>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {(['pending', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', background: 'transparent', border: 'none',
            borderBottom: tab === t ? '2px solid #3182ce' : '2px solid transparent',
            cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14, marginBottom: -2,
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'pending' && pending.length > 0 && (
              <span style={{ marginLeft: 6, background: '#e53e3e', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>{error}</p>}
      {actionError && <p style={{ color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>{actionError}</p>}
      {loading && <p style={{ color: '#718096' }}>Loading...</p>}

      {!loading && tab === 'pending' && (
        pending.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8, fontSize: 14 }}>
            No pending withdrawals
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((w) => (
              <div key={w.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 18, color: '#2d3748' }}>${w.amountUsd.toFixed(2)}</span>
                      <span style={{ fontSize: 13, color: '#718096' }}>from</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#2d3748' }}>{w.businessName}</span>
                    </div>

                    {/* Payment method — this is where to send the money */}
                    {w.paynowMerchantRef && (
                      <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Send Payment To
                        </p>
                        <p style={{ margin: 0, fontSize: 14, color: '#1a365d', fontWeight: 500 }}>{w.paynowMerchantRef}</p>
                      </div>
                    )}

                    <p style={{ margin: 0, fontSize: 12, color: '#a0aec0' }}>
                      Requested {new Date(w.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => approve(w.id)}
                    disabled={approving === w.id}
                    style={{ padding: '8px 18px', background: approving === w.id ? '#a0aec0' : '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: approving === w.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {approving === w.id ? 'Approving…' : '✓ Approve & Process'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'history' && (
        history.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8, fontSize: 14 }}>
            No withdrawal history
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#edf2f7' }}>
                <th style={th}>Business</th>
                <th style={th}>Amount</th>
                <th style={th}>Payment Method</th>
                <th style={th}>Status</th>
                <th style={th}>Requested</th>
                <th style={th}>Processed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((w) => {
                const sm = STATUS_STYLE[w.status ?? ''] ?? { color: '#4a5568', bg: '#e2e8f0' };
                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={td}>{w.businessName}</td>
                    <td style={{ ...td, fontWeight: 600 }}>${w.amountUsd.toFixed(2)}</td>
                    <td style={{ ...td, maxWidth: 220, wordBreak: 'break-word' }}>{w.paynowMerchantRef ?? '—'}</td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: sm.color, background: sm.bg }}>
                        {w.status ? w.status.charAt(0).toUpperCase() + w.status.slice(1) : '—'}
                      </span>
                    </td>
                    <td style={td}>{new Date(w.requestedAt).toLocaleDateString()}</td>
                    <td style={td}>{w.processedAt ? new Date(w.processedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 13 };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13 };
