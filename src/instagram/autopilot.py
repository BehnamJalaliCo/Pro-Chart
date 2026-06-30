"""خلبانِ خودکارِ اینستاگرام — مغزِ ارسالِ اتوماتیک.
طبق زمان‌بندی، خودش موضوع را برمی‌دارد، با AI بستهٔ کامل (سناریوی ویدیو/کپشن/هشتگ/کلیدواژه) می‌سازد،
یک محتوای زمان‌بندی‌شده ایجاد می‌کند و خطِ تولیدِ موجود (ساختِ ویدیو → انتشار → اتصالِ دایرکت) بقیه را انجام می‌دهد."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.core.database import IgAutopilot, IgContent
from src.core.logger import get_logger

logger = get_logger(__name__)
TEHRAN = timezone(timedelta(hours=3, minutes=30))   # ایران (بدونِ DST)


def compute_next_run(times: list | None, after: datetime | None = None) -> datetime:
    """نزدیک‌ترین ساعتِ بعدی از فهرستِ ساعت‌ها (به وقتِ تهران) را به‌صورتِ UTC برمی‌گرداند."""
    hours = sorted({int(h) % 24 for h in (times or [10])}) or [10]
    now = (after or datetime.now(timezone.utc)).astimezone(TEHRAN)
    for h in hours:
        cand = now.replace(hour=h, minute=0, second=0, microsecond=0)
        if cand > now + timedelta(seconds=30):
            return cand.astimezone(timezone.utc)
    cand = (now + timedelta(days=1)).replace(hour=hours[0], minute=0, second=0, microsecond=0)
    return cand.astimezone(timezone.utc)


async def run_due() -> dict:
    from src.instagram.engine import _task_db
    from src.instagram.publisher import gen_full_content
    now = datetime.now(timezone.utc)
    made = 0
    async with _task_db() as db:
        aps = (await db.execute(select(IgAutopilot).where(
            IgAutopilot.enabled.is_(True),
            IgAutopilot.next_run_at.isnot(None),
            IgAutopilot.next_run_at <= now))).scalars().all()
        for ap in aps:
            try:
                # کمپین‌ها (هر مورد: موضوع+کلیدواژه+لینک+CTA)؛ فالبک به topicsِ قدیمی
                campaigns = [c for c in (ap.campaigns or []) if isinstance(c, dict) and str(c.get("topic", "")).strip()]
                if not campaigns:
                    campaigns = [{"topic": str(t).strip(), "keyword": ap.auto_keyword, "link": ap.auto_link, "cta": "dm"}
                                 for t in (ap.topics or []) if str(t).strip()]
                if not campaigns:
                    # ۸ ستونِ پیش‌فرضِ محتوای فارکس (وقتی موضوعی تنظیم نشده) — روتیشن برای تنوع
                    campaigns = [{"topic": t, "keyword": "فارکس", "link": ap.auto_link, "cta": "comment"} for t in [
                        "بریفِ روزانهٔ بازار: طلا و جفت‌ارزهای مهم و سطوحِ کلیدی امروز",
                        "کالبدشکافیِ یک ترید: ورود، استاپ و حدِ سود روی طلا یا یورودلار",
                        "مدیریتِ ریسک: قانونِ دو درصد و چرا حساب‌ها می‌سوزند",
                        "روان‌شناسیِ معامله: ترسِ از دست دادن و ترید انتقامی",
                        "افسانه‌زدایی: آیا اندیکاتورها واقعاً پولدارت می‌کنند؟",
                        "واکنش به خبر: چطور دور و برِ NFP و جلساتِ فدرال‌رزرو ترید کنیم",
                        "آموزشِ ساده: اسپرد، پیپ و لوریج به زبانِ خودمونی",
                        "پنج اشتباهِ رایجِ تریدرهای تازه‌کار در فارکس",
                    ]]
                types = [t for t in (ap.post_types or []) if t] or ["reel"]
                if not campaigns:
                    ap.next_run_at = compute_next_run(ap.times)
                    continue
                camp = campaigns[(ap.topic_cursor or 0) % len(campaigns)]
                topic = str(camp.get("topic")).strip()
                keyword = (camp.get("keyword") or "").strip() or None
                link = (camp.get("link") or "").strip() or ap.auto_link
                cta = camp.get("cta") or "dm"
                ptype = types[(ap.type_cursor or 0) % len(types)]
                plan = await gen_full_content(topic, ptype, keyword=keyword, cta=cta) if (ap.caption_ai or ap.gen_video) else {}
                caption = plan.get("caption") or topic
                c = IgContent(
                    account_ids=ap.account_ids or [],
                    post_type=ptype, title=(plan.get("title") or topic)[:255],
                    caption=caption, hashtags=plan.get("hashtags"),
                    ai_prompt=topic, source="autopilot",
                    gen_video=bool(ap.gen_video),
                    video_prompt=(plan.get("video_prompt") or topic) if ap.gen_video else None,
                    video_status="pending" if ap.gen_video else None,
                    video_spec=ap.video_spec or {},
                    auto_reply_keyword=(keyword or plan.get("keyword")),
                    auto_reply_link=link,
                    auto_reply_text=ap.auto_reply_text or plan.get("reply_text"),
                    mode="schedule", status="scheduled", scheduled_at=now,
                )
                db.add(c)
                ap.topic_cursor = (ap.topic_cursor or 0) + 1
                ap.type_cursor = (ap.type_cursor or 0) + 1
                ap.made_count = (ap.made_count or 0) + 1
                ap.last_run_at = now
                ap.next_run_at = compute_next_run(ap.times)
                made += 1
                logger.info("ig_autopilot_made", autopilot=ap.id, topic=topic, keyword=keyword, type=ptype)
            except Exception as e:
                logger.warning("ig_autopilot_item_failed", autopilot=ap.id, error=str(e)[:200])
                ap.next_run_at = compute_next_run(ap.times)
        await db.commit()
    return {"made": made}
