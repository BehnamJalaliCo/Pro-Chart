# اسپکِ بازطراحیِ منوی همبرگری بازارنما — بازاریابیِ پریمیوم + جایگاه‌های تبلیغاتیِ مدیریت‌پذیر

**تسک‌ها:** #12 (بازطراحیِ بازاریابیِ پریمیوم + ثبت‌نام→پنلِ کاربری) و #14 (منوی همبرگریِ پر: فیچرها + جایگاه‌های تبلیغاتیِ قابلِ‌مدیریت از ادمین)
**فایلِ هدفِ فرانت:** `frontend/prochart/src/AuthMenu.jsx` (کامپوننتِ فعلیِ منوی همبرگری)
**فایلِ هدفِ بک‌اند:** `src/api/routes/bazaarnama.py` (عمومی) + `src/api/routes/admin.py` یا فایلِ تازهٔ `src/api/routes/admin_bazaarnama.py`
**مدلِ داده:** `src/core/database.py` (دو جدولِ تازه)
**مرجعِ طراحی:** TradingView Supercharts overlay/right-rail + top-right menu (تحقیق‌شده — منابع در انتها)

---

## ۱) مسئله (وضعِ فعلی)

منوی همبرگریِ فعلی (`AuthMenu.jsx`) سه ضعفِ اصلی دارد:

1. **بازاریابیِ خام، نه پریمیوم.** پنلِ اشتراک (`SubscribePanel`) آدرسِ کیف‌پول (contract/wallet address) را به‌صورتِ خام در منو می‌چسباند:
   ```
   آدرسِ واریز (BEP-20 · USDT): 0x3f8a...c21
   ```
   این تجربهٔ یک صرافیِ آماتور است، نه یک محصولِ پریمیوم. کاربر باید با حسِ «ارزش» مواجه شود، نه با یک رشتهٔ کریپتویِ ترسناک.

2. **ثبت‌نام درجا، بدون هدایت به پنل.** فرمِ `RegisterForm` کلِ فلوی OTP/ساختِ حساب را درونِ کشوی کوچک انجام می‌دهد و کاربر هرگز به **پنلِ کاربری** (`user.pro-chart.com` / `UserPanel.jsx`) که جای واقعیِ پرداخت، اتصالِ بروکر و رفرال است نمی‌رود.

3. **منوی فقیر.** منو فقط «ورود/ثبت‌نام/اشتراک» دارد. هیچ دسترسیِ سریعی به فیچرهای محصول (واچ‌لیست، آلارم، اسکرینر، تقویم، نمااسکریپت، راهنما) و هیچ **جایگاهِ تبلیغاتیِ مدیریت‌پذیر** (لوگوی PNG صرافی/وان‌رویال + متن، قابلِ‌تنظیم از ادمین) وجود ندارد.

---

## ۲) اهداف

