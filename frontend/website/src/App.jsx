import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import { trackPageview } from './utils/tracker';

// بعد از دیپلوی، چانک‌های هش‌دارِ قدیمی پاک می‌شوند؛ اگر مرورگرِ کاربر index.htmlِ
// کهنه را داشته باشد، import داینامیک ۴۰۴ می‌شود. در این حالت یک‌بار صفحه را ریلود
// می‌کنیم تا index.html و چانک‌های تازه بارگذاری شوند (گاردِ sessionStorage مانعِ حلقه).
const lazyWithReload = (factory) =>
  lazy(() =>
    factory().catch((err) => {
      if (!sessionStorage.getItem('chunk_reloaded')) {
        sessionStorage.setItem('chunk_reloaded', '1');
        window.location.reload();
        return new Promise(() => {}); // معلق تا ریلود
      }
      throw err;
    })
  );

const HomePage = lazyWithReload(() => import('./pages/HomePage'));
const AcademyPage = lazyWithReload(() => import('./pages/AcademyPage'));
const CopyTradePage = lazyWithReload(() => import('./pages/CopyTradePage'));
const SignalsPage = lazyWithReload(() => import('./pages/SignalsPage'));
const PerformancePage = lazyWithReload(() => import('./pages/PerformancePage'));
const BacktestPage = lazyWithReload(() => import('./pages/BacktestPage'));
const LivePricesPage = lazyWithReload(() => import('./pages/LivePricesPage'));
const LivePage = lazyWithReload(() => import('./pages/LivePage'));
const EducationPage = lazyWithReload(() => import('./pages/EducationPage'));
const NewsPage = lazyWithReload(() => import('./pages/NewsPage'));
const AnalysisPage = lazyWithReload(() => import('./pages/AnalysisPage'));
const BlogPage = lazyWithReload(() => import('./pages/BlogPage'));
const ArticlePage = lazyWithReload(() => import('./pages/ArticlePage'));
const TagPage = lazyWithReload(() => import('./pages/TagPage'));
const BrokerPage = lazyWithReload(() => import('./pages/BrokerPage'));
const AboutPage = lazyWithReload(() => import('./pages/AboutPage'));
const ContactPage = lazyWithReload(() => import('./pages/ContactPage'));
const NotFoundPage = lazyWithReload(() => import('./components/common/NotFoundPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-dark-400 text-sm">در حال بارگذاری...</p>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <div className="text-5xl text-red-500">!</div>
            <h2 className="text-xl font-bold text-dark-100">خطایی رخ داده است</h2>
            <p className="text-dark-400 text-sm max-w-md">
              متاسفانه مشکلی پیش آمده است. لطفا صفحه را مجددا بارگذاری کنید.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              بارگذاری مجدد
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const location = useLocation();
  // برنامه با موفقیت سوار شد → گاردِ ریلود را پاک کن تا دیپلویِ بعدی هم خودکار ریکاور شود
  useEffect(() => { sessionStorage.removeItem('chunk_reloaded'); }, []);
  // ثبتِ بازدید در هر تغییرِ مسیر (آنالیتیکسِ پنلِ ادمین)
  useEffect(() => { trackPageview(location.pathname + location.search); }, [location.pathname, location.search]);

  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/academy" element={<AcademyPage />} />
            <Route path="/copy-trade" element={<CopyTradePage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/live-prices" element={<LivePricesPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/education" element={<EducationPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/tag/:tag" element={<TagPage />} />
            <Route path="/broker" element={<BrokerPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
