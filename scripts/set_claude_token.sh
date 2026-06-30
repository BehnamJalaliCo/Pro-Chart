#!/usr/bin/env bash
# توکن بلندمدت Claude (claude setup-token) را امن در .env ذخیره می‌کند.
# توکن با read -s به‌صورت پنهان گرفته می‌شود و هرگز روی صفحه/لاگ چاپ نمی‌شود.
set -euo pipefail

ENV_FILE="/home/forex/CoinePro-FX/.env"

echo "──────────────────────────────────────────────────────────"
echo " ثبت توکن دائمی Claude برای کانتینر claude-llm"
echo "──────────────────────────────────────────────────────────"
echo " اگر هنوز توکن نساخته‌ای، اول در همین ترمینال این را بزن:"
echo "     claude setup-token"
echo " سپس توکنی که با sk-ant-oat شروع می‌شود را کپی کن."
echo "──────────────────────────────────────────────────────────"
echo ""

read -rsp " توکن را اینجا Paste کن و Enter بزن: " TOKEN
echo ""

if [[ -z "${TOKEN}" ]]; then
  echo "✗ توکن خالی بود — لغو شد."
  exit 1
fi
if [[ "${TOKEN}" != sk-ant-oat* ]]; then
  echo "⚠ هشدار: توکن با sk-ant-oat شروع نمی‌شود. مطمئنی درست است؟ (ادامه می‌دهم)"
fi

# خط قبلی را در صورت وجود حذف کن (جلوگیری از تکراری)
if [[ -f "${ENV_FILE}" ]]; then
  grep -v '^CLAUDE_CODE_OAUTH_TOKEN=' "${ENV_FILE}" > "${ENV_FILE}.tmp" || true
  mv "${ENV_FILE}.tmp" "${ENV_FILE}"
fi

printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "${TOKEN}" >> "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
unset TOKEN

echo "✓ توکن در .env ذخیره شد (پنهان، چاپ نشد)."
echo "  حالا به Claude بگو «تمام شد» تا کانتینر را با توکن جدید بالا بیاورد و تست کند."
