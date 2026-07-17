# Threat Model اولیه Pro Chart

وضعیت: `PARTIAL` — Data-flow و Owner نقش ثبت شده؛ Owner فردی، abuse-case review و نگاشت کامل ASVS 5.0.0 مانده است

## Data-flow و مرزهای اعتماد

```text
[Browser/PWA: untrusted device]
      │ HTTPS/WSS; session, workspace, commands
      ▼
[Nginx/TLS edge: public boundary]
      │ same-origin /api + /ws; security headers
      ▼
[FastAPI + identity/entitlement boundary]
      ├── PostgreSQL/TimescaleDB  (identity, workspace, market/trading records)
      ├── Valkey/Redis            (cache, queue, transient session/state)
      ├── Workers/queues          (news, alert, data feed, background actions)
      ├── LLM sidecar             (bounded prompt/context; no credential access)
      └── Provider adapters       (market/news/Telegram/LBank; outbound trust boundary)

[Admin/operations boundary]
      ├── deploy/secret injection
      ├── telemetry/support evidence
      └── encrypted backup → restricted storage/restore environment
```

قواعد عبور از مرز:

- Browser و payload Provider هر دو untrusted هستند؛ validation، permission و entitlement در service layer انجام می‌شود.
- هیچ API key، signing key یا Provider credential به Browser/URL/query/log منتقل نمی‌شود.
- command تغییر‌دهنده باید identity، permission، idempotency و audit داشته باشد؛ AI فقط Draft/Preview می‌سازد.
- محتوای News/AI از instructionهای سیستم و tool permission جدا می‌ماند.
- داده backup/support/screenshot پیش از خروج از مرز عملیات، minimization و redaction می‌شود.

## دارایی‌ها و مرزهای اعتماد

- هویت، session، 2FA و recovery؛
- API key و Credential Provider؛
- Workspace، Layout، Drawing و NamaScript خصوصی؛
- Market data، alert، paper order و هر command معاملاتی؛
- Webhook secret و مقصد؛
- محتوای News/AI و ابزارهای قابل‌فراخوانی؛
- telemetry، support bundle، screenshot و trace؛
- PostgreSQL/Timescale، Valkey، Browser storage و backup.

## سناریوهای تهدید

| حوزه | تهدید اصلی | کنترل لازم | Owner role | وضعیت |
|---|---|---|---|---|
| Auth | credential stuffing، session fixation، user enumeration، recovery abuse | rate limit، MFA، rotation، device logout، پیام خنثی، audit | Identity/Security | PARTIAL |
| Authorization | دورزدن entitlement/RBAC با تغییر Client | enforcement سمت Server، deny-by-default، test matrix | Backend/Security | PARTIAL؛ live-admin slice فقط |
| Market data | bar جعلی، replay/out-of-order، stale quote، cache خارج entitlement | normalization، sequence، lineage، freshness badge، reconciliation | Data | PARTIAL |
| Script | CPU/memory exhaustion، escape به DOM/network/file، tenant crossover | sandbox، quota، deterministic clock، AST validation، fuzz | NamaScript/Security | MISSING |
| Alert/Webhook | SSRF، DNS rebinding، replay، secret leak، unbounded retry | URL policy، resolve/recheck، HMAC، rotation، redaction، DLQ | Backend/Security | MISSING |
| AI/News | prompt injection، tool misuse، PII exfiltration، action بدون consent | content isolation، allowlist، redaction، preview/confirm، eval | AI/Security | MISSING |
| Trading | duplicate order، timeout ambiguity، permission زیاد، withdrawal | idempotency، state machine، confirm، no-withdrawal، kill switch | Trading/Security | PARTIAL/disabled |
| Referral | open redirect، مقصد جایگزین، نبود disclosure/eligibility | allowlist ثابت، 302 داخلی، accessible disclosure، policy gate | Product/Backend | PARTIAL |
| Browser | XSS/CSRF، token exposure، insecure storage، clickjacking | CSP، cookie امن، CSRF، output encoding، frame policy | Web/Security | PARTIAL؛ candidate فقط |
| Supply chain | dependency compromise، image drift، unsigned artifact | lockfile، SBOM، pinned image، provenance، SCA | Platform/Security | BASELINED/FAIL |
| Backup/Logs | انتقال Secret/PII، دسترسی بیش‌ازحد، restore فساد | exclude، encryption، permission، retention، restore drill | Platform/Security | PARTIAL |

