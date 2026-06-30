# CoinePro-FX — راهنمای پروژه

## محیط استقرار
- سرور: Hetzner، Ubuntu 24.04، 16GB RAM، 8 vCPU AMD، 8GB swap
- کاربر کاری: forex (نه root). مسیر پروژه: /home/forex/CoinePro-FX
- شاخه فعال: claude/wizardly-edison-zyWyW
- استقرار: کاملاً Docker — همه‌ی سرویس‌ها در docker-compose.yml
- کاربر forex در گروه docker است، پس docker بدون sudo کار می‌کند

## معماری (15 فاز توسعه، 460 تست)
- Backend: FastAPI (src/api) + SQLAlchemy 2.0 async
- DB: TimescaleDB (PostgreSQL + hypertables برای candles/ticks)
- Cache/PubSub: Redis
- صف: Celery + celery-beat
- موتور سیگنال: src/signals (engine، scorer، risk_manager، tracker، state_machine)
- تحلیل: src/analysis (technical، candlestick، chart_patterns، smart_money، 
  volume_profile، multi_timeframe، support_resistance)
- ML: src/ml (xgboost، lightgbm، lstm، ensemble، feature_engine، scaler، 
  purged_kfold، calibration، drift_detector، financial_metrics)
- مدیریت ریسک: src/risk (guard، daily_loss_limit، correlation، session_filter، 
  weekend_filter، holiday_calendar، regime_detector، position_sizer، 
  portfolio_var، margin_validator، multi_level_limits)
- بک‌تست: src/backtest (engine، simulator، cost_model، walk_forward، 
  advanced_metrics، reporting)
- launch: src/launch (paper_trading، divergence، preflight)
- ربات تلگرام: src/bot (aiogram)
- فرانت‌اند: frontend/admin و frontend/website (React + Vite + Tailwind)

## دستورهای رایج
- بالا آوردن: docker compose up -d
- وضعیت: docker compose ps
- لاگ یک سرویس: docker compose logs -f <service>
- migration: docker compose exec api alembic upgrade head
- preflight: docker compose exec api python -m src.launch.preflight
- تست: python -m pytest tests/test_phase*.py
- backup: bash scripts/backup.sh
- restore: bash scripts/restore.sh <file>
- ساخت secrets: bash scripts/rotate_secrets.sh

## قواعد کار (مهم)
- همیشه بدون پرسیدن از کاربر کارها را انجام بده. فقط در صورت خطر حذف داده 
  یا leak شدن secret توقف کن.
- خروجی‌های ترمینال را انگلیسی بده، توضیحات را فارسی.
- secrets را هرگز در خروجی چاپ نکن.
- TRADING_MODE فعلاً paper بماند تا کیفیت سیگنال‌ها روی این بروکر تأیید شود؛ 
  بعد از تأیید divergence report به live تغییر می‌کند.
- مراقب RAM باش (16GB محدود است)؛ بعد از بالا آوردن سرویس‌ها free -h و 
  docker stats را چک کن.
- سرور GPU ندارد — LSTM سنگین است؛ در صورت کمبود RAM فقط XGBoost+LightGBM فعال بماند.
- اگر سرویسی crash کرد، لاگش را بخوان و علت را بگو، خودسرانه restart نکن.
- محیط production است: DEBUG=false.
