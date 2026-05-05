import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface ReferralEntry {
  id: string;
  referredEmail: string;
  referredName: string;
  status: 'registered' | 'subscribed';
  createdAt: string;
  earningsUsd: number | null;
  currentPlan: string | null;
}

interface ReferralData {
  referralEnabled: boolean;
  referralCode: string | null;
  totalEarningsUsd: number;
  referrals: ReferralEntry[];
}

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;

const PLAN_LABELS: Record<string, string> = {
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  silver: { bg: '#c6f6d5', color: '#276749' },
  gold:   { bg: '#fefcbf', color: '#975a16' },
  platinum: { bg: '#e9d8fd', color: '#553c9a' },
};

export default function Referrals() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<ReferralData>('/dashboard/referrals')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const referralLink = data?.referralCode
    ? `${BASE_URL}/register?ref=${data.referralCode}`
    : null;

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareWhatsApp = () => {
    if (!referralLink) return;
    const text = encodeURIComponent(`Join me on Augustus — the AI-powered WhatsApp sales platform! Sign up here: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const totalReferrals = data?.referrals.length ?? 0;
  const subscribed = data?.referrals.filter(r => r.status === 'subscribed').length ?? 0;
  const totalEarnings = data?.totalEarningsUsd ?? 0;

  if (loading) return <div style={{ color: '#718096', padding: 24 }}>Loading…</div>;

  if (!data?.referralEnabled) {
    return (
      <div style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Referrals</h2>
        <div style={{ padding: '32px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2d3748', marginBottom: 8 }}>Referrals not enabled</div>
          <div style={{ fontSize: 14, color: '#718096' }}>
            Contact support to get your referral link activated.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Referrals</h2>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Share your link and earn commission when friends subscribe.
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Referrals</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2d3748' }}>{totalReferrals}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Subscribed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#38a169' }}>{subscribed}</div>
        </div>
        <div style={{ background: totalEarnings > 0 ? '#f0fff4' : '#fff', border: `1px solid ${totalEarnings > 0 ? '#9ae6b4' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Earnings</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: totalEarnings > 0 ? '#276749' : '#2d3748' }}>
            ${totalEarnings.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Referral link card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 10 }}>Your Referral Link</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0, padding: '9px 12px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#2d3748', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            style={{ padding: '9px 16px', background: copied ? '#38a169' : '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', transition: 'background 0.2s' }}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
          <button
            onClick={shareWhatsApp}
            style={{ padding: '9px 16px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share on WhatsApp
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#a0aec0' }}>
          Code: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#4a5568' }}>{data.referralCode}</span>
        </div>
      </div>

      {/* Referrals table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#4a5568' }}>
          People You've Referred ({totalReferrals})
        </div>
        {totalReferrals === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#a0aec0', fontSize: 14 }}>
            No referrals yet. Share your link to get started!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={th}>Business</th>
                <th style={th}>Email</th>
                <th style={th}>Status</th>
                <th style={th}>Plan</th>
                <th style={th}>Earnings</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.map(r => {
                const planKey = r.currentPlan?.toLowerCase() ?? null;
                const planStyle = planKey ? (PLAN_COLORS[planKey] ?? { bg: '#e2e8f0', color: '#4a5568' }) : null;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={td}>{r.referredName}</td>
                    <td style={{ ...td, color: '#718096', fontSize: 12 }}>{r.referredEmail}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: r.status === 'subscribed' ? '#c6f6d5' : '#ebf8ff',
                        color: r.status === 'subscribed' ? '#276749' : '#2b6cb0',
                      }}>
                        {r.status === 'subscribed' ? 'Subscribed' : 'Registered'}
                      </span>
                    </td>
                    <td style={td}>
                      {planKey && planStyle ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: planStyle.bg, color: planStyle.color,
                        }}>
                          {PLAN_LABELS[planKey] ?? r.currentPlan}
                        </span>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      {r.earningsUsd != null && r.earningsUsd > 0 ? (
                        <span style={{ fontWeight: 600, color: '#276749' }}>${r.earningsUsd.toFixed(2)}</span>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, color: '#718096', fontSize: 12 }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Earnings note */}
      {totalEarnings > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, fontSize: 12, color: '#276749' }}>
          💰 You've earned <strong>${totalEarnings.toFixed(2)}</strong> in referral commissions. Contact support to arrange a payout.
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#718096', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '10px 16px', color: '#2d3748' };