- **G1 — بازاریابیِ پریمیومِ تمیز:** کارت‌های مزیتِ بصری (نه آدرسِ خام)؛ آدرسِ کیف‌پول فقط داخلِ پنلِ کاربری و فقط در لحظهٔ پرداخت.
- **G2 — ثبت‌نام = هدایت به پنل:** دکمهٔ «ثبت‌نام» و «ارتقا به پریمیوم» به پنلِ کاربری (`user.pro-chart.com`) ریدایرکت می‌کنند، نه فلوی درجا.
- **G3 — منوی پُر و کاربردی:** بخشِ «فیچرهای بازارنما» (شورت‌کاتِ واچ‌لیست/آلارم/اسکرینر/تقویم/نمااسکریپت/راهنما) + بخشِ حساب + بخشِ پشتیبانی/اجتماعی.
- **G4 — جایگاه‌های تبلیغاتیِ مدیریت‌پذیر از ادمین:** اسلاتِ تبلیغ (لوگوی PNG صرافی/وان‌رویال + عنوان + متن + CTA + لینک) که سوپرادمین از پنلِ ادمین می‌سازد/ویرایش/فعال‌غیرفعال می‌کند، با زمان‌بندی و هدف‌گیریِ تیر (free/vip/premium) و شمارشِ impression/click.
- **G5 — دیفالت: نمای روز (light).** کلِ منو theme-aware است؛ پیش‌فرضِ تمِ منو **روز/روشن** است (هم‌راستا با تسک #12 «دیفالت: نمای روز»).

---

## ۳) ساختار نهاییِ منو (از بالا به پایین)

```
┌─────────────────────────────────────────┐
│  Pro·Chart                          [✕]  │  ← سربرگ
├─────────────────────────────────────────┤
│  ▏ کارتِ کاربر                            │  ← آواتار + نام + تیر (رایگان/VIP/پرمیوم)
│  ┌───────────────────────────────────┐   │
│  │ [PNG]  جایگاهِ تبلیغِ بالا (slot=top)│   │  ← اسلاتِ تبلیغِ ۱ (مدیریت‌پذیر)
│  │        عنوان · متن · [دکمهٔ CTA →]  │   │
│  └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  حساب                                     │
│   • ورود به حساب        (مهمان)          │
│   • ثبت‌نام →پنلِ کاربری   (مهمان، accent) │
│   • خروج از حساب         (واردشده)        │
│   • پنلِ کاربری (حساب/اشتراک/بروکر)  ↗     │
├─────────────────────────────────────────┤
│  ارتقا به پریمیوم                          │  ← کارت‌های مزیت (نه آدرسِ خام)
│   ✦ هوشِ مصنوعی  ✦ نمااسکریپت  ✦ تریدِ چارت│
│   [ ارتقا و پرداخت در پنلِ کاربری →↗ ]      │
├─────────────────────────────────────────┤
│  امکاناتِ بازارنما                          │  ← شورت‌کاتِ فیچرها (#14)
│   ⌗ واچ‌لیست    🔔 آلارم‌ها   ⚲ اسکرینر    │
│   🗓 تقویمِ اقتصادی  </> نمااسکریپت  ? راهنما│
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐   │
│  │ [PNG]  جایگاهِ تبلیغِ پایین (inline)│   │  ← اسلاتِ تبلیغِ ۲ (مدیریت‌پذیر)
│  └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  پشتیبانی و اجتماعی                        │
│   • کانالِ تلگرام   • پشتیبانی   • قوانین  │
├─────────────────────────────────────────┤
│  نسخه ۱.۰ · بازارنما                       │  ← فوتر
└─────────────────────────────────────────┘
```

> هم‌ترازی با TradingView: TV همین گروه‌بندی را در overlay-rail دارد (Watchlist / Alerts / News / Calendars / Screener / Pine Editor) و حساب/اشتراک را در top-right menu جدا می‌کند. ما همان منطق را در یک کشوی واحدِ موبایل-فرست پیاده می‌کنیم.

---

## ۴) G1 — بازاریابیِ پریمیومِ تمیز (جایگزینِ `SubscribePanel`)

### رفتار
- آدرسِ کیف‌پولِ خام (`wallet`/`pr.wallet`) **از منو حذف** می‌شود.
- به‌جایش سه کارتِ مزیت (آیکون + عنوان + یک‌خط توضیح) نمایش داده می‌شود — همان سه قفلِ پریمیومِ موجود در بک‌اند (`bazaarnama.py::_PREMIUM_MSG`):
  - **هوشِ مصنوعی** — سیگنالِ زندهٔ Sonnet روی نماد/تایم‌فریمِ انتخابی.
  - **نمااسکریپت** — اسکریپت‌نویسیِ اندیکاتور/استراتژی (مثلِ Pine).
  - **تریدِ روی چارت** — اجرای سفارش روی البنک/وان‌رویال.
- قیمت‌ها از `api.pricing()` خوانده می‌شوند ولی فقط به‌صورتِ «از ۱۵ تتر در ماه» نمایش داده می‌شوند (بدونِ آدرس).
- یک CTAِ واحد: **«ارتقا و پرداخت در پنلِ کاربری»** → ریدایرکت (G2).

### کامپوننتِ تازه: `PremiumPitch`
جایگزینِ `SubscribePanel` در `AuthMenu.jsx`. بدونِ state کیف‌پول؛ فقط نمایشی + دکمهٔ ریدایرکت.

```jsx
function PremiumPitch({ P, onUpgrade }) {
  const [pr, setPr] = React.useState(null);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  const monthly = pr?.monthly_usdt ?? 15;
  const PERKS = [
    { icon: <Sparkles size={16} />, t: 'هوشِ مصنوعی', d: 'سیگنالِ زندهٔ هوشمند روی هر نماد و تایم‌فریم' },
    { icon: <Code2 size={16} />,   t: 'نمااسکریپت', d: 'نوشتنِ اندیکاتور و استراتژیِ اختصاصی' },
    { icon: <LineChart size={16} />, t: 'تریدِ روی چارت', d: 'اجرای سفارش روی البنک / وان‌رویال' },
  ];
  return (
    <div className="space-y-3">
      <h4 className="font-bold flex items-center gap-2"><Crown size={16} className="text-amber-400" /> ارتقا به پریمیوم</h4>
      <div className="space-y-2">
        {PERKS.map((k) => (
          <div key={k.t} className="flex items-start gap-3 rounded-xl p-3" style={{ background: P.soft }}>
            <span className="mt-0.5 text-amber-400">{k.icon}</span>
            <div><div className="font-bold text-sm">{k.t}</div>
              <div className="text-[12px] leading-5" style={{ color: P.sub }}>{k.d}</div></div>
          </div>
        ))}
      </div>
      <div className="text-center text-[13px]" style={{ color: P.sub }}>
        از <b className="text-indigo-400">{monthly} تتر</b> در ماه
      </div>
      <button onClick={onUpgrade}
        className="w-full py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2">
        ارتقا و پرداخت در پنلِ کاربری <ExternalLink size={14} />
      </button>
      <p className="text-[11px] text-center" style={{ color: P.sub }}>
        پرداخت امن داخلِ پنل انجام می‌شود؛ پس از تأیید، قفلِ امکانات باز می‌شود.
      </p>
    </div>
  );
}
```

> ⚠️ هیچ آدرسِ کیف‌پولی در منو رندر نشود. آدرس فقط در `UserPanel.jsx` و فقط در گامِ پرداخت.

---

## ۵) G2 — ثبت‌نام و ارتقا → هدایت به پنلِ کاربری

### URLِ پنل
- متغیرِ محیطیِ فرانت: `VITE_USER_PANEL_URL` (پیش‌فرض `https://user.pro-chart.com`).
- تابعِ کمکی در `AuthMenu.jsx`:
  ```js
  const PANEL_URL = import.meta.env.VITE_USER_PANEL_URL || 'https://user.pro-chart.com';
  const gotoPanel = (path = '') => { window.open(PANEL_URL + path, '_blank', 'noopener'); };
  ```

### تغییرِ دکمه‌ها
- **«ثبت‌نام»** (`MenuBtn`): به‌جای `setView('register')` → `gotoPanel('/register?from=chart')`.
- **«ارتقا به پریمیوم»** (`PremiumPitch.onUpgrade`): → `gotoPanel('/subscribe?from=chart')`.
- **«پنلِ کاربری»** (آیتمِ تازه، همیشه نمایش): → `gotoPanel('/')`.
- **«ورود»** باقی می‌ماند درجا (`LoginForm`) — ورودِ سریع برای آنلاک‌کردنِ چارت بدونِ ترکِ صفحه منطقی است. (اختیاری: لینکِ «ورود در پنل» هم زیرِ فرم.)

> پارامترِ `?from=chart` در پنل برای آنالیتیکسِ منبعِ ثبت‌نام استفاده می‌شود (نشانِ نرخِ تبدیلِ چارت→پنل).

---

## ۶) G3 — بخشِ «امکاناتِ بازارنما» (#14)

شورت‌کاتِ فیچرها. چون این کامپوننت در `BazaarNama.jsx` mount می‌شود، با `CustomEvent` با والد ارتباط می‌گیرد (بدونِ نیاز به prop-drilling).

| آیتم | آیکون (lucide) | اکشن |
|---|---|---|
| واچ‌لیست | `List` | `dispatch('bn:rightTab', 'watch')` + بستنِ منو |
| آلارم‌ها | `Bell` | `dispatch('bn:rightTab', 'alerts')` |
| اسکرینر | `Search`/`LayoutGrid` | `dispatch('bn:rightTab', 'screener')` |
| تقویمِ اقتصادی | `CalendarDays` | `dispatch('bn:rightTab', 'calendar')` |
| نمااسکریپت | `Code2` | `dispatch('bn:openScript')` (گیتِ پریمیوم در والد) |
| راهنما | `HelpCircle` | `dispatch('bn:help')` |

در `BazaarNama.jsx` لیسنرها اضافه می‌شوند:
```js
useEffect(() => {
  const onTab = (e) => { setRightTab(e.detail); setShowRight(true); };
  const onScript = () => openNamaScript();
  const onHelp = () => setShowShortcuts(true);
  window.addEventListener('bn:rightTab', onTab);
  window.addEventListener('bn:openScript', onScript);
  window.addEventListener('bn:help', onHelp);
  return () => { window.removeEventListener('bn:rightTab', onTab);
    window.removeEventListener('bn:openScript', onScript);
    window.removeEventListener('bn:help', onHelp); };
}, [openNamaScript]);
```

> این رویدادها از قبل ریشهٔ هم‌خانواده دارند (مثلِ `bn:premium`)، پس الگو در پروژه آشناست.

---

## ۷) G4 — جایگاه‌های تبلیغاتیِ مدیریت‌پذیر از ادمین

### ۷.۱ تعریفِ اسلات‌ها (slot)
دو جایگاهِ ثابت در منو (قابلِ‌گسترش):
- `menu_top` — کارتِ بزرگِ زیرِ کارتِ کاربر (پررنگ‌ترین جای منو).
- `menu_inline` — کارتِ کوچکِ بینِ «امکانات» و «پشتیبانی».

(در آینده می‌توان `chart_banner` برای نوارِ زیرِ چارت هم اضافه کرد؛ مدلِ داده از همین ساختار پشتیبانی می‌کند.)

### ۷.۲ ساختارِ یک تبلیغ (Ad)
هر تبلیغ شاملِ:
- **لوگوی PNG** (آپلودی؛ مثلِ لوگوی صرافی/وان‌رویال) — اختیاری.
- **عنوان** (مثلِ «وان‌رویال») + **متنِ کوتاه** (یک تا دو خط).
- **متنِ دکمه (CTA)** + **لینک** (لینکِ رفرال).
- **تیرِ هدف** (`free`/`vip`/`premium`/`all`) — به چه کاربرانی نشان داده شود.
- **بازهٔ زمانی** (`starts_at`/`ends_at`) — زمان‌بندیِ کمپین.
- **اولویت** (`priority`) — وقتی چند تبلیغ برای یک اسلاتِ واجدِ‌شرایط است، بالاترین اولویت برنده.
- **فعال/غیرفعال** (`active`).
- شمارندهٔ **impression/click** (آنالیتیکس).

### ۷.۳ مدلِ دادهٔ ادمین (SQLAlchemy — `src/core/database.py`)

```python
class BnAd(Base):
    """جایگاهِ تبلیغاتیِ منوی بازارنما — مدیریت از پنلِ ادمین.

    هر رکورد یک «خلاقیتِ تبلیغ» است که به یک اسلاتِ مشخص (menu_top/menu_inline)
    تخصیص می‌یابد. هدف‌گیریِ تیر، زمان‌بندی، اولویت و فعال/غیرفعال پشتیبانی می‌شود.
    لوگوی PNG به‌صورتِ فایل آپلود و مسیرش در logo_path نگه‌داری می‌شود.
    """
    __tablename__ = "bn_ads"

    id: Mapped[int] = mapped_column(primary_key=True)
    slot: Mapped[str] = mapped_column(String(32), index=True)        # menu_top | menu_inline
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str | None] = mapped_column(String(280), nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    cta_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(300), nullable=True)  # مسیرِ PNG آپلودی
    bg_color: Mapped[str | None] = mapped_column(String(16), nullable=True)     # رنگِ پس‌زمینهٔ کارت (اختیاری)

    target_tier: Mapped[str] = mapped_column(String(16), default="all")  # all|free|vip|premium
    priority: Mapped[int] = mapped_column(Integer, default=0)            # بزرگ‌تر = جلوتر
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks:      Mapped[int] = mapped_column(Integer, default=0)

    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)  # admin.id
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

> توجه: شمارشِ click می‌تواند روی همین جدول جمع شود (ساده) یا برای تحلیلِ زمانی در جدولِ رویدادِ سبک هم لاگ شود (اختیاری):

```python
class BnAdEvent(Base):
    """رویدادِ نمایش/کلیکِ تبلیغ — برای تحلیلِ زمانیِ CTR (اختیاری/سبک)."""
    __tablename__ = "bn_ad_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ad_id: Mapped[int] = mapped_column(Integer, index=True)
    kind: Mapped[str] = mapped_column(String(12))   # impression | click
    tier: Mapped[str | None] = mapped_column(String(16), nullable=True)  # تیرِ بینندهٔ زمانِ رویداد
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc), index=True)
```

> migration: یک فایلِ Alembic تازه (`alembic revision --autogenerate -m "bn_ads"` سپس `alembic upgrade head` داخلِ کانتینرِ api).

### ۷.۴ بخشِ ادمین

افزودنِ یک بخشِ تازه به رجیستریِ `src/api/sections.py`:
```python
{"key": "bn-ads", "label": "تبلیغاتِ بازارنما"},
```
- قابلِ‌تخصیص به کارمند (در `ASSIGNABLE`)؛ نه `SUPERADMIN_ONLY`.
- صفحهٔ فرانتِ ادمین (`frontend/admin/...`): جدولِ تبلیغ‌ها + فرمِ ساخت/ویرایش با:
  - انتخابِ اسلات (menu_top/menu_inline).
  - آپلودِ لوگوی PNG (مثلِ صرافی/وان‌رویال).
  - عنوان/متن/CTA/لینک.
  - تیرِ هدف، اولویت، تاریخِ شروع/پایان، سوییچِ فعال.
  - نمایشِ شمارندهٔ impression/click + CTR.

### ۷.۵ مدلِ APIِ ادمین (پیشنهادی — `src/api/routes/admin_bazaarnama.py`)

| متد | مسیر | کارکرد |
|---|---|---|
| `GET`  | `/admin/bn-ads` | فهرستِ همهٔ تبلیغ‌ها (با فیلترِ slot/active) |
| `POST` | `/admin/bn-ads` | ساختِ تبلیغ (بدنهٔ JSON؛ بدونِ لوگو) |
| `PUT`  | `/admin/bn-ads/{id}` | ویرایش |
| `DELETE` | `/admin/bn-ads/{id}` | حذف |
| `POST` | `/admin/bn-ads/{id}/logo` | آپلودِ `UploadFile` لوگوی PNG → ذخیره در `bn_ad_logos/` و ست‌کردنِ `logo_path` |
| `POST` | `/admin/bn-ads/{id}/toggle` | فعال/غیرفعال |

- همه پشتِ `Depends(get_current_admin)` + گاردِ بخش (`SectionGuard("bn-ads")`).
- ذخیرهٔ لوگو: همان الگوی فایلِ ایستای پروژه (مثلِ `edu-asset`/`ig-media` در `public.py`) — دایرکتوریِ `bn_ad_logos/` + سروینگِ عمومی `GET /bazaarnama/ad-logo/{filename}`.

### ۷.۶ مدلِ APIِ عمومی (مصرف توسطِ چارت — `src/api/routes/bazaarnama.py`)

چون منوی همبرگری برای کاربرِ مهمان هم باز می‌شود، اندپوینتِ خواندنِ تبلیغ‌ها **عمومی** است (بدونِ احرازِ اجباری؛ تیر در صورتِ وجودِ توکن خوانده می‌شود):

```
GET /bazaarnama/ads?slot=menu_top
→ 200 { "ads": [ {
    "id": 7, "slot": "menu_top", "title": "وان‌رویال",
    "body": "بروکرِ رگوله با اسپردِ پایین — با لینکِ ما ثبت‌نام کن",
    "cta_label": "ساختِ حساب", "cta_url": "https://...ref...",
    "logo_url": "/bazaarnama/ad-logo/oneroyal.png", "bg_color": "#0b1e3a"
} ] }
```

منطقِ انتخاب در سرور:
1. `active == True`.
2. بازهٔ زمانی معتبر (`starts_at <= now <= ends_at` یا null).
3. `target_tier in ('all', <tierِ کاربرِ جاری>)` — تیر از توکنِ آکادمی (در صورتِ وجود) استخراج می‌شود؛ نبودِ توکن ⇐ `free`.
4. مرتب بر اساسِ `priority DESC, id DESC`؛ برگرداندنِ بالاترین (یا چند تا برای چرخش).
5. هر بار که سرور تبلیغی را برمی‌گرداند `impressions += 1` (و در صورتِ فعال‌بودنِ `BnAdEvent`، یک رویداد).

ثبتِ کلیک:
```
POST /bazaarnama/ads/{id}/click  → 204   # clicks += 1 (+ رویداد)؛ بدونِ احراز
```

### ۷.۷ مصرفِ فرانت — کامپوننتِ `AdSlot`

کامپوننتِ تازه در `AuthMenu.jsx` (یا فایلِ کنارِ آن):

```jsx
function AdSlot({ P, slot }) {
  const [ad, setAd] = React.useState(null);
  React.useEffect(() => {
    api.bnAds(slot).then((r) => setAd((r.ads || [])[0] || null)).catch(() => {});
  }, [slot]);
  if (!ad) return null;                       // نبودِ تبلیغ ⇒ هیچ فضای خالی‌ای اشغال نشود
  const onClick = () => {
    try { api.bnAdClick(ad.id); } catch (e) {}
    window.open(ad.cta_url, '_blank', 'noopener');
  };
  return (
    <button onClick={onClick}
      className="w-full text-right rounded-xl p-3 flex items-center gap-3 transition-transform hover:scale-[1.01]"
      style={{ background: ad.bg_color || P.soft, border: `1px solid ${P.border}` }}>
      {ad.logo_url && <img src={ad.logo_url} alt="" className="w-10 h-10 rounded-lg object-contain shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{ad.title}</div>
        {ad.body && <div className="text-[11px] leading-5 opacity-80 line-clamp-2">{ad.body}</div>}
      </div>
      {ad.cta_label && (
        <span className="shrink-0 text-[11px] px-2 py-1 rounded-lg bg-white/15">{ad.cta_label}</span>
      )}
    </button>
  );
}
```

افزودنِ متدها به `src/api/client.js`:
```js
bnAds:     (slot) => client.get(`/bazaarnama/ads?slot=${encodeURIComponent(slot)}`),
bnAdClick: (id)   => client.post(`/bazaarnama/ads/${id}/click`),
```

جای‌گذاری در `AuthMenu`:
- `<AdSlot P={P} slot="menu_top" />` بلافاصله زیرِ کارتِ کاربر.
- `<AdSlot P={P} slot="menu_inline" />` بینِ «امکانات» و «پشتیبانی».

> **اصلِ «بدونِ آدرسِ خام»:** تبلیغ‌ها هم لوگوی تمیز + متن + دکمه‌اند؛ هرگز آدرسِ کیف‌پول/کانترکت در منو رندر نمی‌شود.

---

## ۸) G5 — تمِ پیش‌فرضِ روز (light)

- `AuthMenu` از prop `theme` تغذیه می‌شود (از `BazaarNama.jsx`). مطابقِ تسک #12، پیش‌فرضِ تمِ کلِ بازارنما به **`light`** تغییر می‌کند (در `BazaarNama.jsx`: `useState(() => loadWS().theme || 'light')`).
- هیچ رنگِ inlineِ خام؛ همه از `palette(dark)` در `AuthMenu.jsx` و توکن‌های `THEMES` در `BazaarNama.jsx`.
- اسلاتِ تبلیغ `bg_color` را به‌صورتِ override می‌گیرد؛ اگر null باشد از `P.soft` استفاده می‌شود تا با تمِ روز/شب هماهنگ بماند.

---

## ۹) جمع‌بندیِ تغییرات (Change Set)

**فرانت (`frontend/prochart/src/`):**
1. `AuthMenu.jsx`:
   - حذفِ `SubscribePanel` (آدرسِ کیف‌پول) → افزودنِ `PremiumPitch` (کارت‌های مزیت + CTAِ پنل).
   - حذفِ مسیرِ `register` درجا از منو؛ دکمهٔ «ثبت‌نام» → `gotoPanel('/register?from=chart')`.
   - افزودنِ بخشِ «امکاناتِ بازارنما» (شورت‌کاتِ فیچرها با `CustomEvent`).
   - افزودنِ آیتمِ «پنلِ کاربری» + بخشِ «پشتیبانی و اجتماعی» + فوتر.
   - افزودنِ `AdSlot` × ۲ (menu_top, menu_inline).
2. `api/client.js`: متدهای `bnAds`, `bnAdClick`.
3. `BazaarNama.jsx`: لیسنرهای `bn:rightTab` / `bn:openScript` / `bn:help`؛ پیش‌فرضِ تم → `light`.

**بک‌اند (`src/`):**
4. `core/database.py`: مدلِ `BnAd` (+ اختیاری `BnAdEvent`).
5. `api/routes/bazaarnama.py`: `GET /bazaarnama/ads`، `POST /bazaarnama/ads/{id}/click`، `GET /bazaarnama/ad-logo/{filename}`.
6. `api/routes/admin_bazaarnama.py` (تازه): CRUDِ تبلیغ + آپلودِ لوگو + toggle.
7. `api/sections.py`: بخشِ `bn-ads` («تبلیغاتِ بازارنما»).
8. Alembic migration برای جدول‌های تازه.

**ادمین (`frontend/admin/`):**
9. صفحهٔ «تبلیغاتِ بازارنما»: جدول + فرمِ ساخت/ویرایش + آپلودِ PNG + شمارندهٔ CTR.

---

## ۱۰) معیارهای پذیرش (Acceptance)

- [ ] منوی همبرگری **هیچ آدرسِ کیف‌پول/کانترکتِ خامی** نشان نمی‌دهد.
- [ ] دکمهٔ «ثبت‌نام» و «ارتقا» کاربر را به `user.pro-chart.com` (با `?from=chart`) می‌برند.
- [ ] بخشِ «امکانات» تب‌های واچ‌لیست/آلارم/اسکرینر/تقویم را باز می‌کند و نمااسکریپت را (با گیتِ پریمیوم) فعال می‌کند.
- [ ] سوپرادمین از پنلِ ادمین می‌تواند تبلیغ بسازد: لوگوی PNG + عنوان + متن + CTA + لینک + تیرِ هدف + بازهٔ زمانی + اولویت + فعال/غیرفعال.
- [ ] تبلیغِ فعالِ واجدِ‌شرایط در اسلاتِ مربوطه نمایش داده می‌شود؛ نبودِ تبلیغ ⇒ هیچ فضای خالی.
- [ ] impression با نمایش و click با کلیک افزایش می‌یابد و در ادمین دیده می‌شود.
- [ ] تمِ پیش‌فرضِ منو/بازارنما **روز (light)** است؛ تغییرِ تم همه‌چیز را theme-aware نگه می‌دارد.
- [ ] برای کاربرِ مهمان (بدونِ توکن) همه‌چیز کار می‌کند (تبلیغ‌ها = تیرِ free/all).

---

## منابع (تحقیقِ TradingView)

- TradingView — Getting started with Supercharts (overlay/right-rail + top-right menu): <https://www.tradingview.com/support/solutions/43000746464-getting-started-with-supercharts/>
- TradingView — Mastering the watchlists: <https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/>
- TradingView — Introduction to alerts: <https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/>
- TradingView — Manage alerts: <https://www.tradingview.com/support/solutions/43000595311-manage-alerts/>
