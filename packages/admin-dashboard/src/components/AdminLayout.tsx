import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/admin/businesses', label: 'Businesses' },
  { to: '/admin/metrics', label: 'AI & Meta Metrics', end: true },
  { to: '/admin/metrics/subscriptions', label: 'Subscription Metrics' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/support', label: 'Support Tickets' },
  { to: '/admin/plan-management', label: 'Plan Management' },
  { to: '/admin/api-keys', label: 'API Key Status' },
];

export default function AdminLayout() {
  const navigate = useNavigate();

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
      <main style={{ flex: 1, padding: 24, background: '#f7fafc' }}>
        <Outlet />
      </main>
    </div>
  );
}
