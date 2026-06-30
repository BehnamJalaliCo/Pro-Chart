# اسپکِ تقویتِ قابلیتِ اسکرین‌شات (#5)

> **هدف:** ارتقای آیکونِ دوربین از یک «دانلودِ PNG»ِ تک‌گزینه‌ای به یک منوی کاملِ اسکرین‌شات هم‌سطحِ TradingView: **کپی به کلیپ‌بورد**، **لینکِ اشتراکِ دائمی**، **واترمارکِ برند**، **چند فرمت (PNG/JPG)**، و **حاشیه‌نویسیِ پیش‌از‌اشتراک** — با هویتِ بازارنما و RTL.
>
> **فایلِ مرجع:** `frontend/prochart/src/pages/BazaarNama.jsx` (دکمهٔ دوربین، خط ۱۲۱۵)
> **اجزای مرتبط:**
> - `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` (کامپوننتِ `Watermark`، خط ۳۰)
> - `frontend/prochart/src/bazaarnama/hotkeys.js` (میان‌بُرِ `screenshot` = کلیدِ `S`، خط ۱۳۶ — هنوز handler ندارد)
> - `frontend/prochart/src/api/client.js` (الگوی endpointهای `bn*`، خطوط ۱۲۱–۱۵۰)
> - `src/api/routes/bazaarnama.py` (روترِ بک‌اند برای endpointِ اشتراک)
> - `frontend/prochart/src/assets/bn-logo.png` (`bnLogo`)
> **تاریخ:** 2026-06-30

---

## ۱. وضعِ فعلی (نقطهٔ شروع)

دکمهٔ دوربین در نوارِ ابزارِ بالا (BazaarNama.jsx خط ۱۲۱۵) یک onClick یک‌خطی است:

```js
const cv = chartRef.current.takeScreenshot();   // canvas از lightweight-charts v5
const ov = overlayRef.current;                  // canvasِ overlay (سشن‌ها/ترسیم‌ها)
if (ov) cv.getContext('2d').drawImage(ov, 0, 0);// ترکیبِ overlay روی screenshot
cv.toBlob(blob => { /* ساختِ <a download> با نامِ `${symbol}_${tf}.png` */ });
```

