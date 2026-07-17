# Clean-room Python suite

`run-clean.sh` یک snapshot پاک‌سازی‌شده از Worktree می‌سازد، قبل از اجرا آن را با Gitleaks redacted اسکن می‌کند، pytest قفل‌شده را در image مشتق از API نصب می‌کند و `pip check` + Full suite را با Repository فقط‌خواندنی، filesystem container فقط‌خواندنی، cache/bytecode غیرفعال، Credentialهای تصادفی موقت و `--network none` اجرا می‌کند.

از ریشه Repository:

```bash
qa/python/run-clean.sh
```

آرگومان اول مسیر Evidence اختیاری است. متغیرهای `PROCHART_QA_BASE_IMAGE` و `PROCHART_QA_TEST_IMAGE` imageها را override می‌کنند. Exit code واقعی pytest حفظ می‌شود و `full.log`، JUnit، package freeze، metadata، گزارش Secret scan و `SHA256SUMS` در مسیر run-scoped نوشته می‌شوند.

اسکریپت عمداً `tests/` ignored فعلی را نیز وارد snapshot می‌کند تا failureهای legacy پنهان نشوند و هم‌زمان regressionهای tracked در `qa/python/security_regressions.py` را اجرا می‌کند. اجرای آن هیچ مجوزی برای اتصال به DB/Redis/provider زنده یا تغییر سرویس‌های Compose نمی‌دهد.
