"""تست‌های API"""

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_health_endpoint() -> None:
    from src.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_signals_list() -> None:
    from src.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/signals")
        # /signals اکنون نیازمند احراز هویت ادمین است (رفع امنیتیِ ممیزی)؛
        # بدون توکن باید رد شود (401 بدون credential یا 403 forbidden).
        assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_performance_summary() -> None:
    from src.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/performance/summary")
        assert response.status_code in (200, 401)


@pytest.mark.asyncio
async def test_auth_login_missing_credentials() -> None:
    from src.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/auth/login", json={})
        assert response.status_code in (400, 422)
