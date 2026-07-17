# برنامه وابستگی‌محور

وضعیت: `I0 / G0 باز`  
منبع جزئیات هر شناسه: `docs/REQUIREMENTS_STATUS.csv`

## مسیر بحرانی

```text
GOV: PC-001, PC-007, PC-159, PC-160
  ↓
INVENTORY: PC-002, PC-003, PC-005, PC-024
  ├─ EVIDENCE: PC-153, PC-154, PC-157
  ├─ SAFETY: PC-128, PC-130–135, PC-158
  └─ PERF/A11Y BASELINE: PC-138–142, PC-146–152
              ↓
       G0 BASELINE_ACCEPTED
              ↓
I1 Foundation → I2 Data/Chart → I3 Analysis/Workspace → I4 Automation
              ├─ I5 NamaScript
              ├─ I6 Discovery/Content/AI
              └─ I7 Provider adapters
                         ↓
                  I8 Hardening/G8
                         ↓
              PC-156 سه Clean run
                         ↓
                 PC-004 COMPLETE
```

P0 Referralهای `PC-118–123` به Slice مستقل `I1.5` منتقل شده‌اند تا برای Adapterهای P1 منتظر نمانند. `PC-124–127` در I7 باقی می‌مانند.

## مدل وضعیت

ستون `status` وضعیت تحقق Product requirement است و در آغاز برای همه ردیف‌ها `NOT_STARTED` می‌ماند. ستون مستقل `baseline_status` از مدل زیر استفاده می‌کند:

```text
NOT_STARTED → BASELINING → BASELINED → IN_PROGRESS
→ EVIDENCE_READY → VERIFIED

حالت‌های جانبی: BLOCKED، FAILED، WAIVED
```

ثبت `BASELINED` هرگز به معنی `VERIFIED` نیست. نتیجه Gate در ستون `gate_result` مستقل است.

## گیت G0

پیش از G0 فقط Docs، Backup، Characterization، Crawl/Test tooling و اصلاح اضطراری امنیتی مجاز است. Feature یا Refactor رفتار Production مجاز نیست.

G0 نیازمند این شواهد است:

1. Inventory واقعی Route/Menu/Dialog/CTA/Shortcut/API/Storage/Cookie/Flag/Permission/Asset؛
2. Characterization suite بازتولیدپذیر روی کد تغییرنکرده؛
3. Screenshot، DOM/A11y snapshot، Network/Event trace در محیط قفل‌شده؛
4. Backup/Restore clean drill؛
5. Threat model، Owner و Risk register؛
6. صفر Secret یا Critical بدون mitigation؛
7. baseline Performance و Accessibility؛
8. ADR معماری، migration، feature flag، evidence retention و recovery؛
9. Known failureهای صریح و پیوندخورده به Matrix؛
10. تأیید Product Owner، Architect، QA، Security و SRE/DBA.

## Incrementها

| Increment | خروجی | Gate خروج |
|---|---|---|
| I0 | Baseline، Evidence، Backup/Restore، Threat model، ADR | G0 پذیرفته |
| I1 | RTL/i18n، Design System، Shell، Auth، Security/CI foundation | Gate زبان/امنیت/CI |
| I1.5 | LBank/OneRoyal CTA، Redirect، Disclosure و Eligibility | همه P0 اتصال |
| I2 | Data contracts، Stream/Cache، Chart Core و Serialization | Golden/contract/fault |
| I2.5 | Advanced chart، data quality و chart a11y overlay | P1 مستقل Chart/Data |
| I3 | Indicator، Drawing، Workspace، Watchlist و Search | سفرهای تحلیل P0 |
| I4 | Alert، Replay، Backtest، Paper و Webhook | Clock/idempotency/audit |
| I5 | NamaScript | Sandbox و Golden suite |
| I6 | Screener، Heatmap، Content، AI و Voice | Safety eval و a11y |
| I7 | LBank public adapter و OneRoyal scaffold | Provider/security contracts |
| I8 | Visual/A11y/Load/Soak/Migration/Supply chain | سه Clean run و G8 |

همه ۱۶۲ شناسه دقیقاً یک Owner role، dependency set، spec reference، Increment و critical-path class در `REQUIREMENTS_STATUS.csv` دارند. این تخصیص نقش است، نه انتصاب فرد؛ نام Approverها هنوز باید توسط مالک محصول تعیین شود.
