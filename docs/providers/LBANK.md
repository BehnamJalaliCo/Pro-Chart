# Provider: LBank

وضعیت production: `Referral departure deployed and verified؛ account trading مستقل و هنوز تأییدنشده`

## ثابت‌های الزام‌آور

- تنها صرافی قابل نمایش: `LBank`.
- لینک ورودی دقیق: `https://www.lbank.com/ref/PROCHART`.
- مسیر داخلی هدف: `/go/lbank` با رویداد بدون PII/Secret و Redirect ثابت.
- Disclosure فارسی و Eligibility gate پیش از خروج الزامی است.

## بررسی رسمی

- مستندات رسمی API V2، REST و WebSocket را ارائه می‌کند.
- Market data عمومی است؛ APIهای account/trading نیازمند API key و signature هستند.
- مستندات rate limit، server timestamp، permission error و خطاهای region/compliance را تعریف می‌کند.
- HTTP check در ۱۴ ژوئیه ۲۰۲۶: لینک الزام‌آور با یک Redirect به Signup رسمی دارای کد `PROCHART` و status نهایی 200 رسید.

منبع: [LBank API](https://www.lbank.com/docs/)

## سیاست پیاده‌سازی

Public adapter باید symbol mapping، precision/min tick، REST history، WebSocket reconnect، rate-limit، time sync، dedupe و contract fixture رسمی داشته باشد. Account connection/Order فقط پس از Credential آزمایشی، Vault server-side، no-withdrawal permission، idempotency، confirm، audit و kill switch فعال می‌شود.

## شاهد candidate فعلی

- Backend GET exact `/go/lbank` با مقصد ثابت، 302، `no-store/no-cache` و بی‌اثر بودن query override در artifact `backend-build/.../20260715T011720Z` contract شد؛
- UI desktop/mobile disclosure و eligibility دقیق، native disabled submit تا keyboard acknowledgement و فقط action هم‌مبدأ `/go/lbank` را در `referral-compliance/.../20260715T012118Z` پاس کرد؛
- direct provider bypass و `window.open` در چهار سناریوی Referral صفر بود.
- artifact مهرشدهٔ `referral-verification/20260715T083236Z` روی origin و `pro-chart.com`، `www.pro-chart.com`، `pro-chart.ir` و `user.pro-chart.com` مقصد ثابت، status=`302` و `no-store/no-cache` را با query خصمانه تأیید کرد؛
- Main canonical برابر ۲/۲، User Connect candidate/production هرکدام ۴/۴ و placement matrix candidate/production هرکدام ۱۶/۱۶ پاس شدند؛ User image زنده `sha256:3ebdde…aa8d` و healthy است.

## Gateهای باز

- clean-checkout و reproducibility کل repository هنوز یک Gate جداگانه و باز است؛
- scan compose-aware همهٔ source/bundleهای shipping را پوشش داده، اما یافته‌های QA/legacy جداگانه برای hygiene باز مانده‌اند؛
- public API adapter و fixture رسمی هنوز باید در baseline کد تعیین وضعیت شوند؛
- اتصال واقعی تا تأیید صریح disabled می‌ماند.
