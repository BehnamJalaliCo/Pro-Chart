# فیکس‌های زندهٔ کاربرمحورِ نشستِ 113282d5 که هنوز uncommitted مانده‌اند

**چرا این فایل هست:** طیِ لوپِ پریتی (نشستِ 2026-07-16)، سه باگِ صحتِ **کاربرمحورِ همه‌گیر** پیدا و رفع شد و **زنده دیپلوی شد** — ولی چون روی فایل‌هایی افتادند که از قبل در working-tree اصلاح‌شده (WIP، uncommitted) بودند، نمی‌شد هانکِ رفع را بدونِ sweepِ کارِ نشستِ قبلی به‌صورتِ کامیتِ تمیز ثبت کرد.

این فایل تمیز است (کارِ خودِ این نشست) و در گیت کامیت می‌شود تا **این رفع‌ها در ریستِ احتمالیِ branch گم نشوند**. وقتی مالک branch را snapshot/سامان داد، این رفع‌ها را در گیت ثبت کند (روی فایل‌های زیر از قبل اعمال شده‌اند؛ فقط باید commit شوند).

هر سه رفع با **تستِ عددیِ آفلاینِ مستقیم روی کدِ deploy‌شده** اثبات شده‌اند (نه صرفاً «رندر می‌شود»).

---

## رفع ۱ — Renko: بازگشت باید ۲ آجر باشد نه ۱ (Loop #46)
فایل: `frontend/prochart/src/bazaarnama/chartbuilders.js` — تابعِ `renko`
باگ: با یک `base`ِ تکی، بعد از فقط ۱ آجرِ برگشت آجرِ معکوس می‌زد؛ استانداردِ Renko/TV بازگشت را ۲ آجر می‌خواهد.
آفلاین: `100,102,101` باگ⇒ `U U D`(D جعلی)، fixed⇒ `U U`.

قبل:
```js
  let base = cs[0].c, dir = 0;
  for (const c of cs) {
    let price = c.c;
    while (price >= base + brick) { const o = base, cl = base + brick; out.push({ t: nt(c.t), o, h: cl, l: o, c: cl }); base += brick; dir = 1; }
    while (price <= base - brick) { const o = base, cl = base - brick; out.push({ t: nt(c.t), o, h: o, l: cl, c: cl }); base -= brick; dir = -1; }
  }
```
بعد (دو دیوارِ top/bot):
```js
  let top = cs[0].c, bot = cs[0].c;
  for (const c of cs) {
    const price = c.c;
    while (price >= top + brick) { const o = top, cl = top + brick; out.push({ t: nt(c.t), o, h: cl, l: o, c: cl }); top += brick; bot = top - brick; }
    while (price <= bot - brick) { const o = bot, cl = bot - brick; out.push({ t: nt(c.t), o, h: o, l: cl, c: cl }); bot -= brick; top = bot + brick; }
  }
```

---

## رفع ۲ — SuperTrend: رَچِتِ باندِ نهایی معکوس بود (Loop #59)
فایل: `frontend/prochart/src/bazaarnama/indicators.js` — تابعِ `supertrend` (~خط ۲۲۴)
آفلاین (روی کدِ deploy‌شده): current با textbook **۴۶/۵۱ خط اختلاف**؛ fixed **۰/۵۱ خط + ۰/۵۱ جهت**.

قبل:
```js
    if (up != null) ub = closes[i - 1] > up ? Math.max(ub, up) : ub;
    if (dn != null) lb = closes[i - 1] < dn ? Math.min(lb, dn) : lb;
```
بعد:
```js
    if (up != null) ub = (ub < up || closes[i - 1] > up) ? ub : up;
    if (dn != null) lb = (lb > dn || closes[i - 1] < dn) ? lb : dn;
```
(یادداشت: همین باگ در `namascript.js` هم بود که آنجا **تمیز کامیت شد** — کامیتِ `9680879`.)

---

## رفع ۳ — anti-patternِ warmup `map(null→0)` در ۶ اندیکاتور (Loop #60)
فایل: `frontend/prochart/src/bazaarnama/indicators.js`
باگ: `x.map(v=>v==null?0:v)` قبل از `ema/sma/wma` صفرِ جعلیِ warmup را به‌عنوانِ داده وارد می‌کرد. شدیدترین: **dema/tema** (~۹۰ بارِ اول به‌شدت غلط؛ آفلاین: dema/tema fixed vs textbook **۰/۱۲۱**، قبلاً ۱۲۱/۱۲۱ غلط).

