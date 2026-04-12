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

interface BusinessesResponse {
  businesses: Business[];
  total: number;
  page: number;
  totalPages: number;
}

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);
      params.set('page', String(p));
      params.set('limit', '50');
      const data = await apiFetch<BusinessesResponse>(`/admin/businesses?${params.toString()}`);
      setBusinesses(data.businesses);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  const suspend = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/suspend`, { method: 'POST' });
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const reactivate = async (id: string) => {
    setActionError('');
    try {
      await apiFetch(`/admin/businesses/${id}/reactivate`, { method: 'POST' });
      await load(page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ marginTop: 0 }}>Business Accounts</h2>
        <span style={{ fontSize: 13, color: '#718096' }}>{total} total</span>
      </div>

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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button
            onClick={() => { setPage(p => p - 1); load(page - 1); }}
            disabled={page <= 1 || loading}
            style={{ ...btnSecondary, opacity: page <= 1 ? 0.4 : 1 }}
          >← Prev</button>
          <span style={{ fontSize: 13, color: '#718096' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => { setPage(p => p + 1); load(page + 1); }}
            disabled={page >= totalPages || loading}
            style={{ ...btnSecondary, opacity: page >= totalPages ? 0.4 : 1 }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSuccess: React.CSSProperties = { padding: '4px 10px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
