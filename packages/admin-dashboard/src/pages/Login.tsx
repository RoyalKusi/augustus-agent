import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ mfaRequired?: boolean; token?: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, totpCode: '' }),
      });
      if (res.token) {
        // MFA not enabled — logged in directly
        localStorage.setItem('augustus_operator_token', res.token);
        navigate('/admin');
      } else if (res.mfaRequired) {
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
        body: JSON.stringify({ email, password, totpCode }),
      });
      localStorage.setItem('augustus_operator_token', res.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid TOTP code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f7fafc',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: 360,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Augustus Admin Login</h2>

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e0' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e0' }}
              />
            </div>
            {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2}>
            <p style={{ fontSize: 14, color: '#4a5568' }}>Enter the 6-digit code from your authenticator app.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>TOTP Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e0', letterSpacing: 4, fontSize: 18 }}
              />
            </div>
            {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ width: '100%', marginTop: 8, padding: '8px', background: 'transparent', border: '1px solid #cbd5e0', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
