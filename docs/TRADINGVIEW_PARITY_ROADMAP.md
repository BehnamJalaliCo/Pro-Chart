# BazaarNama → TradingView Parity & Polish Roadmap

هدف: «کپی برابرِ اصلِ» TradingView. این سند جمع‌بندیِ تحقیقِ عمیق (کاتالوگِ کاملِ قابلیت‌ها +
زبانِ طراحیِ لاکچری + قابلیت‌های پرتقاضایی که کلون‌ها جا می‌اندازند) به‌علاوهٔ تطبیق با وضعیتِ
فعلیِ بازارنماست. مرجع: TradingView Charting Library / Help docs / Lightweight Charts docs.

---

## وضعیتِ فعلیِ بازارنما (موجود — از inventory کد)
- انواعِ چارت: candle/line/area/bar/baseline/histogram + غیراستاندارد (`charttypes_ext`: Kagi, P&F, Renko, Line-Break, volume-candles, columns).
- ابزارِ ترسیم: ~۹۱ مدخل (`drawtools_ext` + `ToolRail`).
- اندیکاتورها: `indicators` + `indicators_ext_a/b` (REGISTRY).
- NamaScript: ~۱۵۱ تابعِ داخلی + `CodeEditor` + `scriptlib` (نمونه/مرجع) + StrategyTester.
- Bar Replay (`ReplayController`)، crosshair modes، price-scale modes، sessions، timezones (`scales_crosshair`).
- Hotkeys (`hotkeys` + SHORTCUT_GROUPS)، موبایل (`mobile`)، چیدمانِ چندچارتی (`layoutPresets`).
- RightPanel (واچ‌لیست، سیگنالِ AI، اسکنر، آلارم، ترید)، BottomDock (Notes، StrategyTester).
- پنل‌ها: Calendar، Details، News، Screener. AlertsPanel. trade-from-chart (پل به مَستر).

> ارزیابی: زیرساخت غنی است ولی **عمق + پولیش + قابلیت‌های چسبندهٔ پرو** ناقص‌اند. تمرکزِ نقشه‌راه روی همین‌هاست.

---

## فاز ۰ — پولیشِ «لاکچری» (رفعِ حسِ «خشک») — بیشترین اثر، کم‌ریسک
رنگ‌های پایه از قبل با TV می‌خوانند؛ فاصله تا «لاکچری» این‌هاست:
1. **اعدادِ tabular در همه‌جا** (`font-variant-numeric: tabular-nums lining-nums`) — قیمت/درصد/محور هرگز نلرزد؛ اعداد در RTL با `dir="ltr"`.
2. **دیسیپلینِ شعاع/تراکم**: دکمه‌ها/اینپوت radius=4px، popup=6px، dialog=8px؛ گریدِ 4px؛ ارتفاعِ ردیفِ منو 28px، واچ‌لیست 36px، تولبار 38–40px. بدون pill/`rounded-full` روی کنترل‌ها.
3. **میکرو‌اینتراکشن‌ها**: ترانزیشنِ یکدست `120–200ms ease-out`؛ بدون scale در hover؛ `:focus-visible` rings فقط برای کیبورد؛ اسلایدِ پنل‌ها/منوها.
4. **متنِ off-white** `#d1d4dc` (نه سفیدِ خالص)، «مشکی» = `#131722`.
5. **elevation با fill-step + یک سایه** (نه روشن‌ترکردن)؛ منو/دیالوگ = border + shadow.
6. **واترمارکِ شبح** (انجام‌شده: لوگوی شفاف) + گریدِ بسیار کم‌رنگ.
7. **دو سبزِ/قرمزِ متمایز**: کندل teal `#26a69a`/`#ef5350` ، UI emerald `#089981`/`#f23645`؛ activeِ tinted `rgba(41,98,255,.14)`.
8. **flashِ سبز/قرمزِ سلول روی تیکِ قیمت** + skeleton/شمرِ بارگذاری + نوارِ پیشرفتِ نازکِ آبی به‌جای spinner.

توکن‌های آمادهٔ CSS در پیوستِ پایین.

---

## فاز ۱ — «حسِ پرو در ۶۰ ثانیهٔ اول» (Low/Med، بیشترین نسبتِ اثر/تلاش)
| # | قابلیت | وضعیت | پیچیدگی |
|---|--------|------|--------|
| 1 | **Magnet mode** (weak/strong) + snap به OHLC/اندیکاتور | بررسی/تکمیل | Med |
| 2 | **Data Window** (مقدارِ O/H/L/C + هر اندیکاتور زیرِ crosshair) | جدید | Low |
| 3 | **جستجوی نمادِ کیبورد-محور fuzzy** | بررسی/تکمیل | Low |
| 4 | **Countdown to bar close** | موجود (`secondsToClose`) → تأیید | Low |
| 5 | **Measure tool** (drag → %/قیمت/بار/زمان) | بررسی/تکمیل | Low |
| 6 | **Right-click context menu** همه‌جا (چارت/محور/درای/اندیکاتور) | جدید | Med |
| 7 | **Hotkeyهای کامل** (Alt+T/F/H/V، undo/redo، magnet، replay، `?` cheatsheet) | تکمیل | Low |
| 8 | **Favorites bar** (ابزار/اندیکاتور/تایم‌فریمِ منتخب پین‌شده) | جدید | Low |
| 9 | **crosshair با تگِ محورِ قیمت+زمان** | تأیید/تکمیل | Low |
| 10 | **log/percent/auto/regular scale** + invert + fit | بررسی (`PRICE_SCALE_MODES`) | Med |

