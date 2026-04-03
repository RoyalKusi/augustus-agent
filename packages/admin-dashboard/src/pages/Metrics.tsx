import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface AiMetrics {
  totalTokens: number;
  totalCalls: number;
  totalCostUsd: number;
  perBusiness: Array<{
    businessId: string;
    businessName: string;
    tokens: number;
    calls: number;
    costUsd: number;
  }>;
}

interface MetaMetrics {
  totalSent: number;
  totalReceived: number;
  perBusiness: Array<{
    businessId: string;
    businessName: string;
    sent: number;
    received: number;
  }>;
}

export default function Metrics() {
  const [ai, setAi] = useState<AiMetrics | null>(null);
  const [meta, setMeta] = useState<MetaMetrics | null>(null);
  const [aiError, setAiError] = useState('');
  const [metaError, setMetaError] = useState('');

  useEffect(() => {
    apiFetch<AiMetrics>('/admin/metrics/ai')
      .then(setAi)
      .catch((err) => setAiError(err instanceof Error ? err.message : 'Failed to load AI metrics'));

    apiFetch<MetaMetrics>('/admin/metrics/meta')
      .then(setMeta)
      .catch((err) => setMetaError(err instanceof Error ? err.message : 'Failed to load Meta metrics'));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Usage Metrics</h2>

      <section style={{ marginBottom: 32 }}>
        <h3>AI Usage</h3>
        {aiError && <p style={{ color: 'red' }}>{aiError}</p>}
        {!ai && !aiError && <p>Loading...</p>}
        {ai && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatCard label="Total Tokens" value={ai.totalTokens.toLocaleString()} />
              <StatCard label="Total Calls" value={ai.totalCalls.toLocaleString()} />
              <StatCard label="Cost to Date" value={`$${ai.totalCostUsd.toFixed(4)}`} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#edf2f7' }}>
                  <th style={th}>Business</th>
                  <th style={th}>Tokens</th>
                  <th style={th}>Calls</th>
                  <th style={th}>Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {ai.perBusiness.map((row) => (
                  <tr key={row.businessId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={td}>{row.businessName}</td>
                    <td style={td}>{row.tokens.toLocaleString()}</td>
                    <td style={td}>{row.calls.toLocaleString()}</td>
                    <td style={td}>${row.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
                {ai.perBusiness.length === 0 && (
                  <tr><td colSpan={4} style={{ ...td, color: '#718096', textAlign: 'center' }}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h3>Meta API Usage</h3>
        {metaError && <p style={{ color: 'red' }}>{metaError}</p>}
        {!meta && !metaError && <p>Loading...</p>}
        {meta && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatCard label="Total Sent" value={meta.totalSent.toLocaleString()} />
              <StatCard label="Total Received" value={meta.totalReceived.toLocaleString()} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#edf2f7' }}>
                  <th style={th}>Business</th>
                  <th style={th}>Sent</th>
                  <th style={th}>Received</th>
                </tr>
              </thead>
              <tbody>
                {meta.perBusiness.map((row) => (
                  <tr key={row.businessId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={td}>{row.businessName}</td>
                    <td style={td}>{row.sent.toLocaleString()}</td>
                    <td style={td}>{row.received.toLocaleString()}</td>
                  </tr>
                ))}
                {meta.perBusiness.length === 0 && (
                  <tr><td colSpan={3} style={{ ...td, color: '#718096', textAlign: 'center' }}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
