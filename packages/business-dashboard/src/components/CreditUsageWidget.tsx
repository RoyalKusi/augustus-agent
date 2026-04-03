import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface CreditUsage {
  used_usd: number;
  cap_usd: number;
  percentage: number;
  status: 'active' | 'suspended';
}

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

  if (error) return <div style={{ color: 'red', fontSize: 12 }}>Credit usage unavailable</div>;
  if (!data) return <div style={{ fontSize: 12 }}>Loading credit usage…</div>;

  const pct = Math.min(100, Math.round(data.percentage));
  const barColor = data.status === 'suspended' ? '#e53e3e' : pct >= 95 ? '#dd6b20' : '#38a169';

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        Credit Usage — <strong>{pct}%</strong>{' '}
        <span style={{ color: data.status === 'suspended' ? 'red' : 'green' }}>
          ({data.status})
        </span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, width: '100%' }}>
        <div
          style={{
            background: barColor,
            borderRadius: 4,
            height: 8,
            width: `${pct}%`,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}
