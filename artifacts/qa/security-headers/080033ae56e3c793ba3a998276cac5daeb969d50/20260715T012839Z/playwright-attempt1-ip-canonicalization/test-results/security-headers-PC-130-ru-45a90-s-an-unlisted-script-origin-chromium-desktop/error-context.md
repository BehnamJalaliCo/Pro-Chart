# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security-headers.spec.mjs >> PC-130 runtime CSP behavior >> the production policy permits required workers and blocks an unlisted script origin
- Location: tests/security-headers.spec.mjs:4:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ObjectContaining {"blockedURI": "https://example.invalid/prochart-pc130-probe.js", "directive": "script-src-elem"}
Received: null
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - button "EURUSD" [ref=e7] [cursor=pointer]:
      - generic [ref=e8]:
        - img [ref=e11]
        - img [ref=e24]
      - generic [ref=e28]: EURUSD
      - img [ref=e29]
    - generic [ref=e32]:
      - button "مقایسهٔ نماد" [ref=e33] [cursor=pointer]:
        - img [ref=e34]
      - generic: مقایسه/افزودنِ نماد به‌صورتِ خطِ overlay
    - generic [ref=e37]: "1.14362"
    - generic [ref=e39]:
      - button "5m" [ref=e40] [cursor=pointer]
      - button "15m" [ref=e41] [cursor=pointer]
      - button "1H" [ref=e42] [cursor=pointer]
      - button "4H" [ref=e43] [cursor=pointer]
      - button "1D" [ref=e44] [cursor=pointer]
      - button "1W" [ref=e45] [cursor=pointer]
      - button "همهٔ اینتروال‌ها" [ref=e46] [cursor=pointer]:
        - img [ref=e47]
    - 'button "نوعِ چارت: کندل" [ref=e50] [cursor=pointer]':
      - img [ref=e51]
      - img [ref=e55]
    - button "اندیکاتورها، سنجه‌ها و استراتژی‌ها" [ref=e58] [cursor=pointer]:
      - img [ref=e59]
    - button "ویژهٔ پرمیوم" [ref=e62] [cursor=pointer]:
      - img [ref=e63]
      - img [ref=e67]
    - button "افزودنِ هشدارِ قیمت" [ref=e70] [cursor=pointer]:
      - img [ref=e71]
    - button "بازپخشِ تاریخی" [ref=e74] [cursor=pointer]:
      - img [ref=e75]
    - button "سیگنالِ AI — ستاپِ کاملِ AI در همین نماد/تایم‌فریم (0/0)" [ref=e77] [cursor=pointer]:
      - img [ref=e78]
    - button "واگرد (Ctrl+Z)" [disabled] [ref=e81]:
      - img [ref=e82]
    - button "ازنو (Ctrl+Y)" [disabled] [ref=e85]:
      - img [ref=e86]
    - button "درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)" [ref=e89] [cursor=pointer]:
      - img [ref=e90]
    - button "1×" [ref=e93] [cursor=pointer]:
      - img [ref=e94]
      - text: 1×
      - img [ref=e99]
    - button "R" [ref=e102] [cursor=pointer]:
      - generic [ref=e103]: R
      - img [ref=e104]
    - button "قفلِ مقیاس (خاموش‌کردنِ خودکار)" [ref=e106] [cursor=pointer]:
      - img [ref=e107]
    - generic [ref=e110]:
      - button "وارونه‌کردنِ محورِ قیمت" [ref=e111] [cursor=pointer]:
        - img [ref=e112]
      - generic: وارونه‌کردنِ محورِ قیمت — بالا و پایینِ نمودار جابه‌جا می‌شود (مناسبِ تحلیلِ معکوس)
    - generic [ref=e115]:
      - button "بازنشانیِ مقیاس" [ref=e116] [cursor=pointer]:
        - img [ref=e117]
      - generic: بازنشانیِ زوم و مقیاسِ نمودار به حالتِ اولیه (اتوفیت)
    - button "حالتِ کراس‌هیر" [ref=e123] [cursor=pointer]:
      - img [ref=e124]
      - img [ref=e126]
    - generic [ref=e129]:
      - button "سشن‌ها — نمایش/پنهان‌کردنِ باندهای سشنِ فارکس" [ref=e130] [cursor=pointer]:
        - img [ref=e131]
      - button "انتخابِ سشن‌ها و منطقهٔ زمانی" [ref=e134] [cursor=pointer]:
        - img [ref=e135]
    - button "تمام‌صفحه" [ref=e137] [cursor=pointer]:
      - img [ref=e138]
    - button "عکسِ چارت" [ref=e144] [cursor=pointer]:
      - img [ref=e145]
      - img [ref=e148]
    - button "راهنمای میان‌بُرهای صفحه‌کلید" [ref=e150] [cursor=pointer]: ⌨
    - button "تنظیماتِ چارت" [ref=e152] [cursor=pointer]:
      - img [ref=e153]
    - button "چیدمان‌ها (ذخیره/بارگذاری نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" [ref=e157] [cursor=pointer]:
      - img [ref=e158]
      - img [ref=e160]
    - button "حساب / ورود / ثبت‌نام" [ref=e162] [cursor=pointer]:
      - img [ref=e163]
  - generic [ref=e164]:
    - generic [ref=e165]:
      - generic [ref=e167]:
        - button "نشانگرها" [pressed] [ref=e169] [cursor=pointer]:
          - img [ref=e170]
        - button "خطوط" [ref=e173] [cursor=pointer]:
          - img [ref=e174]
        - button "کانال‌ها" [ref=e179] [cursor=pointer]:
          - img [ref=e180]
        - button "فیبوناچی" [ref=e185] [cursor=pointer]:
          - img [ref=e186]
        - button "گان" [ref=e189] [cursor=pointer]:
          - img [ref=e190]
        - button "الگوها" [ref=e195] [cursor=pointer]:
          - img [ref=e196]
        - button "پروجکشن و اندازه‌گیری" [ref=e204] [cursor=pointer]:
          - img [ref=e205]
        - button "اشکال" [ref=e209] [cursor=pointer]:
          - img [ref=e210]
        - button "یادداشت‌ها" [ref=e213] [cursor=pointer]:
          - img [ref=e214]
        - button "آهنربا (Magnet) — چسبیدن به OHLC" [ref=e217] [cursor=pointer]:
          - img [ref=e218]
          - button "شدتِ آهنربا" [ref=e222]
        - button "ماندن در حالتِ ترسیم" [ref=e223] [cursor=pointer]:
          - img [ref=e224]
        - button "قفلِ همهٔ ترسیم‌ها" [ref=e227] [cursor=pointer]:
          - img [ref=e228]
        - button "نمایش/مخفیِ همهٔ ترسیم‌ها" [ref=e231] [cursor=pointer]:
          - img [ref=e232]
        - button "حذفِ همهٔ ترسیم‌ها" [ref=e236] [cursor=pointer]:
          - img [ref=e237]
          - button "گزینه‌های حذف" [ref=e240]
      - generic [ref=e242]:
        - textbox [ref=e243] [cursor=pointer]: "#3b82f6"
        - generic: رنگِ ترسیم
    - generic [ref=e244]:
      - generic [ref=e245]:
        - generic [ref=e246]:
          - img [ref=e249]
          - img [ref=e262]
        - generic [ref=e266]: EURUSD
        - generic [ref=e267]: یورو / دلار آمریکا
        - generic [ref=e268]: 1H · فارکس
        - img [ref=e269]
        - generic [ref=e273]:
          - generic [ref=e274]:
            - generic [ref=e275]: O
            - generic [ref=e276]: "1.14377"
          - generic [ref=e277]:
            - generic [ref=e278]: H
            - generic [ref=e279]: "1.14377"
          - generic [ref=e280]:
            - generic [ref=e281]: L
            - generic [ref=e282]: "1.14359"
          - generic [ref=e283]:
            - generic [ref=e284]: C
            - generic [ref=e285]: "1.14362"
        - generic [ref=e286]: −0.00015 (−0.01%)
        - generic [ref=e287]:
          - generic [ref=e288]: Vol
          - generic [ref=e289]: "0"
        - button "تنظیماتِ چارت" [ref=e290] [cursor=pointer]:
          - img [ref=e291]
      - generic [ref=e294]:
        - table [ref=e297]:
          - row [ref=e298]:
            - cell
            - cell [ref=e299]
            - cell [ref=e303]
          - row [ref=e307]:
            - cell
            - cell [ref=e308]
            - cell [ref=e312]
        - generic:
          - generic [ref=e315]:
            - button "1.14362 SELL" [ref=e316] [cursor=pointer]:
              - generic [ref=e317]: "1.14362"
              - generic [ref=e318]: SELL
            - generic [ref=e319]:
              - generic [ref=e320]: "0"
              - generic [ref=e321]: اسپرد
            - button "1.14362 BUY" [ref=e322] [cursor=pointer]:
              - generic [ref=e323]: "1.14362"
              - generic [ref=e324]: BUY
          - generic [ref=e325]:
            - generic [ref=e326]: "-0.00015"
            - generic [ref=e327]: (-0.01%)
        - generic:
          - img
          - generic: 29:04
        - generic [ref=e328]:
          - button "مقیاسِ درصدی" [ref=e329] [cursor=pointer]: ٪
          - button "مقیاسِ لگاریتمی" [ref=e330] [cursor=pointer]: log
          - button "مقیاسِ خودکار (Fit)" [ref=e331] [cursor=pointer]: auto
        - generic:
          - img
          - generic: حجم · Vol
        - img "بازارنما"
      - generic [ref=e332]:
        - button "1D" [ref=e333] [cursor=pointer]
        - button "5D" [ref=e334] [cursor=pointer]
        - button "1M" [ref=e335] [cursor=pointer]
        - button "3M" [ref=e336] [cursor=pointer]
        - button "6M" [ref=e337] [cursor=pointer]
        - button "YTD" [ref=e338] [cursor=pointer]
        - button "1Y" [ref=e339] [cursor=pointer]
        - button "5Y" [ref=e340] [cursor=pointer]
        - button "All" [ref=e341] [cursor=pointer]
        - button "پرش به تاریخ" [ref=e343] [cursor=pointer]:
          - img [ref=e344]
        - button "05:00:56 (تهران)" [ref=e348] [cursor=pointer]:
          - img [ref=e349]
          - generic [ref=e352]: 05:00:56
          - generic [ref=e353]: (تهران)
    - generic [ref=e354]:
      - generic [ref=e355]:
        - button "واچ‌لیست" [ref=e356] [cursor=pointer]:
          - img [ref=e357]
          - generic [ref=e359]: واچ‌لیست
        - button "سیگنال AI" [ref=e361] [cursor=pointer]:
          - img [ref=e362]
          - generic [ref=e374]: سیگنال AI
        - button "اسکنر" [ref=e376] [cursor=pointer]:
          - img [ref=e377]
          - generic [ref=e382]: اسکنر
        - button "جزئیات" [ref=e384] [cursor=pointer]:
          - img [ref=e385]
          - generic [ref=e387]: جزئیات
        - button "اخبار" [ref=e389] [cursor=pointer]:
          - img [ref=e390]
          - generic [ref=e393]: اخبار
        - button "تقویم" [ref=e395] [cursor=pointer]:
          - img [ref=e396]
          - generic [ref=e398]: تقویم
        - button "ترید" [ref=e400] [cursor=pointer]:
          - img [ref=e401]
          - generic [ref=e404]: ترید
        - button "آلارم" [ref=e406] [cursor=pointer]:
          - img [ref=e407]
          - generic [ref=e412]: آلارم
      - generic [ref=e415]:
        - generic [ref=e416]:
          - button "پیش‌فرض" [ref=e417] [cursor=pointer]:
            - generic [ref=e418]: پیش‌فرض
            - img [ref=e419]
          - generic [ref=e421]:
            - generic [ref=e422]: "5"
            - button "افزودنِ نماد" [ref=e423] [cursor=pointer]:
              - img [ref=e424]
            - button "تنظیمِ ستون‌ها و شخصی‌سازی" [ref=e425] [cursor=pointer]:
              - img [ref=e426]
        - generic [ref=e430]:
          - button "فیلترِ رنگِ red" [ref=e431] [cursor=pointer]
          - button "فیلترِ رنگِ orange" [ref=e432] [cursor=pointer]
          - button "فیلترِ رنگِ yellow" [ref=e433] [cursor=pointer]
          - button "فیلترِ رنگِ green" [ref=e434] [cursor=pointer]
          - button "فیلترِ رنگِ blue" [ref=e435] [cursor=pointer]
          - button "فیلترِ رنگِ purple" [ref=e436] [cursor=pointer]
          - button "فیلترِ رنگِ gray" [ref=e437] [cursor=pointer]
        - generic [ref=e438]:
          - button "نماد" [ref=e439] [cursor=pointer]
          - button "آخرین" [ref=e440] [cursor=pointer]
          - button "تغییر" [ref=e441] [cursor=pointer]
          - button "تغییر٪" [ref=e442] [cursor=pointer]
        - generic [ref=e443]:
          - generic [ref=e444]:
            - button "فارکس FOREX" [ref=e445] [cursor=pointer]:
              - img [ref=e446]
              - generic [ref=e448]: فارکس
              - generic [ref=e449]: FOREX
            - generic [ref=e451]: "4"
          - button "بازار باز EUR/USD 1.14362 +0.00317 +0.28٪" [ref=e452] [cursor=pointer]:
            - generic [ref=e454]:
              - img [ref=e457]
              - img [ref=e470]
            - generic [ref=e475]:
              - generic "بازار باز" [ref=e476]
              - generic [ref=e477]: EUR/USD
            - generic [ref=e478]: "1.14362"
            - generic [ref=e479]: "+0.00317"
            - generic [ref=e480]: +0.28٪
            - generic [ref=e481]:
              - button "پرچمِ تفکیک" [ref=e482]:
                - img [ref=e483]
              - button "حذف از واچ‌لیست" [ref=e485]:
                - img [ref=e486]
          - button "بازار باز GBP/USD 1.34024 +0.00156 +0.12٪" [ref=e489] [cursor=pointer]:
            - generic [ref=e491]:
              - img [ref=e494]
              - img [ref=e507]
            - generic [ref=e515]:
              - generic "بازار باز" [ref=e516]
              - generic [ref=e517]: GBP/USD
            - generic [ref=e518]: "1.34024"
            - generic [ref=e519]: "+0.00156"
            - generic [ref=e520]: +0.12٪
            - generic [ref=e521]:
              - button "پرچمِ تفکیک" [ref=e522]:
                - img [ref=e523]
              - button "حذف از واچ‌لیست" [ref=e525]:
                - img [ref=e526]
          - button "بازار باز USD/JPY 162.065 +0.187 +0.12٪" [ref=e529] [cursor=pointer]:
            - generic [ref=e531]:
              - img [ref=e534]
              - img [ref=e540]
            - generic [ref=e552]:
              - generic "بازار باز" [ref=e553]
              - generic [ref=e554]: USD/JPY
            - generic [ref=e555]: "162.065"
            - generic [ref=e556]: "+0.187"
            - generic [ref=e557]: +0.12٪
            - generic [ref=e558]:
              - button "پرچمِ تفکیک" [ref=e559]:
                - img [ref=e560]
              - button "حذف از واچ‌لیست" [ref=e562]:
                - img [ref=e563]
          - button "بازار باز USD/CHF 0.80834 -0.00103 -0.13٪" [ref=e566] [cursor=pointer]:
            - generic [ref=e568]:
              - img [ref=e571]
              - img [ref=e578]
            - generic [ref=e590]:
              - generic "بازار باز" [ref=e591]
              - generic [ref=e592]: USD/CHF
            - generic [ref=e593]: "0.80834"
            - generic [ref=e594]: "-0.00103"
            - generic [ref=e595]: "-0.13٪"
            - generic [ref=e596]:
              - button "پرچمِ تفکیک" [ref=e597]:
                - img [ref=e598]
              - button "حذف از واچ‌لیست" [ref=e600]:
                - img [ref=e601]
        - generic [ref=e604]:
          - generic [ref=e605]:
            - button "فلزات METALS" [ref=e606] [cursor=pointer]:
              - img [ref=e607]
              - generic [ref=e609]: فلزات
              - generic [ref=e610]: METALS
            - generic [ref=e612]: "1"
          - button "بازار باز XAU/USD 4,052.54 +55.54 +1.39٪" [ref=e613] [cursor=pointer]:
            - img [ref=e615]
            - generic [ref=e624]:
              - generic "بازار باز" [ref=e625]
              - generic [ref=e626]: XAU/USD
            - generic [ref=e627]: 4,052.54
            - generic [ref=e628]: "+55.54"
            - generic [ref=e629]: +1.39٪
            - generic [ref=e630]:
              - button "پرچمِ تفکیک" [ref=e631]:
                - img [ref=e632]
              - button "حذف از واچ‌لیست" [ref=e634]:
                - img [ref=e635]
        - generic [ref=e638]:
          - button "جزئیاتِ نماد DETAILS" [ref=e639] [cursor=pointer]:
            - generic [ref=e640]:
              - img [ref=e641]
              - text: جزئیاتِ نماد
              - generic [ref=e643]: DETAILS
            - img [ref=e644]
          - generic [ref=e647]:
            - generic [ref=e648]:
              - generic [ref=e649]:
                - generic [ref=e650]:
                  - img [ref=e653]
                  - img [ref=e666]
                - generic [ref=e670]:
                  - generic [ref=e671]:
                    - button "EURUSD" [ref=e672] [cursor=pointer]
                    - generic [ref=e673]: جفت‌ارز (فارکس)
                  - generic [ref=e674]:
                    - generic [ref=e675]: یورو / دلار آمریکا
                    - generic [ref=e676]: · FX
                - generic [ref=e677]:
                  - button "مقایسه (تغییرِ نماد)" [ref=e678] [cursor=pointer]:
                    - img [ref=e679]
                  - button "ویرایشِ تنظیماتِ چارت" [ref=e681] [cursor=pointer]:
                    - img [ref=e682]
                  - button "کپیِ قیمت" [ref=e684] [cursor=pointer]:
                    - img [ref=e685]
              - generic [ref=e690]:
                - generic [ref=e691]: "1.14362"
                - generic [ref=e692]: USD
                - generic [ref=e693]: +0.00317 +0.28%
              - generic [ref=e694]:
                - generic [ref=e695]: بازار باز
                - generic [ref=e697]: · آخرین به‌روزرسانی · 01:30 GMT
            - img [ref=e699]
            - generic [ref=e702]:
              - generic [ref=e703]:
                - img [ref=e704]
                - generic [ref=e706]: حقایقِ کلیدی
                - generic [ref=e707]: Key facts
              - generic [ref=e708]: یورو / دلار آمریکا از پرمعامله‌ترین جفت‌ارزهای بازارِ فارکس است و به‌صورتِ ۲۴ساعته از سیدنی تا نیویورک دادوستد می‌شود.
              - generic [ref=e709]: بیشتر بخوانید ›
            - 'link "اخبار News 8 دقیقه پیش خلاصه بازار آمریکا: نفت بالا، فیچ کانادا را تأیید کرد ForexLive" [ref=e710] [cursor=pointer]':
              - /url: https://investinglive.com/news/investinglive-americas-fx-news-wrap-14-jul-cpi-lower-warsh-remains-cautious/
              - generic [ref=e711]:
                - generic [ref=e712]: اخبار
                - generic [ref=e713]: News
                - generic [ref=e714]: 8 دقیقه پیش
              - generic [ref=e715]: "خلاصه بازار آمریکا: نفت بالا، فیچ کانادا را تأیید کرد"
              - generic [ref=e716]: ForexLive
            - generic [ref=e717]:
              - generic [ref=e718]:
                - generic [ref=e719]: امتیازِ تکنیکال
                - generic [ref=e720]: Technical Rating
              - generic [ref=e721]:
                - button "چارت" [ref=e722] [cursor=pointer]
                - button "5m" [ref=e723] [cursor=pointer]
                - button "15m" [ref=e724] [cursor=pointer]
                - button "1H" [ref=e725] [cursor=pointer]
                - button "4H" [ref=e726] [cursor=pointer]
                - button "1D" [ref=e727] [cursor=pointer]
              - img [ref=e728]
              - generic [ref=e732]:
                - generic [ref=e733]: فروش
                - generic [ref=e734]: خنثی
                - generic [ref=e735]: خرید
              - generic [ref=e736]: خریدِ قوی
              - generic [ref=e737]:
                - generic [ref=e738]:
                  - generic [ref=e739]: "0"
                  - generic [ref=e740]: فروش
                - generic [ref=e741]:
                  - generic [ref=e742]: "8"
                  - generic [ref=e743]: خنثی
                - generic [ref=e744]:
                  - generic [ref=e745]: "18"
                  - generic [ref=e746]: خرید
              - generic [ref=e747]:
                - generic [ref=e748]:
                  - generic [ref=e749]: خریدِ قوی
                  - generic [ref=e750]: میانگین‌ها
                  - generic "فروش · خنثی · خرید" [ref=e751]:
                    - generic [ref=e752]: "0"
                    - generic [ref=e753]: ·
                    - generic [ref=e754]: "0"
                    - generic [ref=e755]: ·
                    - generic [ref=e756]: "15"
                - generic [ref=e757]:
                  - generic [ref=e758]: خرید
                  - generic [ref=e759]: نوسان‌گرها
                  - generic "فروش · خنثی · خرید" [ref=e760]:
                    - generic [ref=e761]: "0"
                    - generic [ref=e762]: ·
                    - generic [ref=e763]: "8"
                    - generic [ref=e764]: ·
                    - generic [ref=e765]: "3"
            - generic [ref=e766]:
              - generic [ref=e767]: بازهٔ روز
              - generic [ref=e768]:
                - generic [ref=e769]: "1.13788"
                - generic [ref=e772]: "1.14613"
            - generic [ref=e773]:
              - generic [ref=e774]: بازهٔ ۵۲ هفته
              - generic [ref=e775]:
                - generic [ref=e776]: "1.03793"
                - generic [ref=e779]: "1.20236"
            - generic [ref=e780]:
              - generic [ref=e781]: عملکرد
              - generic [ref=e782]: Performance
            - generic [ref=e783]:
              - generic [ref=e784]:
                - generic [ref=e785]: +0.28%
                - generic [ref=e786]: 1D
              - generic [ref=e787]:
                - generic [ref=e788]: "-0.50%"
                - generic [ref=e789]: 1W
              - generic [ref=e790]:
                - generic [ref=e791]: "-1.89%"
                - generic [ref=e792]: 1M
              - generic [ref=e793]:
                - generic [ref=e794]: "-3.60%"
                - generic [ref=e795]: 3M
              - generic [ref=e796]:
                - generic [ref=e797]: "-2.07%"
                - generic [ref=e798]: 6M
              - generic [ref=e799]:
                - generic [ref=e800]: "-3.12%"
                - generic [ref=e801]: YTD
              - generic [ref=e802]:
                - generic [ref=e803]: "-3.02%"
                - generic [ref=e804]: 1Y
            - generic [ref=e805]:
              - generic [ref=e806]: آمارِ کلیدی
              - generic [ref=e807]: Key stats
            - generic [ref=e808]:
              - generic [ref=e809]:
                - generic [ref=e810]: بستهٔ روزِ قبل
                - generic [ref=e811]: "1.14045"
              - generic [ref=e812]:
                - generic [ref=e813]: بازشدنِ روز
                - generic [ref=e814]: "1.13837"
              - generic [ref=e815]:
                - generic [ref=e816]: حجمِ روز
                - generic [ref=e817]: —
              - generic [ref=e818]:
                - generic [ref=e819]: میانگینِ حجم
                - generic [ref=e820]: —
            - generic [ref=e821]:
              - generic [ref=e822]: مشخصاتِ معاملاتی
              - generic [ref=e823]: Quote
            - generic [ref=e824]:
              - generic [ref=e825]:
                - generic [ref=e826]: بید (Bid)
                - generic [ref=e827]: "1.14357"
              - generic [ref=e828]:
                - generic [ref=e829]: اَسک (Ask)
                - generic [ref=e830]: "1.14367"
              - generic [ref=e831]:
                - generic [ref=e832]: اسپرد
                - generic [ref=e833]: "0.00010"
            - generic [ref=e834]:
              - generic [ref=e835]: دربارهٔ نماد
              - generic [ref=e836]: About
            - generic [ref=e837]:
              - generic [ref=e838]:
                - generic [ref=e839]: نماد
                - generic [ref=e840]: EURUSD
              - generic [ref=e841]:
                - generic [ref=e842]: نوعِ ابزار
                - generic [ref=e843]: جفت‌ارز (فارکس)
              - generic [ref=e844]:
                - generic [ref=e845]: ارزِ مظنه
                - generic [ref=e846]: USD
              - generic [ref=e847]:
                - generic [ref=e848]: اندازهٔ قرارداد
                - generic [ref=e849]: ۱۰۰٬۰۰۰
              - generic [ref=e850]:
                - generic [ref=e851]: حداقلِ حرکتِ قیمت
                - generic [ref=e852]: "0.00001"
              - generic [ref=e853]:
                - generic [ref=e854]: جلسهٔ معاملاتی
                - generic [ref=e855]: سیدنی→نیویورک
    - tablist [ref=e856]:
      - tab "واچ‌لیست" [selected] [ref=e857] [cursor=pointer]:
        - img [ref=e858]
      - tab "آلارم‌ها" [ref=e860] [cursor=pointer]:
        - img [ref=e861]
      - tab "اسکنر" [ref=e866] [cursor=pointer]:
        - img [ref=e867]
      - tab "تقویمِ اقتصادی" [ref=e872] [cursor=pointer]:
        - img [ref=e873]
      - tab "اخبار" [ref=e875] [cursor=pointer]:
        - img [ref=e876]
      - tab "ایده‌ها و سیگنال" [ref=e879] [cursor=pointer]:
        - img [ref=e880]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('PC-130 runtime CSP behavior', () => {
  4  |   test('the production policy permits required workers and blocks an unlisted script origin', async ({ page }) => {
  5  |     const violations = [];
  6  |     await page.addInitScript(() => {
  7  |       window.__pc130Violations = [];
  8  |       document.addEventListener('securitypolicyviolation', (event) => {
  9  |         window.__pc130Violations.push({
  10 |           blockedURI: event.blockedURI,
  11 |           directive: event.effectiveDirective,
  12 |         });
  13 |       });
  14 |     });
  15 | 
  16 |     const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  17 |     expect(response?.status()).toBe(200);
  18 |     await expect(page.locator('#root')).not.toBeEmpty();
  19 | 
  20 |     const workerResult = await page.evaluate(async () => {
  21 |       const source = `postMessage(new Function('return 6 * 7')())`;
  22 |       const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
  23 |       try {
  24 |         return await new Promise((resolve, reject) => {
  25 |           const worker = new Worker(url);
  26 |           const timeout = setTimeout(() => reject(new Error('worker timeout')), 5000);
  27 |           worker.onmessage = (event) => {
  28 |             clearTimeout(timeout);
  29 |             worker.terminate();
  30 |             resolve(event.data);
  31 |           };
  32 |           worker.onerror = (event) => {
  33 |             clearTimeout(timeout);
  34 |             worker.terminate();
  35 |             reject(new Error(event.message));
  36 |           };
  37 |         });
  38 |       } finally {
  39 |         URL.revokeObjectURL(url);
  40 |       }
  41 |     });
  42 |     expect(workerResult).toBe(42);
  43 | 
  44 |     const blockedProbe = await page.evaluate(() => new Promise((resolve) => {
  45 |       const onViolation = (event) => {
  46 |         if (event.blockedURI.includes('example.invalid')) {
  47 |           resolve({ blockedURI: event.blockedURI, directive: event.effectiveDirective });
  48 |         }
  49 |       };
  50 |       document.addEventListener('securitypolicyviolation', onViolation, { once: true });
  51 |       const script = document.createElement('script');
  52 |       script.src = 'https://example.invalid/prochart-pc130-probe.js';
  53 |       document.head.appendChild(script);
  54 |       setTimeout(() => resolve(null), 3000);
  55 |     }));
  56 |     violations.push(...await page.evaluate(() => window.__pc130Violations));
  57 | 
> 58 |     expect(blockedProbe).toEqual(expect.objectContaining({
     |                          ^ Error: expect(received).toEqual(expected) // deep equality
  59 |       directive: 'script-src-elem',
  60 |       blockedURI: 'https://example.invalid/prochart-pc130-probe.js',
  61 |     }));
  62 |     expect(violations).toContainEqual(expect.objectContaining({
  63 |       directive: 'script-src-elem',
  64 |       blockedURI: 'https://example.invalid/prochart-pc130-probe.js',
  65 |     }));
  66 |   });
  67 | });
  68 | 
```