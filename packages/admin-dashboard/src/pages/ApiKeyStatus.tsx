import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type KeyStatus = 'active' | 'expired' | 'error';

interface ApiKeyStatusData {
  meta: {
    status: KeyStatus;
    reason?: string | null;
  };
  paynow: {
    status: KeyStatus;
    reason?: string | null;
  };
}

const statusColor: Record<KeyStatus, string> = {
  active: '#38a169',
  expired: '#d69e2e',
  error: '#e53e3e',
};

const statusBg: Record<KeyStatus, string> = {
  active: '#f0fff4',
  expired: '#fffff0',
  error: '#fff5f5',
};

export default function ApiKeyStatus() {
  const [data, setData] = useState<ApiKeyStatusData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<ApiKeyStatusData>('/admin/api-keys/status')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load API key status'));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>API Key Status</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}

      {data && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <KeyCard title="Meta API Key" keyData={{ status: data.meta.status, detail: data.meta.reason ?? undefined }} />
          <KeyCard title="Paynow Key" keyData={{ status: data.paynow.status, detail: data.paynow.reason ?? undefined }} />
        </div>
      )}
    </div>
  );
}

function KeyCard({ title, keyData }: { title: string; keyData: { status: KeyStatus; detail?: string } }) {
  const color = statusColor[keyData.status];
  const bg = statusBg[keyData.status];
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: 24,
        minWidth: 220,
      }}
    >
      <div style={{ fontSize: 14, color: '#4a5568', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 16, color }}>{keyData.status.toUpperCase()}</span>
      </div>
      {keyData.detail && (
        <p style={{ fontSize: 12, color: '#718096', marginTop: 8, marginBottom: 0 }}>{keyData.detail}</p>
      )}
    </div>
  );
}
