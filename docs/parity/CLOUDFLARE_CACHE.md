# کشِ Cloudflare — pro-chart.com

**تاریخ:** ۲۰۲۶-۰۷-۱۷ · **وضعیت:** حل‌شده و راستی‌آزمایی‌شدهٔ زنده

## مشکل

`cf-cache-status: DYNAMIC` روی **هر** درخواستِ `pro-chart.com` — هیچ‌چیز از لبه سرو
نمی‌شد، هر بار به origin می‌رفت. حتی `logo.png`.

## علتِ ریشه‌ای

یک **Cache Rule** به نامِ `bypass-all` با شرطِ `(http.host contains "pro-chart.com")`
و اکشنِ `cache: false`. کلِ دامنه را از کش خارج می‌کرد.

**نکتهٔ کلیدیِ Cache Rules:** برخلافِ انتظار، «اولین match برنده» نیست. یک قانونِ
`cache: false` که روی asset هم match شود، بر قانونِ `cache: true`ِ قبل از خودش **غالب
می‌شود**. پس افزودنِ یک قانونِ asset-cache *قبلِ* bypass کافی نبود — قانونِ bypass باید
پسوندهای asset را **صراحتاً مستثنی** کند.

## راه‌حل (دو قانون در ruleset `2e65223f…`)

۱. **cache static assets** — host + پسوندهای `.js/.css/.woff2/.woff/.png/.jpg/.jpeg/
   .gif/.svg/.ico/.webp` → `cache: true`، `edge_ttl: respect_origin`، `browser_ttl:
   respect_origin`. (origin از قبل `Cache-Control: public, max-age=31536000, immutable`
   می‌دهد.)

۲. **bypass HTML/API** — host **و NOT** همان پسوندها → `cache: false`. تا HTML و API
   هرگز کش نشوند و دیپلوی فوری باشد.

فایل‌ها hash‌دارند (`index-<hash>.js`)، پس هر بیلد نامِ نو می‌گیرد و کاربر هیچ‌وقت
asset کهنه نمی‌بیند.

## راستی‌آزماییِ زنده

| مسیر | cf-cache-status | درست؟ |
|---|---|---|
| `assets/index-*.js` | **HIT** | ✓ از لبه |
| `assets/index-*.css` | **HIT** | ✓ |
| `logo.png` | **HIT** | ✓ |
| `/` (HTML) | **DYNAMIC** | ✓ کش نمی‌شود |
| `/api/health` | **DYNAMIC** | ✓ کش نمی‌شود |

## purge

`.cf` ساخته شد (توکنِ کامل + zone `5b7251…` = pro-chart.com، `chmod 600`، gitignore).
`deploy.sh` و `cf_purge.sh` حالا لبه را درست purge می‌کنند — تست‌شده.

## تنظیماتِ سالمِ دیگر (برای مرجع)

- development mode: off · cache level: aggressive · browser cache ttl: 14400
- Page Rules: هیچ · Worker Routes: هیچ · always_online: off
- توکنِ `.env` (کانتینرِ api از طریق override): zone `5b7251…` که با WEBSITE_DOMAIN
  می‌خواند — قبلاً `trade-future.ir` بود و purgeِ سئوی مقالات را بی‌اثر می‌کرد.

## توکن

`prochart-deploy` (id `a0eb4a79…`)، مجوزها: Zone Read · Zone Settings Read ·
Cache Purge · Cache Rules Edit. هر ۵ zoneِ حساب را می‌بیند. توکن **فقط** در `.env`
و `.cf` (هر دو gitignore) است — هرگز در فایلِ track‌شده.
