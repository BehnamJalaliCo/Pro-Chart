# بودجه Performance

مبنای Web Vitals: صدک ۷۵، به‌صورت جداگانه برای Mobile و Desktop.

| معیار | Gate | نوع شاهد |
|---|---:|---|
| LCP | ≤ 2.5s | RUM + lab regression |
| INP | ≤ 200ms | RUM؛ lab interaction proxy جداگانه |
| CLS | ≤ 0.1 | RUM + lab |
| TTFB | هدف < 800ms | RUM/API trace |
| feedback ورودی | < 100ms | browser trace |
| Crosshair response | < 50ms | interaction benchmark |
| Quote-to-paint overhead داخلی | < 100ms | timestamped stream/paint trace |
| Frame time چارت | p95 < 20ms الزام سند؛ stretch ≤ 16.7ms برای 60fps واقعی | performance trace |
| Indicator P0 روی 10k bar | < 500ms | worker benchmark |
| Layout restore پس از Shell | < 2s | E2E trace |
| Long task | >50ms محدود و گزارش‌شده | PerformanceObserver/trace |
| Memory leak | رشد کنترل‌نشده صفر در window تعریف‌شده | soak؛ window/tolerance نیازمند ADR |

## ابهام‌های لازم برای ADR

- device و network profile مرجع؛
- JS bundle budget عددی؛
- window و tolerance آزمون memory؛
- RUM sampling/retention؛
- ظرفیت و SLA fan-out/alert؛
- تعارض هدف 60fps با p95<20ms؛ مقدار 16.7ms به‌عنوان stretch ثبت شده و متن سند تغییر نکرده است.

افزایش Budget بدون Approval و دلیل ثبت‌شده ممنوع است.
