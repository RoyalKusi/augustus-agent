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
      .then((d) => { setData(d); setError(''); })
      .catch((e: Error) => {
        // Suppress auth errors — apiFetch already redirects to /login on 401
        const msg = e.message ?? '';
        if (!msg.includes('session has expired') && !msg.includes('permission')) {
          // Only show error if we have no data yet; otherwise keep showing last known data
          setError((prev) => (data ? prev : msg));
        }
      });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (error) return <div style={{ color: 'red', fontSize: 12 }}>Token usage unavailable</div>;
  if (!data) return <div style={{ fontSize: 12, color: '#a0aec0' }}>Loading…</div>;

  // Keep full precision for the bar width so even tiny usage is visible
  const rawPct = isNaN(data.usagePercent) ? 0 : Math.min(100, data.usagePercent);
  // Show at least a 1.5px sliver when there's any usage at all
  const barWidth = rawPct === 0 ? 0 : Math.max(rawPct, 1.5);
  // Display label: show one decimal when < 1%, otherwise round to integer
  const displayPct = rawPct < 1 ? rawPct.toFixed(1) : String(Math.round(rawPct));

  const barColor = data.status === 'suspended' ? '#e53e3e' : rawPct >= 95 ? '#dd6b20' : '#38a169';
  const usedTokens = toCredits(data.currentCostUsd).toLocaleString();
  const capTokens = toCredits(data.monthlyCap).toLocaleString();

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 11, marginBottom: 5, color: '#a0aec0', display: 'flex', alignItems: 'center', gap: 5 }}>
        {/* CPU / chip icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
          <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
          <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
          <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
          <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
        </svg>
        <span>
          AI Tokens —{' '}
          <strong style={{ color: '#e2e8f0' }}>{displayPct}%</strong>
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#718096', marginBottom: 5 }}>
        {usedTokens} / {capTokens} tokens
      </div>
      <div style={{ background: '#2d3748', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
        <div
          style={{
            background: barColor,
            borderRadius: 4,
            height: 6,
            width: `${barWidth}%`,
            transition: 'width 0.4s ease',
            minWidth: rawPct > 0 ? 3 : 0,
          }}
        />
      </div>
    </div>
  );
}
