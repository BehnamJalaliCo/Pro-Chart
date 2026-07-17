# راه‌اندازیِ سرورِ ویندوزِ کپی‌ترید (یک‌بار) + اسنپ‌شات برای مقیاسِ خودکار

این کار **فقط یک‌بار** انجام می‌شود؛ بعدش اسکریپتِ هتزنر سرورهای بعدی را خودکار از روی
اسنپ‌شات می‌سازد و مقیاس می‌دهد.

## ۱) ساختِ سرورِ ویندوزِ اول (هتزنر)
1. در کنسولِ Hetzner Cloud یک سرورِ **x86** بساز (ARM/CAX ویندوز را اجرا نمی‌کند).
   برای شروعِ کم‌کاربر: **CX32 (۸GB)** یا **CX42 (۱۶GB)** کافی است.
2. تبِ **ISO Images** → ISO ویندوز سرور (۲۰۱۹/۲۰۲۲) را Mount کن → سرور را Start و نصب کن.
3. هنگامِ نصب، درایورهای **VirtIO** را بده (پوشه‌های Balloon, NetKVM, vioscsi — نسخهٔ amd64).
4. بعد از نصب، در cmd این را بزن تا ساعت درست شود (هاستِ هتزنر UTC است):
   ```
   reg add "HKLM\System\CurrentControlSet\Control\TimeZoneInformation" /v RealTimeIsUniversal /d 1 /t REG_DWORD /f
   ```
   و یک‌بار ری‌استارت.
> لایسنسِ ویندوز را خودت تأمین می‌کنی (روی Cloud؛ یا از سرورِ Dedicated هتزنر با لایسنس).

## ۲) نصبِ پیش‌نیازها روی ویندوز
1. **Python 3** را نصب کن (در نصب، گزینهٔ «Add to PATH» را بزن).
2. **MetaTrader 5** را نصب کن (نصبِ استانداردِ بروکر؛ مسیرِ پیش‌فرض `C:\Program Files\MetaTrader 5`).
3. فایلِ **`CoineProAutoTrader.ex5`** (همان EAِ پروژه) را در
   `C:\Program Files\MetaTrader 5\MQL5\Experts\` بگذار. (یا `.mq5` را با MetaEditor کامپایل کن.)

## ۳) نصبِ Agent
1. این پوشه (`deploy/windows`) را روی سرورِ ویندوز کپی کن، مثلاً در `C:\CoinePro\`.
2. `config.ini.example` را به `config.ini` تغییرِ نام بده و پرش کن:
   - `ea_token` = **همان `EA_TOKEN` سرورِ اصلی** (در `.env` پروژه).
   - `api_url`  = آدرسِ API سرورِ اصلی (مثلاً `https://api.fx.trade-future.ir`).
3. تستِ دستی:  `python C:\CoinePro\coinepro_agent.py`  (باید `[agent] start ...` و سپس
   `desired=[...] alive=[...]` ببینی).

## ۴) اجرای دائمی (سرویس)
با **NSSM** (دانلودِ رایگان) به‌عنوان سرویس ثبت کن تا با ری‌استارت هم بالا بیاید:
```
nssm install CoineProAgent "C:\Python3\python.exe" "C:\CoinePro\coinepro_agent.py"
nssm start CoineProAgent
```
(یا با Task Scheduler، اجرا «At startup» و «Run whether user is logged on or not».)

## ۵) ساختِ اسنپ‌شات (برای مقیاسِ خودکار)
1. سرور را **Power off** کن.
2. در کنسولِ هتزنر → تبِ **Snapshots** → **Create snapshot** (مثلاً نامِ `coinepro-win-base`).
3. **id اسنپ‌شات** را بردار و در `.env` سرورِ اصلی بگذار:
   ```
   HETZNER_SNAPSHOT_ID=<شناسهٔ عددیِ اسنپ‌شات>
   ```
4. سرورِ اول را دوباره **Power on** کن.

## ۶) فعال‌سازیِ کپیِ زنده
در `.env` سرورِ اصلی:
```
COPY_LIVE_ENABLED=true
```
از این پس:
- Agent روی هر سرورِ ویندوز، حساب‌های فعال را از API می‌گیرد و MT5 هر کاربر را native اجرا می‌کند (پایدار).
- تسکِ `scale_servers` (هر ۲۰ دقیقه) تعدادِ کاربر را می‌سنجد و سرورها را **خودکار** ارتقا/اضافه/حذف می‌کند.

## نکات
- یک سرورِ ۳۲GB (CX52) ~۲۴ کاربر. رشد: اول همان سرور بزرگ‌تر، بعد سرورِ دوم.
- اولین تستِ واقعی را با یک **حسابِ دموی مجزا** (نه حسابِ مَستر 9991073) انجام بده.
- `EA_TOKEN` و کردنشالِ کاربران فقط روی شبکهٔ امن منتقل می‌شوند؛ API را روی HTTPS نگه دار.
