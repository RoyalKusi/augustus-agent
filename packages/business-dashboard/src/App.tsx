import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Subscription from './pages/Subscription';
import WhatsAppSetup from './pages/WhatsAppSetup';
import Catalogue from './pages/Catalogue';
import Training from './pages/Training';
import Conversations from './pages/Conversations';
import Orders from './pages/Orders';
import Revenue from './pages/Revenue';
import Support from './pages/Support';
import PaymentSettings from './pages/PaymentSettings';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={<DashboardLayout />}
        >
          <Route index element={<Navigate to="/dashboard/subscription" replace />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="whatsapp" element={<WhatsAppSetup />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="training" element={<Training />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="orders" element={<Orders />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="support" element={<Support />} />
          <Route path="payments" element={<PaymentSettings />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
