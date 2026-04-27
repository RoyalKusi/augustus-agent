import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    // Use GET /auth/verify-email?token=... (no auth required)
    fetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setMessage('Your email has been verified! Redirecting to login…');
          setTimeout(() => navigate('/login?verified=true'), 2000);
        } else {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setStatus('error');
          setMessage(data.error ?? 'Verification failed. The link may have expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to connect. Please try again.');
      });
  }, [token, navigate]);

  return (
    <div style={containerStyle}>
      <h2>Email Verification</h2>
      {status === 'loading' && (
        <div>
          <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#3182ce', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '16px auto' }} />
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#718096' }}>Verifying your email…</p>
        </div>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ color: '#276749', fontWeight: 600 }}>{message}</p>
          <Link to="/login" style={{ color: '#3182ce' }}>Go to Login</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <p style={{ color: '#c53030' }}>{message}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            <Link to="/register" style={{ color: '#3182ce' }}>Back to Register</Link>
            <span style={{ color: '#cbd5e0' }}>·</span>
            <Link to="/login" style={{ color: '#3182ce' }}>Login</Link>
          </div>
        </>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 400,
  margin: '60px auto',
  padding: 24,
  fontFamily: 'sans-serif',
  textAlign: 'center',
};
