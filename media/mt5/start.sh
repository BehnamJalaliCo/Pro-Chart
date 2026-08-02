#!/usr/bin/env bash
# متاتریدر ۵ روی سرور: Xvfb → fluxbox → x11vnc (damage-based) → noVNC → MT5 → ffmpeg capture
set -u

export HOME=/root
export DISPLAY=":0"
SCREEN="${DISPLAY_W}x${DISPLAY_H}x${DISPLAY_D}"

pkill -f Xvfb 2>/dev/null || true
pkill -f x11vnc 2>/dev/null || true
sleep 1
rm -f /tmp/.X0-lock
rm -rf /tmp/.X11-unix && mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

echo "[mt5] starting Xvfb ${SCREEN}"
Xvfb :0 -screen 0 "${SCREEN}" -ac -nolisten tcp +extension RANDR +extension DAMAGE >/var/log/xvfb.log 2>&1 &
sleep 2

echo "[mt5] starting window manager"
DISPLAY=:0 fluxbox >/var/log/fluxbox.log 2>&1 &
sleep 1

# x11vnc با XDAMAGE (فقط نواحیِ تغییرکرده) — روان و کم‌مصرف
echo "[mt5] starting x11vnc (damage-based)"
x11vnc -display :0 -forever -shared -nopw -rfbport 5900 \
  -threads -defer 1 -wait 2 -cursor most -ncache 0 \
  -o /var/log/x11vnc.log -bg

echo "[mt5] starting noVNC (web) on 6080"
websockify --web=/usr/share/novnc 6080 localhost:5900 >/var/log/novnc.log 2>&1 &

MT5_EXE="${WINEPREFIX}/drive_c/Program Files/MetaTrader 5/terminal64.exe"
if [ ! -f "${MT5_EXE}" ]; then
  echo "[mt5] MT5 not found — init wine + download installer"
  WINEDLLOVERRIDES="mscoree,mshtml=" wineboot --init >/var/log/wineboot.log 2>&1
  sleep 5
  wget -q -O /tmp/mt5setup.exe \
    "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" \
    && ( DISPLAY=:0 wine /tmp/mt5setup.exe /auto >/var/log/mt5install.log 2>&1 & ) \
    || echo "[mt5] WARN installer download failed"
fi
if [ -f "${MT5_EXE}" ]; then
  echo "[mt5] launching terminal64.exe"
  ( DISPLAY=:0 wine "${MT5_EXE}" >/var/log/mt5.log 2>&1 & ) || true
fi

echo "[mt5] starting capture loop"
/capture.sh &

echo "[mt5] ready — desktop via noVNC :6080"
while true; do
  sleep 30
  pgrep -f "[X]vfb" >/dev/null || { echo "[mt5] Xvfb died"; exit 1; }
done
