import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { userAPI, tokenStore } from './api/client';
import { useAuth } from './store';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import CopyTradePage from './pages/CopyTradePage';
import HistoryPage from './pages/HistoryPage';
import AccountPage from './pages/AccountPage';
import ProfilePage from './pages/ProfilePage';
import VipGate from './pages/VipGate';

function Protected({ children }) {
  const { profile } = useAuth();
  const loc = useLocation();
  if (!tokenStore.get()) return <Navigate to="/login" replace />;
  if (!profile) return <Spinner />;
  if (!profile.panel_allowed) return <VipGate state={profile.panel_state} />;
  // آنبوردینگِ اجباری: ایمیلِ تأییدشده + پذیرشِ سلبِ مسئولیت
  const needsOnboard = !profile.email_verified || !profile.disclaimer_accepted;
  if (needsOnboard && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { profile, setProfile } = useAuth();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    sessionStorage.removeItem('chunk_reloaded');
    if (!tokenStore.get()) { setBooting(false); return; }
    userAPI.me().then((p) => setProfile(p)).catch(() => tokenStore.clear()).finally(() => setBooting(false));
  }, [setProfile]);

  if (booting) return <Spinner label="در حال ورود…" />;

  return (
    <Routes>
      <Route path="/login" element={tokenStore.get() && profile ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/copy" element={<Protected><CopyTradePage /></Protected>} />
      <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
      <Route path="/account" element={<Protected><AccountPage /></Protected>} />
      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
