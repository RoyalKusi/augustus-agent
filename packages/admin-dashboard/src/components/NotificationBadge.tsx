import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  onClick: () => void;
}

export function NotificationBadge({ onClick }: NotificationBadgeProps) {
  const [count, setCount] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('operatorToken');
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;
        
        // Trigger animation if count increased
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
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      aria-label={`Notifications${shouldShow ? ` (${displayCount} unread)` : ''}`}
    >
      <Bell className="w-6 h-6" />
      {shouldShow && (
        <span
          className={`absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full ${
            animate ? 'animate-pulse' : ''
          }`}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}
