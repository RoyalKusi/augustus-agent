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
      className="relative p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-all duration-200"
      aria-label={`Notifications${shouldShow ? ` (${displayCount} unread)` : ''}`}
    >
      <Bell className={`w-6 h-6 ${shouldShow ? 'text-blue-600' : ''}`} />
      {shouldShow && (
        <span
          className={`absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold leading-none text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-lg border-2 border-white ${
            animate ? 'animate-bounce' : ''
          }`}
          style={{
            animation: animate ? 'bounce 0.5s ease-in-out 2' : 'none'
          }}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}
