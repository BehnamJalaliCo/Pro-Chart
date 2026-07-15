# Provider: OneRoyal

وضعیت production: `Referral-only deployed and verified`

## ثابت‌های الزام‌آور

- تنها بروکر قابل نمایش: `OneRoyal`.
- لینک ورودی دقیق: `https://vc.cabinet.oneroyal.com/fa/links/go/12412`.
- مسیر داخلی هدف: `/go/oneroyal` با رویداد بدون PII/Secret و Redirect ثابت.
- Disclosure فارسی، Eligibility gate و متن خنثی الزامی است.

## بررسی رسمی

HTTP check در ۱۴ ژوئیه ۲۰۲۶ نشان داد لینک الزام‌آور با یک Redirect به Signup فارسی دامنه رسمی OneRoyal و status نهایی 200 می‌رسد. این فقط integrity مقصد را baseline می‌کند و مجازبودن خدمت برای کاربر/منطقه را ثابت نمی‌کند.

منبع: [OneRoyal](https://www.oneroyal.com/)

## سیاست پیاده‌سازی

تا دریافت قرارداد، API رسمی، Credential آزمایشی و تأیید محدوده خدمت:

- اتصال حساب یا معامله واقعی نمایش داده نمی‌شود؛
- رمز یا شناسه کابین جمع‌آوری نمی‌شود؛
- Scraping و Automation پنل شخصی ممنوع است؛
- `BrokerAdapter` فقط interface/test double مستقل خواهد بود.

## شاهد candidate فعلی

- Backend GET exact `/go/oneroyal` با مقصد ثابت، 302، `no-store/no-cache` و بی‌اثر بودن query override در artifact `backend-build/.../20260715T011720Z` contract شد؛
- UI desktop/mobile disclosure و eligibility دقیق، native disabled submit تا keyboard acknowledgement و فقط action هم‌مبدأ `/go/oneroyal` را در `referral-compliance/.../20260715T012118Z` پاس کرد؛
- چهار سناریوی Browser OneRoyal را Referral-only و بدون credential/order UI آزمودند؛ direct provider bypass و `window.open` صفر بود؛
- Bot focused suite فقط پس از دو مرحله متن، URL داخلی `/go/oneroyal` را ارائه کرد؛ focused Referral/Bot مجموعاً ۱۳/۱۳ پاس بود.
- artifact مهرشدهٔ `referral-verification/20260715T083236Z` روی origin و چهار host عمومی مقصد ثابت، status=`302` و `no-store/no-cache` را با query خصمانه تأیید کرد؛
- Main canonical برابر ۲/۲، User Connect candidate/production هرکدام ۴/۴ و placement matrix candidate/production هرکدام ۱۶/۱۶ پاس شدند؛ هیچ credential/order UI برای OneRoyal دیده نشد.

## Gateهای باز

- clean-checkout و reproducibility کل repository هنوز یک Gate جداگانه و باز است؛
- policy Owner و refresh cadence همچنان باید نهایی شوند؛ QA/legacy scan به‌عنوان hygiene جدا باقی مانده است؛
- API/credential واقعی همچنان غایب است و Referral-only باید حفظ شود.
