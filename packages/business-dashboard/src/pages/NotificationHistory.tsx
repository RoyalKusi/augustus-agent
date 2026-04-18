import { useEffect, useState } from 'react';
import { NotificationItem } from '../components/NotificationItem';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchNotifications(0);
  }, [filter, typeFilter]);

  const fetchNotifications = async (currentOffset: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('augustus_token');
      if (!token) return;

      const params = new URLSearchParams({
        limit: '20',
        offset: currentOffset.toString(),
      });

      if (filter === 'unread') {
        params.append('unread', 'true');
      }

      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (currentOffset === 0) {
          setNotifications(data.notifications || []);
        } else {
          setNotifications(prev => [...prev, ...(data.notifications || [])]);
        }
        setHasMore(data.hasMore || false);
        setOffset(currentOffset);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    fetchNotifications(offset + 20);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('augustus_token');
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications/${id}/read`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notification History</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="subscription_update">Subscriptions</option>
              <option value="payment_event">Payments</option>
              <option value="referral_earning">Referrals</option>
              <option value="support_ticket">Support Tickets</option>
              <option value="order_update">Orders</option>
              <option value="system_alert">System Alerts</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && offset === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <p className="text-lg">No notifications found</p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleMarkAsRead(notification.id)}
              />
            ))}

            {hasMore && (
              <div className="p-4 text-center border-t border-gray-200">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