### کاستی‌ها نسبت به TradingView
1. **فقط دانلود** است؛ هیچ منویی نیست. در TradingView کلیکِ دوربین یک منو با چند گزینه باز می‌کند.
2. **کپی به کلیپ‌بورد نیست** (مهم‌ترین خواستهٔ #5) — کاربر نمی‌تواند مستقیم در تلگرام/سند paste کند.
3. **لینکِ اشتراکِ دائمی نیست** — TradingView یک URL دائمی می‌سازد که هرجا قابلِ ارسال است.
4. **واترمارک در عکس نیست:** کامپوننتِ `Watermark` فقط یک `<img>` در DOM است (ChartOverlays.jsx خط ۳۰–۳۳) و **داخلِ canvasِ خروجی composite نمی‌شود**؛ پس عکسِ دانلودی لوگو ندارد. هیچ تنظیمِ موقعیت/شفافیت/متنِ سفارشی هم نیست.
5. **فقط PNG** است؛ انتخابِ JPG/کیفیت نیست.
6. **حاشیه‌نویسی نیست:** امکانِ افزودنِ نماد/تایم‌فریم/تاریخ/قیمت یا یک خطِ متن روی عکس وجود ندارد.
7. **میان‌بُرِ `S`** در hotkeys.js ثبت شده ولی handler ندارد (بی‌اثر است).
8. هیچ بازخوردِ بصری (toast «کپی شد/لینک ساخته شد») نیست.

---

## ۲. معماریِ هستهٔ تولیدِ تصویر (`captureChart`)

یک util مشترک می‌سازیم تا همهٔ گزینه‌ها (دانلود/کپی/لینک) از یک مسیرِ واحد تغذیه شوند. فایلِ پیشنهادی: `frontend/prochart/src/bazaarnama/screenshot.js`.

```ts
type CaptureOpts = {
  format: 'png' | 'jpg';        // پیش‌فرض png
  quality?: number;             // فقط jpg، 0.5–1، پیش‌فرض 0.92
  scale?: 1 | 2;                // رزولوشن؛ 2 = رتینا (پیش‌فرض 2 برای اشتراک، 1 برای کلیپ‌بورد)
  watermark: WatermarkOpts | null;
  annotations?: Annotation[];   // حاشیه‌نویسی‌ها (بخشِ ۶)
  caption?: CaptionOpts | null; // نوارِ پایینِ نماد/تایم‌فریم/تاریخ
};
```

### مراحلِ تولید (همگی روی یک canvasِ آف‌اسکرین، نه DOM)
1. `base = chartRef.current.takeScreenshot()` → canvasِ خامِ چارت (lightweight-charts v5).
2. ساختِ یک canvasِ مقصد به اندازهٔ `base.width*scale × base.height*scale` و `ctx.scale(scale, scale)`.
3. `drawImage(base)` سپس **`drawImage(overlayRef.current)`** (سشن‌ها/ترسیم‌ها — همان منطقِ فعلیِ خط ۱۲۱۵؛ حتماً حفظ شود).
4. اگر `caption` فعال: یک نوارِ افقیِ پایین (بخشِ ۵-ج) رسم شود.
5. حاشیه‌نویسی‌ها (بخشِ ۶) رسم شوند.
6. **واترمارک** آخر از همه رسم شود تا روی‌همه باشد (بخشِ ۴).
7. خروجی: برای دانلود/کلیپ‌بورد → `canvas.toBlob(cb, mime, quality)`؛ برای لینک → همان blob به سرور آپلود می‌شود.

> **نکتهٔ CORS/کلیپ‌بورد:** لوگو محلی (`bnLogo`) است و چارت canvas-native؛ پس canvas «tainted» نمی‌شود و `toBlob`/`ClipboardItem` کار می‌کند. مراقب باشید هیچ تصویرِ cross-origin بدونِ `crossOrigin="anonymous"` روی canvas کشیده نشود (وگرنه clipboard fail می‌دهد).

---

## ۳. منوی دوربین (UI)

دکمهٔ دوربینِ فعلی به یک **دکمهٔ کشویی (split/dropdown)** تبدیل می‌شود:
- **کلیکِ ساده** = اکشنِ پیش‌فرض (کپی به کلیپ‌بورد — مطابقِ رفتارِ مدرنِ کاربر).
- **کلیکِ روی فلشِ کوچک / نگه‌داشتن** = بازشدنِ منوی کامل.

آیتم‌های منو (با آیکونِ `lucide-react`؛ هم‌خانوادهٔ آیکون‌های موجود):

| آیتم | آیکون | عمل |
|---|---|---|
| **کپی تصویر** | `Copy` | تصویر را در کلیپ‌بورد می‌گذارد (`ClipboardItem`) → toast «کپی شد» |
| **ذخیرهٔ تصویر** | `Download` | دانلودِ فایل با فرمتِ انتخابی |
| **کپیِ لینکِ تصویر** | `Link` | آپلود + گرفتنِ URL دائمی + کپیِ URL در کلیپ‌بورد → toast |
| **اشتراک‌گذاری…** | `Share2` | بازکردنِ مودالِ اشتراک (بخشِ ۷): پیش‌نمایش + حاشیه‌نویسی + دکمه‌های تلگرام/X/کپی |
| ───── | | (جداکننده) |
| **فرمت: PNG / JPG** | — | رادیو/تاگل؛ ذخیره در تنظیمات |
| **واترمارک: روشن/خاموش** | `Droplet` | تاگل + لینک به تنظیماتِ واترمارک |
| **شاملِ نوارِ نماد/تاریخ** | — | چک‌باکسِ caption (بخشِ ۵-ج) |

- منو `dir="rtl"`، با `TH.popoverBg`/`TH.border`، آیتم‌ها با hover `TH.chipBgHover`، ترنزیشن `duration-[120ms]` — هم‌سطحِ بقیهٔ پنل.
- **میان‌بُرها** (در hotkeys.js): `S` = کپی به کلیپ‌بورد (handler را وصل کن)، `Shift+S` = ذخیرهٔ فایل، `Ctrl+Alt+S` = کپیِ لینک. ثبتِ این‌ها در همان آرایهٔ `SHORTCUTS` تا در دیالوگِ راهنما (`showShortcuts`) دیده شوند.

---

## ۴. واترمارک (برند)

دو لایه:

### الف) واترمارکِ **داخلِ تصویرِ خروجی** (مهم — امروز وجود ندارد)
در `captureChart` پس از رسمِ چارت، لوگو روی canvas کشیده می‌شود:

```js
const wm = new Image();
wm.src = bnLogo;               // import محلی → بدون CORS taint
await wm.decode();
const h = opts.watermark.size; // پیش‌فرض 40px
const w = h * (wm.width / wm.height);
ctx.globalAlpha = opts.watermark.opacity;       // پیش‌فرض 0.5
// موقعیت بر اساسِ position (bottom-left پیش‌فرض، هم‌خوان با Watermark فعلیِ DOM)
ctx.drawImage(wm, x, y, w, h);
ctx.globalAlpha = 1;
```

**تنظیماتِ واترمارک (`WatermarkOpts`)** که در localStorage (`bn_screenshot_opts`) persist می‌شوند:

```ts
type WatermarkOpts = {
  enabled: boolean;                 // پیش‌فرض true
  kind: 'logo' | 'text' | 'logo+text';
  text?: string;                    // متنِ سفارشیِ کاربر (مثلِ آی‌دیِ تلگرام)
  position: 'bottom-left'|'bottom-right'|'top-left'|'top-right'|'center';
  opacity: number;                  // 0.1–1، پیش‌فرض 0.5
  size: number;                     // ارتفاعِ لوگو px، پیش‌فرض 40
};
```

- پیش‌فرضِ برند: لوگوی بازارنما، `bottom-left`، `opacity 0.5`، `size 40` — دقیقاً مطابقِ `Watermark` فعلیِ DOM، تا عکس و صفحه یکی دیده شوند.
- در تمِ روشن لوگو باید `invert` شود تا خوانا بماند (ChartOverlays.jsx همین کار را با `filter: invert(1)` می‌کند؛ معادلش روی canvas: لوگوی روشن را روی یک off-screen با `filter` نکشید — ساده‌تر است دو فایلِ لوگو، تیره/روشن، نگه داریم یا با `globalCompositeOperation` معکوس کنیم. **روشِ توصیه‌شده:** نگه‌داشتنِ دو asset `bn-logo-light.png`/`bn-logo-dark.png`).
- `kind: 'text'`/`'logo+text'`: متنِ سفارشی با فونتِ Vazirmatn، رنگِ نیمه‌شفافِ سفید/مشکی بسته به تم.

### ب) واترمارکِ **پس‌زمینهٔ چارت** (اختیاری، فاز ۲ — مثلِ TradingView)
نمایشِ کم‌رنگِ `EURUSD · ۱h` در مرکزِ صفحه (نه‌فقط در عکس). این همان «watermark» داخلیِ TradingView است. اختیاری و کم‌اولویت؛ اگر ساخته شود، در عکس هم می‌آید چون روی canvasِ overlay رسم می‌شود.

---

## ۵. فرمت‌ها و خروجی

### الف) فرمت‌ها
- **PNG** (پیش‌فرض): بدونِ افت، مناسبِ تحلیلِ دقیق. `image/png`.
- **JPG**: حجمِ کم برای اشتراکِ سریع. `image/jpeg` با `quality` (پیش‌فرض ۰.۹۲). چون JPG شفافیت ندارد، روی پس‌زمینهٔ مات (`TH.bg`) flatten شود.
- (اختیاری فاز ۲) **WebP** برای آپلودِ لینک، سبک‌تر؛ اگر مرورگر پشتیبانی کند.

### ب) رزولوشن (`scale`)
- اشتراک/دانلود: `scale=2` (رتینا، خواناتر).
- کلیپ‌بورد: `scale=1` کافی است (حجم/سرعت)؛ قابلِ تنظیم.

### ج) نوارِ caption (شاملِ نماد/تایم‌فریم/تاریخ)
گزینهٔ «شاملِ نوارِ نماد/تاریخ» یک نوارِ پایینِ تصویر اضافه می‌کند (مثلِ legendِ TradingView در عکس):
- محتوا: `لوگوی نماد + نامِ نماد (EUR/USD) + تایم‌فریم + قیمتِ لحظه‌ای + تاریخ/ساعتِ تهران + «bazaarnama»`.
- ارتفاعِ ~۳۶px، پس‌زمینهٔ `TH.bg`، اعداد `tabular-nums` و `dir="ltr"`، متنِ فارسی RTL.
- منبعِ داده: همان stateهای `symbol`, `tf`, آخرین `mid`/قیمت، `prettySym`.

---

## ۶. حاشیه‌نویسی (Annotation) — پیش از اشتراک

در **مودالِ اشتراک** (بخشِ ۷) یک لایهٔ سادهٔ حاشیه‌نویسی روی پیش‌نمایشِ تصویر:

```ts
type Annotation =
  | { kind: 'text';  x:number; y:number; text:string; color:string; size:number }
  | { kind: 'arrow'; x1:number;y1:number;x2:number;y2:number; color:string }
  | { kind: 'rect';  x:number; y:number; w:number; h:number; color:string }
  | { kind: 'pen';   points:[number,number][]; color:string; width:number };
```

ابزارها (نوارِ کوچکِ بالای پیش‌نمایش): **متن**، **فلش**، **مستطیل/هایلایت**، **قلمِ آزاد**، انتخابِ **رنگ** (همان ۷ رنگِ `FLAG_HEX` که در اسپکِ ساید‌بار #15 تعریف شد، برای یک‌دستی)، و **Undo/پاک‌کردن**.

- حاشیه‌نویسی‌ها روی یک canvasِ روی پیش‌نمایش رسم می‌شوند و هنگامِ خروجی در `captureChart` (مرحلهٔ ۵ بخشِ ۲) داخلِ تصویر composite می‌شوند.
- مختصات نسبت‌به ابعادِ تصویرِ خروجی نرمالایز شوند (تا با `scale=2` درست بزرگ شوند).
- **محدودهٔ فاز ۱:** فقط «متن» و «فلش» کافی است؛ مستطیل/قلم در فاز ۲.

> توجه: این حاشیه‌نویسیِ «روی عکس» مستقل از ابزارهای ترسیمِ چارت (`drawings.js`) است و آن‌ها را تغییر نمی‌دهد. ترسیم‌های اصلیِ چارت از طریقِ `overlayRef` همچنان در عکس می‌آیند.

---

## ۷. مودالِ اشتراک و لینکِ دائمی

### الف) مودال
- **پیش‌نمایشِ زنده** تصویرِ نهایی (با واترمارک/caption/حاشیه‌نویسی).
- نوارِ ابزارِ حاشیه‌نویسی (بخشِ ۶).
- ردیفِ اکشن: **کپی تصویر** · **ذخیره** · **کپیِ لینک** · **تلگرام** · **X**.
- تنظیماتِ سریع: فرمت، واترمارک on/off، caption on/off.
- `dir="rtl"`، توکن‌های `TH`، بستن با `Esc`/کلیکِ بیرون.

### ب) لینکِ دائمی (بک‌اند)
endpointِ جدید در `src/api/routes/bazaarnama.py` (هم‌خانوادهٔ `/layouts`, `/watchlist`):

```
POST /academy/bn/snapshot
  body: multipart (image blob) یا { data_url }
  resp: { id, url }      // url دائمی، مثلِ /s/<id> یا یک CDN/استاتیک
GET  /academy/bn/snapshot/{id}        → خودِ تصویر (image/png)
GET  /s/{id}  (صفحهٔ عمومیِ نمایش)    → og:image برای پیش‌نمایش در تلگرام/شبکه‌ها
```

سمتِ کلاینت در `api/client.js` (کنارِ خطِ ۱۳۰):

```js
bnSnapshotUpload: (blob) => {
  const fd = new FormData(); fd.append('image', blob, 'chart.png');
  return client.post('/academy/bn/snapshot', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
},
```

**ذخیره‌سازی:** تصاویر روی دیسکِ سرور در یک volume (مثلِ `bn_snapshots/`) یا S3/گوگل‌درایوِ موجودِ پروژه؛ نام = هشِ تصادفیِ کوتاه (URL-safe). رکورد در DB (`snapshot` table: `id`, `student_id` nullable, `created_at`, `path`, `symbol`, `tf`). **اشتراک دائمی است و منقضی نمی‌شود** (مطابقِ TradingView).

**صفحهٔ عمومیِ `/s/{id}`:** تصویر + متاتگ‌های `og:image`/`twitter:card` تا در تلگرام/X پیش‌نمایش بخورد + یک CTAِ ظریفِ «ساخته‌شده با بازارنما» (لینک به سایت) برای رشدِ ارگانیک.

### ج) دکمه‌های شبکه‌های اجتماعی
- **تلگرام:** `https://t.me/share/url?url=<snapshotUrl>&text=<symbol tf>` (پیش‌نمایش از og:image).
- **X:** `https://twitter.com/intent/tweet?url=<snapshotUrl>&text=...`.
- چون تصویر روی URL عمومی نشسته، پیش‌نمایشِ تصویر خودکار می‌آید (نیازی به آپلودِ مستقیمِ فایل به این شبکه‌ها نیست).

### د) امنیت/سوءاستفاده
- حدِ نرخ (rate-limit) روی `POST /snapshot` (مثلِ N در دقیقه per-IP/per-user) تا storage پر نشود.
- حدِ حجمِ بدنه (مثلِ ≤۵MB) و اعتبارسنجیِ نوعِ تصویر.
- اختیاری: «Protect my chart» — اگر کاربر بخواهد، snapshot خصوصی/با لینکِ غیرقابل‌حدس بماند (پیش‌فرضِ همه‌ٔ لینک‌ها همین حالتِ unguessable است).

---

## ۸. RTL و توکن‌های تم

- کلِ منو/مودال `dir="rtl"`؛ نماد/تایم‌فریم/قیمت/تاریخ در نوارِ caption `dir="ltr"` و `tabular-nums`.
- رنگ‌ها فقط از `TH` (`TH.bg`, `TH.popoverBg`, `TH.border`, `TH.text`, `TH.chipBg`, `TH.chipBgHover`, `TH.accent`)؛ تنها رنگِ هاردکدِ مجاز همان `FLAG_HEX`ِ حاشیه‌نویسی است.
- ترنزیشن `duration-[120ms]`، اسکرول `bn-thin-scroll`.
- آیکون‌ها از `lucide-react`: `Camera`, `Copy`, `Download`, `Link`, `Share2`, `Droplet`, `Type`, `ArrowUpRight`, `Square`, `Pencil`, `Undo2` (اکثرشان از قبل import شده‌اند).
- toastها: اگر سیستمِ toastِ مشترک هست از آن استفاده شود؛ وگرنه یک toastِ سادهٔ inline با `TH.accent`.

---

## ۹. فازبندیِ پیاده‌سازی

| فاز | محتوا | ریسک |
|---|---|---|
| **۱ — کلیپ‌بورد + واترمارکِ داخلِ عکس + منو** | استخراجِ `captureChart` به `screenshot.js`، تبدیلِ دکمه به منو (کپی/ذخیره)، composite کردنِ واترمارک داخلِ canvas، وصل‌کردنِ میان‌بُرِ `S`، toast. | کم |
| **۲ — فرمت‌ها + caption + تنظیماتِ واترمارک** | تاگلِ PNG/JPG + کیفیت، نوارِ caption (نماد/تایم‌فریم/تاریخ/قیمت)، پنلِ تنظیماتِ واترمارک (متن/موقعیت/شفافیت)، persist در localStorage. | کم |
| **۳ — لینکِ دائمی + اشتراک** | endpointِ بک‌اندِ `POST /snapshot` + صفحهٔ `/s/{id}` با og:image، دکمه‌های تلگرام/X، `bnSnapshotUpload` در client، rate-limit. | متوسط |
| **۴ — حاشیه‌نویسی** | مودالِ اشتراک با پیش‌نمایش + متن/فلش (سپس مستطیل/قلم)، composite در خروجی. | متوسط |

> توصیه: فاز ۱ و ۲ کم‌ریسک و بیشترِ ارزشِ خواستهٔ #5 (کپی به کلیپ‌بورد + واترمارک + فرمت‌ها) را می‌دهند. فاز ۳/۴ تدریجی.

---

## ۱۰. چک‌لیستِ پذیرش

- [ ] کلیکِ دوربین یک منوی کامل باز می‌کند (کپی/ذخیره/لینک/اشتراک/فرمت/واترمارک).
- [ ] «کپی تصویر» تصویر را در کلیپ‌بورد می‌گذارد و در تلگرام/سند paste می‌شود (بدونِ taint).
- [ ] واترمارکِ برند **داخلِ فایلِ خروجی** دیده می‌شود (نه‌فقط روی صفحه)، با موقعیت/شفافیت/متنِ سفارشیِ قابلِ‌تنظیم و درست در هر دو تم.
- [ ] خروجی هم PNG و هم JPG (با کیفیت) و رزولوشنِ رتینا (`scale=2`) دارد.
- [ ] گزینهٔ caption نماد/تایم‌فریم/تاریخ/قیمت را به پایینِ عکس اضافه می‌کند.
- [ ] «کپیِ لینک» یک URL دائمی می‌سازد که در تلگرام پیش‌نمایشِ تصویر می‌خورد و منقضی نمی‌شود.
- [ ] حاشیه‌نویسی (حداقل متن+فلش) روی پیش‌نمایش کار می‌کند و در عکسِ نهایی می‌آید.
- [ ] میان‌بُرهای `S`/`Shift+S`/`Ctrl+Alt+S` کار می‌کنند و در دیالوگِ راهنما دیده می‌شوند.
- [ ] منطقِ فعلیِ composite کردنِ `overlayRef` (سشن‌ها/ترسیم‌ها) دست‌نخورده حفظ شده.
- [ ] هیچ رنگِ خارج از `TH`/`FLAG_HEX`؛ RTL درست؛ اعداد `tabular-nums`.
- [ ] rate-limit و حدِ حجم روی endpointِ snapshot فعال است.

---

## منابع (TradingView)

- [How to share a snapshot — TradingView](https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot/) — منوی دوربین: ذخیرهٔ تصویر، کپی به بافر، کپیِ لینک، ارسال به X؛ «لینک منقضی نمی‌شود».
- [Watermarks — Advanced Charts Documentation](https://www.tradingview.com/charting-library-docs/latest/ui_elements/watermarks/) — APIِ واترمارک (پیش‌فرض + سفارشی).
- [How to add a watermark (symbol & timeframe) — Quant Nomad](https://quantnomad.com/faq-how-to-add-a-watermark-symbol-and-timeframe-to-the-chart-background-in-tradingview/) — واترمارکِ پس‌زمینه (نماد/تایم‌فریم، رنگ/شفافیت).
- [How to insert images on the chart — TradingView](https://www.tradingview.com/support/solutions/43000632957-how-to-insert-images-on-the-chart/) — درجِ تصویر/حاشیه‌نویسی.
- [How to Share TradingView Chart Link — Pineify](https://pineify.app/resources/blog/how-to-share-tradingview-chart-link-a-step-by-step-guide) — جریانِ لینکِ اشتراک.
