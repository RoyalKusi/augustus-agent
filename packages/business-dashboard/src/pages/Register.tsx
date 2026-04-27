import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function Register() {
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') ?? '';

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { ...form };
      if (refCode) body.referralCode = refCode;
      // Use plain fetch — registration doesn't require auth token
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Registration failed (${res.status})`);
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={containerStyle}>
        <h2>Registration successful</h2>
        <p>Check your email to verify your account.</p>
        <Link to="/login">Back to login</Link>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2>Create your account</h2>
      {refCode && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, fontSize: 13, color: '#276749' }}>
          🎉 You were referred! Referral code: <strong>{refCode}</strong>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={submit} style={formStyle}>
        <label>Business Name</label>
        <input value={form.businessName} onChange={set('businessName')} required style={inputStyle} />
        <label>Owner Name</label>
        <input value={form.ownerName} onChange={set('ownerName')} required style={inputStyle} />
        <label>Email</label>
        <input type="email" value={form.email} onChange={set('email')} required style={inputStyle} />
        <label>Password</label>
        <input type="password" value={form.password} onChange={set('password')} required style={inputStyle} />
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Registering…' : 'Register'}
        </button>
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}

const containerStyle: React.CSSProperties = { maxWidth: 400, margin: '60px auto', padding: 24, fontFamily: 'sans-serif' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const inputStyle: React.CSSProperties = { padding: '8px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' };
const btnStyle: React.CSSProperties = { padding: '10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
