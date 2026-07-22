# Pro-Chart — قراردادِ ۵ قابلیتِ سمتِ سرور (تحویلِ اپ)

**Base URL:** `https://user.pro-chart.com/api`  ·  **Auth:** `Authorization: Bearer <JWT>` (توکنِ آکادمی، scope=`academy`).
**وضعیت:** همه روی هابِ زنده (Po-Chart) دیپلوی و end-to-end تست‌شده — CHANGELOG «S15».
خطاهای ادمین: `{"detail":{"error":{"code":..., "message":..., "required_permission":...}}}`.

---

## ۶) هم‌ترازیِ نمادها با TradingView  (کاملاً جدید)

منبع‌ها:
- **کریپتو** = جفت‌های **LBank ∩ نمادهای دارای لوگوی TradingView** (سینکِ خودکار توسطِ workerِ کریپتو؛ نمادِ جدیدِ LBank بی‌نیاز به دیپلوی وارد می‌شود).
- **فارکس/فلز/انرژی/شاخص/سهام/ETF** = جهانِ زندهٔ فیدِ پلتفرم (کلیدهای `price:*` = «موجود در OneRoyal + لیستِ TradingView»)؛ به‌محضِ افزوده‌شدنِ نماد توسطِ فید، همان‌لحظه در کاتالوگ می‌آید.

### `GET /academy/market/catalog`  (عمومی، بدونِ توکن)
Query: `market` = `all|crypto|forex|metal|energy|index|etf|stock` (پیش‌فرض all) · `q` (جست‌وجوی متنی روی symbol/base) · `limit` (۰=بی‌حد).
```jsonc
{
  "version": "9ddce515",          // با هر تغییرِ مجموعهٔ نمادها عوض می‌شود (crc32)
  "count": 690,
  "counts": {"crypto":595,"stock":47,"forex":26,"index":11,"etf":4,"metal":5,"energy":2},
  "updated_at": 1784549166,
  "market": "all",
  "symbols": [
    {"symbol":"BTCUSDT","market":"crypto","base":"BTC","quote":"USDT","name":"BTC","name_fa":null,
     "tv":"LBANK:BTCUSDT","logoid":"crypto/XTVCBTC",
     "logo":"https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg","tradable":true},
    {"symbol":"XAUUSD","market":"metal","base":"XAU","quote":"USD","name":"XAUUSD","name_fa":"طلا",
     "tv":"OANDA:XAUUSD","logoid":null,"logo":null,"tradable":true},
    {"symbol":"EURUSD","market":"forex","base":"EUR","quote":"USD","name":"EURUSD","name_fa":"یورو/دلار",
     "tv":"OANDA:EURUSD","logoid":null,"logo":null,"tradable":true}
  ]
}
```
- `tv` = نمادِ استانداردِ TradingView (برای ویجت/جست‌وجوی اپ). کریپتو `LBANK:*`؛ فارکس/فلز/شاخص `OANDA:*`؛ انرژی `TVC:USOIL|UKOIL`؛ ETF/سهام `AMEX:*`/`NASDAQ:*` (best-effort؛ اپ می‌تواند اصلاح کند).
- `logo` فقط برای کریپتو تضمین‌شده (لوگوی رسمیِ TV)؛ برای غیرکریپتو `null` است (اپ با پرچم/تیکرِ خود رندر کند).

### `GET /academy/market/catalog/version`  (پولینگِ سبک)
```json
{"version":"9ddce515","count":690,"counts":{...},"updated_at":1784549166}
```
اپ `version` را نگه دارد؛ اگر عوض شد → `/catalog` را دوباره بگیرد.

### WSS `wss://user.pro-chart.com/api/academy/market/catalog/stream`  (عمومی)
قرارداد پیام:
```jsonc
// سرور → کلاینت، بلافاصله پس از اتصال:
{"type":"snapshot","version":"9ddce515","count":690,"counts":{...},"symbols":[ ...همان شکلِ بالا... ]}
// هر ~۲۰ ثانیه، فقط وقتی تغییری باشد:
{"type":"delta","version":"<new>","count":691,"counts":{...},
 "added":[ {symbol,...} ],   // نمادهای تازه‌اضافه‌شده (کاملِ آبجکت)
 "removed":["SYM1","SYM2"]}  // نمادهای حذف‌شده (فقط symbol)
// ضربان:
{"type":"pong","ts":1784549166}
```
> نمادِ جدیدِ LBank/OneRoyal → در `delta.added` می‌آید (بدونِ دیپلوی). دورهٔ سینکِ کریپتو تدریجی است؛ فارکس/سهام همان‌لحظه با ورودِ کلیدِ `price:*`.

