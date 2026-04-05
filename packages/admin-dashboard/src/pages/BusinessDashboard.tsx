import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

interface BusinessDashboardData {
  subscription?: {
    tier: string;
    status: string;
    currentPeriodEnd: string;
    priceUsd: number;
  };
  tokenUsage?: {
    monthlyCostUsd: number;
    hardLimitOverrideUsd?: number;
    tierCapUsd: number;
    utilisationPct: number;
  };
  activeConversationsCount?: number;
  orders?: {
    total: number;
    completed: number;
    pending: number;
    totalRevenue: number;
  };
  whatsapp?: {
    status: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    wabaId: string;
  } | null;
}

export default function BusinessDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BusinessDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch<BusinessDashboardData>(`/admin/businesses/${id}/dashboard`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, [id]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => navigate('/admin/businesses')}
          style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Business Dashboard (Read-Only)</h2>
      </div>
      <p style={{ color: '#718096', fontSize: 13, marginTop: 0 }}>Business ID: {id}</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.subscription && (
            <Section title="Subscription">
              <Row label="Tier" value={data.subscription.tier} />
              <Row label="Status" value={data.subscription.status} />
              <Row label="Price" value={`${data.subscription.priceUsd.toFixed(2)}/mo`} />
              <Row label="Current Period End" value={new Date(data.subscription.currentPeriodEnd).toLocaleDateString()} />
            </Section>
          )}

          {data.tokenUsage && (
            <Section title="Token Usage">
              <Row label="Monthly Cost" value={`${data.tokenUsage.monthlyCostUsd.toFixed(4)}`} />
              <Row label="Tier Cap" value={`${data.tokenUsage.tierCapUsd.toFixed(2)}`} />
              {data.tokenUsage.hardLimitOverrideUsd != null && (
                <Row label="Hard Limit Override" value={`${data.tokenUsage.hardLimitOverrideUsd.toFixed(2)}`} />
              )}
              <Row label="Utilisation" value={`${data.tokenUsage.utilisationPct.toFixed(1)}%`} />
            </Section>
          )}

          {data.activeConversationsCount != null && (
            <Section title="Conversations">
              <Row label="Active Conversations" value={String(data.activeConversationsCount)} />
            </Section>
          )}

          {data.orders && (
            <Section title="Orders Summary">
              <Row label="Total Orders" value={String(data.orders.total)} />
              <Row label="Completed" value={String(data.orders.completed)} />
              <Row label="Pending" value={String(data.orders.pending)} />
              <Row label="Total Revenue" value={`${data.orders.totalRevenue.toFixed(2)}`} />
            </Section>
          )}

          <Section title="WhatsApp Integration">
            {data.whatsapp ? (
              <>
                <Row label="Status" value={data.whatsapp.status} />
                <Row label="Phone Number" value={data.whatsapp.displayPhoneNumber ?? '—'} />
                <Row label="Business Name" value={data.whatsapp.verifiedName ?? '—'} />
                <Row label="WABA ID" value={data.whatsapp.wabaId} />
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>Not connected</p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#2d3748' }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f7fafc', fontSize: 14 }}>
      <span style={{ color: '#718096' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
