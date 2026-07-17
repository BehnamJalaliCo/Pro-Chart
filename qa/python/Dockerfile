ARG BASE_IMAGE=prochart-api:latest
FROM ${BASE_IMAGE}

USER root
RUN python -m pip install --no-cache-dir \
    pytest==9.1.1 \
    pytest-asyncio==1.4.0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/workspace

WORKDIR /workspace
USER 1000:1000
ENTRYPOINT ["python", "-m", "pytest"]
