import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import CreditUsageWidget from './CreditUsageWidget';

const navItems = [
  { to: '/dashboard/subscription', label: 'Subscription' },
  { to: '/dashboard/whatsapp', label: 'WhatsApp Setup' },
  { to: '/dashboard/catalogue', label: 'Catalogue' },
  { to: '/dashboard/training', label: 'Training' },
  { to: '/dashboard/conversations', label: 'Conversations' },
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/revenue', label: 'Revenue' },
  { to: '/dashboard/payments', label: 'Payments' },
  { to: '/dashboard/support', label: 'Support' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('augustus_token');

  if (!token) return <Navigate to="/login" replace />;

  const logout = () => {
    localStorage.removeItem('augustus_token');
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside
        style={{
          width: 200,
          background: '#1a202c',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', fontWeight: 700, fontSize: 16 }}>Augustus</div>
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        <div style={{ padding: '0 16px 8px' }}>
          <CreditUsageWidget />
        </div>
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
      <main style={{ flex: 1, padding: 24, background: '#f7fafc' }}>
        <Outlet />
      </main>
    </div>
  );
}
