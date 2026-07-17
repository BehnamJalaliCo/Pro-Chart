import { Routes, Route, Navigate } from 'react-router-dom';
import { tokenStore, useAuth } from './api/client';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MarketPage from './pages/MarketPage';
import AiSignalsPage from './pages/AiSignalsPage';
import TradingPage from './pages/TradingPage';
import ConnectPage from './pages/ConnectPage';
import SubscriptionPage from './pages/SubscriptionPage';
import ProfilePage from './pages/ProfilePage';

// ورودِ یکپارچه (SSO): یک‌بار در زمانِ بارگذاری، کوکیِ دامنهٔ مشترک را بپذیر.
tokenStore.bootSSO();

function ProtectedRoute({ children }) {
  const isAuthed = useAuth((s) => s.isAuthed) || !!tokenStore.get();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const isAuthed = useAuth((s) => s.isAuthed) || !!tokenStore.get();
  return (
    <Routes>
      <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
      <Route path="/signals" element={<ProtectedRoute><AiSignalsPage /></ProtectedRoute>} />
      <Route path="/trade" element={<ProtectedRoute><TradingPage /></ProtectedRoute>} />
      <Route path="/connect" element={<ProtectedRoute><ConnectPage /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
