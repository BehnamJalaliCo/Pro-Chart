# Pro-Chart (بازارنما)

پلتفرمِ معاملاتیِ مستقل — **کریپتو روی صرافیِ LBank** و **فارکس روی بروکرِ وان‌رویال (MT5)** — با چارتِ هم‌ترازِ TradingView، تریدِ واقعیِ روی چارت (نه کپی)، پنلِ کاربر (user.pro-chart.com)، پنلِ ادمین (panel.pro-chart.com)، اشتراکِ پرمیوم و پرداختِ خودکارِ USDT روی BSC.

## استک
- frontend/prochart — اپِ بازارنما (React + Vite + lightweight-charts)
- src/ — بک‌اندِ FastAPI (مسیرهای bazaarnama + اتصال/ترید + داده)
- docker-compose.prochart.yml — استکِ مستقل (api, data-feed, crypto-ws, frontend, claude-llm, timescaledb, redis)

> آکادمیِ VIP و محتوای آموزشی **در پروژهٔ CoinePro FX** قرار دارد، نه اینجا.
> رازها (.env و کلیدها) در این ریپو نیستند؛ روی سرور نگه‌داری می‌شوند.
