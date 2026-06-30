# مرجعِ کاملِ Pine Script v6 → نگاشت به «نمااسکریپت»

> **هدف:** کلودِ سرور با خواندنِ این فایل می‌داند زبانِ Pine **کامل** چه دارد، و «نمااسکریپت»
> (موتورِ ما در `frontend/academy/src/bazaarnama/namascript.js`) الان چه دارد و چه کم دارد.
> هر بخش: امضای Pine + معادلِ نمااسکریپت + وضعیت.
>
> **علائم:** ✅ پیاده‌شده · ◑ ناقص · ☐ نیست
> **قاعده:** نمااسکریپت زبانِ مستقلِ ماست (الهام‌گرفته از Pine)، نه کپیِ آن. اجرا در **Web Worker سندباکس**.
> مرجعِ رسمیِ Pine: https://www.tradingview.com/pine-script-reference/v6/

---

## ۰) تفاوتِ بنیادینِ مدلِ اجرا (مهم‌ترین نکته)

| | Pine Script | نمااسکریپت فعلی |
|---|---|---|
| مدل | **بار-به-بار**: کل اسکریپت روی هر کندل از چپ به راست اجرا می‌شود | **سری‌محور (vectorized)**: هر سری یک آرایهٔ کامل است |
| سری تاریخی | `close[1]` = کندلِ قبل (history-referencing) | ☐ ندارد |
| حالتِ پایدار | `var x = 0` یک‌بار مقداردهی، بینِ کندل‌ها می‌ماند | ☐ ندارد |
| حلقه روی زمان | خودِ موتور تکرار می‌کند | باید vectorize شود |

> **شکافِ هستهٔ ۱:** برای «کپی‌برابرِاصلِ Pine» باید نمااسکریپت به **مدلِ بار-به-بار** ارتقا یابد
> یا حداقل عملگرِ `[]` (history) و `var` را شبیه‌سازی کند. این بزرگ‌ترین کارِ زبان است.

---

## ۱) ساختارِ کلیِ اسکریپت

```pine
//@version=6
indicator("My Indicator", overlay=true)   // یا strategy("My Strategy", ...)
length = input.int(14, "Length")
src    = input.source(close, "Source")
val    = ta.sma(src, length)
plot(val, "SMA", color.blue)
```

| عنصر | Pine | نمااسکریپت |
|---|---|---|
| `//@version=6` | اعلانِ نسخه | ☐ (نادیده) |
| `indicator(title, overlay, ...)` | تعریفِ اندیکاتور | ✅ `study()/indicator()` (no-op) |
| `strategy(title, ...)` | تعریفِ استراتژی | ◑ |
| `library(...)` | کتابخانهٔ قابل‌import | ☐ |
| `import user/lib/1` | واردکردنِ کتابخانه | ☐ |

---

## ۲) انواعِ داده و اعلان

| Pine | توضیح | نمااسکریپت |
|---|---|---|
| `int`, `float`, `bool`, `string`, `color` | انواعِ پایه | ◑ (پویا) |
| `series` vs `simple` vs `const` | کیفیتِ نوع (مهم برای کامپایلر) | ☐ |
| `var x = ...` | یک‌بار مقداردهی، پایدار | ☐ |
| `varip x = ...` | پایدار حتی بینِ تیک‌ها | ☐ |
| `x = na` | مقدارِ تهی | ◑ (`null`) |
| `na(x)` / `nz(x, r)` | چکِ تهی / جایگزینی | ◑ `nz` هست، `na()` ☐ |
| `int(x)`, `float(x)`, `bool(x)` | تبدیلِ نوع | ☐ |
| `array<type>`, `matrix<type>`, `map<k,v>` | ساختارهای داده | ☐ |
| تاپل `[a, b] = f()` | چند خروجی | ◑ |

---

## ۳) عملگرها

| دسته | Pine | نمااسکریپت |
|---|---|---|
| ریاضی | `+ - * / %` | ✅ (`add/sub/mul/div`) |
| مقایسه | `< > <= >= == !=` | ✅ (`lt/gt/le/ge`) |
| منطقی | `and or not` | ✅ (`and/or`) |
| سه‌گانه | `cond ? a : b` | ✅ (`iff`) |
| **history** | `close[1]`, `x[n]` | ☐ **(شکافِ کلیدی)** |
| واگذاری | `=` (اعلان), `:=` (بازتخصیص) | ◑ |

