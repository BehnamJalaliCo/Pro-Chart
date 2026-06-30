FROM python:3.12-slim

# متغیرهای محیطی
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# نصب وابستگی‌های سیستمی
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    wget \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# نصب TA-Lib از سورس (نسخه کلاسیک)
RUN wget -q https://prdownloads.sourceforge.net/ta-lib/ta-lib-0.4.0-src.tar.gz && \
    tar -xzf ta-lib-0.4.0-src.tar.gz && \
    cd ta-lib && \
    ./configure --prefix=/usr && \
    make && \
    make install && \
    ldconfig && \
    cd .. && \
    rm -rf ta-lib ta-lib-0.4.0-src.tar.gz

WORKDIR /app

# نصب وابستگی‌های پایتون
COPY requirements.txt .
# Install numpy first, then main deps, then pandas-ta (skip dep check), then compile TA-Lib
RUN pip install --no-cache-dir numpy==2.2.6
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir numba
RUN pip install --no-cache-dir --no-deps pandas-ta==0.4.71b0
RUN pip install --no-cache-dir cython setuptools wheel && \
    pip install --no-cache-dir --no-binary TA-Lib --no-build-isolation --force-reinstall TA-Lib==0.4.32

# کپی سورس کد
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic/alembic.ini ./alembic.ini
COPY scripts/ ./scripts/
COPY run_*.py ./

# ساخت پوشه‌ها
RUN mkdir -p /app/logs /app/ml_models

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
