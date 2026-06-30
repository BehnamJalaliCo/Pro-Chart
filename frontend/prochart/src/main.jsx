import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

// ثبتِ service worker — نصب‌پذیریِ PWA + آپدیتِ خودکار (تا کاربر هرگز روی نسخهٔ قدیمی گیر نکند)
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return; refreshing = true; window.location.reload(); // SWِ جدید کنترل گرفت → یک‌بار رفرش با فایل‌های تازه
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {});                       // همیشه دنبالِ نسخهٔ جدیدِ SW بگرد
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000); // هر ساعت
    }).catch(() => {});
  });
}
