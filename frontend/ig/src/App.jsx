import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from './api/client';
import { useAuth } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import SmartReply from './pages/SmartReply';
import Content from './pages/Content';
import Inbox from './pages/Inbox';
import Forms from './pages/Forms';
import Autopilot from './pages/Autopilot';
import Cover from './pages/Cover';

function Protected({ children }) {
  const { me, ready, setMe, setReady } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    if (me) { setReady(true); return; }   // me از قبل ست شده (بعد از لاگین) → آماده، گیر نکن
    api.me().then(setMe).catch(() => {}).finally(() => setReady(true));
  }, []);
  if (!ready) return <div className="h-screen grid place-items-center text-ink-muted">در حال بارگذاری…</div>;
  if (!tokenStore.get()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/smart" element={<SmartReply />} />
                <Route path="/content" element={<Content />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/forms" element={<Forms />} />
                <Route path="/autopilot" element={<Autopilot />} />
                <Route path="/cover" element={<Cover />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}
