# قالبِ ایمیلِ مستقلِ بازارنما (Pro-Chart) — تأییدِ ایمیل / OTP

تسک #241 — طراحیِ یک قالبِ HTML ایمیلِ **جدا و مستقل از آکادمیِ VIP** برای بازارنما (Pro-Chart).
برندِ بازارنما، فارسیِ RTL، تمیز و حرفه‌ای.

---

## ۱) وضعیتِ فعلی (چرا لازم است)

بازارنما auth و ثبت‌نامِ مستقلی **ندارد**؛ از همان جریانِ آکادمی استفاده می‌کند:

- فرانتِ Pro-Chart این endpointها را صدا می‌زند:
  - `frontend/prochart/src/api/client.js:80` → `POST /academy/auth/register/request`
  - `frontend/prochart/src/api/client.js:81` → `POST /academy/auth/register/verify`
- بک‌اند: `src/api/routes/academy.py`
  - `register_request` (خط ۲۴۹) → `request_otp(em, brand="academy", ttl=120)` در **خط ۲۶۰**
- موتورِ ارسال: `src/core/email_otp.py`
  - دیکشنریِ `_BRANDS` (خط ۳۹) فقط دو برند دارد: `panel` و `academy`
  - تابعِ `_send_email` (خط ۶۶) یک قالبِ HTML واحد می‌سازد و فقط `title/intro/subject` را از برند می‌خواند.

نتیجه: کاربری که در بازارنما ثبت‌نام می‌کند، ایمیلِ **برندِ «🎓 آکادمی VIP»** دریافت می‌کند — اشتباه است.

> نکته: چون هر دو از یک endpoint و یک جدولِ `AcademyStudent` استفاده می‌کنند، تفکیکِ برند باید از سمتِ **مبدأِ صدا‌زننده** (فرانت/پارامتر) به بک‌اند منتقل شود، نه با حدسِ ایمیل.

---

## ۲) نقطهٔ دقیقِ تزریق در بک‌اند

سه تغییرِ کوچک. هیچ‌کدام جریانِ آکادمی را نمی‌شکند (آکادمی پیش‌فرضِ `academy` می‌ماند).

### تغییرِ ۱ — افزودنِ برندِ `bazaarnama` به `_BRANDS`
فایل: `src/core/email_otp.py`، دیکشنریِ `_BRANDS` (خطِ ۳۹).

```python
_BRANDS = {
    "panel": {...},      # بدون تغییر
    "academy": {...},    # بدون تغییر
    "bazaarnama": {
        "title": "بازارنما",
        "subject": "کد تأیید ورود به بازارنما",
        "intro": "کدِ تأیید برای ورود به حسابِ بازارنما:",
    },
}
```

### تغییرِ ۲ — قالبِ HTML برندمحور در `_send_email`
فایل: `src/core/email_otp.py`، تابعِ `_send_email` (خطِ ۶۶).

`_send_email` فعلاً یک HTML واحد دارد. آن را برندمحور کن: اگر `brand == "bazaarnama"` از تابعِ `_bn_otp_html(...)` (در بخشِ ۴) استفاده شود؛ در غیرِ این صورت همان قالبِ فعلی (آکادمی/پنل) بماند. فوترِ مستقلِ بازارنما (`_BN_FOOTER`) و نسخهٔ متنیِ مستقل هم استفاده شود.

اسکلتِ پیشنهادی داخلِ `_send_email`، درست قبل از ساختِ `html`:

```python
b = _BRANDS.get(brand, _BRANDS["panel"])
minutes = _fa_digits(str(max(1, round(ttl / 60))))
if brand == "bazaarnama":
    html = _bn_otp_html(code, minutes)
    text = (f"بازارنما\n\nکدِ تأیید: {code}\n"
            f"این کد تا {minutes} دقیقه معتبر است.\n"
            "اگر شما درخواست نکرده‌اید، این پیام را نادیده بگیرید.")
else:
    html = (... قالبِ فعلیِ موجود ...)
    text = (... متنِ فعلیِ موجود ...)
```

و در بدنهٔ POST، مقدارِ `"text"` به‌جای رشتهٔ inline از متغیرِ `text` بالا گرفته شود. (subject همان `b["subject"]` است که حالا برای بازارنما درست پر می‌شود.)

> فرستنده: `settings.RESEND_FROM_EMAIL` (پیش‌فرض `CoinePro FX <noreply@trade-future.ir>`) مشترک است و نیازی به تغییر ندارد؛ تفکیکِ برند کاملاً در subject/HTML/text انجام می‌شود. (اختیاری: می‌توان بعداً ENV جدا `BN_FROM_EMAIL` افزود.)

