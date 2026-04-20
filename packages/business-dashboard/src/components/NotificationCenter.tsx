import { useEffect, useState } from 'react';
import { X, CheckCheck } from 'lucide-react';
import { NotificationItem } from './NotificationItem';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function NotificationCenter({ isOpen, onClose, onCountChange }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('augustus_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setHasMore(data.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('augustus_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/${id}/read`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        const unreadCount = notifications.filter(n => !n.isRead && n.id !== id).length;
        onCountChange?.(unreadCount);
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('augustus_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/mark-all-read`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        onCountChange?.(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .nc-mark-all:hover { background: rgba(99,179,237,0.15) !important; color: #63b3ed !important; }
        .nc-close:hover { background: rgba(255,255,255,0.1) !important; color: #e2e8f0 !important; }
        .nc-view-all:hover { text-decoration: underline; color: #63b3ed !important; }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 8,
        width: 360, background: '#1e2a3a', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', zIndex: 50,
        maxHeight: 520, display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(135deg, rgba(99,179,237,0.12), rgba(49,130,206,0.08))',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, background: '#63b3ed', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Notifications
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={handleMarkAllAsRead} className="nc-mark-all"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#90cdf4', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontWeight: 600, transition: 'all 0.15s' }}>
              <CheckCheck size={13} /> Mark all read
            </button>
            <button onClick={onClose} className="nc-close"
              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#718096', borderRadius: 6, display: 'flex', transition: 'all 0.15s' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(99,179,237,0.2)', borderTopColor: '#63b3ed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 24px', color: '#718096' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <CheckCheck size={24} color="#4a5568" />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#a0aec0' }}>All caught up!</p>
              <p style={{ margin: 0, fontSize: 12, color: '#4a5568' }}>No new notifications</p>
            </div>
          ) : (
            notifications.map(notification => (
              <NotificationItem key={notification.id} notification={notification} onClick={() => handleMarkAsRead(notification.id)} />
            ))
          )}
        </div>

        {/* Footer */}
        {hasMore && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <a href="/dashboard/notifications" className="nc-view-all"
              style={{ fontSize: 13, color: '#90cdf4', fontWeight: 600, textDecoration: 'none', transition: 'color 0.15s' }}>
              View All Notifications →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
