import { Bell, CreditCard, Users, AlertCircle, MessageSquare, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  account_change: <Settings className="w-5 h-5 text-orange-500" />,
  subscription_update: <CreditCard className="w-5 h-5 text-blue-500" />,
  payment_event: <CreditCard className="w-5 h-5 text-green-500" />,
  referral_earning: <Users className="w-5 h-5 text-purple-500" />,
  support_ticket: <MessageSquare className="w-5 h-5 text-indigo-500" />,
  system_alert: <AlertCircle className="w-5 h-5 text-red-500" />,
  order_update: <Bell className="w-5 h-5 text-teal-500" />,
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const icon = typeIcons[notification.type] || <Bell className="w-5 h-5 text-gray-500" />;
  
  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
  
  const truncatedMessage = notification.message.length > 100
    ? notification.message.substring(0, 100) + '...'
    : notification.message;

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
        !notification.isRead ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex-shrink-0 mt-1">{icon}</div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`text-sm ${!notification.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
            {notification.title}
          </h4>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1"></span>
          )}
        </div>
        
        <p className="text-sm text-gray-600 mt-1">{truncatedMessage}</p>
        
        <p className="text-xs text-gray-400 mt-2">{relativeTime}</p>
      </div>
    </div>
  );
}
