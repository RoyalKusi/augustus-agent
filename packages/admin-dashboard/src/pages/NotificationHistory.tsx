import { useEffect, useState } from 'react';
import { Bell, Filter, Sparkles, RefreshCw, CheckCheck, Inbox } from 'lucide-react';
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

  const handleRefresh = () => {
    fetchNotifications(0);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header with Gradient Background */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white">Notification History</h1>
                  <p className="text-blue-100 mt-1 text-lg">
                    View and manage all system notifications
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl hover:bg-white/30 transition-all disabled:opacity-50"
                title="Refresh notifications"
              >
                <RefreshCw className={`w-6 h-6 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {unreadCount > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-sm">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Filter Notifications</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  Status
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-semibold transition-all hover:border-gray-300"
                >
                  <option value="all">📋 All Notifications</option>
                  <option value="unread">🔔 Unread Only</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 font-semibold transition-all hover:border-gray-300"
                >
                  <option value="all">🌟 All Types</option>
                  <option value="system_alert">⚠️ System Alerts</option>
                  <option value="support_ticket">🎫 Support Tickets</option>
                  <option value="subscription_update">💳 Subscriptions</option>
                  <option value="payment_event">💰 Payments</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Notification List */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          {loading && offset === 0 ? (
            <div className="flex flex-col items-center justify-center p-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0 left-0"></div>
              </div>
              <p className="mt-6 text-gray-600 font-semibold text-lg">Loading notifications...</p>
              <p className="text-gray-500 text-sm mt-1">Please wait while we fetch your notifications</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-gray-500">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <Inbox className="w-12 h-12 text-blue-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-2">All Clear!</p>
              <p className="text-lg text-gray-600 mb-1">No notifications found</p>
              <p className="text-sm text-gray-500">Try adjusting your filters or check back later</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleMarkAsRead(notification.id)}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="p-8 text-center border-t-2 border-gray-100 bg-gradient-to-b from-white to-gray-50">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="group relative px-10 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 hover:scale-105 text-base"
                  >
                    {loading ? (
                      <span className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Loading More...
                      </span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <CheckCheck className="w-5 h-5" />
                        Load More Notifications
                      </span>
                    )}
                  </button>
                  <p className="text-sm text-gray-500 mt-3">
                    Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Card */}
        {notifications.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-6 shadow-2xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-10 rounded-full -mr-24 -mt-24"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Stay Updated</h4>
                <p className="text-white/90 text-sm">
                  Click on any notification to mark it as read and keep your inbox organized
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
