import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ otpRequired?: boolean; operatorId?: string; token?: string }>(
        '/admin/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      if (res.token) {
        localStorage.setItem('augustus_operator_token', res.token);
        navigate('/admin');
      } else if (res.otpRequired && res.operatorId) {
        setOperatorId(res.operatorId);
        setStep(2);
      } else {
        setError('Unexpected response from server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, otpCode }),
      });
      localStorage.setItem('augustus_operator_token', res.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setOtpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f7fafc', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: 18 }}>Augustus Admin</h2>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#4a5568' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={{ width: '100%', padding: '9px 10px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#4a5568' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 10px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14 }}
              />
            </div>
            {error && <p style={{ color: '#c53030', fontSize: 13, margin: '0 0 12px', background: '#fff5f5', padding: '8px 10px', borderRadius: 6, border: '1px solid #feb2b2' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: loading ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              {loading ? 'Sending code…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2}>
            <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#2b6cb0' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                A 6-digit code was sent to <strong>silveraugustus@gmail.com</strong>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#4a5568' }}>Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                style={{ width: '100%', padding: '12px 10px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 24, letterSpacing: 10, textAlign: 'center' }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#a0aec0' }}>Code expires in 10 minutes.</p>
            </div>
            {error && <p style={{ color: '#c53030', fontSize: 13, margin: '0 0 12px', background: '#fff5f5', padding: '8px 10px', borderRadius: 6, border: '1px solid #feb2b2' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              style={{ width: '100%', padding: '10px', background: (loading || otpCode.length !== 6) ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: (loading || otpCode.length !== 6) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              {loading ? 'Verifying…' : 'Verify & Login'}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading}
                style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#718096' }}
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setOtpCode(''); setError(''); }}
                style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#718096' }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