---

## ۱) پنلِ ادمینِ هابِ مرکزی — کنترلِ اشتراکِ همهٔ سرورها  (تکمیل‌شده)

**مدلِ واقعی:** هویت/اشتراک **مرکزی** است؛ همهٔ سرورها (کریپتو/فارکس/چارت/سیگنال) با همان SSO/tier احراز می‌کنند. پس یک toggle در مرکز → روی همهٔ سرورها اعمال می‌شود. نیازی به رکوردِ per-server نیست (`propagation: central-sso`).
Auth: توکنِ ادمین با مجوزِ granular (owner = superadmin با هر ۲۳ مجوز).

### `GET /academy/admin/servers`  — نظارتِ مرکزی  (مجوز `overview.read`)
```jsonc
{
  "servers":[
    {"id":"hub","name":"Po-Chart Hub (API مرکزی)","role":"api/auth/subscriptions","health":{"up":true,"status":200}},
    {"id":"central-auth","name":"App Central Auth (SSO)","role":"sso","health":{"up":true,"status":200}},
    {"id":"crypto","name":"TraydeYar","role":"crypto","health":{"up":true,"status":404}},
    {"id":"forex","name":"CoinePro-FX","role":"forex","health":{"up":true,"status":200}}
  ],
  "subscribers":{"total_users":2577,"paid_active":40,
    "by_tier":[{"tier":"free","total":2537,"active":2537},{"tier":"vip","total":39,"active":39},{"tier":"premium","total":1,"active":1}]},
  "note":"اشتراک مرکزی است؛ toggle در مرکز روی همهٔ سرورها اعمال می‌شود."
}
```

### `GET /academy/admin/users/{id}/entitlements`  — دسترسیِ کاربر روی هر سرور  (مجوز `subscriptions.read`)
`{id}` = `u_<id>` یا عددِ خام.
```jsonc
{
  "user_id":"u_123","user_masked":"be***@gmail.com","tier":"vip","paid_active":true,
  "expires_at":1787141337540,"prochart_until":1787141337540,
  "servers":[
    {"server":"hub","features":["chart","markets","portfolio","home"],"enabled":true,"until":null},
    {"server":"crypto","features":["crypto_signals","crypto_exec","copy_crypto"],"enabled":true,"until":1787141337540,"copy":false},
    {"server":"forex","features":["forex_signals","copy_forex"],"enabled":true,"signals_until":null,"copy_until":null,"copy":false}
  ],
  "propagation":"central-sso"
}
```

### `POST /academy/admin/users/{id}/subscription/toggle`  — فعال/غیرفعال (تک‌کلیدی)  (مجوز `subscriptions.grant`)
Headers: `X-Admin-Confirm: yes` (الزامی).  Body:
```json
{"enabled": true, "plan": "vip", "duration_days": 30, "reason": "toggle from app"}
```
- `enabled:true` → `tier=plan` (vip|premium) تا `duration_days` روز فعال + `prochart_until` ست می‌شود.
- `enabled:false` → `tier=free` فوری.
پاسخ: `{"accepted":true,"enabled":true,"entitlements":{...همان بالا...},"audit":{...}}` (کاملاً audit می‌شود).

> اکشن‌های تفصیلی‌ترِ موجود (اگر لازم شد): `POST /academy/admin/users/{id}/subscription` با `action=grant|extend|cancel` (فاز ۸C)، `GET /academy/admin/subscriptions`, `GET /academy/admin/plans`, `GET /academy/admin/users`.

---

## ۵) همه‌چیز WebSocket/لحظه‌ای  (موجود + کاتالوگِ جدید)

همهٔ streamها زیرِ `wss://user.pro-chart.com/api/academy/...` (nginx برای هرکدام locationِ upgradeِ اختصاصی دارد). ping/pong ~۲۰ثانیه؛ انقضای توکن → close `4401`؛ فریمِ بدفرمت → `4400`.

