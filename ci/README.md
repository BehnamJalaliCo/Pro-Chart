# CI امنیتی

`security-workflow.yml` همان GitHub Actionsِ امنیتی است (gitleaks/bandit/pip-audit/trivy/hadolint/npm-audit).
به‌خاطرِ نبودِ scopeِ `workflow` در توکن، اینجا گذاشته شده. برای فعال‌سازی:
کپی به `.github/workflows/security.yml` با توکنی که scopeِ workflow دارد، یا از طریقِ وبِ GitHub.

اسکنِ محلی (بدونِ CI): `bash scripts/security_scan.sh`