- `dema`: `ema(e.map((v) => (v == null ? 0 : v)), p)` → `ema(e, p)`
- `tema`: `ema(e1.map(...), p), e3 = ema(e2.map(...), p)` → `ema(e1, p), e3 = ema(e2, p)`
- `macd` signal: `ema(line.map((v) => (v == null ? 0 : v)), sig)` → `ema(line, sig)`
- `stoch` %D: `sma(k.map((v) => (v == null ? 0 : v)), d).map((v, i) => (k[i] == null ? null : v))` → `smaNull(k, d)`
- `stochRsi`: `ks = sma(raw.map(...), k)...; ds = sma(ks.map(...), d)...` → `ks = smaNull(raw, k); ds = smaNull(ks, d);`
- `hma`: ماسکِ خروجی تا پنجرهٔ کاملِ `sq` از `diff` واقعی باشد:
  `return h.map((v, i) => (diff[i] == null ? null : v));` → `return h.map((v, i) => { for (let j = 0; j < sq; j++) if (i - j < 0 || diff[i - j] == null) return null; return v; });`

(یادداشت: همین anti-pattern در `ext_b`/`namascript` هم بود که **تمیز کامیت شدند** — کامیت‌های `09f0b58` و `bac82e7`. `ext_a` عاری از آن بود.)

---

