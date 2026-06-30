"""نصبِ uvloop — حلقهٔ asyncio سریع‌تر (تا ~۲× سریع‌تر از حلقهٔ پیش‌فرض).

در ابتدای هر entrypoint فراخوانی می‌شود (قبل از asyncio.run). fail-soft: اگر uvloop
نبود یا روی این پلتفرم پشتیبانی نشد، بی‌صدا به حلقهٔ پیش‌فرض برمی‌گردد.
"""

from __future__ import annotations


def install_uvloop() -> bool:
    try:
        import uvloop

        uvloop.install()
        return True
    except Exception:  # noqa: BLE001 — هرگز نباید استارت را بشکند
        return False