---

## فاز ۲ — قابلیت‌های چسبندهٔ نگه‌دارندهٔ کاربر (Med/High)
| # | قابلیت | پیچیدگی |
|---|--------|--------|
| 11 | **Object Tree** (همهٔ درای/اندیکاتورها: گروه/ترتیبِ Z/نمایش/قفل/حذفِ گروهی) | Med |
| 12 | **Drawing templates** + پیش‌فرضِ هر ابزار | Med |
| 13 | **Indicator templates** (یک‌کلیک اعمالِ مجموعه) | Med |
| 14 | **Apply to all charts / sync درای‌ها per-symbol** | Med |
| 15 | **Multi-chart layouts (2/3/4/6/8) با sync نماد/تایم/crosshair/زمان** | High |
| 16 | **Bar Replay** (تأیید عمق: step/auto، نقطهٔ کلیک‌شده، intrabar) | High |
| 17 | **آلارم روی اندیکاتور/درای** (آلارم با خطِ متحرک جابه‌جا شود) | Med |
| 18 | **آلارمِ چندشرطی** (RSI<30 AND price>trendline، چندتایم‌فریم) | High |
| 19 | **چند واچ‌لیست + ستون‌های سفارشی (RSI/MACD/%) + پرچمِ رنگی** | Med |
| 20 | **Watchlist alerts** (یک آلارم روی کلِ لیست) | Med |
| 21 | **ذخیرهٔ ابری layout + ماندگاریِ کاملِ تنظیمات** (درای/اندیکاتور/اسکیل پس از reload) | Med |

---

## فاز ۳ — عمقِ دادهٔ تریدرِ جدی (High)
| # | قابلیت | پیچیدگی |
|---|--------|--------|
| 24 | **Anchored VWAP** (ابزارِ ترسیم: انتخابِ بار) | Med |
| 25 | **Volume Profile (visible range)** + POC/VAH/VAL | High |
| 26 | **Fixed Range Volume Profile** (drag بازه) | High |
| 27 | **Session VWAP + باندهای ±σ** | Med |
| 28 | **Heikin-Ashi** (تأیید) | Low |
| 29 | تأیید/تعمیقِ **Renko/Range/Line-Break/P&F** (موتورِ غیرِزمانی) | High |
| 30 | **Spread/expression symbols** (`AAPL/MSFT`, نسبت‌ها) | High |
| 31 | **Extended hours + session breaks** | Med |
| 33 | **MTF indicator** (سریِ تایم‌فریمِ بالاتر داخلِ اندیکاتور) | High |

---

## فاز ۴ — پولیشِ تکمیلی (اکثراً Low)
Undo/redo همهٔ اکشن‌ها · copy/paste/clone/lock/Z-order درای · keyboard navigation (pan/zoom/Esc/Del) · حافظهٔ per-symbol · تنظیماتِ ظاهرِ ماندگار · snapshot/export + لینکِ اشتراک · «افزودنِ آلارم/ترید» از راست‌کلیکِ سطحِ قیمت · indicator-on-indicator.

---