---

## ۴) namespace: `ta.*` (تحلیلِ تکنیکال) — مهم‌ترین

فهرستِ **کاملِ** توابعِ `ta` در Pine v6 و وضعیتِ نمااسکریپت:

### میانگین‌ها و روند
| Pine | نمااسکریپت |
|---|---|
| `ta.sma(src, len)` | ✅ `ta.sma` |
| `ta.ema(src, len)` | ✅ `ta.ema` |
| `ta.wma(src, len)` | ✅ `ta.wma` |
| `ta.hma(src, len)` | ✅ `ta.hma` |
| `ta.rma(src, len)` (Wilder) | ✅ `ta.rma` |
| `ta.vwma(src, len)` | ✅ `ta.vwma` |
| `ta.vwap` | ✅ `ta.vwap` |
| `ta.swma(src)` | ☐ |
| `ta.alma(src, len, offset, sigma)` | ☐ |
| `ta.linreg(src, len, offset)` | ☐ |

### اسیلاتورها
| Pine | نمااسکریپت |
|---|---|
| `ta.rsi(src, len)` | ✅ `ta.rsi` |
| `ta.stoch(src, high, low, len)` | ✅ `ta.stoch` |
| `ta.macd(src, fast, slow, signal)` → `[macd, signal, hist]` | ✅ `ta.macd` |
| `ta.cci(src, len)` | ✅ `ta.cci` |
| `ta.mom(src, len)` | ✅ `ta.mom` |
| `ta.roc(src, len)` | ✅ `ta.roc` |
| `ta.tsi(src, short, long)` | ☐ |
| `ta.cmo(src, len)` | ☐ |
| `ta.wpr(len)` (Williams %R) | ☐ (ولی اندیکاتورش هست) |
| `ta.mfi(src, len)` | ☐ |

### نوسان و باند
| Pine | نمااسکریپت |
|---|---|
| `ta.atr(len)` | ✅ `ta.atr` |
| `ta.tr` / `ta.tr(handle_na)` | ✅ `ta.tr` |
| `ta.stdev(src, len)` | ✅ `ta.stdev`/`ta.dev` |
| `ta.variance(src, len)` | ☐ |
| `ta.bb(src, len, mult)` → `[mid, up, low]` | ✅ `ta.bb` |
| `ta.bbw(src, len, mult)` | ☐ |
| `ta.kc(src, len, mult)` (Keltner) | ☐ |
| `ta.kcw(...)` | ☐ |
| `ta.dmi(len, smooth)` → `[+di, -di, adx]` | ☐ |
| `ta.sar(start, inc, max)` | ☐ |
| `ta.supertrend(factor, atrLen)` → `[st, dir]` | ✅ `ta.supertrend` |

### کراس و وضعیت
| Pine | نمااسکریپت |
|---|---|
| `ta.crossover(a, b)` | ✅ |
| `ta.crossunder(a, b)` | ✅ |
| `ta.cross(a, b)` | ✅ |
| `ta.change(src, len)` | ✅ `ta.change` |
| `ta.rising(src, len)` | ✅ `ta.rising` |
| `ta.falling(src, len)` | ✅ `ta.falling` |
| `ta.highest(src, len)` / `ta.lowest(...)` | ✅ |
| `ta.highestbars` / `ta.lowestbars` | ☐ |
| `ta.barssince(cond)` | ✅ |
| `ta.valuewhen(cond, src, occ)` | ✅ |
| `ta.cum(src)` | ☐ |
| `ta.pivothigh(src, left, right)` / `ta.pivotlow(...)` | ☐ |
| `ta.median/percentile_*/mode/range` | ☐ |
| `ta.correlation(a, b, len)` | ☐ |

> **نمااسکریپت ~۳۰ تابعِ `ta` دارد؛ Pine ~۵۰+.** غایب‌های پرکاربرد:
> `wpr, mfi, dmi/adx, sar, kc, linreg, pivothigh/low, cum, alma`.

---

## ۵) namespace: `math.*`

| Pine | نمااسکریپت |
|---|---|
| `math.abs/max/min/round/sqrt/pow` | ✅ |
| `math.avg` | ✅ |
| `math.floor/ceil/sign/exp/log/log10` | ☐ |
| `math.sin/cos/tan/...` | ☐ |
| `math.round_to_mintick(x)` | ☐ |
| `math.random(min, max, seed)` | ☐ |
| `math.todegrees/toradians` | ☐ |
| ثابت‌ها: `math.pi`, `math.e`, `math.phi` | ☐ |

