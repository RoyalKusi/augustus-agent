import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface TierStats {
  count: number;
  mrr: number;
  avgCreditUtilisationPercent: number;
}

interface SubscriptionMetricsData {
  perTier: { silver: TierStats; gold: TierStats; platinum: TierStats };
  totalMrr: number;
  churnCount: number;
  avgCreditUtilisationPercent: number;
}

export default function SubscriptionMetrics() {
  const [data, setData] = useState<SubscriptionMetricsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<SubscriptionMetricsData>('/admin/metrics/subscriptions')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load subscription metrics'));
  }, []);

  const tiers = data
    ? (['silver', 'gold', 'platinum'] as const).map((tier) => ({
        tier,
        count: data.perTier[tier].count,
        mrr: data.perTier[tier].mrr,
        avgCreditUtilisation: data.perTier[tier].avgCreditUtilisationPercent,
      }))
    : [];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Subscription Metrics</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Total MRR" value={`$${data.totalMrr.toFixed(2)}`} />
            <StatCard label="Churn (this month)" value={String(data.churnCount)} />
          </div>

          <h3>Per-Tier Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#edf2f7' }}>
                <th style={th}>Tier</th>
                <th style={th}>Active Accounts</th>
                <th style={th}>MRR (USD)</th>
                <th style={th}>Avg Credit Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((row) => (
                <tr key={row.tier} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={td}>{row.tier.charAt(0).toUpperCase() + row.tier.slice(1)}</td>
                  <td style={td}>{row.count}</td>
                  <td style={td}>${row.mrr.toFixed(2)}</td>
                  <td style={td}>{row.avgCreditUtilisation.toFixed(1)}%</td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...td, color: '#718096', textAlign: 'center' }}>No data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 20px', minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