| Stream | مسیر | توکن | محتوا |
|---|---|---|---|
| قیمت/کوت/تیکر | `/academy/market/stream` | مهمان مجاز | `snapshot`→`tick`(delta)→`global`→`movers`→`pong`؛ `subscribe {"symbols":[...]}` فیلتر |
| چارت | `/academy/chart/stream` | مهمان مجاز | `subscribe {symbol,tf}`→`snapshot`(کندل‌ها)→`candle`(forming)→`tick`(ts=ms)→`pong` |
| پرتفوی/پوزیشن | `/academy/portfolio/stream` | لازم | snapshot موجودی/پوزیشن‌های زندهٔ LBank→`pong` (مهمان→close) |
| کپی‌ترید | `/academy/copy/stream` | لازم | `snapshot`+`position`(پوزیشنِ کاربر+trader_id/name)→`pong` |
| سیگنال | `/academy/signals/stream` | اختیاری (مهمان ۳ قفل) | سیگنال‌های زنده (crypto+forex+admin) |
| **کاتالوگِ نماد** | **`/academy/market/catalog/stream`** | **مهمان مجاز** | **`snapshot`→`delta`(added/removed)→`pong`** ← جدید |
| ادمین | `/academy/admin/stream` | ادمین | overview/system_health/kill_switch/audit/ticket |

قراردادِ subscribe/unsubscribe (market/catalog/chart): کلاینت `{"symbols":[...]}` یا `{"subscribe":[...]}` می‌فرستد؛ سرور فریم‌های `snapshot`/`tick`/`delta` را push می‌کند.

---

## ۴) آپلودِ آواتارِ کاربر  (از قبل موجود — آماده)

### `POST /academy/me/avatar`  (توکن لازم)
```json
{"content_type":"image/png", "data_b64":"<base64 یا dataURL>"}
```
مجاز: `image/png|image/jpeg|image/webp`، حداکثر ۲MB پس از decode. پاسخ:
```json
{"ok": true, "avatar_url": "/api/academy/me/avatar/raw?v=1784500000"}
```
### `GET /academy/me/avatar/raw?t=<JWT>`  — بایت‌های خامِ عکس
توکن از هدر `Authorization` یا کوئریِ `?t=` (برای `<Image>`). برای نمایش در اپ: `https://user.pro-chart.com/api{avatar_url}&t=<token>`.
> `avatar_url` در `GET /academy/me` و `/academy/profile` هم برمی‌گردد. حذفِ آواتار: `POST /academy/profile` با `avatar_id=""`.

---

## ۱۵) حذفِ ریشه‌ایِ حساب — بدونِ بازگشت  (کاملاً جدید)

### `POST /academy/me/delete-permanent`  (توکن لازم)
```json
{"confirm": true, "confirm_text": "DELETE", "reason": "optional"}
```
- `confirm_text` باید = نامِ‌کاربری، یا ایمیلِ کاربر، یا کلمهٔ `DELETE`/`حذف` باشد (وگرنه ۴۰۰).
- **پاک‌سازیِ کامل:** همهٔ ردیف‌های کاربر در تمامِ جدول‌های `student_id`/`author_id` (به‌جز `articles`) + خودِ ردیفِ `academy_students` + کلیدهای Redisِ کاربر + یک **deny-list دائمی** (`bn:deleted:{sid}`) که مانعِ بازساختِ حساب از توکنِ باقی‌مانده در حالتِ standalone/central می‌شود.
- بعد از این، همان توکن → **۴۰۱** «این حساب برای همیشه حذف شده است»؛ برای استفاده باید از ابتدا ثبت‌نام کند.
پاسخ:
```json
{"ok":true,"permanent":true,"recoverable":false,"student_deleted":true,
 "tables_purged":{"academy_devices":1,"academy_subscriptions":2},
 "redis_keys_deleted":0,
 "message":"حسابِ شما کاملاً حذف شد. برای استفادهٔ دوباره باید از ابتدا ثبت‌نام کنید."}
```
> تفاوت با `POST /academy/me/delete` (که soft است: غیرفعال + مهلتِ ۳۰ روزهٔ بازگشت). این endpoint فوری و **irreversible** است.

---

### فایل‌های سرور (برای مرجع)
`src/api/routes/symbols_catalog.py` (۶) · `admin_central.py` (۱) · `account_delete.py` (۱۵) + پچِ deny-list در `academy.py current_student` · `nginx/user-panel.conf` (locationِ catalog/stream). آواتار در `academy.py` (`/me/avatar`) از قبل. بکاپ‌ها: `*.bak-20260720-*`.
