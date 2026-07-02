import React from 'react';

/**
 * ErrorBoundary سراسری — هر خطای رندرِ غیرمنتظره را می‌گیرد و به‌جای صفحهٔ سفید،
 * یک UIِ «بارگذاری مجدد» نشان می‌دهد. اگر خطا از نوعِ chunk/بارگذاریِ ماژول باشد
 * (بعد از دیپلویِ نسخهٔ تازه)، یک‌بار به‌صورتِ خودکار hard-reload می‌کند.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '' };
  }

  componentDidCatch(error) {
    const msg = String(error?.message || '');
    const isChunk = /chunk|dynamically imported module|Importing a module|Failed to fetch/i.test(msg);
    if (isChunk && !sessionStorage.getItem('admin_eb_reloaded')) {
      sessionStorage.setItem('admin_eb_reloaded', '1');
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-red/15 flex items-center justify-center mx-auto mb-4 text-brand-red text-3xl">
            !
          </div>
          <h1 className="text-lg font-bold text-text-primary mb-2">
            مشکلی پیش آمد
          </h1>
          <p className="text-sm text-text-muted mb-5">
            صفحه به‌درستی بارگذاری نشد. معمولاً یک بار «بارگذاری مجدد» مشکل را حل می‌کند.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              className="btn-primary"
              onClick={() => {
                sessionStorage.removeItem('admin_eb_reloaded');
                window.location.reload();
              }}
            >
              بارگذاری مجدد
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch (_) {}
                window.location.href = '/login';
              }}
            >
              پاک‌سازی و ورود مجدد
            </button>
          </div>
        </div>
      </div>
    );
  }
}
