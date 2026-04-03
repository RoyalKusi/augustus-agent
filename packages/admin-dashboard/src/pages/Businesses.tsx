import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

interface Business {
  id: string;
  name: string;
  email: string;
  status: string;
  plan?: string | null;
  createdAt?: string;
}

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);
      const qs = params.toString();
      const data = await apiFetch<{ businesses: Business[]; total: number }>(
        `/admin/businesses${qs ? `?${qs}` : ''}`
      );
      setBusinesses(data.businesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const suspend = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/suspend`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const reactivate = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/reactivate`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Business Accounts</h2>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14, minWidth: 220 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
        >
          <option value="all">All Plans</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
        <button type="submit" style={{ padding: '6px 14px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
          Search
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {actionError && <p style={{ color: 'red' }}>{actionError}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#edf2f7' }}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Plan</th>
              <th style={th}>Status</th>
              <th style={th}>Registered</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{b.name}</td>
                <td style={td}>{b.email}</td>
                <td style={td}>{b.plan ?? '—'}</td>
                <td style={td}>{b.status}</td>
                <td style={td}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {b.status !== 'suspended' ? (
                      <button onClick={() => suspend(b.id)} style={btnDanger}>Suspend</button>
                    ) : (
                      <button onClick={() => reactivate(b.id)} style={btnSuccess}>Reactivate</button>
                    )}
                    <button
                      onClick={() => navigate(`/admin/businesses/${b.id}/dashboard`)}
                      style={btnSecondary}
                    >
                      View Dashboard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#718096' }}>
                  No businesses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSuccess: React.CSSProperties = { padding: '4px 10px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
