import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface CreditUsage {
  currentCostUsd: number;
  monthlyCap: number;
  usagePercent: number;
  status: 'active' | 'suspended';
}

// Convert USD to credits (1 credit = $0.001)
const toCredits = (usd: number) => Math.round(usd * 1000);

export default function CreditUsageWidget() {
  const [data, setData] = useState<CreditUsage | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    apiFetch<CreditUsage>('/dashboard/credit-usage')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (error) return <div style={{ color: 'red', fontSize: 12 }}>Token usage unavailable</div>;
  if (!data) return <div style={{ fontSize: 12 }}>Loading token usage…</div>;

  const pct = Math.min(100, Math.round(isNaN(data.usagePercent) ? 0 : data.usagePercent));
  const barColor = data.status === 'suspended' ? '#e53e3e' : pct >= 95 ? '#dd6b20' : '#38a169';
  const usedTokens = toCredits(data.currentCostUsd).toLocaleString();
  const capTokens = toCredits(data.monthlyCap).toLocaleString();

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        AI Tokens — <strong>{pct}%</strong>{' '}
        <span style={{ color: data.status === 'suspended' ? 'red' : 'green' }}>
          ({data.status})
        </span>
        <span style={{ color: '#a0aec0', marginLeft: 6 }}>
          {usedTokens} / {capTokens} tokens
        </span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, width: '100%' }}>
        <div style={{ background: barColor, borderRadius: 4, height: 8, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