## رفع ۴ — پالتِ حجمِ VOL_UP/VOL_DOWN لگسی بود (Loop #86)
فایل: `frontend/prochart/src/bazaarnama/chartbuilders.js` — ثابت‌های `VOL_UP`/`VOL_DOWN` (خط ۱۱۱-۱۱۲)
باگ: کندل‌ها به پالتِ مدرنِ TV (#089981/#f23645) مهاجرت کرده بودند ولی این دو ثابتِ رنگِ حجم هنوز لگسی (#26a69a/#ef5350) بودند ⇒ ناسازگاری با کندل‌ها. (نسخهٔ inlineِ همین رنگ‌ها در `BazaarNama.jsx` **تمیز کامیت شد** — کامیتِ `11c9edd`؛ ولی chartbuilders.js فایلِ WIP است.)

قبل:
```js
export const VOL_UP = 'rgba(38,166,154,.5)';   // legacy #26a69a
export const VOL_DOWN = 'rgba(239,83,80,.5)';  // legacy #ef5350
```
بعد:
```js
export const VOL_UP = 'rgba(8,153,129,.5)';   // modern #089981 — هم‌تراز با کندل‌ها
export const VOL_DOWN = 'rgba(242,54,69,.5)';  // modern #f23645 — هم‌تراز با کندل‌ها
```

---

## رفع ۵ — مهاجرتِ پالتِ رنگِ جهت‌دار در رِندرِ زندهٔ چارت (Loop #87)
تکمیلِ مهاجرتِ لگسی→مدرن (#26a69a/#ef5350 → #089981/#f23645) در فایل‌هایی که رنگِ **جهت‌دارِ زندهٔ چارت** دارند. (نسخهٔ فرمِ hexِ همان باگِ #۸۶.)
- **`MiniChart.jsx:14-15`** (WIP): رنگِ **کندلِ سلول‌های چند-چارت** لگسی بود ⇒ کندل‌های چند-چارت با چارتِ اصلی ناسازگار. → مدرن.
- **`scales_crosshair.js:258-259`** (WIP): `LIVE_UP`/`LIVE_DOWN` (برچسبِ جهت‌دارِ آخرین‌قیمت). → مدرن.
- **`charttypes_ext.js:44`** (WIP): `DEF.up/down` پیش‌فرضِ نوع‌های چارتِ توسعه‌یافته. → مدرن.
- **`drawtools_ext.js:696/706`** (WIP): پُرِ فلشِ up/downِ ابزارِ ترسیم. → مدرن.
- **`drawings.js:328/395/466`** (تمیز، **کامیت `573727b`**): جعبهٔ اندازه‌گیریِ Shift+درگ + پیش‌فرضِ ابزارِ فلش.
زنده: `index-BIy7Wnvn.js`، ۰ خطای JS، ۸ کانواس. لگسیِ باقی‌مانده در باندل فقط مواردِ **غیرِچارت** است که عمداً دست‌نخورده ماند (دیاگرام‌های تیوتوریالِ `help/patterns.js`، سواچِ `BN_DRAW_COLORS`، fallbackِ مردهٔ `Help.jsx`، صفحهٔ `Legal.jsx`).
**آیتمِ معوق (کم‌اولویت):** دیاگرام‌های الگوی شمعیِ `help/patterns.js` (~۲۰ رنگِ لگسی) هنوز لگسی‌اند؛ برای فیدلیتیِ کاملِ تیوتوریال می‌توان بعداً به مدرن برد (سطحِ live chart نیست).

---

## رفع ۶ — دیاگرام‌های تیوتوریالِ الگو به پالتِ مدرن (Loop #88)
فایل: `frontend/prochart/src/bazaarnama/help/patterns.js` (WIP) — ۲۰ رنگِ خطِ زیگزاگِ دیاگرام‌های الگوی شمعی.
باگ: دیاگرام‌های راهنمای الگو (سر و شانه، الیوت، …) لِگ‌های صعودی/نزولی را با پالتِ لگسی (#26a69a/#ef5350) می‌کشیدند در حالی‌که چارتِ زنده مدرن است → ناسازگاریِ تیوتوریال با چارت (مالک فیدلیتیِ تیوتوریال را مهم می‌داند).
رفع: `#26a69a→#089981`, `#ef5350→#f23645` (۲۰ مورد). زنده: `index-C0gdrZVS.js`.
با این، **کلِ رنگِ جهت‌دارِ اپ** (زنده + تیوتوریال) مدرن شد؛ لگسیِ باقی فقط: سواچِ کاربریِ `BN_DRAW_COLORS`، fallbackِ مردهٔ `Help.jsx`، صفحهٔ `Legal.jsx`، و دو کامنت — هیچ‌کدام رنگِ رِندرِ جهت‌دار نیستند.

---

## رفع ۷ — لجندِ پیش‌فرض (بدونِ اندیکاتور) «تغییر» را close-open می‌داد نه close-to-close (Loop #94)
فایل: `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` — کامپوننتِ `Legend` (خط ~۱۸۷)
باگ (تلهٔ dual-legend): `ChartLegend` (نمای با-اندیکاتور) «تغییر» را close-to-close (نسبت به بستهٔ کندلِ قبل، عینِ TV) حساب می‌کرد، ولی `Legend` (نمای پیش‌فرضِ بدونِ اندیکاتور) چون `prevClose` نمی‌گرفت close-open (درون‌کندلی) می‌داد. (سمتِ پاس‌دادنِ `prevClose={_legPrevClose}` در `BazaarNama.jsx` **تمیز کامیت شد** — `7c5880d`.)
رفع: `Legend` حالا `prevClose` می‌گیرد → `_base = prevClose ?? open`، `chAbs = close − _base`؛ و رنگِ O/H/L/C = جهتِ کندل (`ohlcCol`)، رنگِ «تغییر» = جهتِ close-to-close — دقیقاً مثلِ `ChartLegend`+TV.
تأییدِ زنده (`index-Biy9JJlr.js`): لجند `C 1.14359  −0.00136075` نشان داد ⇒ base = ۱٫۱۴۴۹۵۰۷۵ = **بستهٔ کندلِ قبل** (نه open=۱٫۱۴۴۹۵) ⇒ close-to-close تأیید شد؛ ۰ خطای JS.

---

## رفع ۸ — «تغییرِ روزِ قبل» در نمای پیش‌فرض بی‌صدا no-op بود + باگِ «++» (Loop #95)
فایل: `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` — کامپوننتِ `Legend` (چیپِ Last-day) + رفعِ علامتِ دوگانه در **هر دو** مسیرِ لجند.
- **باگِ dual-legend:** توگلِ `slLastDayChange` فقط در `ChartLegend` (نمای با-اندیکاتور) رندر می‌شد؛ `Legend` (نمای پیش‌فرض) `lastDayChg/lastDayPct` نمی‌گرفت ⇒ روشن‌کردنِ توگل در نمای پیش‌فرض بی‌صدا no-op بود. (پاسِ propها در `BazaarNama.jsx` **تمیز کامیت شد** — `9511020`.) رفع: چیپِ Last-day به `Legend` هم افزوده شد (gated `slLastDayChange===true`).
- **باگِ «++»:** چیپ `'+' + fmtDelta(v)` می‌زد ولی `fmtDelta` خودش علامت دارد ⇒ `++0.0053`. پیشوندِ زائد در **هر دو** مسیر حذف شد.
- تأییدِ زنده (`index-DyUiN_-A.js`): با روشن‌کردنِ توگل، نمای پیش‌فرض `D +0.00530 (+0.47%)` نشان داد (تک‌علامت، چیپ حاضر)؛ ۰ خطای JS.

---

## رفع ۹ — توگلِ «حجم»ِ خطِ وضعیت (slVolume) در نمای با-اندیکاتور مرده بود (Loop #96)
فایل: `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` — `ChartLegend` خط `hasVol`.
باگ (تلهٔ dual-legend، چهارمین واگرایی): `Legend` (نمای پیش‌فرض) حجم را با `sl.slVolume` گِیت می‌کرد، ولی `ChartLegend` با `showVolume` (توگلِ **هیستوگرام**، نه متنِ خطِ وضعیت) ⇒ خاموش‌کردنِ `slVolume` در نمای با-اندیکاتور کاری نمی‌کرد.
رفع: `const hasVol = showVolume && vol != null && sl.slVolume !== false;` (افزودنِ گِیتِ slVolume؛ رفتارِ پیش‌فرض بی‌تغییر چون slVolume پیش‌فرض true است).
تأییدِ زنده (`index-B-d4aqsi.js`): نمای پیش‌فرض همچنان «Vol 0» دارد (بی‌رگرسیون)، ۰ خطای JS. سمتِ ChartLegend by-construction درست (همان گِیتِ اثبات‌شدهٔ Legend). فایلِ WIP ⇒ زنده-uncommitted (این لوپ کامیتِ کدِ تمیز نداشت؛ فقط doc).

---

## رفع ۱۰ — «تغییر»ِ پنجرهٔ داده close-open بود، ناسازگار با لجند/TV (Loop #97)
فایل: `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` — کامپوننتِ `DataWindow`.
باگ: بعد از #۹۴ که لجند را close-to-close کرد، `DataWindow` هنوز `close − open` می‌داد ⇒ **همان کندل** در لجند و پنجرهٔ داده «تغییر»ِ متفاوت نشان می‌داد (و با TV فرق داشت). (پاسِ `prevClose={_legPrevClose}` در `BazaarNama.jsx` **تمیز کامیت شد** — `ff7b7db`.)
رفع: `_cwBase = prevClose ?? open`، `chAbs = close − _cwBase`، رنگِ «تغییر» = `chgCol` (جهتِ close-to-close)، O/H/L/C = جهتِ کندل — عینِ لجند+TV.
تأییدِ زنده (`index-C0AreHTe.js`): پنجرهٔ داده روی hover «تغییر +0.00052» هم‌راستا با تغییرِ زندهٔ SELL/BUY؛ ۰ خطای JS. by-construction close-to-close (همان `_legPrevClose`ِ اثبات‌شدهٔ لجند).

---

## رفع ۱۱ — فیلدِ پیامِ آلارم تک‌خطی بود، TV چندخطی (Loop #103)
فایل: `frontend/prochart/src/bazaarnama/AlertsPanel.jsx` — فیلدِ «پیام» (خط ۵۴۲).
گپ: TV پیامِ آلارم را در `<textarea>`ِ چندخطی می‌گیرد؛ ما `<input>`ِ تک‌خطی داشتیم (متغیرها در چند خط جا نمی‌شدند).
رفع: `<input>` → `<textarea rows={2} resize-y>` با همان binding؛ inputCls به‌خاطرِ `h-[26px]` کنار گذاشته شد و کلاسِ چندخطی جایگزین شد.
تأییدِ زنده (`index-brwbMu-p.js`): بعد از بازکردنِ «پیام و تحویل»، فیلد = `TEXTAREA rows=2`. ۰ خطای JS.

---

## رفع ۱۲ — لجندِ خطِ وضعیت روی موبایل از لبهٔ چپ کلیپ می‌شد (Loop #109)
فایل: `frontend/prochart/src/bazaarnama/overlays/ChartOverlays.jsx` — `OhlcTape` (سلول‌های O/H/L).
باگ: لجند به راست انکر است؛ روی ۳۹۰px محتوایش (O/H/L/C + تغییر + Vol + گیر) پهن‌تر از عرض بود و از لبهٔ چپ کلیپ می‌شد (چیپِ تغییر در x=−108، Vol/گیر بیرونِ صفحه). تلاشِ قبلی فقط نامِ توصیفی را <560px پنهان کرده بود (ناکافی).
رفع: سلول‌های **O/H/L** زیرِ 560px پنهان (`hidden min-[560px]:flex`)، فقط **C=قیمت** بماند — سبکِ لجندِ فشردهٔ موبایلِ TV (نماد+قیمت+تغییر). (کلاسِ متضادِ `flex`+`hidden` هم اصلاح شد تا `hidden` واقعاً اثر کند.)
تأییدِ زنده (`index-NLafpvLE.js`): موبایل ۳۹۰px → سلولِ O `display:none`، چیپِ تغییر `left=55` (روی صفحه، قبلاً −108)، بدونِ عنصرِ کلیپ‌شده. دسکتاپ ۱۴۴۰px → O `display:flex` (OHLCِ کامل، بی‌تغییر).

---

**وضعیت:** هر دوازده رفع در working-tree اعمال و زنده دیپلوی شده‌اند (بیلدهای این نشست). فقط منتظرِ snapshot-commitِ مالک برای ثبت در گیت‌اند.
