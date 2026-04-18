import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NotificationBadge } from './NotificationBadge';
import { NotificationCenter } from './NotificationCenter';

const navItems = [
  { to: '/admin/businesses', label: 'Businesses' },
  { to: '/admin/metrics', label: 'AI & Meta Metrics', end: true },
  { to: '/admin/metrics/subscriptions', label: 'Subscription Metrics' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/support', label: 'Support Tickets' },
  { to: '/admin/plan-management', label: 'Plan Management' },
  { to: '/admin/promo-codes', label: 'Promo Codes' },
  { to: '/admin/referral-commission', label: 'Referral Commission' },
  { to: '/admin/api-keys', label: 'API Key Status' },
  { to: '/admin/notifications', label: 'Notifications' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem('augustus_operator_token');
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside
        style={{
          width: 220,
          background: '#1a202c',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', fontWeight: 700, fontSize: 16 }}>
          Augustus Admin
        </div>
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'block',
                padding: '8px 16px',
                color: isActive ? '#63b3ed' : '#cbd5e0',
                textDecoration: 'none',
                fontSize: 14,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          style={{
            margin: '8px 16px 0',
            padding: '6px 0',
            background: 'transparent',
            border: '1px solid #4a5568',
            color: '#cbd5e0',
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          Logout
        </button>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar with Notification Badge */}
        <div style={{ 
          background: '#fff', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          position: 'relative',
          height: '60px'
        }}>
          <div style={{ position: 'relative' }}>
            <NotificationBadge onClick={() => setNotificationCenterOpen(!notificationCenterOpen)} />
            {notificationCenterOpen && (
              <NotificationCenter 
                isOpen={notificationCenterOpen} 
                onClose={() => setNotificationCenterOpen(false)}
              />
            )}
          </div>
        </div>
        <main style={{ flex: 1, padding: 24, background: '#f7fafc' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

