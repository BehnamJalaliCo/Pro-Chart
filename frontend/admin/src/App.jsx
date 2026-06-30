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
const SignalsPage = lazy_(() => import('./pages/SignalsPage'));
const BacktestPage = lazy_(() => import('./pages/BacktestPage'));
const RiskPage = lazy_(() => import('./pages/RiskPage'));
const UsersPage = lazy_(() => import('./pages/UsersPage'));
const PerformancePage = lazy_(() => import('./pages/PerformancePage'));
const ReportsPage = lazy_(() => import('./pages/ReportsPage'));
const MLModelsPage = lazy_(() => import('./pages/MLModelsPage'));
const MonitoringPage = lazy_(() => import('./pages/MonitoringPage'));
const VisitorsPage = lazy_(() => import('./pages/VisitorsPage'));
const SeoPage = lazy_(() => import('./pages/SeoPage'));
const TradeHistoryPage = lazy_(() => import('./pages/TradeHistoryPage'));
const ArticlesPage = lazy_(() => import('./pages/ArticlesPage'));
const BroadcastsPage = lazy_(() => import('./pages/BroadcastsPage'));
const LiveControlPage = lazy_(() => import('./pages/LiveControlPage'));
const AutoTradePage = lazy_(() => import('./pages/AutoTradePage'));
const PanelUsersPage = lazy_(() => import('./pages/PanelUsersPage'));
const SettingsPage = lazy_(() => import('./pages/SettingsPage'));
const AcademyPage = lazy_(() => import('./pages/AcademyPage'));
const IgUsersPage = lazy_(() => import('./pages/IgUsersPage'));

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
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ml-models" element={<MLModelsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/visitors" element={<VisitorsPage />} />
          <Route path="/seo" element={<SeoPage />} />
          <Route path="/trade-history" element={<TradeHistoryPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/broadcasts" element={<BroadcastsPage />} />
          <Route path="/live" element={<LiveControlPage />} />
          <Route path="/auto-trade" element={<AutoTradePage />} />
          <Route path="/panel-users" element={<PanelUsersPage />} />
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/ig-users" element={<IgUsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
