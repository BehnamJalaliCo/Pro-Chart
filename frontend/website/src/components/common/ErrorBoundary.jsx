import { Component } from 'react';

/**
 * ErrorBoundary - مدیریت خطاهای غیرمنتظره در کامپوننت‌ها
 * از الگوی Class Component استفاده می‌کند (الزامی برای Error Boundary در ری‌اکت)
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // ارسال خطا به سرویس لاگ (در صورت وجود)
    if (typeof window !== 'undefined' && window.__ERROR_LOGGER__) {
      window.__ERROR_LOGGER__(error, errorInfo);
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // اگر کامپوننت fallback سفارشی ارسال شده باشد
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4" dir="rtl">
          <div className="glass-card max-w-md w-full p-8 text-center">
            {/* آیکون خطا */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-bearish/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-bearish"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* پیام خطا */}
            <h2 className="text-xl font-bold text-white mb-3">
              خطایی رخ داده است
            </h2>
            <p className="text-dark-400 text-sm leading-7 mb-6">
              متاسفانه مشکلی در نمایش این بخش پیش آمده است.
              لطفا دوباره تلاش کنید. در صورت تکرار مشکل، با پشتیبانی تماس بگیرید.
            </p>

            {/* جزئیات خطا (فقط در حالت توسعه) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-dark-900 rounded-xl p-4 mb-6 text-right">
                <p className="text-bearish text-xs font-mono break-all leading-6">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-dark-500 text-xs cursor-pointer hover:text-dark-300 transition-colors">
                      مشاهده جزئیات فنی
                    </summary>
                    <pre className="text-dark-600 text-[10px] font-mono mt-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-5" dir="ltr">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* دکمه‌های عملیات */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                  />
                </svg>
                تلاش دوباره
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="btn-outline flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>
                بازگشت به خانه
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
