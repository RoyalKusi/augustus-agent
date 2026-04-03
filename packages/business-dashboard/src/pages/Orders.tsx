import { useEffect, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  orderReference: string;
  order_reference?: string;
  customerWaNumber: string;
  customer_wa_number?: string;
  totalAmount: number;
  total_amount?: number;
  currency: string;
  status: string;
  createdAt: string;
  created_at?: string;
}

type OrderStatus = 'pending' | 'pending_external_payment' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'expired' | 'failed';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:                  { label: 'Pending',          color: '#92400e', bg: '#fef3c7' },
  pending_external_payment: { label: 'Awaiting Payment', color: '#1e40af', bg: '#dbeafe' },
  processing:               { label: 'Processing',       color: '#5b21b6', bg: '#ede9fe' },
  shipped:                  { label: 'Shipped',          color: '#065f46', bg: '#d1fae5' },
  completed:                { label: 'Completed',        color: '#14532d', bg: '#bbf7d0' },
  cancelled:                { label: 'Cancelled',        color: '#6b7280', bg: '#f3f4f6' },
  expired:                  { label: 'Expired',          color: '#7f1d1d', bg: '#fee2e2' },
  failed:                   { label: 'Failed',           color: '#991b1b', bg: '#fee2e2' },
};

const STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending:                  ['processing', 'cancelled'],
  pending_external_payment: ['processing', 'completed', 'cancelled'],
  processing:               ['shipped', 'completed', 'cancelled'],
  shipped:                  ['completed', 'cancelled'],
  completed:                [],
  cancelled:                [],
  expired:                  [],
  failed:                   [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(o: Order): Order {
  return {
    ...o,
    orderReference: o.orderReference ?? o.order_reference ?? '',
    customerWaNumber: o.customerWaNumber ?? o.customer_wa_number ?? '',
    totalAmount: o.totalAmount ?? Number(o.total_amount ?? 0),
    createdAt: o.createdAt ?? o.created_at ?? '',
  };
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: '#4a5568', bg: '#e2e8f0' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState({ from: '', to: '', status: '', product_name: '' });
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filters.from) params.set('dateFrom', filters.from);
    if (filters.to) params.set('dateTo', filters.to);
    if (filters.status) params.set('status', filters.status);
    if (filters.product_name) params.set('productName', filters.product_name);
    const qs = params.toString();
    apiFetch<{ orders: Order[] } | Order[]>(`/dashboard/orders${qs ? `?${qs}` : ''}`)
      .then((r) => {
        const list = Array.isArray(r) ? r : (r as { orders: Order[] }).orders ?? [];
        setOrders(list.map(normalize));
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = async () => {
    try {
      const blob = await apiFetchBlob('/dashboard/orders/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'orders.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Export failed.'); }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await apiFetch(`/dashboard/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const setF = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  // Summary counts
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Orders</h2>
        <button onClick={exportCSV} style={exportBtn}>⬇ Export CSV</button>
      </div>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 4, marginBottom: 20 }}>
        {orders.length} order{orders.length !== 1 ? 's' : ''} found
      </p>

      {error && <p style={errStyle}>{error}</p>}

      {/* Status summary pills */}
      {orders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {Object.entries(counts).map(([status, count]) => {
            const m = STATUS_META[status] ?? { label: status, color: '#4a5568', bg: '#e2e8f0' };
            return (
              <button
                key={status}
                onClick={() => setFilters((f) => ({ ...f, status: f.status === status ? '' : status }))}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: m.color, background: filters.status === status ? m.color : m.bg, border: `1px solid ${m.color}20`, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {filters.status === status ? <span style={{ color: '#fff' }}>{m.label} {count}</span> : <>{m.label} {count}</>}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, padding: '12px 16px', background: '#f7fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={filters.from} onChange={setF('from')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={filters.to} onChange={setF('to')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={filters.status} onChange={setF('status')} style={inputStyle}>
            <option value="">All</option>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Product</label>
          <input placeholder="Product name" value={filters.product_name} onChange={setF('product_name')} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={load} style={filterBtn}>Search</button>
        </div>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#a0aec0', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
          No orders found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map((o) => {
            const transitions = STATUS_TRANSITIONS[o.status] ?? [];
            const isExpanded = expandedId === o.id;
            return (
              <div key={o.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Main row */}
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, padding: '14px 16px', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#2d3748' }}>{o.orderReference}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#a0aec0' }}>
                      {new Date(o.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>Customer</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#2d3748', fontFamily: 'monospace' }}>{o.customerWaNumber}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>Amount</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#2d3748' }}>{o.currency} {o.totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 16px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#718096', marginRight: 4 }}>Update status:</span>
                    {transitions.length === 0 ? (
                      <span style={{ fontSize: 12, color: '#a0aec0', fontStyle: 'italic' }}>No further actions available</span>
                    ) : (
                      transitions.map((s) => {
                        const m = STATUS_META[s];
                        return (
                          <button
                            key={s}
                            disabled={updatingId === o.id}
                            onClick={(e) => { e.stopPropagation(); updateStatus(o.id, s); }}
                            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: m.color, background: m.bg, border: `1px solid ${m.color}40`, cursor: 'pointer', opacity: updatingId === o.id ? 0.6 : 1 }}
                          >
                            {updatingId === o.id ? '…' : `Mark ${m.label}`}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#718096', display: 'block', marginBottom: 3 };
const inputStyle: React.CSSProperties = { padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e0', background: '#fff' };
const filterBtn: React.CSSProperties = { padding: '7px 18px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const exportBtn: React.CSSProperties = { padding: '7px 16px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 };
