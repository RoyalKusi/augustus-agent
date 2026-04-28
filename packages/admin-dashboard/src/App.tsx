import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Businesses from './pages/Businesses';
import BusinessDashboard from './pages/BusinessDashboard';
import Metrics from './pages/Metrics';
import SubscriptionMetrics from './pages/SubscriptionMetrics';
import Withdrawals from './pages/Withdrawals';
import TokenOverride from './pages/TokenOverride';
import PlanManagement from './pages/PlanManagement';
import PromoCodes from './pages/PromoCodes';
import ApiKeyStatus from './pages/ApiKeyStatus';
import SupportTickets from './pages/SupportTickets';
import { NotificationHistory } from './pages/NotificationHistory';
import ReferralCommission from './pages/ReferralCommission';
import MessageTemplates from './pages/MessageTemplates';

export default function App() {
  const basename = import.meta.env.PROD ? '/admin-app' : '';
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/businesses" replace />} />
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/businesses" replace />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="businesses/:id/dashboard" element={<BusinessDashboard />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="metrics/subscriptions" element={<SubscriptionMetrics />} />
          <Route path="withdrawals" element={<Withdrawals />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="token-override" element={<TokenOverride />} />
          <Route path="plan-management" element={<PlanManagement />} />
          <Route path="promo-codes" element={<PromoCodes />} />
          <Route path="api-keys" element={<ApiKeyStatus />} />
          <Route path="referral-commission" element={<ReferralCommission />} />
          <Route path="notifications" element={<NotificationHistory />} />
          <Route path="message-templates" element={<MessageTemplates />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