## کاتالوگِ مرجعِ کاملِ TradingView (برای پوششِ ۱۰۰٪)
- **انواعِ چارت**: Line, Line-with-markers, Step, Area, HLC-Area, Baseline, Bars(OHLC), High-Low, Candles, Hollow, Volume-candles, Heikin-Ashi, Renko, Line-Break, Kagi, P&F, Range, Footprint, SVP, TPO/Market-Profile, Column.
- **تایم‌فریم**: ثانیه/دقیقه/ساعت/روز/هفته/ماه/فصل/سال + tick + range + **custom interval** + favorites.
- **ابزارِ ترسیم (تاکسونومیِ کامل)**: Trend/Ray/Extended/Info/Arrow/Horizontal/Vertical/Cross · Parallel/Regression/Disjoint Channel · Pitchfork (Andrews/Schiff/Modified/Inside)/Pitchfan/Anchored-VWAP · Fib (Retracement/Extension/Channel/TimeZone/Circles/Spiral/Speed-Fan/Arcs/Wedge) · Gann (Box/Square/Square-Fixed/Fan) · Patterns (XABCD/Cypher/ABCD/Triangle/3-Drives/H&S) · Elliott (Impulse/Triangle/Triple/Correction/Double) · Cyclic/TimeCycles/Sine · Shapes (Brush/Highlighter/Rect/RotatedRect/Circle/Ellipse/Arc/Triangle/Polyline/Path/Curve) · Annotations (Text/Anchored/Note/Callout/Comment/Signpost/PriceLabel) · Markers/Flags · Long/Short-Position · Forecast/Projection/BarsPattern/Ghost · Price/Date/Date-Price-Range · **Measure** · Fixed-Range-VP · Icons/Stickers/Emoji.
- **سیستمِ درای**: Magnet (weak/strong) · Templates · Favorites · **Object Tree** · Lock/Hide/Clone/Z-order · stay-in-drawing · sync (all/same-symbol/none) · Eraser · Drawing alerts.
- **اندیکاتورها**: ۱۰۰+ داخلی (Trend/Momentum/Volume/Volatility) + templates + multiple-instances + source-selection + indicator-on-indicator + per-TF visibility + pin-to-scale + TF override. (لیستِ کاملِ ~۱۰۰ اندیکاتور در تحقیق موجود.)
- **Multi-chart**: گریدها + sync (Symbol/Interval/Crosshair/Time/Drawings) + grouping + saved layouts + templates + tabs/windows.
- **Watchlist**: چندتایی + ستون‌های Price/Financial/Risk/Technical + پرچم + sections + import/export + sort + hotlists.
- **Symbol**: جستجو با فیلترِ نوع/صرافی + پنلِ جزئیات + دیالوگِ مشخصاتِ قرارداد + compare/overlay.
- **Alerts**: انواع (Price/Indicator/Drawing/Strategy/Watchlist/Bar-pattern) + شرط‌ها (Crossing/Up/Down/>/</Enter/Exit-Channel/Moving%) + چندشرطی + frequency/expiration + کانال‌ها (push/popup/email/sms/sound/**webhook**) + پیام با placeholder + alert-log.
- **ابزارها**: Bar-Replay · Screeners (Stock/Crypto/Forex/ETF/Bond) · Heatmaps · Calendars (Economic/Earnings/Revenue/Dividend/IPO) · News.
- **اسکریپت/بک‌تست**: ادیتورِ Pine + indicator/strategy/library + Strategy-Tester (Overview/Performance/Trades/Properties) + broker-emulator + deep-backtest + bar-magnifier + publishing + library import + alerts-from-script.
- **ترید**: پنلِ (Positions/Orders/Account/History) + اتصالِ بروکر + paper-trading + انواعِ سفارش (Market/Limit/Stop/Stop-Limit/Bracket-OCO/Trailing/partial) + trade-from-chart (درگِ TP/SL) + **DOM/Level-2**.
- **اجتماعی**: Ideas · Minds · Following · Profiles · Public-scripts · Chats/streams · reputation.
- **UX/پلتفرم**: 150+ hotkey · magnet · تم Light/Dark + سفارشی‌سازیِ هر المان · ماندگاریِ تنظیمات (sync) · log/linear/percent/indexed scale + countdown + extended-hours · چندزبانه + **RTL** · موبایل · دسکتاپ · snapshot/share · **embeddable widgets**.

---

## پیوست — توکن‌های طراحیِ TradingView (آمادهٔ اعمال)
```css
:root.theme-dark{
  --pc-bg:#131722; --pc-surface:#1e222d; --pc-hover:#2a2e39; --pc-pressed:#363a45;
  --pc-border:#2a2e39; --pc-border-strong:#363a45;
  --pc-text:#d1d4dc; --pc-text-2:#b2b5be; --pc-text-muted:#787b86;
  --pc-accent:#2962ff; --pc-accent-hover:#1e53e5; --pc-accent-tint:rgba(41,98,255,.14);
  --pc-up:#26a69a; --pc-up-ui:#089981; --pc-down:#ef5350; --pc-down-ui:#f23645;
  --pc-grid:rgba(255,255,255,.06); --pc-crosshair:#9598a1;
  --pc-shadow:0 2px 4px rgba(0,0,0,.2),0 2px 12px rgba(0,0,0,.4);
}
:root:not(.theme-dark){
  --pc-bg:#fff; --pc-surface:#f8f9fd; --pc-hover:#f0f3fa; --pc-pressed:#e0e3eb;
  --pc-border:#e0e3eb; --pc-border-strong:#d1d4dc;
  --pc-text:#131722; --pc-text-2:#5d606b; --pc-text-muted:#787b86;
  --pc-accent:#2962ff; --pc-accent-hover:#1e53e5; --pc-accent-tint:rgba(41,98,255,.08);
  --pc-up:#26a69a; --pc-up-ui:#089981; --pc-down:#ef5350; --pc-down-ui:#f23645;
  --pc-grid:rgba(0,0,0,.06); --pc-crosshair:#9598a1;
  --pc-shadow:0 2px 4px rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.1);
}
.tnum{font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum"1,"lnum"1;}
/* transitions: 120ms micro · 150ms menu · 180ms dialog · 200–250ms panel; ease-out; focus-visible only */
```
رادیوس: کنترل 4px · popup 6px · dialog 8px. وزنِ bold = 600 (نه 700). محورِ چارت 11px. تراکم: تولبار 38–40px، ردیفِ منو 28px، واچ‌لیست 36px.

اندازه‌گیریِ قبلی تأیید می‌کند رنگ‌های پایهٔ chrome از قبل با TV می‌خوانند؛ فاصلهٔ «لاکچری» = tabular typography + دیسیپلینِ radius/density + میکرو‌اینتراکشن + پولیشِ §۷.
