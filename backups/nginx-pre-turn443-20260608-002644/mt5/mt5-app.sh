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

echo "[mt5-app] launching terminal64.exe"
exec wine "${MT5_EXE}"
