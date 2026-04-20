import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';

// Lazy-loaded pages for faster initial load and smooth navigation
const Subscription    = lazy(() => import('./pages/Subscription'));
const WhatsAppSetup   = lazy(() => import('./pages/WhatsAppSetup'));
const Catalogue       = lazy(() => import('./pages/Catalogue'));
const Training        = lazy(() => import('./pages/Training'));
const TrainingGuide   = lazy(() => import('./pages/TrainingGuide'));
const Conversations   = lazy(() => import('./pages/Conversations'));
const Orders          = lazy(() => import('./pages/Orders'));
const Revenue         = lazy(() => import('./pages/Revenue'));
const Support         = lazy(() => import('./pages/Support'));
const PaymentSettings = lazy(() => import('./pages/PaymentSettings'));
const Referrals       = lazy(() => import('./pages/Referrals'));
const NotificationHistory = lazy(() => import('./pages/NotificationHistory'));
const Docs            = lazy(() => import('./pages/Docs'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes pgSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pgFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #e2e8f0' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#3182ce', animation: 'pgSpin 0.7s linear infinite' }} />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: '#a0aec0', animation: 'pgFade 0.3s ease' }}>Loading…</p>
    </div>
  );
}

export default function App() {
  const token = localStorage.getItem('augustus_token');

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard/subscription" replace />} />
            <Route path="subscription"    element={<Suspense fallback={<PageLoader />}><Subscription /></Suspense>} />
            <Route path="whatsapp"        element={<Suspense fallback={<PageLoader />}><WhatsAppSetup /></Suspense>} />
            <Route path="catalogue"       element={<Suspense fallback={<PageLoader />}><Catalogue /></Suspense>} />
            <Route path="training"        element={<Suspense fallback={<PageLoader />}><Training /></Suspense>} />
            <Route path="training/guide"  element={<Suspense fallback={<PageLoader />}><TrainingGuide /></Suspense>} />
            <Route path="conversations"   element={<Suspense fallback={<PageLoader />}><Conversations /></Suspense>} />
            <Route path="orders"          element={<Suspense fallback={<PageLoader />}><Orders /></Suspense>} />
            <Route path="revenue"         element={<Suspense fallback={<PageLoader />}><Revenue /></Suspense>} />
            <Route path="support"         element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
            <Route path="payments"        element={<Suspense fallback={<PageLoader />}><PaymentSettings /></Suspense>} />
            <Route path="payment-settings" element={<Suspense fallback={<PageLoader />}><PaymentSettings /></Suspense>} />
            <Route path="referrals"       element={<Suspense fallback={<PageLoader />}><Referrals /></Suspense>} />
            <Route path="notifications"   element={<Suspense fallback={<PageLoader />}><NotificationHistory /></Suspense>} />
            <Route path="docs"            element={<Suspense fallback={<PageLoader />}><Docs /></Suspense>} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
