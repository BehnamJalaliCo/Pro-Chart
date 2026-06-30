"""تولیدِ خودکارِ ویدیوی اینستاگرام: Claude سناریو می‌سازد → chart-renderer ویدیوی عمودی را
با صدای ElevenLabs + زیرنویس + موزیک می‌سازد → media_urls در IgContent ست می‌شود."""
from __future__ import annotations

import json
import os
import re

import httpx
from sqlalchemy import select

from src.core.database import IgContent
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger(__name__)
CHART_BASE = os.environ.get("CHART_RENDERER_BASE", "http://chart-renderer:8086")

# اصولِ کارگردانی از avatar_work/EDIT_PLAYBOOK.md (تحقیقِ CapCut/Reels 2026) استخراج شده.
_SYS = (
    "تو کارگردانِ ویدیوهای کوتاهِ اینستاگرامِ پیجِ CoinePro (آموزشِ فارکس) هستی. "
    "از پرامپتِ کاربر یک سناریوی ۴ تا ۶ صحنه‌ای بساز. خروجی فقط JSON باشد، بدونِ توضیح. "
    "قالب: {\"scenes\":[{\"kicker\":\"۲ تا ۳ کلمه\",\"spoken\":\"۱ جملهٔ روایتِ فارسیِ خودمونی و روان برای صداگذاری\",\"bg_query\":\"3-6 English words describing cinematic stock FOOTAGE for this scene (forex/trading/gold/finance imagery, NO crypto)\",\"count\":<عددِ آمار اگر صحنه آماری‌ست وگرنه حذف>,\"unit\":\"واحدِ عدد مثل: درصد ضرر\"}]}. "
    "هر صحنه حتماً bg_query داشته باشد (فوتیجِ فارکس/طلا/معامله، بدونِ کریپتو). در صحنهٔ CTA، کلیدواژهٔ کامنت را داخلِ «» بگذار (مثل «آکادمی») تا برجسته شود. "
    # قاعدهٔ سختِ برند:
    "موضوع فقط «فارکس» است (جفت‌ارز، طلا/XAUUSD، شاخصِ دلار، سشن‌ها، اخبارِ اقتصادی، مدیریتِ ریسک، روان‌شناسی). "
    "هیچ اشاره‌ای به کریپتو/بیت‌کوین/کوین نکن. "
    # هوک و ساختار (Dynamic Minimalism):
    "صحنهٔ اول در ۳ ثانیهٔ اول یک قلابِ قویِ ۴ تا ۷ کلمه‌ای باشد (آمارِ شوک، افسانه‌زدایی، یا اشتباهِ رایج)، "
    "بعد یک ایدهٔ واحد را در ۲ تا ۳ ضرب باز کن، و صحنهٔ آخر CTA به تلگرام/VIP باشد. "
    "هر spoken کوتاه (حداکثر ۱۲ کلمه) و کلِ ویدیو فقط ۴ تا ۵ صحنه و حدودِ ۲۰ تا ۲۵ ثانیه باشد. "
    "کپشن‌ها کوتاه و ضربتی (۲ تا ۳ کلمه)، لحن حرفه‌ای و گرم و قاطع. "
    # تلفظِ TTS:
    "در فیلدِ spoken، برند و واژگانِ لاتین را لاتین بنویس تا صدا درست تلفظ شود: CoinePro، Forex، spread، leverage. "
    # اعتماد:
    "هرگز وعدهٔ سودِ تضمینی نده و ریسک را هم یادآوری کن. اعداد را درست بنویس. هیچ لینکی داخلِ متن نگذار."
)


# QCِ خودکار: ناظرِ کیفیت (کارگردان + مهندسِ ادیت) سناریو را نمره می‌دهد؛ زیرِ ۷۰ → یک اصلاح
_QC_SYS = (
    "تو ناظرِ کیفیتِ سخت‌گیرِ ریلزِ فارکس هستی (کارگردانِ اسکار + مهندسِ کپ‌کات). سناریوی JSON را ارزیابی کن: "
    "قلابِ قویِ ۳ثانیه، یک ایدهٔ واضح، CTAِ روشن، زبانِ خودمونی نه رسمی، کاملاً فارکس و بدونِ هیچ کریپتو، "
    "صحنه‌ها bg_query داشته باشند. فقط JSON: {\"score\":0..100,\"fix_hint\":\"یک جملهٔ کوتاهِ راهنمای اصلاح\"}"
)


