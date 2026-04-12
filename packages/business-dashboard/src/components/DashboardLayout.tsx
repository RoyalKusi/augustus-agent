import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import CreditUsageWidget from './CreditUsageWidget';

// Inline SVG icons — no external dependency needed
const icons: Record<string, JSX.Element> = {
  Subscription: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  'WhatsApp Setup': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Catalogue: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Training: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  Conversations: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 10h8M8 14h5"/>
    </svg>
  ),
  Orders: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  Revenue: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Payments: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  Support: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

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
        <div style={{ padding: '0 16px 16px', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Augustus
        </div>
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 16px',
                color: isActive ? '#63b3ed' : '#cbd5e0',
                textDecoration: 'none',
                fontSize: 14,
                borderLeft: isActive ? '3px solid #63b3ed' : '3px solid transparent',
                background: isActive ? 'rgba(99,179,237,0.08)' : 'transparent',
                transition: 'background 0.15s',
              })}
            >
              <span style={{ opacity: 0.85, flexShrink: 0 }}>{icons[item.label]}</span>
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f7fafc' }}>
        <Outlet />
      </main>
    </div>
  );
}
