import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';

interface LoginResponse {
  token: string;
}

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

  return (
    <div style={containerStyle}>
      <h2>Login</h2>
      {(stateMsg || verifiedMsg) && (
        <p style={{ color: verified === 'error' ? '#c53030' : '#276749', background: verified === 'error' ? '#fff5f5' : '#f0fff4', padding: '8px 12px', borderRadius: 4 }}>
          {stateMsg || verifiedMsg}
        </p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={submit} style={formStyle}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 400,
  margin: '60px auto',
  padding: 24,
  fontFamily: 'sans-serif',
};
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const inputStyle: React.CSSProperties = { padding: '8px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' };
const btnStyle: React.CSSProperties = {
  padding: '10px',
  background: '#3182ce',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
};
