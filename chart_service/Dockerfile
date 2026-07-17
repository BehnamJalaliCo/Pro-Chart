# رندر چارت TradingView (lightweight-charts) در chromium headless → PNG
FROM mcr.microsoft.com/playwright:v1.44.1-jammy

WORKDIR /app

# فونت فارسیِ متصل (Vazirmatn) تا متنِ فارسی در chromium درست (نه حروف جدا) رندر شود
RUN mkdir -p /usr/local/share/fonts/vazir && \
    wget -qO /usr/local/share/fonts/vazir/Vazirmatn-Regular.ttf \
      https://github.com/rastikerdar/vazirmatn/raw/v33.003/fonts/ttf/Vazirmatn-Regular.ttf && \
    wget -qO /usr/local/share/fonts/vazir/Vazirmatn-Bold.ttf \
      https://github.com/rastikerdar/vazirmatn/raw/v33.003/fonts/ttf/Vazirmatn-Bold.ttf && \
    fc-cache -f

COPY package.json .
RUN npm install --omit=dev && npm cache clean --force
COPY server.js .

# پایتونِ موتورِ ریلز (reel_engine.py در /work): بیت-سینک + حالتِ آپلودِ صدا + پردازشِ صدا/تصویر
RUN apt-get update && apt-get install -y --no-install-recommends python3-pip ffmpeg && \
    pip3 install --no-cache-dir librosa soundfile faster-whisper && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV HF_HUB_DISABLE_TELEMETRY=1

ENV CHART_PORT=8086 NODE_ENV=production
EXPOSE 8086

# اجرا با کاربر غیر-root که در ایمیج playwright موجود است
USER pwuser
CMD ["node", "server.js"]
