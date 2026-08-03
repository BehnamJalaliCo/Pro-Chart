# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance-baseline.spec.mjs >> PERF-BASELINE: desktop-chart
- Location: tests/performance-baseline.spec.mjs:652:3

# Error details

```
Error: numeric performance gates

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 22

- Array []
+ Array [
+   Object {
+     "actual": 4308,
+     "evidence": "lab regression",
+     "metric": "labLcpMs",
+     "operator": "<=",
+     "pass": false,
+     "result": "FAIL",
+     "threshold": 2500,
+     "unit": "ms",
+   },
+   Object {
+     "actual": 28,
+     "evidence": "active-chart rAF interval proxy",
+     "metric": "activeChartFrameP95Ms",
+     "operator": "<",
+     "pass": false,
+     "result": "FAIL",
+     "threshold": 20,
+     "unit": "ms",
+   },
+ ]
```

# Page snapshot

```yaml
- main [ref=e4]:
  - heading "Pro-Chart — چارت حرفه‌ای بازارهای مالی" [level=1] [ref=e5]
  - generic [ref=e6]:
    - generic [ref=e7]:
      - button "EURUSD" [ref=e8] [cursor=pointer]:
        - generic [ref=e9]:
          - img [ref=e12]
          - img [ref=e25]
        - generic [ref=e29]: EURUSD
        - img [ref=e30]
      - generic [ref=e33]:
        - button "مقایسهٔ نماد" [ref=e34] [cursor=pointer]:
          - img [ref=e35]
        - generic: مقایسه/افزودنِ نماد به‌صورتِ خطِ overlay
      - generic [ref=e38]: "1.14212"
      - generic [ref=e40]:
        - button "5m" [ref=e41] [cursor=pointer]
        - button "15m" [ref=e42] [cursor=pointer]
        - button "1H" [ref=e43] [cursor=pointer]
        - button "4H" [ref=e44] [cursor=pointer]
        - button "1D" [ref=e45] [cursor=pointer]
        - button "1W" [ref=e46] [cursor=pointer]
        - button "همهٔ اینتروال‌ها" [ref=e47] [cursor=pointer]:
          - img [ref=e48]
      - 'button "نوعِ چارت: کندل" [ref=e51] [cursor=pointer]':
        - img [ref=e52]
        - img [ref=e56]
      - button "اندیکاتورها، سنجه‌ها و استراتژی‌ها" [ref=e59] [cursor=pointer]:
        - img [ref=e60]
      - button "ویژهٔ پرمیوم" [ref=e63] [cursor=pointer]:
        - img [ref=e64]
        - img [ref=e68]
      - button "افزودنِ هشدارِ قیمت" [ref=e71] [cursor=pointer]:
        - img [ref=e72]
      - button "بازپخشِ تاریخی" [ref=e75] [cursor=pointer]:
        - img [ref=e76]
      - button "سیگنالِ AI — ستاپِ کاملِ AI در همین نماد/تایم‌فریم (10/10)" [ref=e78] [cursor=pointer]:
        - img [ref=e79]
      - button "واگرد (Ctrl+Z)" [disabled] [ref=e82]:
        - img [ref=e83]
      - button "ازنو (Ctrl+Y)" [disabled] [ref=e86]:
        - img [ref=e87]
      - button "درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)" [ref=e90] [cursor=pointer]:
        - img [ref=e91]
      - button "1×" [ref=e94] [cursor=pointer]:
        - img [ref=e95]
        - text: 1×
        - img [ref=e100]
      - button "R" [ref=e103] [cursor=pointer]:
        - generic [ref=e104]: R
        - img [ref=e105]
      - button "قفلِ مقیاس (خاموش‌کردنِ خودکار)" [ref=e107] [cursor=pointer]:
        - img [ref=e108]
      - generic [ref=e111]:
        - button "وارونه‌کردنِ محورِ قیمت" [ref=e112] [cursor=pointer]:
          - img [ref=e113]
        - generic: وارونه‌کردنِ محورِ قیمت — بالا و پایینِ نمودار جابه‌جا می‌شود (مناسبِ تحلیلِ معکوس)
      - generic [ref=e116]:
        - button "بازنشانیِ مقیاس" [ref=e117] [cursor=pointer]:
          - img [ref=e118]
        - generic: بازنشانیِ زوم و مقیاسِ نمودار به حالتِ اولیه (اتوفیت)
      - button "حالتِ کراس‌هیر" [ref=e124] [cursor=pointer]:
        - img [ref=e125]
        - img [ref=e127]
      - generic [ref=e130]:
        - button "سشن‌ها — نمایش/پنهان‌کردنِ باندهای سشنِ فارکس" [ref=e131] [cursor=pointer]:
          - img [ref=e132]
        - button "انتخابِ سشن‌ها و منطقهٔ زمانی" [ref=e135] [cursor=pointer]:
          - img [ref=e136]
      - button "تمام‌صفحه" [ref=e138] [cursor=pointer]:
        - img [ref=e139]
      - button "عکسِ چارت" [ref=e145] [cursor=pointer]:
        - img [ref=e146]
        - img [ref=e149]
      - button "راهنمای میان‌بُرهای صفحه‌کلید" [ref=e151] [cursor=pointer]: ⌨
      - button "تنظیماتِ چارت" [ref=e153] [cursor=pointer]:
        - img [ref=e154]
      - button "چیدمان‌ها (ذخیره/بارگذاری نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" [ref=e158] [cursor=pointer]:
        - img [ref=e159]
        - img [ref=e161]
      - button "حساب / ورود / ثبت‌نام" [ref=e163] [cursor=pointer]:
        - img [ref=e164]
    - generic [ref=e165]:
      - generic [ref=e166]:
        - generic [ref=e168]:
          - button "نشانگرها" [pressed] [ref=e170] [cursor=pointer]:
            - img [ref=e171]
          - button "خطوط" [ref=e174] [cursor=pointer]:
            - img [ref=e175]
          - button "کانال‌ها" [ref=e180] [cursor=pointer]:
            - img [ref=e181]
          - button "فیبوناچی" [ref=e186] [cursor=pointer]:
            - img [ref=e187]
          - button "گان" [ref=e190] [cursor=pointer]:
            - img [ref=e191]
          - button "الگوها" [ref=e196] [cursor=pointer]:
            - img [ref=e197]
          - button "پروجکشن و اندازه‌گیری" [ref=e205] [cursor=pointer]:
            - img [ref=e206]
          - button "اشکال" [ref=e210] [cursor=pointer]:
            - img [ref=e211]
          - button "یادداشت‌ها" [ref=e214] [cursor=pointer]:
            - img [ref=e215]
          - button "آهنربا (Magnet) — چسبیدن به OHLC" [ref=e218] [cursor=pointer]:
            - img [ref=e219]
            - button "شدتِ آهنربا" [ref=e223]
          - button "ماندن در حالتِ ترسیم" [ref=e224] [cursor=pointer]:
            - img [ref=e225]
          - button "قفلِ همهٔ ترسیم‌ها" [ref=e228] [cursor=pointer]:
            - img [ref=e229]
          - button "نمایش/مخفیِ همهٔ ترسیم‌ها" [ref=e232] [cursor=pointer]:
            - img [ref=e233]
          - button "حذفِ همهٔ ترسیم‌ها" [ref=e237] [cursor=pointer]:
            - img [ref=e238]
            - button "گزینه‌های حذف" [ref=e241]
        - generic [ref=e243]:
          - textbox "رنگِ ترسیم" [ref=e244] [cursor=pointer]: "#3b82f6"
          - generic: رنگِ ترسیم
      - generic [ref=e245]:
        - generic [ref=e246]:
          - generic [ref=e247]:
            - img [ref=e250]
            - img [ref=e263]
          - generic [ref=e267]: EURUSD
          - generic [ref=e268]: یورو / دلار آمریکا
          - generic [ref=e269]: 1H · فارکس
          - img [ref=e270]
          - generic [ref=e274]:
            - generic [ref=e275]:
              - generic [ref=e276]: O
              - generic [ref=e277]: "1.14201"
            - generic [ref=e278]:
              - generic [ref=e279]: H
              - generic [ref=e280]: "1.14243"
            - generic [ref=e281]:
              - generic [ref=e282]: L
              - generic [ref=e283]: "1.14169"
            - generic [ref=e284]:
              - generic [ref=e285]: C
              - generic [ref=e286]: "1.14212"
          - generic [ref=e287]: +0.00011 (+0.01%)
          - generic [ref=e288]:
            - generic [ref=e289]: Vol
            - generic [ref=e290]: 2.88K
          - button "تنظیماتِ چارت" [ref=e291] [cursor=pointer]:
            - img [ref=e292]
        - generic [ref=e295]:
          - table [ref=e298]:
            - row [ref=e299]:
              - cell
              - cell [ref=e300]
              - cell [ref=e304]
            - row [ref=e308]:
              - cell
              - cell [ref=e309]
              - cell [ref=e313]
          - generic:
            - generic [ref=e316]:
              - button "1.14210 SELL" [ref=e317] [cursor=pointer]:
                - generic [ref=e318]: "1.14210"
                - generic [ref=e319]: SELL
              - generic [ref=e320]:
                - generic [ref=e321]: "4"
                - generic [ref=e322]: اسپرد
              - button "1.14214 BUY" [ref=e323] [cursor=pointer]:
                - generic [ref=e324]: "1.14214"
                - generic [ref=e325]: BUY
            - generic [ref=e326]:
              - generic [ref=e327]: "+0.00011"
              - generic [ref=e328]: (+0.01%)
          - generic:
            - img
            - generic: 25:04
          - generic [ref=e329]:
            - button "مقیاسِ درصدی" [ref=e330] [cursor=pointer]: ٪
            - button "مقیاسِ لگاریتمی" [ref=e331] [cursor=pointer]: log
            - button "مقیاسِ خودکار (Fit)" [ref=e332] [cursor=pointer]: auto
          - generic:
            - img
            - generic: حجم · Vol
          - img "بازارنما"
        - generic [ref=e333]:
          - button "1D" [ref=e334] [cursor=pointer]
          - button "5D" [ref=e335] [cursor=pointer]
          - button "1M" [ref=e336] [cursor=pointer]
          - button "3M" [ref=e337] [cursor=pointer]
          - button "6M" [ref=e338] [cursor=pointer]
          - button "YTD" [ref=e339] [cursor=pointer]
          - button "1Y" [ref=e340] [cursor=pointer]
          - button "5Y" [ref=e341] [cursor=pointer]
          - button "All" [ref=e342] [cursor=pointer]
          - button "پرش به تاریخ" [ref=e344] [cursor=pointer]:
            - img [ref=e345]
          - button "16:04:56 (تهران)" [ref=e349] [cursor=pointer]:
            - img [ref=e350]
            - generic [ref=e353]: 16:04:56
            - generic [ref=e354]: (تهران)
      - generic [ref=e355]:
        - generic [ref=e356]:
          - button "واچ‌لیست" [ref=e357] [cursor=pointer]:
            - img [ref=e358]
            - generic [ref=e360]: واچ‌لیست
          - button "سیگنال AI" [ref=e362] [cursor=pointer]:
            - img [ref=e363]
            - generic [ref=e375]: سیگنال AI
          - button "اسکنر" [ref=e377] [cursor=pointer]:
            - img [ref=e378]
            - generic [ref=e383]: اسکنر
          - button "جزئیات" [ref=e385] [cursor=pointer]:
            - img [ref=e386]
            - generic [ref=e388]: جزئیات
          - button "اخبار" [ref=e390] [cursor=pointer]:
            - img [ref=e391]
            - generic [ref=e394]: اخبار
          - button "تقویم" [ref=e396] [cursor=pointer]:
            - img [ref=e397]
            - generic [ref=e399]: تقویم
          - button "ترید" [ref=e401] [cursor=pointer]:
            - img [ref=e402]
            - generic [ref=e405]: ترید
          - button "آلارم" [ref=e407] [cursor=pointer]:
            - img [ref=e408]
            - generic [ref=e413]: آلارم
        - generic [ref=e416]:
          - generic [ref=e417]:
            - button "پیش‌فرض" [ref=e418] [cursor=pointer]:
              - generic [ref=e419]: پیش‌فرض
              - img [ref=e420]
            - generic [ref=e422]:
              - generic [ref=e423]: "5"
              - button "افزودنِ نماد" [ref=e424] [cursor=pointer]:
                - img [ref=e425]
              - button "تنظیمِ ستون‌ها و شخصی‌سازی" [ref=e426] [cursor=pointer]:
                - img [ref=e427]
          - generic [ref=e431]:
            - button "فیلترِ رنگِ red" [ref=e432] [cursor=pointer]
            - button "فیلترِ رنگِ orange" [ref=e433] [cursor=pointer]
            - button "فیلترِ رنگِ yellow" [ref=e434] [cursor=pointer]
            - button "فیلترِ رنگِ green" [ref=e435] [cursor=pointer]
            - button "فیلترِ رنگِ blue" [ref=e436] [cursor=pointer]
            - button "فیلترِ رنگِ purple" [ref=e437] [cursor=pointer]
            - button "فیلترِ رنگِ gray" [ref=e438] [cursor=pointer]
          - generic [ref=e439]:
            - button "نماد" [ref=e440] [cursor=pointer]
            - button "آخرین" [ref=e441] [cursor=pointer]
            - button "تغییر" [ref=e442] [cursor=pointer]
            - button "تغییر٪" [ref=e443] [cursor=pointer]
          - generic [ref=e444]:
            - generic [ref=e445]:
              - button "فارکس FOREX" [ref=e446] [cursor=pointer]:
                - img [ref=e447]
                - generic [ref=e449]: فارکس
                - generic [ref=e450]: FOREX
              - generic [ref=e452]: "4"
            - generic [ref=e453]:
              - button "انتخاب EUR/USD" [ref=e454] [cursor=pointer]:
                - generic [ref=e456]:
                  - img [ref=e459]
                  - img [ref=e472]
                - generic [ref=e477]:
                  - generic "بازار باز" [ref=e478]
                  - generic [ref=e479]: EUR/USD
                - generic [ref=e480]: "1.14212"
                - generic [ref=e481]: "+0.00001"
                - generic [ref=e482]: +0.00٪
              - generic [ref=e483]:
                - button "پرچمِ تفکیک" [ref=e484] [cursor=pointer]:
                  - img [ref=e485]
                - button "حذف از واچ‌لیست" [ref=e487] [cursor=pointer]:
                  - img [ref=e488]
            - generic [ref=e491]:
              - button "انتخاب GBP/USD" [ref=e492] [cursor=pointer]:
                - generic [ref=e494]:
                  - img [ref=e497]
                  - img [ref=e510]
                - generic [ref=e518]:
                  - generic "بازار باز" [ref=e519]
                  - generic [ref=e520]: GBP/USD
                - generic [ref=e521]: "1.33923"
                - generic [ref=e522]: "+0.00001"
                - generic [ref=e523]: +0.00٪
              - generic [ref=e524]:
                - button "پرچمِ تفکیک" [ref=e525] [cursor=pointer]:
                  - img [ref=e526]
                - button "حذف از واچ‌لیست" [ref=e528] [cursor=pointer]:
                  - img [ref=e529]
            - generic [ref=e532]:
              - button "انتخاب USD/JPY" [ref=e533] [cursor=pointer]:
                - generic [ref=e535]:
                  - img [ref=e538]
                  - img [ref=e544]
                - generic [ref=e556]:
                  - generic "بازار باز" [ref=e557]
                  - generic [ref=e558]: USD/JPY
                - generic [ref=e559]: "162.214"
                - generic [ref=e560]: "+0.001"
                - generic [ref=e561]: +0.00٪
              - generic [ref=e562]:
                - button "پرچمِ تفکیک" [ref=e563] [cursor=pointer]:
                  - img [ref=e564]
                - button "حذف از واچ‌لیست" [ref=e566] [cursor=pointer]:
                  - img [ref=e567]
            - generic [ref=e570]:
              - button "انتخاب USD/CHF" [ref=e571] [cursor=pointer]:
                - generic [ref=e573]:
                  - img [ref=e576]
                  - img [ref=e583]
                - generic [ref=e595]:
                  - generic "بازار باز" [ref=e596]
                  - generic [ref=e597]: USD/CHF
                - generic [ref=e598]: "0.80936"
                - generic [ref=e599]: "0.00000"
                - generic [ref=e600]: 0.00٪
              - generic [ref=e601]:
                - button "پرچمِ تفکیک" [ref=e602] [cursor=pointer]:
                  - img [ref=e603]
                - button "حذف از واچ‌لیست" [ref=e605] [cursor=pointer]:
                  - img [ref=e606]
          - generic [ref=e609]:
            - generic [ref=e610]:
              - button "فلزات METALS" [ref=e611] [cursor=pointer]:
                - img [ref=e612]
                - generic [ref=e614]: فلزات
                - generic [ref=e615]: METALS
              - generic [ref=e617]: "1"
            - generic [ref=e618]:
              - button "انتخاب XAU/USD" [ref=e619] [cursor=pointer]:
                - img [ref=e621]
                - generic [ref=e630]:
                  - generic "بازار باز" [ref=e631]
                  - generic [ref=e632]: XAU/USD
                - generic [ref=e633]: 4,048.14
                - generic [ref=e634]: "+0.07"
                - generic [ref=e635]: +0.00٪
              - generic [ref=e636]:
                - button "پرچمِ تفکیک" [ref=e637] [cursor=pointer]:
                  - img [ref=e638]
                - button "حذف از واچ‌لیست" [ref=e640] [cursor=pointer]:
                  - img [ref=e641]
          - generic [ref=e644]:
            - button "جزئیاتِ نماد DETAILS" [ref=e645] [cursor=pointer]:
              - generic [ref=e646]:
                - img [ref=e647]
                - text: جزئیاتِ نماد
                - generic [ref=e649]: DETAILS
              - img [ref=e650]
            - generic [ref=e653]:
              - generic [ref=e654]:
                - generic [ref=e655]:
                  - generic [ref=e656]:
                    - img [ref=e659]
                    - img [ref=e672]
                  - generic [ref=e676]:
                    - generic [ref=e677]:
                      - button "EURUSD" [ref=e678] [cursor=pointer]
                      - generic [ref=e679]: جفت‌ارز (فارکس)
                    - generic [ref=e680]:
                      - generic [ref=e681]: یورو / دلار آمریکا
                      - generic [ref=e682]: · FX
                  - generic [ref=e683]:
                    - button "مقایسه (تغییرِ نماد)" [ref=e684] [cursor=pointer]:
                      - img [ref=e685]
                    - button "ویرایشِ تنظیماتِ چارت" [ref=e687] [cursor=pointer]:
                      - img [ref=e688]
                    - button "کپیِ قیمت" [ref=e690] [cursor=pointer]:
                      - img [ref=e691]
                - generic [ref=e696]:
                  - generic [ref=e697]: "1.14212"
                  - generic [ref=e698]: USD
                  - generic [ref=e699]: +0.00001 +0.00%
                - generic [ref=e700]:
                  - generic [ref=e701]: بازار باز
                  - generic [ref=e703]: · آخرین به‌روزرسانی · 12:34 GMT
              - img [ref=e705]
              - generic [ref=e708]:
                - generic [ref=e709]:
                  - img [ref=e710]
                  - generic [ref=e712]: حقایقِ کلیدی
                  - generic [ref=e713]: Key facts
                - generic [ref=e714]: یورو / دلار آمریکا از پرمعامله‌ترین جفت‌ارزهای بازارِ فارکس است و به‌صورتِ ۲۴ساعته از سیدنی تا نیویورک دادوستد می‌شود.
                - generic [ref=e715]: بیشتر بخوانید ›
              - 'link "اخبار News 10 دقیقه پیش دادهٔ آزمایشی: بازار ارز در محدودهٔ ثابت QA FIXTURE" [ref=e716] [cursor=pointer]':
                - /url: https://example.invalid/qa/synthetic-news-eur-1
                - generic [ref=e717]:
                  - generic [ref=e718]: اخبار
                  - generic [ref=e719]: News
                  - generic [ref=e720]: 10 دقیقه پیش
                - generic [ref=e721]: "دادهٔ آزمایشی: بازار ارز در محدودهٔ ثابت"
                - generic [ref=e722]: QA FIXTURE
              - generic [ref=e723]:
                - generic [ref=e724]:
                  - generic [ref=e725]: امتیازِ تکنیکال
                  - generic [ref=e726]: Technical Rating
                - generic [ref=e727]:
                  - button "چارت" [ref=e728] [cursor=pointer]
                  - button "5m" [ref=e729] [cursor=pointer]
                  - button "15m" [ref=e730] [cursor=pointer]
                  - button "1H" [ref=e731] [cursor=pointer]
                  - button "4H" [ref=e732] [cursor=pointer]
                  - button "1D" [ref=e733] [cursor=pointer]
                - img [ref=e734]
                - generic [ref=e738]:
                  - generic [ref=e739]: فروش
                  - generic [ref=e740]: خنثی
                  - generic [ref=e741]: خرید
                - generic [ref=e742]: خرید
                - generic [ref=e743]:
                  - generic [ref=e744]:
                    - generic [ref=e745]: "6"
                    - generic [ref=e746]: فروش
                  - generic [ref=e747]:
                    - generic [ref=e748]: "7"
                    - generic [ref=e749]: خنثی
                  - generic [ref=e750]:
                    - generic [ref=e751]: "13"
                    - generic [ref=e752]: خرید
                - generic [ref=e753]:
                  - generic [ref=e754]:
                    - generic [ref=e755]: خریدِ قوی
                    - generic [ref=e756]: میانگین‌ها
                    - generic "فروش · خنثی · خرید" [ref=e757]:
                      - generic [ref=e758]: "3"
                      - generic [ref=e759]: ·
                      - generic [ref=e760]: "0"
                      - generic [ref=e761]: ·
                      - generic [ref=e762]: "12"
                  - generic [ref=e763]:
                    - generic [ref=e764]: فروش
                    - generic [ref=e765]: نوسان‌گرها
                    - generic "فروش · خنثی · خرید" [ref=e766]:
                      - generic [ref=e767]: "3"
                      - generic [ref=e768]: ·
                      - generic [ref=e769]: "7"
                      - generic [ref=e770]: ·
                      - generic [ref=e771]: "1"
              - generic [ref=e772]:
                - generic [ref=e773]: بازهٔ روز
                - generic [ref=e774]:
                  - generic [ref=e775]: "1.14191"
                  - generic [ref=e778]: "1.14231"
              - generic [ref=e779]:
                - generic [ref=e780]: بازهٔ ۵۲ هفته
                - generic [ref=e781]:
                  - generic [ref=e782]: "1.14127"
                  - generic [ref=e785]: "1.14269"
              - generic [ref=e786]:
                - generic [ref=e787]: عملکرد
                - generic [ref=e788]: Performance
              - generic [ref=e789]:
                - generic [ref=e790]:
                  - generic [ref=e791]: +0.00%
                  - generic [ref=e792]: 1D
                - generic [ref=e793]:
                  - generic [ref=e794]: +0.01%
                  - generic [ref=e795]: 1W
                - generic [ref=e796]:
                  - generic [ref=e797]: +0.02%
                  - generic [ref=e798]: 1M
                - generic [ref=e799]:
                  - generic [ref=e800]: "-0.01%"
                  - generic [ref=e801]: 3M
                - generic [ref=e802]:
                  - generic [ref=e803]: +0.02%
                  - generic [ref=e804]: 6M
                - generic [ref=e805]:
                  - generic [ref=e806]: +0.03%
                  - generic [ref=e807]: YTD
                - generic [ref=e808]:
                  - generic [ref=e809]: +0.00%
                  - generic [ref=e810]: 1Y
              - generic [ref=e811]:
                - generic [ref=e812]: آمارِ کلیدی
                - generic [ref=e813]: Key stats
              - generic [ref=e814]:
                - generic [ref=e815]:
                  - generic [ref=e816]: بستهٔ روزِ قبل
                  - generic [ref=e817]: "1.14211"
                - generic [ref=e818]:
                  - generic [ref=e819]: بازشدنِ روز
                  - generic [ref=e820]: "1.14211"
                - generic [ref=e821]:
                  - generic [ref=e822]: حجمِ روز
                  - generic [ref=e823]: 2.01K
                - generic [ref=e824]:
                  - generic [ref=e825]: میانگینِ حجم
                  - generic [ref=e826]: 2.45K
              - generic [ref=e827]:
                - generic [ref=e828]: مشخصاتِ معاملاتی
                - generic [ref=e829]: Quote
              - generic [ref=e830]:
                - generic [ref=e831]:
                  - generic [ref=e832]: بید (Bid)
                  - generic [ref=e833]: "1.14207"
                - generic [ref=e834]:
                  - generic [ref=e835]: اَسک (Ask)
                  - generic [ref=e836]: "1.14217"
                - generic [ref=e837]:
                  - generic [ref=e838]: اسپرد
                  - generic [ref=e839]: "0.00010"
              - generic [ref=e840]:
                - generic [ref=e841]: دربارهٔ نماد
                - generic [ref=e842]: About
              - generic [ref=e843]:
                - generic [ref=e844]:
                  - generic [ref=e845]: نماد
                  - generic [ref=e846]: EURUSD
                - generic [ref=e847]:
                  - generic [ref=e848]: نوعِ ابزار
                  - generic [ref=e849]: جفت‌ارز (فارکس)
                - generic [ref=e850]:
                  - generic [ref=e851]: ارزِ مظنه
                  - generic [ref=e852]: USD
                - generic [ref=e853]:
                  - generic [ref=e854]: اندازهٔ قرارداد
                  - generic [ref=e855]: ۱۰۰٬۰۰۰
                - generic [ref=e856]:
                  - generic [ref=e857]: حداقلِ حرکتِ قیمت
                  - generic [ref=e858]: "0.00001"
                - generic [ref=e859]:
                  - generic [ref=e860]: جلسهٔ معاملاتی
                  - generic [ref=e861]: سیدنی→نیویورک
      - tablist [ref=e862]:
        - tab "واچ‌لیست" [selected] [ref=e863] [cursor=pointer]:
          - img [ref=e864]
        - tab "آلارم‌ها" [ref=e866] [cursor=pointer]:
          - img [ref=e867]
        - tab "اسکنر" [ref=e872] [cursor=pointer]:
          - img [ref=e873]
        - tab "تقویمِ اقتصادی" [ref=e878] [cursor=pointer]:
          - img [ref=e879]
        - tab "اخبار" [ref=e881] [cursor=pointer]:
          - img [ref=e882]
        - tab "ایده‌ها و سیگنال" [ref=e885] [cursor=pointer]:
          - img [ref=e886]
```

