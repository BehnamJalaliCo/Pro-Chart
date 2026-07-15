# گزارش قرارداد Referral

آخرین ثبت بر پایهٔ ساعت UTC میزبان: `2026-07-15T08:53:08Z`

وضعیت: `PASS` برای `PC-119`، `PC-121` و `PC-122`؛ این گزارش به معنی تکمیل کل Goal یا کل Accessibility نیست.

## نتیجهٔ محصول

- `/go/lbank` دقیقاً با `302` به `https://www.lbank.com/ref/PROCHART` می‌رود.
- `/go/oneroyal` دقیقاً با `302` به `https://vc.cabinet.oneroyal.com/fa/links/go/12412` می‌رود.
- هر دو مسیر `Cache-Control: no-store` و `Pragma: no-cache` دارند و پارامترهای خصمانهٔ `next`/`destination` مقصد را تغییر نمی‌دهند.
- پروب origin و چهار host عمومی (`pro-chart.com`، `www.pro-chart.com`، `pro-chart.ir` و `user.pro-chart.com`) در ۱۰/۱۰ حالت پاس شد.

## Disclosure و دسترس‌پذیری

Gate مشترک، متن Disclosure و Eligibility را پیش از فرم قرار می‌دهد؛ checkbox و submit هر دو به همان دو پاراگراف با `aria-describedby` متصل‌اند. submit تا acknowledgement کیبوردی native-disabled است. پس از acknowledgement، درخواست واقعی فرم در سطح BrowserContext intercept شد و فقط یک `GET` هم‌مبدأ به `/go/lbank` یا `/go/oneroyal` ثبت شد؛ Provider خارجی در تست فراخوانی نشد.

Axe روی WCAG 2.0، 2.1 و 2.2 سطح A/AA، قبل و بعد از acknowledgement اجرا شد. یک failure واقعی کنتراست روی دکمهٔ فعال User پیدا شد؛ رنگ فعال از `#2979ff` به `#1565c0` و hover به `#0d47a1` اصلاح و deploy شد. rerun candidate و production violation صفر داشت.

## پوشش مرورگر

| سطح | نتیجه |
|---|---:|
| Main canonical mobile Profile | ۲/۲ PASS |
| Main legacy supplement | ۴/۴ PASS |
| User Connect candidate | ۴/۴ PASS |
| User placement matrix candidate | ۱۶/۱۶ PASS |
| User Connect production | ۴/۴ PASS |
| User placement matrix production | ۱۶/۱۶ PASS |

Placement matrix چهار route واقعی `/`، `/connect`، `/trade` و `/subscription` را برای account typeهای `crypto` و `broker` روی desktop و mobile پوشش می‌دهد. Main desktop سطح canonical فعالی برای Referral ندارد؛ `UserPanel` قدیمی فقط شاهد تکمیلی است و `Partners.jsx` dormant به‌عنوان surface فعال شمرده نشده است.

## Build، deploy و هویت

- commit تست/قرارداد: `6e3fad2909977570ff95c7756e62ee16887d7fc2`.
- buildها: API=`sha256:05ed90…cbe8`، Main=`sha256:43a857…fa4`، Panel=`sha256:8dbab5…42b` و User=`sha256:3ebdde…aa8d`.
- deploy User در `2026-07-15T08:49:40Z`: از `sha256:6a5c25…6216` به `sha256:3ebdde…aa8d`؛ rollback tag آماده و فعال‌نشده است.
- candidate/live User bundle tree هر دو `56a17a5c…aae1`؛ health=`healthy`، restart=`0`، HTTPS=`200`، compose=`11` running و unhealthy=`0`.
- backend network-none برابر ۱۲/۱۲، source contract برابر ۱۰/۱۰ و provider scanner برابر ۵/۵ پاس شدند.

## Evidence و محدودیت

شاهد canonical: `artifacts/qa/referral-verification/20260715T083236Z/` با SHA-256 manifest=`f8edb6f98a85580177c84bc04916836e09e376803ceda325144c81a327269f86` و deploy artifact با manifest=`91503fddc45fc8010d4559d03859d54c2ebc037e80e267804e37422bda4d0fa8`؛ همه entryهای manifest `OK` هستند.

Failureهای harness (vhost اشتباه، انتظار popup با `noopener` و network نداشتن container موقت)، نبود Golden انسانی و failure کنتراست محصول حذف نشده‌اند و در `run-metadata.json` ثبت شده‌اند. ممیزی دستی screen-reader، reflow و Gateهای سراسری Accessibility زیر `PC-146` تا `PC-150`، و policy coverage کامل Eligibility زیر `PC-123` همچنان باز هستند.
