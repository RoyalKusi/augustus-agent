import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type KeyStatus = 'active' | 'expired' | 'error';

interface KeyInfo {
  status: KeyStatus;
  reason?: string | null;
  detail?: string | null;
}

interface ApiKeyStatusData {
  meta: KeyInfo;
  paynow: KeyInfo;
  claude: KeyInfo;
}

const statusColor: Record<KeyStatus, string> = {
  active: '#276749',
  expired: '#b7791f',
  error: '#c53030',
};

const statusBg: Record<KeyStatus, string> = {
  active: '#f0fff4',
  expired: '#fffff0',
  error: '#fff5f5',
};

const statusBorder: Record<KeyStatus, string> = {
  active: '#9ae6b4',
  expired: '#f6e05e',
  error: '#feb2b2',
};

const statusLabel: Record<KeyStatus, string> = {
  active: 'ACTIVE',
  expired: 'EXPIRED',
  error: 'ERROR',
};

const CARDS = [
  {
    key: 'meta' as const,
    title: 'Meta (WhatsApp) API',
    description: 'Used for WhatsApp Business messaging, embedded signup, and webhook verification.',
    icon: '📱',
  },
  {
    key: 'paynow' as const,
    title: 'Paynow Payment Gateway',
    description: 'Processes subscription payments and in-chat product purchases via Paynow Zimbabwe.',
    icon: '💳',
  },
  {
    key: 'claude' as const,
    title: 'Claude AI (Anthropic)',
    description: 'Powers the AI sales agent that responds to customer WhatsApp messages.',
    icon: '🤖',
  },
];

export default function ApiKeyStatus() {
  const [data, setData] = useState<ApiKeyStatusData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const result = await apiFetch<ApiKeyStatusData>('/admin/api-keys/status');
      setData(result);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API key status');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>API Key Status</h2>
        <button
          onClick={load}
          disabled={refreshing}
          style={{ padding: '6px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, opacity: refreshing ? 0.6 : 1 }}
        >
          {refreshing ? 'Checking…' : '↻ Refresh'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CARDS.map(({ key, title, description, icon }) => {
            const info = data[key];
            return (
              <KeyCard
                key={key}
                icon={icon}
                title={title}
                description={description}
                info={info}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function KeyCard({
  icon,
  title,
  description,
  info,
}: {
  icon: string;
  title: string;
  description: string;
  info: KeyInfo;
}) {
  const color = statusColor[info.status];
  const bg = statusBg[info.status];
  const border = statusBorder[info.status];

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#2d3748' }}>{title}</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#718096' }}>{description}</p>
          {info.detail && (
            <p style={{ margin: 0, fontSize: 12, color: '#4a5568', fontFamily: 'monospace', background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
              {info.detail}
            </p>
          )}
          {info.reason && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: color }}>{info.reason}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
          <span style={{ fontWeight: 700, fontSize: 13, color }}>{statusLabel[info.status]}</span>
        </div>
      </div>
    </div>
  );
}
