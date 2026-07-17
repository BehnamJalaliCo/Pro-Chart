FROM python:3.13.14-slim@sha256:bffeb7bd6a85767587059c6ba23e1e9122078e3aa3fa836099171b9bb5a9bb00

# متغیرهای محیطی
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/tmp

# فقط runtime کتابخانه‌های ML؛ wheel رسمی TA-Lib دیگر compiler یا curl نمی‌خواهد.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# نصب وابستگی‌های پایتون
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt && \
    python -c "import fastapi,lightgbm,numpy,pandas,talib,xgboost; print('fastapi',fastapi.__version__,'numpy',numpy.__version__,'pandas',pandas.__version__,'talib',talib.__version__,'lightgbm',lightgbm.__version__,'xgboost',xgboost.__version__)" && \
    python -m pip check

# کپی سورس کد
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic/alembic.ini ./alembic.ini
COPY scripts/ ./scripts/
COPY run_*.py ./

# ساخت پوشه‌ها
RUN mkdir -p /app/logs /app/ml_models && \
    chown -R 1000:1000 /app/logs /app/ml_models

USER 1000:1000

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
