import { useState } from 'react';
import { apiFetch } from '../api';

export default function TokenOverride() {
  const [businessId, setBusinessId] = useState('');
  const [monthlyCapUsd, setMonthlyCapUsd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiFetch(`/admin/businesses/${businessId}/token-override`, {
        method: 'POST',
        body: JSON.stringify({ monthlyCapUsd: parseFloat(monthlyCapUsd) }),
      });
      setSuccess(`Token limit override applied for business ${businessId}.`);
      setBusinessId('');
      setMonthlyCapUsd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply override');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Hard Token Limit Override</h2>
      <p style={{ color: '#4a5568', fontSize: 14 }}>
        Set a custom monthly token cost cap (USD) for a specific business, overriding their tier default.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: 400, background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0' }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Business ID
          </label>
          <input
            type="text"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            required
            placeholder="UUID of the business"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>
            Monthly Cap (USD)
          </label>
          <input
            type="number"
            value={monthlyCapUsd}
            onChange={(e) => setMonthlyCapUsd(e.target.value)}
            required
            min="0"
            step="0.01"
            placeholder="e.g. 50.00"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 14 }}
          />
        </div>

        {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}
        {success && <p style={{ color: '#38a169', fontSize: 13 }}>{success}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 20px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
        >
          {loading ? 'Applying...' : 'Apply Override'}
        </button>
      </form>
    </div>
  );
}
