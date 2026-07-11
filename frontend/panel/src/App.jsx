import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import AdminLayout from './components/Layout/AdminLayout';

// اگر بعد از دیپلوی، چانکِ هش‌دارِ قدیمی ۴۰۴ شد (index.htmlِ کهنه)، یک‌بار صفحه را
// ریلود می‌کنیم تا نسخهٔ تازه بارگذاری شود (گاردِ sessionStorage مانعِ حلقه).
const lazy_ = (factory) =>
  lazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem('admin_chunk_reloaded')) {
        sessionStorage.setItem('admin_chunk_reloaded', '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    })
  );

const LoginPage = lazy_(() => import('./pages/LoginPage'));
const DashboardPage = lazy_(() => import('./pages/DashboardPage'));
const UsersPage = lazy_(() => import('./pages/UsersPage'));
const SubscriptionsPage = lazy_(() => import('./pages/SubscriptionsPage'));
const OrdersPage = lazy_(() => import('./pages/OrdersPage'));
const ExchangePage = lazy_(() => import('./pages/ExchangePage'));
const AiSignalsPage = lazy_(() => import('./pages/AiSignalsPage'));
const ChartsPage = lazy_(() => import('./pages/ChartsPage'));
const AdsPage = lazy_(() => import('./pages/AdsPage'));
const NewsPage = lazy_(() => import('./pages/NewsPage'));
const BroadcastsPage = lazy_(() => import('./pages/BroadcastsPage'));
const AnalyticsPage = lazy_(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy_(() => import('./pages/SettingsPage'));

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-text-muted">در حال بارگذاری...</span>
      </div>
    </div>
  );
}

export default function App() {
  React.useEffect(() => { sessionStorage.removeItem('admin_chunk_reloaded'); }, []);
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/exchange" element={<ExchangePage />} />
          <Route path="/ai-signals" element={<AiSignalsPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/broadcasts" element={<BroadcastsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