### تغییرِ ۳ — عبورِ برند از endpointِ ثبت‌نام
فایل: `src/api/routes/academy.py`، تابعِ `register_request` (خطِ ۲۴۹–۲۶۵).

مشکل: یک endpoint به دو مصرف (آکادمی و بازارنما) خدمت می‌کند. راهِ کم‌خطر: یک پارامترِ اختیاری `app` به body اضافه شود؛ فرانتِ Pro-Chart `app="bazaarnama"` بفرستد، آکادمی چیزی نفرستد (پیش‌فرض `academy`).

```python
@router.post("/auth/register/request")
async def register_request(
    email: str = Body(..., embed=True),
    app: str = Body("academy", embed=True),   # ← جدید
    db: AsyncSession = Depends(get_db),
):
    ...
    brand = "bazaarnama" if app == "bazaarnama" else "academy"
    res = await request_otp(em, brand=brand, ttl=120)   # ← خطِ ۲۶۰
    ...
```

تغییرِ متناظرِ فرانت (هم‌راستا، خارج از این فایلِ اسپک):
`frontend/prochart/src/api/client.js:80`
```js
registerRequest: (email) =>
  client.post('/academy/auth/register/request', { email, app: 'bazaarnama' }),
```

> اگر صاحبِ پروژه تفکیکِ کامل‌تری بخواهد، می‌توان مسیرِ آینهٔ `/bazaarnama/auth/register/request` در `src/api/routes/bazaarnama.py` ساخت که داخلش `request_otp(..., brand="bazaarnama")` صدا بزند؛ اما پارامترِ `app` ساده‌تر و بدونِ duplication است.

---

## ۳) راهنمای برند (Design tokens)

برای تمایزِ بصری از آکادمیِ سبزِ تیره (`#22c55e` روی `#0b0f17`)، بازارنما هویتِ مستقلِ خود را دارد:

| توکن            | مقدار       | کاربرد                                  |
|-----------------|-------------|------------------------------------------|
| بک‌گراندِ کارت | `#0d1320`   | پس‌زمینهٔ اصلیِ کارت                     |
| پنلِ داخلی     | `#111a2e`   | جعبهٔ کد / بلوک‌ها                        |
| رنگِ برند      | `#3b82f6` (آبی)؛ گرادیانِ `#6366f1→#22d3ee` | لوگو، عنوان، دکمه |
| متنِ اصلی      | `#e6edf6`   | بدنه                                     |
| متنِ ثانویه    | `#93a4bd`   | توضیحات                                   |
| متنِ کم‌رنگ    | `#5b6b85`   | فوتر/انقضا                                |
| کدِ تأیید      | `#ffffff` روی `#0b1120` با حاشیهٔ `#1e293b` | جعبهٔ OTP |
| فونت           | `Tahoma, Vazirmatn, Arial, sans-serif` | RTL فارسی |
| لوگو           | متنیِ «بازارنما» + شمعِ کندل‌استیکِ کوچک با Unicode/SVG ساده | بدونِ CDN خارجی |

اصول: همه‌چیز inline-CSS و table-safe برای کلاینت‌های ایمیل (Gmail/Outlook/اپ موبایل)، بدونِ منبعِ خارجیِ CDN (هم‌راستا با قاعدهٔ «no external CDN»)، multipart (HTML + text) برای ضدِ اسپم، `dir="rtl"`، حداکثرعرضِ ۴۸۰px وسط‌چین.

---

## ۴) قالبِ HTML نهایی (تابعِ `_bn_otp_html`)

این تابع را به `src/core/email_otp.py` اضافه کن (قبل از `_send_email`). خروجی همان HTML آمادهٔ ارسال است.
لوگو با شمعِ کندلِ SVG inline ساخته می‌شود (بدونِ تصویرِ خارجی) تا در Iran و آفلاین هم درست لود شود.