## مهاجم و سطح اثر

| Actor | مسیر محتمل | اثر بحرانی مورد حفاظت |
|---|---|---|
| کاربر ناشناس/ربات | HTTP/WS، auth، search، referral | takeover، DoS، open redirect، enumeration |
| کاربر احرازشده مخرب | ID/tenant tampering، command replay، quota abuse | دسترسی workspace/alert/order کاربر دیگر |
| Provider یا محتوای آلوده | quote/news/webhook/AI prompt | داده جعلی، SSRF، prompt injection، action ناخواسته |
| dependency/build compromise | package، image، CI artifact | اجرای کد و سرقت Secret در همه tenantها |
| insider/credential compromise | admin/API key/backup | export داده، تغییر permission، deploy مخرب |
| device/browser compromise | LocalStorage، extension، XSS | session و workspace کاربر؛ نباید به Secret backend برسد |

شدت بحرانی/زیاد مستقل از frequency شامل معامله ناخواسته، bypass permission/entitlement، cross-tenant disclosure، signing/provider key exposure، corruption داده بازار و restore غیرقابل‌اعتماد است.

## یافته‌های فوری

1. Gitleaks در Baseline یک finding در Git history/tracked `.cf` و findingهای متعدد در فایل‌های local حساس ثبت کرد. فایل tracked از candidate حذف و build/backup/loader/rotation harden شده، اما Rotation/Revoke و history cleanup انجام نشده؛ `PC-132` همچنان FAIL است.
2. backupهای ساعتی/GDrive اکنون Secret path/keyها را exclude و Compose را بدون interpolation export می‌کنند؛ backup روزانه passphrase را از environment می‌گیرد. این jobهای external اجرا یا schedule-audit نشده‌اند.
3. Header/CSP در image candidate runtime pass و ZAP High=0 است، اما سه دسته Medium CSP باقی و live container هنوز بدون header است؛ `PC-130` فقط PARTIAL است.
4. Workflow امنیتی در مسیر فعال GitHub Actions نیست و چند scanner legacy exit موفق اجباری ندارند.
5. اتصال واقعی Provider تا تکمیل Vault، permission، sandbox و kill switch باید غیرفعال بماند.

## نگاشت ASVS 5.0.0 جاری

| کنترل | شاهد فعلی | وضعیت |
|---|---|---|
| `v5.0.0-1.3.1` HTML sanitization | regression raw script/style removal | PARTIAL؛ همه ورودی‌ها audit نشده‌اند |
| `v5.0.0-3.4.1/.3/.4/.5/.6` browser headers | runtime image + Playwright + passive ZAP | PARTIAL؛ live deploy و residualها باز |
| `v5.0.0-3.4.2` CORS allowlist | production default regression | PARTIAL؛ endpoint matrix کامل نیست |
| `v5.0.0-13.1.4` secret lifecycle documentation | `SECRETS_POLICY.md` | DRAFT؛ Owner فردی/اجرای rotation باز |
| `v5.0.0-13.3.1/.2/.4` secret store/least privilege/rotation | source/build exclusions و file guards | FAIL/PARTIAL؛ Vault و revoke/history cleanup باز |
| `v5.0.0-16.2.5` sensitive logging | redacted QA artifacts | PARTIAL؛ log sinkهای runtime audit نشده‌اند |

## روش نگاشت ASVS

شناسه‌ها با قالب `v5.0.0-x.y.z` در test/evidence ثبت می‌شوند. هدف موقت Shell/API حداقل L2 است؛ L3 برای مسیرهای ادمین/معامله/Secret نیازمند تصمیم مالک ریسک است. پوشش requirement-by-requirement، abuse-case workshop و امضای Ownerهای Identity، Data، AI، Trading، Platform و AppSec هنوز برای `PC-128` لازم است.
