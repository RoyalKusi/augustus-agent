import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      navigate('/login', { state: { message: 'Password reset successfully. Please log in.' } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#c53030' }}>Invalid reset link.</p>
        <Link to="/forgot-password">Request a new one</Link>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2>Reset Password</h2>
      {error && <p style={{ color: '#c53030' }}>{error}</p>}
      <form onSubmit={submit} style={formStyle}>
        <label>New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="Min 8 chars, upper, lower, digit"
        />
        <label>Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

const containerStyle: React.CSSProperties = { maxWidth: 400, margin: '60px auto', padding: 24, fontFamily: 'sans-serif' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const inputStyle: React.CSSProperties = { padding: '8px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' };
const btnStyle: React.CSSProperties = { padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
