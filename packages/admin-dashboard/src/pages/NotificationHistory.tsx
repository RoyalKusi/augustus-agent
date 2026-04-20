import { useEffect, useState } from 'react';
import { Bell, Filter, Sparkles, RefreshCw, CheckCheck, Inbox } from 'lucide-react';
import { NotificationItem } from '../components/NotificationItem';
import { adminApiFetch } from '../api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { fetchNotifications(0); }, [filter, typeFilter]);

  const fetchNotifications = async (currentOffset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', offset: currentOffset.toString() });
      if (filter === 'unread') params.append('unread', 'true');
      if (typeFilter !== 'all') params.append('type', typeFilter);
      const data = await adminApiFetch<{ notifications: Notification[]; hasMore: boolean }>(`/admin/notifications?${params}`);
      if (currentOffset === 0) setNotifications(data.notifications || []);
      else setNotifications(prev => [...prev, ...(data.notifications || [])]);
      setHasMore(data.hasMore || false);
      setOffset(currentOffset);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => fetchNotifications(offset + 20);

  const handleMarkAsRead = async (id: string) => {
    try {
      await adminApiFetch(`/admin/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc, #eff6ff, #eef2ff)', padding: '24px' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .load-more-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(37,99,235,0.4) !important; }
        .refresh-btn:hover:not(:disabled) { background: rgba(255,255,255,0.35) !important; }
        .select-field:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Hero Header */}
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)', borderRadius: 24, padding: '40px 48px', marginBottom: 24, boxShadow: '0 20px 60px rgba(37,99,235,0.35)' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 256, height: 256, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 192, height: 192, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.2)', borderRadius: 18, backdropFilter: 'blur(8px)' }}>
                  <Bell size={32} color="#fff" />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Notification History</h1>
                  <p style={{ margin: '6px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>View and manage all system notifications</p>
                </div>
              </div>
              <button onClick={() => fetchNotifications(0)} disabled={loading} className="refresh-btn"
                style={{ padding: 14, background: 'rgba(255,255,255,0.2)', borderRadius: 16, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'background 0.2s', backdropFilter: 'blur(8px)' }}>
                <RefreshCw size={24} color="#fff" style={{ animation: loading ? 'spin 1s linear infinite' : 'none', display: 'block' }} />
              </button>
            </div>
            {unreadCount > 0 && (
              <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', padding: '8px 18px', borderRadius: 30 }}>
                <span style={{ width: 8, height: 8, background: '#fde047', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', padding: '18px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: '#dbeafe', borderRadius: 12 }}><Filter size={18} color="#2563eb" /></div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Filter Notifications</h3>
          </div>
          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%', display: 'inline-block' }} />Status
              </label>
              <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'unread')} className="select-field"
                style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 14, padding: '12px 16px', fontSize: 14, fontWeight: 600, background: '#fff', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                <option value="all">📋 All Notifications</option>
                <option value="unread">🔔 Unread Only</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, background: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />Type
              </label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select-field"
                style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 14, padding: '12px 16px', fontSize: 14, fontWeight: 600, background: '#fff', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                <option value="all">🌟 All Types</option>
                <option value="system_alert">⚠️ System Alerts</option>
                <option value="support_ticket">🎫 Support Tickets</option>
                <option value="subscription_update">💳 Subscriptions</option>
                <option value="payment_event">💰 Payments</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification List */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
          {loading && offset === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px' }}>
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #bfdbfe' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid transparent', borderTopColor: '#2563eb', animation: 'spin 1s linear infinite' }} />
              </div>
              <p style={{ marginTop: 24, color: '#374151', fontWeight: 600, fontSize: 17 }}>Loading notifications...</p>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Please wait while we fetch your notifications</p>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', color: '#6b7280' }}>
              <div style={{ position: 'relative', marginBottom: 24 }}>
                <div style={{ width: 96, height: 96, background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Inbox size={48} color="#2563eb" />
                </div>
                <div style={{ position: 'absolute', top: -8, right: -8, width: 32, height: 32, background: 'linear-gradient(135deg, #fbbf24, #f97316)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#111827' }}>All Clear!</p>
              <p style={{ margin: '0 0 4px', fontSize: 16, color: '#374151' }}>No notifications found</p>
              <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Try adjusting your filters or check back later</p>
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid #f3f4f6' }}>
                {notifications.map((notification, i) => (
                  <div key={notification.id} style={{ borderBottom: i < notifications.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <NotificationItem notification={notification} onClick={() => handleMarkAsRead(notification.id)} />
                  </div>
                ))}
              </div>
              {hasMore && (
                <div style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(to bottom, #fff, #f9fafb)', borderTop: '2px solid #f3f4f6' }}>
                  <button onClick={handleLoadMore} disabled={loading} className="load-more-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)', color: '#fff', border: 'none', borderRadius: 16, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, boxShadow: '0 4px 16px rgba(37,99,235,0.3)', transition: 'all 0.2s' }}>
                    {loading ? (
                      <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Loading More...</>
                    ) : (
                      <><CheckCheck size={18} />Load More Notifications</>
                    )}
                  </button>
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#9ca3af' }}>Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Card */}
        {notifications.length > 0 && (
          <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)', borderRadius: 24, padding: '28px 36px', boxShadow: '0 12px 40px rgba(99,102,241,0.3)' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ padding: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 16, flexShrink: 0 }}><Sparkles size={24} color="#fff" /></div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontWeight: 700, color: '#fff', fontSize: 16 }}>Stay Updated</h4>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Click on any notification to mark it as read and keep your inbox organized</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
