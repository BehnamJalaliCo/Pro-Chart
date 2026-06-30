"""بلاگ → ویدیوی سینماییِ یوتیوب (۳ تا ۸ دقیقه، مطابقِ طولِ بلاگ) + شورتِ تبلیغاتیِ همخوان.

پیپلاین (روزی ۲ بار):
  ۱) انتخابِ بلاگِ منتشرشدهٔ بی‌ویدیو (هیچ‌وقت تکراری — `video_yt_id IS NULL`).
  ۲) صحنه‌سازیِ Claude: کلِ متن به سگمنت‌ها (هر سگمنت فوتیجِ مرتبط + چند جملهٔ روایت).
  ۳) chart-renderer `/blog-video`: صدای Behnam v3 + فوتیجِ Pexels + رندرِ Remotion + تامبنیلِ واقعی.
  ۴) آپلودِ ویدیوی بلاگ در playlist «بلاگ» (توضیحاتِ کامل + لینکِ مقاله/سایت) → URL.
  ۵) آپلودِ شورت (۹:۱۶) با اشاره به ویدیوی کاملِ بلاگ (#Shorts).
  ۶) ثبتِ video_yt_id / short_yt_id / video_published_at.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

import httpx
from sqlalchemy import desc, select, text

from src.core.config import settings
from src.core.database import Article, async_session_factory
from src.core.logger import get_logger
from src.llm.client import llm_client
from src.publish import youtube

logger = get_logger(__name__)
CHART = os.environ.get("CHART_RENDERER_BASE", "http://chart-renderer:8086")
IGW = os.environ.get("IG_WORKER_BASE", "http://ig-worker:8090")
MEDIA = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")
SITE = f"https://{settings.WEBSITE_DOMAIN.lower()}"
PLAYLIST = "بلاگ آموزشی فارکس | کوین پرو FX"
SHORTS_PLAYLIST = "شورت‌های آموزشی فارکس | کوین پرو FX"

_SYS = (
    "تو کارگردان و فیلم‌نامه‌نویسِ ارشدِ ویدیوهای آموزشیِ فارکسی (سطحِ کانال‌های حرفه‌ایِ یوتیوب). "
    "کلِ متنِ بلاگ را به یک سناریوی ویدیوی روایت‌محورِ کامل و گیرا تبدیل کن که **۳ تا ۸ دقیقه** طول بکشد "
    "(مطابقِ طولِ بلاگ). اصولِ کارگردانی که باید رعایت کنی:\n"
    "۱) **هوکِ قوی** در ۲ خطِ اول: با نتیجه/مشکلِ ملموس یا یک آمارِ تکان‌دهنده شروع کن و بگو بیننده با دیدنِ ویدیو چه چیزی به‌دست می‌آورد (نه مقدمهٔ خسته‌کننده).\n"
    "۲) **قوسِ روایی**: هوک → بدنه (نکات به‌ترتیبِ منطقی، هر نکته یک قدم) → جمع‌بندیِ کاربردی → دعوت به اقدام.\n"
    "۳) **ریتمِ تند**: هر خط یک جملهٔ کوتاهِ یک‌نفسه (۸ تا ۱۴ کلمه، گفتنِ ۳ تا ۸ ثانیه). جملهٔ طولانی ممنوع.\n"
    "۴) **تنوعِ بصری (مهم‌ترین)**: ۱۰ تا ۱۶ سگمنت، هر سگمنت ۲ تا ۴ خط، و کوئریِ فوتیجِ هر سگمنت "
    "**کاملاً متفاوت و متنوع** باشد (نمودار، معامله‌گر، طلا، دفترِ کار، موبایلِ ترید، اسکناس، شمعِ قیمت، شهرِ مالی، …) "
    "تا هیچ صحنه‌ای شبیهِ صحنهٔ دیگر نباشد. مجموعِ خطوط ۳۰ تا ۵۵ (برای ۳ تا ۷ دقیقه، مطابقِ طولِ بلاگ).\n"
    "۵) **اصطلاحاتِ تخصصی به انگلیسی**: هر واژه/اصطلاحِ تخصصی که اصالتاً انگلیسی است را **عیناً به همان حروفِ انگلیسی** "
    "داخلِ جملهٔ فارسی بنویس (MACD, RSI, EMA, support, resistance, price action, stop loss, breakout, pip, leverage, spread). "
    "آوانگاریِ فارسی ممنوع — گوینده آن‌ها را انگلیسی تلفظ می‌کند. فقط واژه‌های فارسی را فارسی بنویس (تفکیکِ زبان).\n"
    "۶) خطِ آخر یک **دعوت به اقدام** (دیدنِ سایت/سابسکرایب) باشد.\n"
    "۷) **دیاگرامِ آموزشی (کلیدی‌ترین برای آموزش)**: برای هر سگمنت یک فیلدِ `visual` بگذار که "
    "**دقیقاً همان مفهومی که روایت دربارهٔ آن حرف می‌زند** را با یک کلید از این لیست مشخص کند تا روی صفحه کشیده شود "
    "(نه فوتیجِ بی‌ربط): "
    "doji, hammer, shooting_star, bullish_engulfing, bearish_engulfing, morning_star, evening_star, pin_bar, marubozu, harami, "
    "three_white_soldiers, three_black_crows, support_resistance, trendline, breakout, pullback, head_shoulders, double_top, "
    "double_bottom, ascending_triangle, bull_flag, channel, rising_wedge, fibonacci, supply_demand, risk_reward, rsi, macd, ma_cross, bollinger. "
    "اگر سگمنت مقدمه/انگیزشی/جمع‌بندی/CTA است یا به مفهومِ خاصی نگاشت نمی‌شود، `visual` را `\"generic\"` بگذار (آن صحنه فوتیجِ سینمایی می‌گیرد). "
    "تا حدِ ممکن سگمنت‌ها را حولِ این مفاهیم بچین تا بیشترِ ویدیو دیاگرامِ آموزشیِ مرتبط داشته باشد.\n"
    "خروجی فقط JSON: {\"segments\":[{\"q\":\"3-5 English words for cinematic stock footage (only used when visual=generic)\","
    "\"visual\":\"یکی از کلیدهای بالا یا generic\","
    "\"lines\":[\"جملهٔ کوتاهِ فارسیِ روانِ گفتاری\"]}],"
    "\"short\":{\"hook\":\"هوکِ خیلی کوتاهِ فارسی ۴ تا ۷ کلمه\",\"narration\":\"یک جملهٔ ۶ ثانیه‌ایِ فارسیِ گیرا برای تیزر\",\"q\":\"3-5 English footage words\"}}. "
    "همهٔ نکاتِ مهمِ بلاگ پوشش داده شوند. لحن حرفه‌ای، گرم و انگیزشی."
)


_REAL_SYMS = ["EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "EURJPY", "AUDUSD", "USDCAD", "EURGBP", "NZDUSD", "USDCHF", "AUDJPY", "EURAUD"]


async def _real_pool(db, n: int = 10, length: int = 72) -> list:
    """پنجره‌های OHLCِ واقعیِ بازار (هر کدام نمادِ متفاوت) برای رسم روی چارتِ واقعی."""
    pool = []
    for i in range(n):
        sym = _REAL_SYMS[i % len(_REAL_SYMS)]
        try:
            rows = (await db.execute(text(
                "SELECT open,high,low,close FROM candles WHERE symbol=:s AND timeframe='M5' "
                "ORDER BY time DESC LIMIT :lim OFFSET :off"), {"s": sym, "lim": length, "off": i * 35})).all()
        except Exception:  # noqa: BLE001
            break
        if len(rows) >= 60:
            pool.append([{"o": float(o), "h": float(h), "l": float(l), "c": float(c)} for (o, h, l, c) in reversed(rows)])
    return pool


async def _pick_blog(db) -> Article | None:
    return (await db.execute(
        select(Article).where(
            Article.category == "blog", Article.is_published.is_(True), Article.video_yt_id.is_(None))
        .order_by(desc(Article.published_at)).limit(1))).scalar_one_or_none()


async def _scenes(a: Article) -> dict:
    body = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", a.content or "")).strip()
    prompt = f"عنوان: {a.title}\nخلاصه: {a.summary or ''}\nمتنِ کاملِ بلاگ:\n{body[:4500]}"
    raw = None
    for attempt in range(2):  # تولیدِ سناریو سنگین است → تا ۲ بار با تایم‌اوتِ بلند
        raw = await llm_client.complete(prompt, system=_SYS, system_replace=True, timeout=300)
        if raw and "{" in raw:
            break
        logger.warning("blog_video_scenes_retry", id=a.id, attempt=attempt)
    if not raw:
        raise RuntimeError("scene generation timed out")
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise RuntimeError("scene json not found")
    return json.loads(m.group(0))


def _description(a: Article) -> str:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", a.content or "")).strip()
    parts = [a.title]
    if a.summary:
        parts.append(a.summary)
    if text:
        parts.append(text[:2400])
    parts.append("🎓 آکادمیِ کامل (تمرین، آزمون، مربیِ هوش مصنوعی): " + settings.ACADEMY_SITE_URL)
    parts.append(f"📖 متنِ کاملِ مقاله: {SITE}/article/{a.slug}")
    parts.append(f"🌐 سایت: {SITE}")
    parts.append("#فارکس #آموزش_فارکس #تحلیل_تکنیکال #پرایس_اکشن #طلا #ترید #کوین_پرو")
    return "\n\n".join(parts)[:4900]


def _story_html(title: str, thumb_url: str) -> str:
    t = (title or "").replace("<", "&lt;")
    return (
        '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>'
        '@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@700;900&display=swap");'
        '*{margin:0;box-sizing:border-box;font-family:Vazirmatn,sans-serif}html,body{width:1080px;height:1920px;overflow:hidden}'
        '.c{position:relative;width:1080px;height:1920px;background:radial-gradient(120% 80% at 50% 12%,#16203a 0%,#070a12 70%)}'
        '.glow{position:absolute;inset:0;background:radial-gradient(60% 32% at 50% 60%,rgba(255,0,0,.16),transparent 70%)}'
        '.brand{position:absolute;top:90px;left:0;right:0;text-align:center;color:#fff;font-weight:900;font-size:58px}'
        '.badge{position:absolute;top:178px;left:0;right:0;text-align:center}'
        '.badge span{display:inline-block;background:#ff0000;color:#fff;font-weight:900;font-size:38px;padding:12px 36px;border-radius:999px}'
        '.card{position:absolute;top:360px;left:90px;right:90px;height:460px;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);border:3px solid rgba(255,255,255,.12)}'
        '.card img{width:100%;height:100%;object-fit:cover}'
        '.play{position:absolute;top:360px;left:0;right:0;height:460px;display:flex;align-items:center;justify-content:center}'
        '.play div{width:150px;height:150px;border-radius:50%;background:rgba(255,0,0,.92);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 40px rgba(255,0,0,.5)}'
        '.play div::after{content:"";border-left:56px solid #fff;border-top:34px solid transparent;border-bottom:34px solid transparent;margin-left:14px}'
        '.ttl{position:absolute;top:875px;left:80px;right:80px;text-align:center;color:#fff;font-weight:900;font-size:50px;line-height:1.3;text-shadow:0 8px 30px rgba(0,0,0,.7);'
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
        '.tap{position:absolute;top:1120px;left:0;right:0;text-align:center;color:#ffd24d;font-weight:900;font-size:42px}'
        '.linkbtn{position:absolute;top:1433px;left:200px;right:200px;height:130px;background:#fff;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:16px;box-shadow:0 16px 44px rgba(0,0,0,.5)}'
        '.linkbtn .ic{font-size:50px}.linkbtn .tx{color:#15151a;font-weight:900;font-size:42px}'
        '.foot{position:absolute;bottom:80px;left:0;right:0;text-align:center;color:#8c95a6;font-weight:800;font-size:34px}'
        '</style></head><body><div class="c">'
        '<div class="brand">کوین پرو FX</div>'
        '<div class="badge"><span>🎬 ویدیوی جدیدِ یوتیوب</span></div>'
        f'<div class="card"><img src="{thumb_url}"></div><div class="play"><div></div></div>'
        f'<div class="ttl">{t}</div>'
        '<div class="tap">👇 روی این دکمه بزن</div>'
        '<div class="linkbtn"><span class="ic">🔗</span><span class="tx">ویدیوی کامل را ببین</span></div>'
        '<div class="foot">@coineprofx</div></div></body></html>'
    )


async def _post_ig_story(a: Article, blog_id: str, blog_url: str) -> dict | None:
    """خودکار: استوریِ اینستاگرام با تامبنیلِ ویدیو + استیکرِ لینکِ یوتیوب."""
    if os.environ.get("BLOG_VIDEO_IG_STORY", "true").lower() not in ("1", "true", "yes"):
        return None
    fname = f"story_bv{a.id}.jpg"
    path = os.path.join(MEDIA, fname)
    try:
        html = _story_html(a.title, f"https://img.youtube.com/vi/{blog_id}/hqdefault.jpg")
        async with httpx.AsyncClient(timeout=150) as cx:
            r = await cx.post(f"{CHART}/render-html", json={"html": html, "width": 1080, "height": 1920, "scale": 1, "format": "jpeg", "quality": 92})
            r.raise_for_status()
            with open(path, "wb") as f:
                f.write(r.content)
            # ناحیهٔ لمسیِ لینک دقیقاً روی دکمهٔ مرئیِ کشیده‌شده (مرکز 0.5, 0.78)
            rs = await cx.post(f"{IGW}/publish", json={"media": [fname], "kind": "story", "story_link": blog_url, "link_x": 0.5, "link_y": 0.78, "link_w": 0.6, "link_h": 0.12})
            rs.raise_for_status()
            res = rs.json()
        logger.info("blog_video_ig_story", id=a.id, ok=res.get("ok"), code=res.get("code"))
        return res
    except Exception as e:  # noqa: BLE001
        logger.warning("blog_video_ig_story_failed", id=a.id, error=str(e)[:200])
        return None
    finally:
        _cleanup(path)


def _cleanup(*paths) -> None:
    for p in paths:
        try:
            if p and os.path.exists(p):
                os.remove(p)
        except Exception:  # noqa: BLE001
            pass


async def run_once() -> dict:
    if not settings.BLOG_VIDEO_ENABLED:
        return {"ok": False, "reason": "disabled"}
    if not youtube.enabled():
        return {"ok": False, "reason": "youtube_disabled"}
    async with async_session_factory() as db:
        a = await _pick_blog(db)
        if not a:
            return {"ok": False, "reason": "no_unvideoed_blog"}
        slug = f"bv{a.id}"
        try:
            data = await _scenes(a)
        except Exception as e:  # noqa: BLE001
            logger.warning("blog_video_scenes_failed", id=a.id, error=str(e)[:200])
            return {"ok": False, "reason": "scenes_failed", "detail": str(e)[:200]}
        real_pool = await _real_pool(db)
        job = {"segments": data.get("segments", []), "short": data["short"], "title": a.title, "slug": slug, "site": SITE, "real_pool": real_pool}
        # ساختِ مدیا (صدا + فوتیج + رندر + تامبنیل) در chart-renderer
        try:
            async with httpx.AsyncClient(timeout=3200) as cx:
                r = await cx.post(f"{CHART}/blog-video", json=job)
                r.raise_for_status()
                res = r.json()
        except Exception as e:  # noqa: BLE001
            logger.warning("blog_video_render_failed", id=a.id, error=str(e)[:200])
            return {"ok": False, "reason": "render_failed", "detail": str(e)[:200]}
        blog_path = os.path.join(MEDIA, res["blog_file"])
        short_path = os.path.join(MEDIA, res["short_file"])
        thumb_path = os.path.join(MEDIA, res["thumb_file"]) if res.get("thumb_file") else None
        tags = (a.tags if isinstance(a.tags, list) else []) or []
        tags = list(dict.fromkeys(tags + ["فارکس", "آموزش فارکس", "تحلیل تکنیکال", "ترید"]))[:12]
        # ۱) آپلودِ ویدیوی بلاگ (playlist بلاگ + تامبنیل + توضیحاتِ کامل)
        up = await youtube.upload(blog_path, a.title, _description(a), tags, thumbnail=thumb_path, playlist_title=PLAYLIST)
        if not up.get("ok"):
            _cleanup(blog_path, short_path, thumb_path)
            return {"ok": False, "reason": "blog_upload_failed", "detail": up}
        blog_id, blog_url = up["id"], up["url"]
        # ۲) آپلودِ شورت — اشاره به ویدیوی کامل
        short_title = (a.title[:70] + " | کوین پرو FX #Shorts")
        short_desc = (f"📺 ویدیوی کاملِ این موضوع را ببین:\n{blog_url}\n\n"
                      f"🎓 آکادمی: {settings.ACADEMY_SITE_URL}\n🌐 {SITE}\n\n#Shorts #فارکس #آموزش_فارکس #طلا #ترید #کوین_پرو")
        ups = await youtube.upload(short_path, short_title, short_desc, ["فارکس", "آموزش فارکس", "شورت", "ترید"], playlist_title=SHORTS_PLAYLIST)
        short_id = ups.get("id") if ups.get("ok") else None
        # ۳) استوریِ خودکارِ اینستاگرام با دکمهٔ لینکِ کلیک‌پذیرِ ویدیو (قبل از commit تا a.title لود باشد)
        story = await _post_ig_story(a, blog_id, blog_url)
        # ۴) ثبت
        a.video_yt_id = blog_id
        a.short_yt_id = short_id
        a.video_published_at = datetime.now(timezone.utc)
        await db.commit()
        _cleanup(blog_path, short_path, thumb_path)
    logger.info("blog_video_published", slug=a.slug, blog=blog_id, short=short_id, ig_story=bool(story and story.get("ok")))
    return {"ok": True, "article": a.slug, "blog_url": blog_url, "short_id": short_id, "ig_story": (story or {}).get("url")}
