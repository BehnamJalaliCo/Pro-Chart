#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  security_scan.sh — اسکنِ امنیتیِ کاملِ پروژه با ابزارهای متن‌بازِ حرفه‌ای.
#  همه‌چیز از طریقِ Docker اجرا می‌شود (نیازی به نصبِ ابزار روی هاست نیست).
#
#  ابزارها:
#    - gitleaks   : نشتِ سکرت در کد/تاریخچه
#    - trivy      : CVE وابستگی‌ها + اسکنِ فایل‌سیستم + پیکربندیِ Dockerfile
#    - bandit     : تحلیلِ استاتیکِ امنیتیِ پایتون (SAST)
#    - pip-audit  : CVE وابستگی‌های پایتون
#    - hadolint   : best-practice و امنیتِ Dockerfileها
#
#  استفاده:  bash scripts/security_scan.sh [all|secrets|deps|sast|docker]
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
TARGET="${1:-all}"
OUT="${ROOT}/security-report"
mkdir -p "$OUT"
ts="$(date +%Y%m%d-%H%M%S 2>/dev/null || echo run)"
fail=0

hr() { printf '─%.0s' {1..70}; echo; }
sec() { hr; echo "▶ $1"; hr; }

run_secrets() {
  sec "gitleaks — secret scan"
  docker run --rm -v "${ROOT}:/repo" zricethezav/gitleaks:latest \
    detect --source=/repo --config=/repo/.gitleaks.toml --no-banner \
    --report-path=/repo/security-report/gitleaks-${ts}.json -v || fail=1
}

run_deps() {
  sec "trivy — filesystem & dependency CVEs (HIGH,CRITICAL)"
  docker run --rm -v "${ROOT}:/repo" aquasec/trivy:latest \
    fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
    --ignore-unfixed --no-progress /repo | tee "${OUT}/trivy-fs-${ts}.txt" || fail=1

  sec "pip-audit — python dependency CVEs"
  docker run --rm -v "${ROOT}:/repo" -w /repo python:3.12-slim bash -c \
    "pip install -q pip-audit >/dev/null 2>&1 && pip-audit -r requirements.txt --desc" \
    | tee "${OUT}/pip-audit-${ts}.txt" || true
}

run_sast() {
  sec "bandit — python SAST"
  docker run --rm -v "${ROOT}:/repo" -w /repo python:3.12-slim bash -c \
    "pip install -q 'bandit[toml]' >/dev/null 2>&1 && bandit -r src -c pyproject.toml -ll" \
    | tee "${OUT}/bandit-${ts}.txt" || true
}

run_docker() {
  sec "hadolint — Dockerfile lint"
  find . -name 'Dockerfile*' -not -path './node_modules/*' -not -path '*/node_modules/*' | while read -r df; do
    echo "### $df"
    docker run --rm -i hadolint/hadolint < "$df" || true
  done | tee "${OUT}/hadolint-${ts}.txt"

  sec "trivy config — Dockerfile/compose misconfig"
  docker run --rm -v "${ROOT}:/repo" aquasec/trivy:latest \
    config --severity HIGH,CRITICAL --no-progress /repo | tee "${OUT}/trivy-config-${ts}.txt" || true
}

case "$TARGET" in
  secrets) run_secrets ;;
  deps)    run_deps ;;
  sast)    run_sast ;;
  docker)  run_docker ;;
  all)     run_secrets; run_deps; run_sast; run_docker ;;
  *) echo "usage: $0 [all|secrets|deps|sast|docker]"; exit 2 ;;
esac

hr
echo "✔ گزارش‌ها در: ${OUT}/"
echo "  (یافته‌های HIGH/CRITICAL را بالاتر ببینید)"
exit 0