---

## ۶) namespace: متغیرهای داخلیِ کندل (Built-in series)

| Pine | نمااسکریپت |
|---|---|
| `open, high, low, close, volume` | ✅ (O/H/L/C/V) |
| `hl2, hlc3, ohlc4, hlcc4` | ✅ `hl2/hlc3` (+ نیاز به `ohlc4`) |
| `time, time_close` | ◑ (`T`) |
| `bar_index, last_bar_index` | ☐ |
| `barstate.isfirst/islast/isnew/isconfirmed/isrealtime/ishistory` | ☐ |

---

## ۷) namespace: `input.*` (ورودی‌های کاربر)

| Pine | نمااسکریپت |
|---|---|
| `input(defval, title)` | ✅ |
| `input.int(defval, title, minval, maxval, step)` | ◑ (بدونِ min/max/step) |
| `input.float(...)` | ◑ |
| `input.bool(...)` | ✅ |
| `input.string(..., options=[...])` | ☐ |
| `input.color(...)` | ☐ |
| `input.source(close, ...)` | ☐ (انتخابِ منبع) |
| `input.symbol/timeframe/session/time/price` | ☐ |

> نمااسکریپت UI خودکارِ ورودی‌ها را دارد (تب «ورودی‌ها»)، ولی فقط int/float/bool.

---

## ۸) خروجی‌های گرافیکی (Plotting)

| Pine | نمااسکریپت |
|---|---|
| `plot(series, title, color, linewidth, style)` | ✅ |
| `plotshape(cond, title, style, location, color, text)` | ✅ `plotshape` |
| `plotchar(cond, ..., char)` | ◑ (`plotchar`→circle) |
| `plotcandle(o,h,l,c)` | ☐ |
| `plotbar(o,h,l,c)` | ☐ |
| `plotarrow(series)` | ☐ |
| `hline(price, title, color, linestyle)` | ✅ `hline` |
| `fill(plot1, plot2, color)` | ☐ (placeholder) |
| `bgcolor(color, ...)` | ◑ (جمع می‌شود، رندر ناقص) |
| `barcolor(color)` | ☐ (placeholder) |
| `riskreward(entry, sl, tp1, tp2, tp3)` ← **افزوده‌ی ما (در Pine نیست)** | ✅ |

---

## ۹) آبجکت‌های رسمی (Drawing objects)

| Pine | نمااسکریپت |
|---|---|
| `label.new(x, y, text, ...)` + `label.set_*/delete` | ◑ فقط `label.new` |
| `line.new(x1,y1,x2,y2, ...)` + `line.set_*` | ☐ |
| `box.new(left, top, right, bottom, ...)` | ☐ |
| `polyline.new(...)` | ☐ |
| `table.new(position, cols, rows)` + `table.cell(...)` | ☐ |
| `linefill.new(...)` | ☐ |

---

## ۱۰) namespace: `strategy.*` (استراتژی و بک‌تست)

| Pine | نمااسکریپت |
|---|---|
| `strategy.entry(id, direction, qty, limit, stop)` | ◑ `strategy.entry(dir, cond)` ساده |
| `strategy.exit(id, from, profit, loss, stop, limit, trail_*)` | ◑ `strategy.exit(dir, cond)` |
| `strategy.close(id, when)` | ◑ `strategy.close(cond)` |
| `strategy.order(...)` / `strategy.cancel(...)` | ☐ |
| `strategy.long`, `strategy.short` (ثابت‌های جهت) | ◑ ('long'/'short') |
| `strategy.position_size/position_avg_price` | ☐ |
| `strategy.equity/netprofit/grossprofit/...` | ☐ (محاسبهٔ بیرونی در UI) |
| `strategy.opentrades/closedtrades` + `.profit()/.entry_price()` | ☐ |
| پارامترهای کارمزد/اسلیپیج/سرمایه در `strategy(...)` | ☐ |
| `strategy.risk.*` (مدیریتِ ریسک) | ☐ |

> نمااسکریپت بک‌تستِ ساده دارد (Net/PF/Win٪/MaxDD از سیگنال‌ها). برای Strategy Tester کامل
> نیاز به مدلِ پوزیشن/کارمزد/اسلیپیج + گزارشِ Overview/Performance/Trades-List است.

---

