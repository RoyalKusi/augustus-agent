import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

interface LoginResponse {
  token: string;
}

const QUICK_DOCS = [
  {
    icon: '🚀',
    title: 'Getting Started',
    steps: [
      'Register your business account and verify your email.',
      'Choose a subscription plan (Silver, Gold, or Platinum).',
      'Connect your WhatsApp Business number via the WhatsApp Setup page.',
      'Add your products to the Catalogue.',
      'Upload training data so the AI knows your brand and tone.',
    ],
  },
  {
    icon: '💬',
    title: 'How the AI Works',
    steps: [
      'Customers message your WhatsApp number — the AI replies automatically.',
      'It answers product questions, shows your catalogue, and sends payment links.',
      'You can take over any conversation manually from the Conversations page.',
      'Hand back to AI when you\'re done — it picks up the context.',
    ],
  },
  {
    icon: '📦',
    title: 'Orders & Payments',
    steps: [
      'When a customer confirms a purchase, the AI generates a Paynow link.',
      'If in-chat payments are off, it sends an invoice with your payment details.',
      'Track all orders in the Orders page — filter, update status, export CSV.',
      'Revenue from completed orders appears in the Revenue page.',
    ],
  },
  {
    icon: '⚙️',
    title: 'Key Settings',
    steps: [
      'Payment Settings: switch between Paynow links and manual invoices.',
      'Training: upload your logo, FAQs, tone guidelines, and product documents.',
      'WhatsApp Setup: add your personal number to receive order alerts.',
      'Subscription: upgrade or downgrade your plan at any time.',
    ],
  },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const stateMsg = (location.state as { message?: string } | null)?.message ?? '';
  const verified = searchParams.get('verified');
  const verifiedMsg = verified === 'true'
    ? 'Email verified successfully! You can now log in.'
    : verified === 'error'
    ? 'Verification link is invalid or expired. Please register again.'
    : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || 'Invalid email or password.');
        return;
      }
      localStorage.setItem('augustus_token', data.token);
      navigate('/dashboard');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doc = QUICK_DOCS[activeDoc];

  return (
    <div style={{ maxWidth: 420, margin: '40px auto 60px', padding: '0 16px', fontFamily: 'sans-serif' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo.svg" alt="Augustus" width={56} height={56} style={{ borderRadius: '50%' }} />
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 20, color: '#1a202c', letterSpacing: 0.5 }}>Augustus</div>
        <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>AI Sales Assistant</div>
      </div>

      {/* Login card */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px 28px', marginBottom: 20 }}>
        {(stateMsg || verifiedMsg) && (
          <p style={{ color: verified === 'error' ? '#c53030' : '#276749', background: verified === 'error' ? '#fff5f5' : '#f0fff4', padding: '8px 12px', borderRadius: 6, fontSize: 13, margin: '0 0 14px' }}>
            {stateMsg || verifiedMsg}
          </p>
        )}
        {error && <p style={{ color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 14px' }}>{error}</p>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13, color: '#718096' }}>
          <Link to="/forgot-password" style={{ color: '#3182ce', textDecoration: 'none' }}>Forgot password?</Link>
          <Link to="/register" style={{ color: '#3182ce', textDecoration: 'none' }}>Create account →</Link>
        </div>
      </div>

      {/* Quick docs card */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {QUICK_DOCS.map((d, i) => (
            <button key={i} onClick={() => setActiveDoc(i)} style={{
              flex: '0 0 auto', padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: activeDoc === i ? '2px solid #3182ce' : '2px solid transparent',
              color: activeDoc === i ? '#3182ce' : '#718096',
              fontWeight: activeDoc === i ? 600 : 400,
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {d.icon} {d.title}
            </button>
          ))}
        </div>

        {/* Content — scrollable */}
        <div style={{ padding: '16px 20px', maxHeight: 220, overflowY: 'auto' }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {doc.steps.map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6 }}>{step}</li>
            ))}
          </ol>
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid #f0f0f0', background: '#f7fafc' }}>
          <Link to="/register" style={{ fontSize: 12, color: '#3182ce', textDecoration: 'none' }}>
            New here? Create your free account →
          </Link>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box', outline: 'none' };
const btnStyle: React.CSSProperties = { padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, width: '100%' };
