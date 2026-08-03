// Service Worker — حالتِ «بدونِ‌کش» (network pass-through).
// چرا: کشِ قبلی باعث می‌شد کاربر روی نسخهٔ قدیمی گیر کند (sw.js یک سال کش می‌شد).
// این نسخه هیچ‌چیز کش نمی‌کند، همهٔ کش‌های قدیمی را پاک می‌کند، و فوراً کنترل می‌گیرد →
// کاربر همیشه آخرین نسخه را می‌گیرد. (نصب‌پذیریِ PWA با وجودِ همین fetch handler حفظ می‌شود.)
self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k))); // پاک‌سازیِ همهٔ کش‌های قدیمی
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  // pass-through: همیشه از شبکه (بدونِ کش)؛ فقط برای offline یک fallback ساده
  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 504, statusText: 'offline' })));
});