```python
# فوترِ مستقلِ بازارنما
_BN_FOOTER = (
    '<hr style="border:none;border-top:1px solid #1e293b;margin:22px 0 12px">'
    '<p style="margin:0;color:#5b6b85;font-size:11px;line-height:1.8">'
    'این یک ایمیلِ خودکارِ سیستمیِ <b style="color:#3b82f6">بازارنما</b> است؛ لطفاً پاسخ ندهید.<br>'
    'سامانهٔ تحلیل و نمودارِ بازارِ مالی<br>'
    '<a href="https://academy.fx.trade-future.ir" style="color:#5b6b85;text-decoration:none">academy.fx.trade-future.ir</a>'
    '</p>'
)


def _bn_otp_html(code: str, minutes: str) -> str:
    """قالبِ HTML تأییدِ ایمیل/OTP — برندِ مستقلِ بازارنما (RTL فارسی)."""
    # لوگوی شمعِ کندل‌استیک به‌صورتِ SVG inline (بدونِ CDN)
    logo_svg = (
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" '
        'xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-left:8px">'
        '<rect x="4"  y="7"  width="4" height="10" rx="1" fill="#22c55e"/>'
        '<rect x="5.4" y="3"  width="1.2" height="18" fill="#22c55e"/>'
        '<rect x="14" y="9"  width="4" height="8"  rx="1" fill="#3b82f6"/>'
        '<rect x="15.4" y="5"  width="1.2" height="16" fill="#3b82f6"/>'
        '</svg>'
    )
    return (
        '<div dir="rtl" style="font-family:Tahoma,Vazirmatn,Arial,sans-serif;'
        'background:#070b14;padding:28px 14px;margin:0">'
        '<div style="background:#0d1320;border:1px solid #1b2640;'
        'border-radius:18px;max-width:480px;margin:0 auto;'
        'padding:30px 28px;color:#e6edf6;box-shadow:0 8px 30px rgba(0,0,0,.4)">'

        # هدر: لوگو + نامِ برند با گرادیان
        '<div style="text-align:center;margin:0 0 22px">'
        + logo_svg +
        '<span style="font-size:24px;font-weight:800;'
        'background:linear-gradient(90deg,#6366f1,#22d3ee);'
        '-webkit-background-clip:text;background-clip:text;color:#3b82f6;'
        '-webkit-text-fill-color:transparent">بازارنما</span>'
        '<div style="color:#5b6b85;font-size:12px;margin-top:4px">'
        'سامانهٔ تحلیل و نمودارِ بازارِ مالی</div>'
        '</div>'

        # عنوان + توضیح
        '<h2 style="margin:0 0 8px;font-size:18px;color:#e6edf6;text-align:center">'
        'تأییدِ ایمیلِ شما</h2>'
        '<p style="margin:0 0 20px;color:#93a4bd;font-size:14px;'
        'line-height:1.9;text-align:center">'
        'برای ورود/ثبت‌نام در بازارنما، کدِ زیر را در صفحهٔ تأیید وارد کنید:</p>'

        # جعبهٔ کد OTP
        '<div style="font-size:34px;font-weight:800;letter-spacing:10px;'
        'color:#ffffff;background:#0b1120;border:1px solid #1e293b;'
        'border-radius:14px;padding:18px 12px;text-align:center;'
        'direction:ltr;font-family:Consolas,monospace">'
        f'{code}</div>'

        # انقضا
        '<p style="margin:18px 0 0;color:#5b6b85;font-size:13px;'
        'line-height:1.8;text-align:center">'
        f'این کد تا <b style="color:#93a4bd">{minutes} دقیقه</b> معتبر است.<br>'
        'اگر شما این درخواست را نکرده‌اید، این ایمیل را نادیده بگیرید.</p>'

        + _BN_FOOTER +
        '</div></div>'
    )
```

نسخهٔ متنیِ معادل (برای `"text"`؛ ضدِ اسپم):

```
بازارنما — سامانهٔ تحلیل و نمودارِ بازارِ مالی

کدِ تأییدِ ایمیلِ شما: <CODE>
این کد تا <MINUTES> دقیقه معتبر است.
اگر شما این درخواست را نکرده‌اید، این پیام را نادیده بگیرید.
```

---

## ۵) چک‌لیستِ پیاده‌سازی

- [ ] `src/core/email_otp.py`: افزودنِ کلیدِ `"bazaarnama"` به `_BRANDS`.
- [ ] `src/core/email_otp.py`: افزودنِ `_BN_FOOTER` و تابعِ `_bn_otp_html`.
- [ ] `src/core/email_otp.py`: برندمحورکردنِ `_send_email` (شاخهٔ `if brand == "bazaarnama"` برای html و text).
- [ ] `src/api/routes/academy.py` خطِ ۲۴۹–۲۶۰: افزودنِ پارامترِ `app` و انتخابِ `brand`.
- [ ] `frontend/prochart/src/api/client.js:80`: ارسالِ `app: 'bazaarnama'` در `registerRequest`.
- [ ] تستِ زنده: ثبت‌نام از فرانتِ Pro-Chart → دریافتِ ایمیلِ برندِ «بازارنما» (نه آکادمی).
- [ ] رگرسیون: ثبت‌نام از آکادمیِ VIP همچنان ایمیلِ «🎓 آکادمی VIP» می‌گیرد.

> توجه: تغییراتِ بک‌اندِ Python در ایمیج baked است؛ پس از ویرایش باید `docker compose build api && docker compose up -d api` اجرا شود (نه فقط restart). فرانتِ Pro-Chart با rsync به سرورِ pro-chart دیپلوی می‌شود.