async def _qc_scenes(scenes: list[dict]) -> tuple[int, str]:
    try:
        raw = await llm_client.complete(json.dumps({"scenes": scenes}, ensure_ascii=False),
                                        system=_QC_SYS, system_replace=True, timeout=60)
        m = re.search(r"\{.*\}", raw, re.S)
        d = json.loads(m.group(0) if m else raw)
        return int(d.get("score", 100)), (d.get("fix_hint") or "")
    except Exception:
        return 100, ""   # fail-open: QC نباید تولید را متوقف کند


def _parse_scenes(raw: str) -> list[dict]:
    if not raw:
        return []
    m = re.search(r"\{.*\}", raw, re.S)
    try:
        data = json.loads(m.group(0) if m else raw)
    except Exception:
        return []
    out = []
    for s in (data.get("scenes") or []):
        spoken = (s.get("spoken") or s.get("caption") or "").strip()
        if not spoken:
            continue
        sc = {"kicker": (s.get("kicker") or "").strip()[:40],
              "spoken": spoken[:320],
              "bg_query": (s.get("bg_query") or "forex trading chart screen finance").strip()[:80]}
        try:
            if s.get("count") not in (None, "", 0):
                sc["count"] = int(float(s["count"]))
                sc["unit"] = (s.get("unit") or "").strip()[:30]
        except Exception:
            pass
        out.append(sc)
    return out[:5]   # ریلزِ کوتاه (۴–۵ صحنه، ~۲۰–۲۵s) → رِندرِ سریع‌تر


def _ratio_for(post_type: str, spec: dict) -> str:
    if spec.get("ratio"):
        return spec["ratio"]
    return "9:16" if (post_type or "").lower() in ("reel", "story") else "4:5"


async def generate_video(content_id: int, db) -> dict:
    c = (await db.execute(select(IgContent).where(IgContent.id == content_id))).scalar_one_or_none()
    if not c:
        return {"error": "not found"}
    spec = dict(c.video_spec or {})
    prompt = (c.video_prompt or c.ai_prompt or c.caption or c.title or "").strip()
    if not prompt:
        c.video_status = "failed"; await db.commit()
        return {"error": "no prompt"}
    c.video_status = "generating"; await db.commit()
    if (c.post_type or "").lower() in ("carousel", "album"):
        return await _generate_carousel(c, content_id, spec, prompt, db)
    try:
        raw = await llm_client.complete(prompt, system=_SYS, system_replace=True, timeout=120)
        scenes = _parse_scenes(raw)
        if not scenes:
            raise RuntimeError("scene generation failed")
        # QC: اگر کیفیتِ سناریو پایین بود، یک‌بار با راهنمای ناظر اصلاح کن
        qc_score, qc_hint = await _qc_scenes(scenes)
        if qc_score < 70:
            try:
                raw2 = await llm_client.complete(prompt + f"\n\nسناریو ضعیف بود؛ این را اصلاح کن: {qc_hint}",
                                                 system=_SYS, system_replace=True, timeout=120)
                s2 = _parse_scenes(raw2)
                if s2:
                    scenes = s2
                    logger.info("ig_video_qc_revised", content_id=content_id, score=qc_score)
            except Exception:
                pass
        spec["qc_score"] = qc_score
        # روتیشنِ سبک/موزیک با content_id → هر ویدیو ۱۰۰٪ با قبلی فرق می‌کند (خواستهٔ مالک)
        _STYLES = ["cinematic", "hype", "moody", "minimal", "news", "warm", "vibrant", "noir"]
        _MOODS = ["uplifting", "energetic", "corporate", "cinematic", "calm", "tense"]
        # explore/exploit: هر ۳ ویدیو یک‌بار سبکِ برندهٔ یادگیری، بقیه روتیشن (تنوع)
        from src.instagram.learn import best_style
        chosen_style = spec.get("style")
        if not chosen_style and content_id % 3 == 0:
            chosen_style = await best_style()
        job = {
            "slug": f"c{content_id}",
            "style": chosen_style or _STYLES[content_id % len(_STYLES)],
            "music_mood": spec.get("music_mood") or _MOODS[content_id % len(_MOODS)],
            "seed": content_id,
            "voice_id": spec.get("voice"),
            "narration_file": spec.get("narration_file"),
            "scenes": scenes,
        }
        async with httpx.AsyncClient(timeout=2700) as cl:   # رِندرِ CPU تا ۴۵ دقیقه
            r = await cl.post(f"{CHART_BASE}/reel", json=job)   # موتورِ سطح‌جهانیِ نو
            r.raise_for_status()
            res = r.json()
        fname = res.get("file")
        if not fname:
            raise RuntimeError("no file from renderer")
        c.media_urls = [fname]
        spec["scenes"] = scenes
        spec["duration"] = res.get("duration")
        c.video_spec = spec
        c.video_status = "ready"
        await db.commit()
        logger.info("ig_video_generated", content_id=content_id, file=fname, scenes=len(scenes))
        return {"ok": True, "file": fname, "scenes": len(scenes)}
    except Exception as e:
        c.video_status = "failed"
        await db.commit()
        logger.warning("ig_video_failed", content_id=content_id, error=str(e)[:300])
        return {"error": str(e)[:300]}


