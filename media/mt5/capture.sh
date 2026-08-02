#!/usr/bin/env bash
# گرفتنِ تصویرِ صفحهٔ Selkies (:20) و انتشار به MediaMTX روی مسیرِ mt5 (برای بیننده‌های /live).
set -u

: "${MEDIAMTX_HOST:=mediamtx}"
: "${PUBLISH_USER:=broadcaster}"
: "${PUBLISH_PASS:=}"
: "${CAP_DISPLAY:=:20}"
: "${DISPLAY_W:=1024}"
: "${DISPLAY_H:=768}"
: "${CAPTURE_FPS:=15}"

URL="rtmp://${MEDIAMTX_HOST}:1935/mt5?user=${PUBLISH_USER}&pass=${PUBLISH_PASS}"
SOCK="/tmp/.X11-unix/X${CAP_DISPLAY#*:}"
until [ -S "${SOCK}" ]; do sleep 0.5; done
sleep 3

while true; do
  echo "[capture] streaming ${CAP_DISPLAY} (${DISPLAY_W}x${DISPLAY_H}@${CAPTURE_FPS}) -> ${MEDIAMTX_HOST}/mt5"
  ffmpeg -nostdin -loglevel warning \
    -f x11grab -draw_mouse 1 -framerate "${CAPTURE_FPS}" \
    -video_size "${DISPLAY_W}x${DISPLAY_H}" -i "${CAP_DISPLAY}+0,0" \
    -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
    -b:v 2500k -maxrate 2500k -bufsize 5000k -g $((CAPTURE_FPS*2)) \
    -f flv "${URL}"
  echo "[capture] ffmpeg exited; retrying in 5s"
  sleep 5
done
