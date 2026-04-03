import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now log in.');
      })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <div style={containerStyle}>
      <h2>Email Verification</h2>
      {status === 'loading' && <p>Verifying your email…</p>}
      {status === 'success' && (
        <>
          <p style={{ color: '#276749' }}>{message}</p>
          <Link to="/login">Go to Login</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p style={{ color: '#c53030' }}>{message}</p>
          <Link to="/register">Back to Register</Link>
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
