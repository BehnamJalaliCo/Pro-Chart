# متاتریدر ۵ روی سرور — Selkies-GStreamer (WebRTC، در لحظه) + Wine + ffmpeg
# پایه: ایمیجِ رسمیِ Selkies (شاملِ Xvfb :20 + selkies-gstreamer + nginx داخلی + supervisord)
FROM ghcr.io/selkies-project/selkies-gstreamer/gst-py-example:main-ubuntu24.04

USER root
ENV USER=root \
    HOME=/root \
    WINEPREFIX=/root/.wine \
    WINEARCH=win64 \
    WINEDEBUG=-all \
    START_XFCE4=false \
    DISPLAY=:20

# Wine + پنجره‌مدیرِ سبک + ffmpeg (برای پخشِ بیننده‌ها)
RUN dpkg --add-architecture i386 && apt-get update && \
    apt-get install -y --no-install-recommends \
      wine winbind \
      openbox \
      ffmpeg \
      cabextract wget ca-certificates procps net-tools \
    && rm -rf /var/lib/apt/lists/*

# رفعِ باگِ Selkies: bus_call روی پیامِ None کرش می‌کند (bus.pop() می‌تواند None برگرداند)
# و taskِ مدیریتِ pipeline می‌میرد → گردآوری/ارسالِ candidateهای relay مختل می‌شود.
RUN python3 - <<'PY'
f = "/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py"
s = open(f).read()
old = "    def bus_call(self, message):\n        t = message.type"
new = "    def bus_call(self, message):\n        if message is None:\n            return True\n        t = message.type"
assert old in s, "bus_call pattern not found — selkies version changed"
open(f, "w").write(s.replace(old, new))
print("patched bus_call None-guard")
PY

# برنامه‌ها به supervisord افزوده می‌شوند (include از conf.d فعال است)
COPY mt5-app.sh /etc/mt5-app.sh
COPY capture.sh /capture.sh
COPY setup_ea.sh /etc/setup_ea.sh
COPY user_manager.py /user_manager.py
COPY CoineProAutoTrader.mq5 /opt/CoineProAutoTrader.mq5
COPY mt5-app.conf /etc/supervisor/conf.d/mt5-app.conf
COPY ffmpeg-capture.conf /etc/supervisor/conf.d/ffmpeg-capture.conf
COPY user-manager.conf /etc/supervisor/conf.d/user-manager.conf
RUN chmod +x /etc/mt5-app.sh /capture.sh /etc/setup_ea.sh