## ۱۱) namespaceهای دیگرِ Pine (همه ☐ در نمااسکریپت)

| namespace | کاربرد | اهمیت برای ما |
|---|---|---|
| `request.security(sym, tf, expr)` | دادهٔ مولتی‌تایم‌فریم/مولتی‌نماد | **بالا** (مولتی‌TF) |
| `request.financial/dividends/earnings/splits` | دادهٔ بنیادی | پایین |
| `array.*` (new/push/get/sum/avg/sort/…) | آرایه‌های پویا | متوسط |
| `matrix.*` / `map.*` | ساختارهای پیشرفته | پایین |
| `str.*` (format/tostring/tonumber/split/…) | رشته | ◑ متوسط |
| `color.*` (new/rgb/from_gradient) | رنگ | ◑ (پایه هست) |
| `time(...)`, `timestamp(...)`, `timeframe.*` | زمان | متوسط |
| `ticker.new(...)`, `syminfo.*` | اطلاعاتِ نماد | پایین |
| `chart.*`, `dayofweek`, `session.*` | چارت/سشن | متوسط |
| `alert(message, freq)` (علاوه بر `alertcondition`) | آلارمِ پویا | **بالا** |
| `log.info/warning/error` | دیباگ | پایین |

---

## ۱۲) رنگ‌ها و ثابت‌ها

| Pine | نمااسکریپت |
|---|---|
| `color.red/green/blue/orange/purple/...` | ✅ (blue/red/green/orange/purple/gray/white/yellow/aqua/teal) |
| `color.new(col, transp)` | ◑ (بدونِ شفافیت) |
| `color.rgb(r,g,b,t)` | ☐ |
| `color.from_gradient(...)` | ☐ |
| `shape.*` (triangleup/labeldown/…) | ◑ (up/down/circle) |
| `location.*` (abovebar/belowbar/top/bottom) | ◑ |
| `plot.style_*` / `line.style_*` | ◑ |

---

## ۱۳) نقشهٔ راهِ ارتقای نمااسکریپت (اولویت‌دار)

1. **`close[1]` (history) + `var`** — هستهٔ سازگاریِ Pine. بدونِ این، خیلی اسکریپت‌های واقعی کار نمی‌کنند.
2. **`ta` غایب‌ها**: `wpr, mfi, dmi/adx, sar, kc, linreg, pivothigh/low, cum, alma`.
3. **`request.security`** (مولتی‌تایم‌فریم) — با fetch سمتِ‌سرور از همان `candles`.
4. **`strategy.*` کامل** + Strategy Tester (پوزیشن/کارمزد/گزارش).
5. **`line.new/box.new/table.new`** برای رسمِ برنامه‌نویسی‌شده.
6. **`input.source/string(options)/color`** + min/max/step.
7. **`fill/bgcolor/barcolor`** رندرِ واقعی.
8. **`alert()` پویا** + اتصالِ آلارم به سمتِ‌سرور.
9. **ویرایشگرِ Monaco** با autocomplete/داک/خطای خط‌به‌خط.

---

## ۱۴) نمونهٔ سازگاری (همین حالا کار می‌کند در نمااسکریپت)

```js
// نمااسکریپت — کراسِ HMA با ناحیهٔ ریسک/ریوارد
study("HMA Cross", overlay=true)
fast = ta.hma(close, 9)
slow = ta.hma(close, 21)
plot(fast, "HMA سریع", color.blue)
plot(slow, "HMA کند", color.orange)
buy  = crossover(fast, slow)
sell = crossunder(fast, slow)
plotshape(buy,  "خرید", shape.up,   color.green)
plotshape(sell, "فروش", shape.down, color.red)
alertcondition(buy,  "سیگنالِ خرید")
alertcondition(sell, "سیگنالِ فروش")
```

> سینتکسِ نمااسکریپت عمداً نزدیک به Pine است تا کاربرانِ TradingView راحت مهاجرت کنند،
> ولی موتورِ اجرا متفاوت (vectorized) و امن (Web Worker) است.

---

## منابع

- Pine Script v6 Reference Manual: https://www.tradingview.com/pine-script-reference/v6/
- Pine Script v6 Built-ins: https://www.tradingview.com/pine-script-docs/language/built-ins/
- Pine Script v6 User Manual: https://www.tradingview.com/pine-script-docs/
- پیاده‌سازیِ فعلیِ ما: `frontend/academy/src/bazaarnama/namascript.js`