_CAR_SYS = (
    "تو طراحِ پستِ اسلایدیِ (کاروسلِ) فارکسِ پیجِ CoinePro هستی. از موضوع، ۵ تا ۷ اسلاید بساز. "
    "خروجی فقط JSON: {\"style\":\"cinematic|warm|minimal|vibrant\",\"slides\":[{\"kind\":\"cover|point|stat|cta\","
    "\"kicker\":\"۱ تا ۳ کلمه\",\"title\":\"تیترِ کوتاه\",\"body\":\"توضیحِ ۱ تا ۲ خطی\",\"num\":\"عددِ آمار اگر stat\",\"unit\":\"واحد\"}]}. "
    "اسلایدِ ۱ = cover با قلابِ قوی. آخرین = cta با دعوت به فالو/کامنت. فقط فارکس، هیچ کریپتو. لحنِ خودمونی."
)


async def _generate_carousel(c, content_id, spec, prompt, db) -> dict:
    try:
        raw = await llm_client.complete(prompt, system=_CAR_SYS, system_replace=True, timeout=120)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0) if m else raw)
        slides = [s for s in (data.get("slides") or []) if s.get("title") or s.get("num")][:8]
        if not slides:
            raise RuntimeError("carousel slide generation failed")
        _STYLES = ["cinematic", "warm", "minimal", "vibrant", "moody", "hype"]
        job = {"slug": f"car{content_id}", "style": data.get("style") or _STYLES[content_id % len(_STYLES)], "slides": slides}
        async with httpx.AsyncClient(timeout=300) as cl:
            r = await cl.post(f"{CHART_BASE}/carousel", json=job)
            r.raise_for_status()
            res = r.json()
        files = res.get("files") or []
        if not files:
            raise RuntimeError("no carousel files")
        c.media_urls = files
        spec["slides"] = slides; c.video_spec = spec
        c.video_status = "ready"; await db.commit()
        logger.info("ig_carousel_generated", content_id=content_id, slides=len(files))
        return {"ok": True, "files": files, "slides": len(files)}
    except Exception as e:
        c.video_status = "failed"; await db.commit()
        logger.warning("ig_carousel_failed", content_id=content_id, error=str(e)[:300])
        return {"error": str(e)[:300]}


async def generate_pending(limit: int = 2) -> dict:
    """محتواهایی که gen_video روشن و هنوز ویدیو ندارند را می‌سازد (دستهٔ کوچک — سنگین)."""
    from src.instagram.engine import _task_db
    done = 0
    async with _task_db() as db:
        rows = (await db.execute(select(IgContent).where(
            IgContent.gen_video.is_(True),
            IgContent.video_status.in_(["pending", None])).limit(limit))).scalars().all()
        for c in rows:
            await generate_video(c.id, db)
            done += 1
    return {"generated": done}
