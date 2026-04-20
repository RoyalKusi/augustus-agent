import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { adminApiFetch } from '../api';

interface NotificationBadgeProps {
  onClick: () => void;
}

export function NotificationBadge({ onClick }: NotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const data = await adminApiFetch<{ count: number }>('/admin/notifications/unread-count');
      const newCount = data.count || 0;
      if (newCount > count) {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 1000);
      }
      setCount(newCount);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  const displayCount = count > 99 ? '99+' : count.toString();
  const shouldShow = count > 0;

  return (
    <>
      <style>{`
        @keyframes badgeBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
        .notif-btn:hover { background: #f3f4f6 !important; color: #111827 !important; }
        .notif-btn:focus { outline: 2px solid #3b82f6; outline-offset: 2px; }
      `}</style>
      <button
        onClick={onClick}
        className="notif-btn"
        style={{
          position: 'relative',
          padding: '10px',
          background: 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          color: shouldShow ? '#2563eb' : '#4b5563',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`Notifications${shouldShow ? ` (${displayCount} unread)` : ''}`}
      >
        <Bell size={24} />
        {shouldShow && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '20px',
              color: '#fff',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: 10,
              border: '2px solid #fff',
              boxShadow: '0 2px 6px rgba(220,38,38,0.5)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: animate ? 'badgeBounce 0.4s ease-in-out 2' : 'none',
            }}
          >
            {displayCount}
          </span>
        )}
      </button>
    </>
  );
}
