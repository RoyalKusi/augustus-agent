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
      const token = localStorage.getItem('augustus_operator_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications?limit=20`, {
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
      const token = localStorage.getItem('augustus_operator_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications/${id}/read`, {
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
      const token = localStorage.getItem('augustus_operator_token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications/mark-all-read`, {
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
        .mark-all-btn:hover { background: #eff6ff !important; color: #1d4ed8 !important; }
        .close-btn:hover { background: #f3f4f6 !important; color: #374151 !important; }
        .view-all-link:hover { text-decoration: underline; color: #1d4ed8 !important; }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40 }} />

      {/* Panel */}
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 8,
        width: 384, background: '#fff', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 50,
        maxHeight: 560, display: 'flex', flexDirection: 'column',
        border: '1px solid #e5e7eb', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: '#2563eb', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Notifications
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={handleMarkAllAsRead} className="mark-all-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontWeight: 600, transition: 'all 0.15s' }}>
              <CheckCheck size={14} /> Mark all read
            </button>
            <button onClick={onClose} className="close-btn"
              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', borderRadius: 6, display: 'flex', transition: 'all 0.15s' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #dbeafe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ width: 56, height: 56, background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <CheckCheck size={28} color="#9ca3af" />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#374151' }}>All caught up!</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>No new notifications</p>
            </div>
          ) : (
            notifications.map(notification => (
              <NotificationItem key={notification.id} notification={notification} onClick={() => handleMarkAsRead(notification.id)} />
            ))
          )}
        </div>

        {/* Footer */}
        {hasMore && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'center' }}>
            <a href="/admin/notifications" className="view-all-link"
              style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none', transition: 'color 0.15s' }}>
              View All Notifications →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
