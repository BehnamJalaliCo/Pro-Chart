"""LLMClient — کلاینت async برای سرویس claude-llm (Claude Code CLI headless).

اصول:
    - degradation امن: اگر LLM غیرفعال یا خطا داد، None برمی‌گرداند (فراخواننده
      به مسیر بدون‌LLM برمی‌گردد). هیچ‌وقت مسیر اصلی را بلاک/خراب نمی‌کند.
    - کش Redis اختیاری برای جلوگیری از فراخوانی تکراری.
    - semaphore سراسری برای رعایت محدودیت نرخ اشتراک Max.
"""

from __future__ import annotations

import asyncio
import hashlib

import httpx

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("llm.client")

# محدودیت هم‌زمانیِ سمت کلاینت (سرویس هم خودش صف دارد)
_sem = asyncio.Semaphore(3)


class LLMClient:
    def __init__(self, url: str | None = None, model: str | None = None,
                 timeout: int | None = None) -> None:
        self.url = (url or settings.LLM_SERVICE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    async def complete(
        self,
        prompt: str,
        system: str | None = None,
        model: str | None = None,
        timeout: int | None = None,
        cache_ttl: int | None = None,
        system_replace: bool = False,
    ) -> str | None:
        """تکمیل متن با Claude. در صورت غیرفعال‌بودن/خطا None.

        system_replace=True ⇽ system به‌صورتِ فیلدِ جدا می‌رود و سرور با --system-prompt
        هویتِ پیش‌فرضِ Claude Code را کامل جایگزین می‌کند (برای نقش‌های سفت‌وسخت مثل
        دستیارِ بازارِ مالی). در غیرِ این صورت رفتارِ قدیمی (prepend در متن) حفظ می‌شود.
        """
        if not settings.LLM_ENABLED:
            return None

        to = timeout or self.timeout
        use_field = bool(system and system_replace)
        # حالتِ قدیمی: system در ابتدای prompt الصاق می‌شود (سازگاری با narrator/sanity)
        full = prompt if (not system or system_replace) else f"{system}\n\n{prompt}"

        # کش (اختیاری) — کلید شاملِ system هم هست
        cache_key = None
        if cache_ttl:
            digest = hashlib.sha256(
                f"{model or self.model}|{system or ''}|{full}".encode()
            ).hexdigest()[:32]
            cache_key = f"llm:cache:{digest}"
            cached = await self._cache_get(cache_key)
            if cached is not None:
                return cached

        body = {"prompt": full, "model": model or self.model, "timeout_ms": int(to * 1000)}
        if use_field:
            body["system"] = system
        async with _sem:
            try:
                async with httpx.AsyncClient(timeout=to + 15) as client:
                    resp = await client.post(f"{self.url}/complete", json=body)
                    resp.raise_for_status()
                    data = resp.json()
            except Exception as exc:  # noqa: BLE001 — fail-soft
                logger.warning("llm_call_failed", error=str(exc))
                return None

        if not data.get("ok"):
            logger.warning("llm_error", error=str(data.get("error"))[:200])
            return None
        text = (data.get("text") or "").strip() or None
        if text and cache_key:
            await self._cache_set(cache_key, text, cache_ttl)
        return text

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{self.url}/health")
                return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    async def _cache_get(key: str) -> str | None:
        try:
            from src.core.redis_client import redis_client
            return await redis_client.client.get(key)
        except Exception:  # noqa: BLE001
            return None

    @staticmethod
    async def _cache_set(key: str, value: str, ttl: int) -> None:
        try:
            from src.core.redis_client import redis_client
            await redis_client.client.set(key, value, ex=ttl)
        except Exception:  # noqa: BLE001
            pass


llm_client = LLMClient()
