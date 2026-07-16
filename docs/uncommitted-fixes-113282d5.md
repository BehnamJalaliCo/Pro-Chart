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

**وضعیت:** هر چهار رفع در working-tree اعمال و زنده دیپلوی شده‌اند (بیلدهای این نشست). فقط منتظرِ snapshot-commitِ مالک برای ثبت در گیت‌اند.
