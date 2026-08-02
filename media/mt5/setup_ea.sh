#!/usr/bin/env bash
# کپی + کامپایلِ EAِ اتو-تریدر در فولدرِ Experts متاتریدر (پس از آماده‌شدنِ data dir).
set -u
export WINEPREFIX="${WINEPREFIX:-/root/.wine}"
export DISPLAY="${DISPLAY:-:20}"
EA_SRC="/opt/CoineProAutoTrader.mq5"

# صبر تا ساخته‌شدنِ پوشهٔ دادهٔ ترمینال (هَشِ ۳۲ هگزی) — پس از اولین اجرای MT5
TROOT="$WINEPREFIX/drive_c/users/root/AppData/Roaming/MetaQuotes/Terminal"
HASHDIR=""
for _ in $(seq 1 80); do
  HASHDIR=$(ls -d "$TROOT"/*/ 2>/dev/null | grep -iE "/[0-9A-Fa-f]{32}/$" | head -1)
  [ -n "$HASHDIR" ] && break
  sleep 5
done
if [ -z "$HASHDIR" ]; then
  echo "[ea] terminal data dir not ready yet"
  exit 0
fi
INSTALL_EXP="$WINEPREFIX/drive_c/Program Files/MetaTrader 5/MQL5/Experts"
mkdir -p "$INSTALL_EXP"
# کامپایل را در مسیرِ پایدارِ Program Files انجام می‌دهیم (مستقل از هَشِ ترمینال)
cp -f "$EA_SRC" "$INSTALL_EXP/CoineProAutoTrader.mq5"
echo "[ea] EA copied to install dir"

ME="$WINEPREFIX/drive_c/Program Files/MetaTrader 5/metaeditor64.exe"
if [ -f "$ME" ]; then
  WINPATH=$(printf '%s' "$INSTALL_EXP/CoineProAutoTrader.mq5" | sed 's#.*/drive_c#C:#; s#/#\\\\#g')
  ( DISPLAY=:20 wine "$ME" /compile:"$WINPATH" /log >/var/log/ea_compile.log 2>&1 || true )
  for _ in $(seq 1 25); do
    if [ "$INSTALL_EXP/CoineProAutoTrader.ex5" -nt "$INSTALL_EXP/CoineProAutoTrader.mq5" ]; then break; fi
    sleep 3
  done
fi

# باگِ قبلی: فقط به اولین هَشِ ترمینال (head -1) کپی می‌شد، ولی MT5 ممکن بود از هَشِ
# دیگری اجرا شود → EAِ جدید هرگز لود نمی‌شد. حالا .ex5 + .mq5 را به *همهٔ* دایرکتوری‌های
# دادهٔ ترمینال (و mt5_users) توزیع می‌کنیم تا هر ترمینالی که MT5 اجرا کند، نسخهٔ تازه را ببیند.
EX5="$INSTALL_EXP/CoineProAutoTrader.ex5"
DIST=0
while IFS= read -r d; do
  exp="${d%/}/MQL5/Experts"
  mkdir -p "$exp" 2>/dev/null || continue
  [ -f "$EX5" ] && cp -f "$EX5" "$exp/" 2>/dev/null
  cp -f "$EA_SRC" "$exp/CoineProAutoTrader.mq5" 2>/dev/null
  DIST=$((DIST+1))
done <<EOF
$(ls -d "$TROOT"/*/ 2>/dev/null | grep -iE "/[0-9A-Fa-f]{32}/$")
$(ls -d "$WINEPREFIX/drive_c/mt5_users"/*/ 2>/dev/null)
EOF
[ -f "$EX5" ] && echo "[ea] EA distributed to $DIST terminal dir(s)" || echo "[ea] compile pending (distributed src to $DIST dirs)"
