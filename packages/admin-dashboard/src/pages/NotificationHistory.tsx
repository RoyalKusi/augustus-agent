import { useEffect, useState } from 'react';
import { Bell, Filter } from 'lucide-react';
import { NotificationItem } from '../components/NotificationItem';

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

  useEffect(() => {
    fetchNotifications(0);
  }, [filter, typeFilter]);

  const fetchNotifications = async (currentOffset: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('operatorToken');
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
        `${import.meta.env.VITE_API_URL}/admin/notifications?${params}`,
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
      const token = localStorage.getItem('operatorToken');
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/notifications/${id}/read`,
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
            Notification History
          </h1>
          <p className="text-gray-600 mt-2 ml-14">
            View and manage all system notifications
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Status
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            >
              <option value="all">All Notifications</option>
              <option value="unread">Unread Only</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            >
              <option value="all">All Types</option>
              <option value="system_alert">System Alerts</option>
              <option value="support_ticket">Support Tickets</option>
              <option value="subscription_update">Subscriptions</option>
              <option value="payment_event">Payments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && offset === 0 ? (
          <div className="flex items-center justify-center p-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading notifications...</p>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-gray-500">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-700">No notifications found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleMarkAsRead(notification.id)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="p-6 text-center border-t-2 border-gray-200 bg-gray-50">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  {loading ? 'Loading...' : 'Load More Notifications'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