# Test source

```ts
  641 |     browserEnvironment,
  642 |     profile: {
  643 |       networkThrottling: 'none; local loopback preview with synthetic API fulfillments',
  644 |       cpuThrottling: 'none',
  645 |       cacheState: 'new Playwright browser context per sample',
  646 |       referenceDeviceAdr: 'missing in repository performance budget',
  647 |     },
  648 |   };
  649 | }
  650 | 
  651 | for (const scenario of scenarios) {
  652 |   test(`PERF-BASELINE: ${scenario.id}`, async ({ page, browser }, testInfo) => {
  653 |     test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);
  654 | 
  655 |     const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
  656 |     const outDir = path.join(repoRoot, 'artifacts', 'qa', 'performance', baseline, runId, scenario.id, sampleId);
  657 |     const state = {
  658 |       apiRequests: [],
  659 |       mocked: [],
  660 |       mockedWebSockets: [],
  661 |       seen: new Set(),
  662 |       unexpectedExternal: [],
  663 |       unstubbed: [],
  664 |       pageErrors: [],
  665 |       requestFailures: [],
  666 |       badResponses: [],
  667 |       requests: [],
  668 |       completedRequests: [],
  669 |       sizeErrors: [],
  670 |       pendingSizeReads: [],
  671 |     };
  672 |     const readiness = {};
  673 |     let metrics = null;
  674 |     let environment = null;
  675 |     let gates = [];
  676 |     let result = 'FAIL';
  677 |     let failure = null;
  678 | 
  679 |     wireNetworkEvidence(page, state);
  680 | 
  681 |     try {
  682 |       expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required so the runner image is attributable').toBeTruthy();
  683 |       await installPerformanceObservers(page);
  684 |       await installFixture(page, testInfo, state);
  685 | 
  686 |       const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  687 |       readiness.domContentLoadedObservedMs = await page.evaluate(() => performance.now());
  688 | 
  689 |       await expect(page.locator('.pc-approot')).toBeVisible();
  690 |       readiness.shellReadyMs = await page.evaluate(() => performance.now());
  691 | 
  692 |       await expect(page.locator('canvas').first()).toBeVisible();
  693 |       await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  694 |       await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
  695 |       readiness.chartReadyMs = await page.evaluate(() => performance.now());
  696 |       readiness.layoutRestoreAfterShellMs = round(readiness.chartReadyMs - readiness.shellReadyMs);
  697 | 
  698 |       await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
  699 |       await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  700 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
  701 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  702 | 
  703 |       await expect(page.locator('.pc-launch')).toHaveCount(0);
  704 |       readiness.applicationReadyLaunchRemovedMs = await page.evaluate(() => performance.now());
  705 |       await page.waitForLoadState('load');
  706 |       await page.evaluate(() => document.fonts.ready);
  707 |       readiness.fontsReadyObservedMs = await page.evaluate(() => performance.now());
  708 | 
  709 |       const frames = await sampleActiveChartFrames(page, FRAME_SAMPLE_COUNT);
  710 |       await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  711 |       metrics = await collectBrowserMetrics(page);
  712 |       metrics.readiness = readiness;
  713 |       metrics.activeChartFrames = frames;
  714 | 
  715 |       await settleRequestSizes(state);
  716 |       const documentRequest = state.completedRequests.find((request) => request.resourceType === 'document');
  717 |       const documentTraceTtfb = Number(documentRequest?.timing?.responseStart);
  718 |       metrics.documentRequestTrace = {
  719 |         timing: documentRequest?.timing || null,
  720 |         ttfbMs: Number.isFinite(documentTraceTtfb) && documentTraceTtfb >= 0 ? round(documentTraceTtfb) : null,
  721 |         semantics: 'Playwright Request.timing responseStart for the main document, measured from request start.',
  722 |       };
  723 |       environment = await collectEnvironment(page, browser, testInfo);
  724 | 
  725 |       gates = [
  726 |         evaluateGate('labLcpMs', metrics.webVitalLabObservations.lcpMs),
  727 |         evaluateGate('labCls', metrics.webVitalLabObservations.cls),
  728 |         evaluateGate('labTtfbMs', metrics.navigation?.ttfbFromRequestStartMs ?? metrics.documentRequestTrace.ttfbMs),
  729 |         evaluateGate('activeChartFrameP95Ms', metrics.activeChartFrames.p95Ms),
  730 |         evaluateGate('layoutRestoreAfterShellMs', readiness.layoutRestoreAfterShellMs),
  731 |       ];
  732 | 
  733 |       expect(response?.status(), 'document HTTP status').toBe(200);
  734 |       expect(new URL(page.url()).origin, 'run must stay on the mapped preview origin').toBe(new URL(testInfo.project.use.baseURL).origin);
  735 |       expect(state.unstubbed, 'all API calls need an explicit synthetic response').toEqual([]);
  736 |       expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  737 |       expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  738 |       expect(state.requestFailures, 'failed requests').toEqual([]);
  739 |       expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
  740 |       expect(state.sizeErrors, 'request byte accounting errors').toEqual([]);
> 741 |       expect(gates.filter((gate) => !gate.pass), 'numeric performance gates').toEqual([]);
      |                                                                               ^ Error: numeric performance gates
  742 |       result = 'PASS';
  743 |     } catch (error) {
  744 |       failure = safeError(error);
  745 |       throw error;
  746 |     } finally {
  747 |       await settleRequestSizes(state);
  748 |       await fs.mkdir(outDir, { recursive: true });
  749 |       const requestInventory = state.completedRequests.map((request) => ({
  750 |         ...request,
  751 |         sizes: request.sizes ? Object.fromEntries(Object.entries(request.sizes).map(([key, value]) => [key, Number(value)])) : null,
  752 |       }));
  753 |       const networkSummary = summarizeRequestSizes(requestInventory, state.requests.length);
  754 |       const evidence = {
  755 |         schemaVersion: 1,
  756 |         requirementIds: ['PC-138', 'PC-140', 'PC-141'],
  757 |         scenario: scenario.id,
  758 |         sampleId,
  759 |         project: testInfo.project.name,
  760 |         baseline,
  761 |         commit,
  762 |         sourceFingerprint,
  763 |         runId,
  764 |         result,
  765 |         failure,
  766 |         fixture: {
  767 |           id: fixture.fixtureId,
  768 |           sha256: fixtureSha256,
  769 |           fixedAt: fixture.fixedAt,
  770 |           provenance: fixture.provenance,
  771 |         },
  772 |         methodology: {
  773 |           classification: 'deterministic Chromium lab regression',
  774 |           fieldCoreWebVitalsEquivalent: false,
  775 |           fieldEquivalenceWarning: 'These synthetic, unthrottled, local Chromium observations are not RUM and are not a field p75 Core Web Vitals result.',
  776 |           sampleFrameCount: FRAME_SAMPLE_COUNT,
  777 |           observerWindowEndsAfterFrameSampling: true,
  778 |         },
  779 |         metrics,
  780 |         gates: {
  781 |           source: 'docs/performance/PERFORMANCE_BUDGET.md',
  782 |           checks: gates,
  783 |           result: gates.length > 0 && gates.every((gate) => gate.pass) ? 'PASS' : 'FAIL',
  784 |         },
  785 |         recordedWithoutNumericGate: {
  786 |           paints: ['first-paint', 'first-contentful-paint'],
  787 |           applicationAndChartReadiness: true,
  788 |           requestCountAndBytes: true,
  789 |           longTasksOver50Ms: true,
  790 |         },
  791 |         deliberatelyNotMeasured: {
  792 |           inp: 'No representative interaction is performed; the repository requires RUM and a separately defined lab interaction proxy.',
  793 |           inputFeedback: 'No interaction trace in this navigation-focused baseline.',
  794 |           crosshairResponse: 'Requires a dedicated interaction benchmark.',
  795 |           quoteToPaintOverhead: 'Requires a timestamped streaming fixture and paint trace.',
  796 |           indicator10k: 'Requires a worker benchmark, not a navigation run.',
  797 |           memoryLeak: 'The budget states that its observation window and tolerance still require an ADR.',
  798 |           jsBundleBudget: 'The budget states that a numeric JS bundle limit still requires an ADR.',
  799 |         },
  800 |         environment,
  801 |         network: {
  802 |           summary: networkSummary,
  803 |           apiRequests: state.apiRequests,
  804 |           mocked: state.mocked,
  805 |           mockedWebSockets: state.mockedWebSockets,
  806 |           unstubbed: state.unstubbed,
  807 |           unexpectedExternal: state.unexpectedExternal,
  808 |           requestFailures: state.requestFailures,
  809 |           badResponses: state.badResponses,
  810 |           sizeErrors: state.sizeErrors,
  811 |         },
  812 |         pageErrors: state.pageErrors,
  813 |       };
  814 |       await fs.writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  815 |       await fs.writeFile(path.join(outDir, 'request-inventory.json'), `${JSON.stringify(requestInventory, null, 2)}\n`, 'utf8');
  816 |     }
  817 |   });
  818 | }
  819 | 
```