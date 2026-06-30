"""حلقهٔ یادگیریِ روزانه: عملکردِ پست‌ها (کامنت/تعامل) را جمع می‌کند، سبک‌های برنده را می‌سنجد،
و وزنِ سبک‌ها را در Redis ذخیره می‌کند تا video_gen به‌سمتِ برنده‌ها متمایل شود (explore/exploit)."""
from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from sqlalchemy import select, func
from src.core.database import IgContent, IgInbox
from src.core.logger import get_logger

logger = get_logger(__name__)
REDIS_KEY = "ig:style_weights"


async def collect_and_learn(days: int = 21) -> dict:
    """تعاملِ هر پستِ منتشرشده را به سبکش نسبت می‌دهد → میانگینِ سبک‌ها → Redis."""
    from src.instagram.engine import _task_db
    from src.core.redis_client import redis_client
    since = datetime.now(timezone.utc) - timedelta(days=days)
    by_style: dict[str, list[float]] = defaultdict(list)
    by_topic: dict[str, list[float]] = defaultdict(list)
    async with _task_db() as db:
        contents = (await db.execute(select(IgContent).where(
            IgContent.status == "published",
            IgContent.published_at.isnot(None),
            IgContent.published_at >= since))).scalars().all()
        for c in contents:
            spec = dict(c.video_spec or {})
            style = spec.get("style") or "cinematic"
            # پروکسیِ تعامل: تعدادِ کامنت‌های ثبت‌شده برای مدیای این پست + امتیازِ QC
            media_pks = []
            for v in (c.result or {}).values():
                if isinstance(v, dict) and v.get("media_pk"):
                    media_pks.append(str(v["media_pk"]))
            comments = 0
            if media_pks:
                comments = (await db.execute(select(func.count(IgInbox.id)).where(
                    IgInbox.kind == "comment", IgInbox.media_code.in_(media_pks)))).scalar() or 0
            score = float(comments) + float(spec.get("qc_score", 70)) / 100.0
            by_style[style].append(score)
            if c.ai_prompt:
                by_topic[c.ai_prompt[:60]].append(score)
    weights = {s: round(sum(v) / len(v), 3) for s, v in by_style.items() if v}
    topics = sorted(({"topic": t, "score": round(sum(v) / len(v), 3)} for t, v in by_topic.items() if v),
                    key=lambda x: -x["score"])[:8]
    payload = {"weights": weights, "top_topics": topics,
               "updated_at": datetime.now(timezone.utc).isoformat(), "samples": len(contents)}
    try:
        await redis_client.set(REDIS_KEY, json.dumps(payload), ex=14 * 86400)
    except Exception as e:
        logger.warning("ig_learn_redis_fail", error=str(e)[:200])
    logger.info("ig_learn_done", styles=len(weights), samples=len(contents), best=(max(weights, key=weights.get) if weights else None))
    return payload


async def best_style(default: str | None = None) -> str | None:
    """سبکِ برنده از وزن‌های ذخیره‌شده (برای exploit در video_gen)."""
    try:
        from src.core.redis_client import redis_client
        raw = await redis_client.get(REDIS_KEY)
        if not raw:
            return default
        w = (json.loads(raw) or {}).get("weights") or {}
        return max(w, key=w.get) if w else default
    except Exception:
        return default
