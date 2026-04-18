import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import CreditUsageWidget from './CreditUsageWidget';
import { isTokenExpired, redirectToLogin, apiFetch } from '../api';
import { useIsMobile } from '../hooks/useIsMobile';
import { NotificationBadge } from './NotificationBadge';
import { NotificationCenter } from './NotificationCenter';

function decodeToken(token: string): { name?: string; email?: string } {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

const icons: Record<string, JSX.Element> = {
  Subscription: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>),
  'WhatsApp Setup': (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
  Catalogue: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  Training: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>),
  Conversations: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg>),
  Orders: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>),
  Revenue: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  Payments: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>),
  Support: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  Referrals: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Documentation: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
};

const baseNavItems = [
  { to: '/dashboard/subscription', label: 'Subscription' },
  { to: '/dashboard/whatsapp', label: 'WhatsApp Setup' },
  { to: '/dashboard/catalogue', label: 'Catalogue' },
  { to: '/dashboard/training', label: 'Training' },
  { to: '/dashboard/conversations', label: 'Conversations' },
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/revenue', label: 'Revenue' },
  { to: '/dashboard/payments', label: 'Payments' },
  { to: '/dashboard/support', label: 'Support' },
  { to: '/dashboard/referrals', label: 'Referrals', referralOnly: true },
  { to: '/dashboard/docs', label: 'Documentation' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const token = localStorage.getItem('augustus_token');

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (isTokenExpired()) { redirectToLogin(); return; }
    const interval = setInterval(() => { if (isTokenExpired()) redirectToLogin(); }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Check referral status once on mount
  useEffect(() => {
    apiFetch<{ referralEnabled: boolean }>('/dashboard/referrals')
      .then(d => setReferralEnabled(d.referralEnabled))
      .catch(() => {});
  }, []);

  if (!token || isTokenExpired()) return <Navigate to="/login" replace />;

  const { name, email } = decodeToken(token);
  const displayName = name ?? email ?? 'Account';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const logout = () => { localStorage.removeItem('augustus_token'); navigate('/login'); };

  const navItems = baseNavItems.filter(n => !('referralOnly' in n) || referralEnabled);
  const currentLabel = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  const sidebar = (
    <aside style={{
      width: 200, background: '#1a202c', color: '#fff',
      display: 'flex', flexDirection: 'column', padding: '16px 0',
      ...(isMobile ? {
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1000,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.4)' : 'none',
      } : {}),
    }}>
      {/* Logo */}
      <div style={{ padding: '0 16px 12px', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        Augustus
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        )}
      </div>

      {/* User card */}
      <div style={{ margin: '0 12px 12px', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #63b3ed, #3182ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
          {email && name && <div style={{ fontSize: 11, color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px',
            color: isActive ? '#63b3ed' : '#cbd5e0', textDecoration: 'none', fontSize: 14,
            borderLeft: isActive ? '3px solid #63b3ed' : '3px solid transparent',
            background: isActive ? 'rgba(99,179,237,0.08)' : 'transparent',
            transition: 'background 0.15s',
          })}>
            <span style={{ opacity: 0.85, flexShrink: 0 }}>{icons[item.label]}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '0 16px 8px' }}><CreditUsageWidget /></div>
      <button onClick={logout} style={{ margin: '8px 16px 0', padding: '6px 0', background: 'transparent', border: '1px solid #4a5568', color: '#cbd5e0', cursor: 'pointer', borderRadius: 4, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Logout
      </button>
    </aside>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      )}

      {sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Desktop top bar */}
        {!isMobile && (
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ position: 'relative' }}>
              <NotificationBadge onClick={() => setNotificationCenterOpen(!notificationCenterOpen)} />
              <NotificationCenter 
                isOpen={notificationCenterOpen} 
                onClose={() => setNotificationCenterOpen(false)}
                onCountChange={setUnreadCount}
              />
            </div>
          </div>
        )}

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ background: '#1a202c', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: '#cbd5e0', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{currentLabel}</span>
            <div style={{ position: 'relative' }}>
              <NotificationBadge onClick={() => setNotificationCenterOpen(!notificationCenterOpen)} />
              <NotificationCenter 
                isOpen={notificationCenterOpen} 
                onClose={() => setNotificationCenterOpen(false)}
                onCountChange={setUnreadCount}
              />
            </div>
          </div>
        )}

        <main style={{ flex: 1, padding: isMobile ? '16px 14px' : 24, background: '#f7fafc', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
