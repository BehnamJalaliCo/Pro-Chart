#!/usr/bin/env bash
# اجرای متاتریدر ۵ روی دیسپلیِ Selkies (:20) — نصبِ خودکار در اولین اجرا.
set -u
export DISPLAY=":20"
export HOME=/root
export WINEPREFIX=/root/.wine

# اجازهٔ دسترسیِ workerِ nginx (www-data) به فایلِ htpasswd —
# دایرکتوریِ runtime به‌صورت 0700 ساخته می‌شود و auth را با خطای ۵۰۰ می‌شکند.
for _ in $(seq 1 30); do
  if [ -d /tmp/runtime-ubuntu ]; then
    chmod 755 /tmp/runtime-ubuntu 2>/dev/null || true
    [ -f /tmp/runtime-ubuntu/.htpasswd ] && chmod 644 /tmp/runtime-ubuntu/.htpasswd 2>/dev/null || true
    break
  fi
  sleep 1
done

# صبر تا آماده‌شدنِ X سرورِ Selkies
until [ -S /tmp/.X11-unix/X20 ]; do sleep 0.5; done
sleep 2

# رزولوشنِ سبک + پنجره‌مدیر
selkies-gstreamer-resize 1024x768 >/dev/null 2>&1 || true
openbox >/var/log/openbox.log 2>&1 &
sleep 1

MT5_EXE="${WINEPREFIX}/drive_c/Program Files/MetaTrader 5/terminal64.exe"
if [ ! -f "${MT5_EXE}" ]; then
  echo "[mt5-app] MT5 not found — init wine + download installer"
  WINEDLLOVERRIDES="mscoree,mshtml=" wineboot --init >/var/log/wineboot.log 2>&1
  sleep 5
  if wget -q -O /tmp/mt5setup.exe \
      "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"; then
    ( wine /tmp/mt5setup.exe /auto >/var/log/mt5install.log 2>&1 & )
  else
    echo "[mt5-app] WARN installer download failed"
  fi
fi

# صبر تا تکمیلِ نصب
for _ in $(seq 1 60); do
  [ -f "${MT5_EXE}" ] && break
  sleep 5
done

# نصب/کامپایلِ EAِ اتو-تریدر (همگام، تا قبل از لانچ آماده باشد برای اتچِ خودکار)
[ -x /etc/setup_ea.sh ] && /etc/setup_ea.sh >/var/log/setup_ea.log 2>&1 || true

# ── سوپروایزرِ حساب: مشخصاتِ لاگین را از API می‌گیرد و با تغییر، خودکار re-login می‌کند ──
START_SYMBOL="${EA_START_SYMBOL:-EURUSD}"
INI_PATH="${WINEPREFIX}/drive_c/mt5_startup.ini"
API_BASE="${EA_API_BASE:-http://api:8000}"
EATOKEN="${EA_TOKEN:-}"

# خروجی: "rev|configured|logout|server|login|password" (خالی اگر ناموفق)
fetch_account() {
  local resp
  resp=$(curl -s -m 8 "${API_BASE}/ea/master-account?token=${EATOKEN}" 2>/dev/null) || return 1
  [ -z "$resp" ] && return 1
  python3 - "$resp" <<'PY' 2>/dev/null
import json, sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    sys.exit(1)
print("|".join([str(d.get("rev", 0)), "1" if d.get("configured") else "0",
                "1" if d.get("logout") else "0",
                d.get("server", ""), d.get("login", ""), d.get("password", "")]))
PY
}

write_ini() {  # args: server login password  (اگر خالی → بدونِ [Common] = لاگینِ ماندگارِ Wine)
  local srv="$1" lg="$2" pw="$3"
  # VIEW_ONLY=1 (پیش‌فرض): مَستر روی سرورِ کپی (ویندوز) ترید می‌شود؛ ترمینالِ Wine فقط
  # برای استریمِ زنده است — EA لود نمی‌شود و AllowLiveTrading خاموش است تا هرگز ترید نکند.
  local view_only="${EA_VIEW_ONLY:-1}"
  {
    if [ -n "$lg" ] && [ -n "$pw" ] && [ -n "$srv" ]; then
      echo "[Common]"; echo "Login=${lg}"; echo "Password=${pw}"; echo "Server=${srv}"
    fi
    if [ "$view_only" = "1" ]; then
      echo "[StartUp]"; echo "Symbol=${START_SYMBOL}"; echo "Period=M15"
      echo "[Experts]"; echo "AllowLiveTrading=0"; echo "Enabled=0"; echo "AllowDllImport=0"
    else
      echo "[StartUp]"; echo "Expert=CoineProAutoTrader"; echo "Symbol=${START_SYMBOL}"; echo "Period=M15"
      echo "[Experts]"; echo "AllowLiveTrading=1"; echo "Enabled=1"; echo "AllowDllImport=0"
    fi
  } > "$INI_PATH"
}

WINE_PID=""
launch() {
  echo "[mt5-app] launching terminal64.exe (account-rev=${CUR_REV})"
  wine "${MT5_EXE}" "/config:C:\\mt5_startup.ini" &
  WINE_PID=$!
}
kill_wine() {
  [ -n "$WINE_PID" ] && kill "$WINE_PID" 2>/dev/null
  wineserver -k 2>/dev/null || true
  sleep 3
}

CUR_REV="__init__"
MODE="persist"   # persist | login | logout
trap 'kill_wine; exit 0' TERM INT
while true; do
  acct="$(fetch_account || true)"
  if [ -n "$acct" ]; then
    REV="${acct%%|*}"; rest="${acct#*|}"
    CONF="${rest%%|*}"; rest="${rest#*|}"
    LOGOUT="${rest%%|*}"; rest="${rest#*|}"
    SRV="${rest%%|*}"; rest="${rest#*|}"
    LG="${rest%%|*}"; PW="${rest#*|}"
    if [ "$REV" != "$CUR_REV" ]; then
      echo "[mt5-app] state change (rev ${CUR_REV} -> ${REV}, configured=${CONF}, logout=${LOGOUT})"
      kill_wine
      CUR_REV="$REV"
      if [ "$CONF" = "1" ]; then
        MODE="login"; write_ini "$SRV" "$LG" "$PW"; launch
      elif [ "$LOGOUT" = "1" ]; then
        MODE="logout"; WINE_PID=""   # خاموش می‌ماند تا حسابِ جدید وارد شود
        echo "[mt5-app] logged out — terminal stopped until an account is set"
      else
        MODE="persist"; write_ini "" "" ""; launch
      fi
    fi
  elif [ "$CUR_REV" = "__init__" ]; then
    # اولین اجرا و API در دسترس نبود → با لاگینِ ماندگار بالا بیا (رفتارِ قبلی)
    MODE="persist"; write_ini "" "" ""; CUR_REV="0"; launch
  fi
  # تابِ‌آوری: اگر ترمینال مُرد دوباره بالا بیاور — مگر در حالتِ logout
  if [ "$MODE" != "logout" ] && [ -n "$WINE_PID" ] && ! kill -0 "$WINE_PID" 2>/dev/null; then
    echo "[mt5-app] terminal exited — relaunching"
    launch
  fi
  sleep 15
done
