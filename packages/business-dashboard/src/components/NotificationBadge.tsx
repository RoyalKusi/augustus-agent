import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

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
      const token = localStorage.getItem('augustus_token');
      if (!token) return;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;
        if (newCount > count) {
          setAnimate(true);
          setTimeout(() => setAnimate(false), 1000);
        }
        setCount(newCount);
      }
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
        .notif-badge-btn:hover { background: rgba(255,255,255,0.15) !important; }
        .notif-badge-btn:focus { outline: 2px solid #63b3ed; outline-offset: 2px; }
      `}</style>
      <button
        onClick={onClick}
        className="notif-badge-btn"
        style={{
          position: 'relative',
          padding: '10px',
          background: 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          color: shouldShow ? '#63b3ed' : '#a0aec0',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`Notifications${shouldShow ? ` (${displayCount} unread)` : ''}`}
      >
        <Bell size={22} />
        {shouldShow && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '18px',
              color: '#fff',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: 9,
              border: '2px solid #1a202c',
              boxShadow: '0 2px 6px rgba(220,38,38,0.6)',
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
