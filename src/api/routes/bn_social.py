"""سوشالِ سراسریِ Pro-Chart — پست/cashtag/سنتیمنت/فالو/پروفایلِ تریدر/لیدربورد.

جدا از کامیونیتیِ داخلیِ آکادمی (تصمیمِ مالک). به سبکِ TradingView/StockTwits/eToro.
احراز: current_student. ذخیره: جداول bn_posts/bn_post_likes/bn_follows/bn_post_reports/bn_mutes.
"""
from __future__ import annotations

import re
import base64
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

_CASHTAG = re.compile(r"\$([A-Za-z][A-Za-z0-9]{0,15})")
_EDIT_WINDOW = timedelta(minutes=15)
_MAX_BODY = 560


def _now():
    return datetime.now(timezone.utc)


def _cashtags(body: str) -> list[str]:
    return list(dict.fromkeys(m.group(1).upper() for m in _CASHTAG.finditer(body or "")))[:10]


def _display_name(st) -> str:
    u = st.username or f"user{st.id}"
    if u.startswith("central-") or u.startswith("student-"):
        return f"trader{st.id}"
    return u


async def _rate_ok(sid: int, bucket: str, limit: int, per_sec: int) -> bool:
    try:
        from src.core.redis_client import redis_client
        k = f"bn:social:rl:{bucket}:{sid}"
        n = await redis_client.client.incr(k)
        if n == 1:
            await redis_client.client.expire(k, per_sec)
        return int(n) <= limit
    except Exception:  # noqa: BLE001
        return True


async def _post_row(db, row, me_id: int) -> dict:
    liked = False
    if me_id:
        liked = bool((await db.execute(text(
            "SELECT 1 FROM bn_post_likes WHERE post_id=:p AND student_id=:s"),
            {"p": row.id, "s": me_id})).first())
    return {
        "id": row.id, "kind": row.kind, "body": row.body,
        "symbol": row.symbol, "symbols": row.symbols or [], "sentiment": row.sentiment,
        "signal": row.signal, "image_url": row.image_url,
        "likes": row.likes_count, "replies": row.replies_count, "liked": liked,
        "reply_to": row.reply_to,
        "author": {"id": row.author_id, "name": row.author_name, "tier": row.tier},
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "edited_at": row.edited_at.isoformat() if row.edited_at else None,
        "disclaimer": "این محتوا توصیهٔ مالی نیست.",
    }


_FEED_SELECT = (
    "SELECT p.*, s.username AS author_name, s.tier AS tier "
    "FROM bn_posts p JOIN academy_students s ON s.id=p.author_id "
    "WHERE p.deleted=false AND p.reply_to IS NULL "
)


@router.post("/post")
async def create_post(payload: dict = Body(...),
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    body = (payload.get("body") or "").strip()
    if not body:
        raise HTTPException(400, "متنِ پست خالی است.")
    if len(body) > _MAX_BODY:
        raise HTTPException(400, f"حداکثر {_MAX_BODY} کاراکتر.")
    if not await _rate_ok(st.id, "post", 6, 60):
        raise HTTPException(429, "خیلی سریع پست می‌فرستی؛ کمی صبر کن.")
    kind = payload.get("kind") if payload.get("kind") in ("mind", "idea") else "mind"
    sentiment = payload.get("sentiment") if payload.get("sentiment") in ("bull", "bear") else None
    signal = payload.get("signal") if isinstance(payload.get("signal"), dict) else None
    image_url = (payload.get("image_url") or None)
    reply_to = payload.get("reply_to")
    tags = _cashtags(body)
    if payload.get("symbol"):
        s0 = str(payload["symbol"]).upper()
        if s0 not in tags:
            tags = [s0] + tags
    primary = tags[0] if tags else None
    import json as _json
    row = (await db.execute(text(
        "INSERT INTO bn_posts (author_id, kind, body, symbol, symbols, sentiment, signal, image_url, reply_to) "
        "VALUES (:a,:k,:b,:sym,CAST(:syms AS jsonb),:sent,CAST(:sig AS jsonb),:img,:rt) RETURNING id, created_at"),
        {"a": st.id, "k": kind, "b": body, "sym": primary, "syms": _json.dumps(tags),
         "sent": sentiment, "sig": _json.dumps(signal) if signal else None, "img": image_url,
         "rt": int(reply_to) if reply_to else None})).first()
    if reply_to:
        await db.execute(text("UPDATE bn_posts SET replies_count=replies_count+1 WHERE id=:p"), {"p": int(reply_to)})
    await db.commit()
    return {"ok": True, "id": row.id, "symbols": tags, "created_at": row.created_at.isoformat()}


@router.get("/feed")
async def feed(scope: str = "latest", symbol: str = "", cursor: int = 0, limit: int = 20,
               st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    limit = max(1, min(int(limit or 20), 50))
    params = {"lim": limit}
    where = ""
    if cursor:
        where += " AND p.id < :cur "; params["cur"] = int(cursor)
    # mute
    where += (" AND p.author_id NOT IN (SELECT CAST(target AS integer) FROM bn_mutes "
              "WHERE student_id=:me AND target_type='user') ")
    params["me"] = st.id
    if scope == "symbol" and symbol:
        where += " AND p.symbol=:sym "; params["sym"] = symbol.upper()
    elif scope == "home":
        where += (" AND (p.author_id IN (SELECT CAST(target AS integer) FROM bn_follows "
                  "WHERE follower_id=:me AND target_type='user') "
                  "OR p.symbol IN (SELECT target FROM bn_follows WHERE follower_id=:me AND target_type='symbol')) ")
    q = _FEED_SELECT + where + " ORDER BY p.id DESC LIMIT :lim"
    rows = (await db.execute(text(q), params)).all()
    if scope == "home" and not rows and not cursor:
        rows = (await db.execute(text(_FEED_SELECT + " AND p.id < :cur ORDER BY p.id DESC LIMIT :lim"
                                      if cursor else _FEED_SELECT + " ORDER BY p.id DESC LIMIT :lim"),
                                 {"lim": limit, **({"cur": cursor} if cursor else {})})).all()
    items = [await _post_row(db, r, st.id) for r in rows]
    return {"scope": scope, "symbol": symbol.upper() if symbol else None,
            "posts": items, "next_cursor": items[-1]["id"] if items else None}


@router.get("/post/{pid}")
async def get_post(pid: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text(_FEED_SELECT.replace("AND p.reply_to IS NULL ", "") + " AND p.id=:pid"),
                            {"pid": pid})).first()
    if not row:
        raise HTTPException(404, "پست یافت نشد.")
    post = await _post_row(db, row, st.id)
    replies = (await db.execute(text(
        "SELECT p.*, s.username AS author_name, s.tier AS tier FROM bn_posts p JOIN academy_students s ON s.id=p.author_id "
        "WHERE p.reply_to=:pid AND p.deleted=false ORDER BY p.id ASC LIMIT 100"), {"pid": pid})).all()
    post["thread"] = [await _post_row(db, r, st.id) for r in replies]
    return post


@router.patch("/post/{pid}")
async def edit_post(pid: int, payload: dict = Body(...),
                    st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text("SELECT author_id, created_at FROM bn_posts WHERE id=:p AND deleted=false"),
                            {"p": pid})).first()
    if not row:
        raise HTTPException(404, "پست یافت نشد.")
    if row.author_id != st.id:
        raise HTTPException(403, "فقط نویسنده می‌تواند ویرایش کند.")
    if _now() - row.created_at > _EDIT_WINDOW:
        raise HTTPException(403, "مهلتِ ۱۵ دقیقه‌ایِ ویرایش گذشته است.")
    body = (payload.get("body") or "").strip()
    if not body or len(body) > _MAX_BODY:
        raise HTTPException(400, "متنِ نامعتبر.")
    sentiment = payload.get("sentiment") if payload.get("sentiment") in ("bull", "bear", None) else None
    import json as _json
    tags = _cashtags(body)
    await db.execute(text("UPDATE bn_posts SET body=:b, symbols=CAST(:syms AS jsonb), symbol=:sym, "
                          "sentiment=:sent, edited_at=now() WHERE id=:p"),
                     {"b": body, "syms": _json.dumps(tags), "sym": tags[0] if tags else None,
                      "sent": sentiment, "p": pid})
    await db.commit()
    return {"ok": True}


@router.delete("/post/{pid}")
async def delete_post(pid: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text("SELECT author_id FROM bn_posts WHERE id=:p"), {"p": pid})).first()
    if not row:
        raise HTTPException(404, "پست یافت نشد.")
    if row.author_id != st.id:
        raise HTTPException(403, "فقط نویسنده می‌تواند حذف کند.")
    await db.execute(text("UPDATE bn_posts SET deleted=true WHERE id=:p"), {"p": pid})
    await db.commit()
    return {"ok": True}


@router.post("/post/{pid}/like")
async def toggle_like(pid: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    ex = (await db.execute(text("SELECT 1 FROM bn_post_likes WHERE post_id=:p AND student_id=:s"),
                           {"p": pid, "s": st.id})).first()
    if ex:
        await db.execute(text("DELETE FROM bn_post_likes WHERE post_id=:p AND student_id=:s"), {"p": pid, "s": st.id})
        await db.execute(text("UPDATE bn_posts SET likes_count=GREATEST(likes_count-1,0) WHERE id=:p"), {"p": pid})
        liked = False
    else:
        await db.execute(text("INSERT INTO bn_post_likes (post_id, student_id) VALUES (:p,:s) ON CONFLICT DO NOTHING"),
                         {"p": pid, "s": st.id})
        await db.execute(text("UPDATE bn_posts SET likes_count=likes_count+1 WHERE id=:p"), {"p": pid})
        liked = True
    await db.commit()
    cnt = (await db.execute(text("SELECT likes_count FROM bn_posts WHERE id=:p"), {"p": pid})).scalar()
    return {"ok": True, "liked": liked, "likes": cnt or 0}


@router.post("/post/{pid}/report")
async def report_post(pid: int, payload: dict = Body(default={}),
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    await db.execute(text("INSERT INTO bn_post_reports (post_id, reporter_id, reason) VALUES (:p,:s,:r)"),
                     {"p": pid, "s": st.id, "r": (payload.get("reason") or "")[:200]})
    await db.commit()
    return {"ok": True}


@router.get("/symbol/{symbol}/sentiment")
async def symbol_sentiment(symbol: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    sym = symbol.upper()
    since = _now() - timedelta(days=7)
    rows = (await db.execute(text(
        "SELECT sentiment, count(*) c FROM bn_posts WHERE symbol=:sym AND deleted=false AND created_at>:since "
        "GROUP BY sentiment"), {"sym": sym, "since": since})).all()
    bull = bear = neutral = 0
    for r in rows:
        if r.sentiment == "bull": bull = r.c
        elif r.sentiment == "bear": bear = r.c
        else: neutral += r.c
    total = bull + bear + neutral
    score = round((bull / (bull + bear) * 100)) if (bull + bear) else 50
    return {"symbol": sym, "bull": bull, "bear": bear, "neutral": neutral, "total": total,
            "score": score, "window_days": 7}


@router.post("/follow")
async def toggle_follow(payload: dict = Body(...),
                        st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tt = payload.get("target_type")
    if tt not in ("user", "symbol"):
        raise HTTPException(400, "target_type باید user یا symbol باشد.")
    target = str(payload.get("target") or "").strip()
    if tt == "symbol":
        target = target.upper()
    if not target:
        raise HTTPException(400, "target لازم است.")
    if tt == "user" and target == str(st.id):
        raise HTTPException(400, "نمی‌توانی خودت را دنبال کنی.")
    ex = (await db.execute(text("SELECT 1 FROM bn_follows WHERE follower_id=:f AND target_type=:t AND target=:g"),
                           {"f": st.id, "t": tt, "g": target})).first()
    if ex:
        await db.execute(text("DELETE FROM bn_follows WHERE follower_id=:f AND target_type=:t AND target=:g"),
                         {"f": st.id, "t": tt, "g": target})
        following = False
    else:
        await db.execute(text("INSERT INTO bn_follows (follower_id, target_type, target) VALUES (:f,:t,:g) "
                              "ON CONFLICT DO NOTHING"), {"f": st.id, "t": tt, "g": target})
        following = True
    await db.commit()
    return {"ok": True, "following": following, "target_type": tt, "target": target}


@router.get("/following")
async def my_following(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("SELECT target_type, target FROM bn_follows WHERE follower_id=:f"),
                             {"f": st.id})).all()
    return {"users": [r.target for r in rows if r.target_type == "user"],
            "symbols": [r.target for r in rows if r.target_type == "symbol"]}


@router.get("/trader/{tid}")
async def trader_profile(tid: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(text("SELECT id, username, tier, created_at FROM academy_students WHERE id=:t"),
                          {"t": tid})).first()
    if not s:
        raise HTTPException(404, "کاربر یافت نشد.")
    posts = (await db.execute(text("SELECT count(*) FROM bn_posts WHERE author_id=:t AND deleted=false"), {"t": tid})).scalar()
    followers = (await db.execute(text("SELECT count(*) FROM bn_follows WHERE target_type='user' AND target=:t"),
                                  {"t": str(tid)})).scalar()
    following = (await db.execute(text("SELECT count(*) FROM bn_follows WHERE follower_id=:t AND target_type='user'"),
                                  {"t": tid})).scalar()
    likes = (await db.execute(text("SELECT COALESCE(SUM(likes_count),0) FROM bn_posts WHERE author_id=:t AND deleted=false"),
                              {"t": tid})).scalar()
    me_follows = bool((await db.execute(text(
        "SELECT 1 FROM bn_follows WHERE follower_id=:me AND target_type='user' AND target=:t"),
        {"me": st.id, "t": str(tid)})).first())
    recent = (await db.execute(text(_FEED_SELECT + " AND p.author_id=:t ORDER BY p.id DESC LIMIT 20"),
                               {"t": tid})).all()
    sig_rows = (await db.execute(text(
        "SELECT signal FROM bn_posts WHERE author_id=:t AND deleted=false AND signal IS NOT NULL LIMIT 500"),
        {"t": tid})).all()
    rrs = []
    for r in sig_rows:
        sg = r.signal or {}
        try:
            e = float(sg.get("entry")); tp = float(sg.get("target")); sl = float(sg.get("stop"))
            if abs(e - sl) > 0:
                rrs.append(abs(tp - e) / abs(e - sl))
        except Exception:  # noqa: BLE001
            pass
    avg_rr = round(sum(rrs) / len(rrs), 2) if rrs else None
    sent = (await db.execute(text(
        "SELECT sentiment, count(*) c FROM bn_posts WHERE author_id=:t AND deleted=false GROUP BY sentiment"),
        {"t": tid})).all()
    bull = sum(r.c for r in sent if r.sentiment == "bull"); bear = sum(r.c for r in sent if r.sentiment == "bear")
    bull_ratio = round(bull / (bull + bear) * 100) if (bull + bear) else None
    if avg_rr is None:
        risk_score = None
    else:
        risk_score = 2 if avg_rr >= 3 else 3 if avg_rr >= 2 else 4 if avg_rr >= 1.5 else 5 if avg_rr >= 1 else 6
    weeks = (await db.execute(text(
        "SELECT to_char(date_trunc('week', created_at),'YYYY-MM-DD') w, count(*) c FROM bn_posts "
        "WHERE author_id=:t AND deleted=false AND created_at > now() - interval '84 days' GROUP BY w ORDER BY w"),
        {"t": tid})).all()
    stats = {
        "copiers": followers or 0,
        "signals_posted": len(sig_rows), "avg_rr": avg_rr, "risk_score": risk_score,
        "bull_ratio_pct": bull_ratio,
        "likes_per_post": round((likes or 0) / posts, 1) if posts else 0,
        "activity_12w": [{"week": r.w, "posts": r.c} for r in weeks],
    }
    return {
        "id": s.id, "name": _display_name(s), "tier": s.tier,
        "joined": s.created_at.isoformat() if s.created_at else None,
        "posts": posts or 0, "followers": followers or 0, "following": following or 0,
        "likes_received": int(likes or 0), "me_follows": me_follows,
        "stats": stats,
        "recent_posts": [await _post_row(db, r, st.id) for r in recent],
    }


@router.get("/leaderboard")
async def leaderboard(metric: str = Query("followers"), limit: int = 20,
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    limit = max(1, min(int(limit or 20), 50))
    if metric == "posts":
        rows = (await db.execute(text(
            "SELECT s.id, s.username, s.tier, count(p.id) AS m FROM academy_students s "
            "JOIN bn_posts p ON p.author_id=s.id AND p.deleted=false GROUP BY s.id ORDER BY m DESC LIMIT :l"),
            {"l": limit})).all()
    elif metric == "likes":
        rows = (await db.execute(text(
            "SELECT s.id, s.username, s.tier, COALESCE(SUM(p.likes_count),0) AS m FROM academy_students s "
            "JOIN bn_posts p ON p.author_id=s.id AND p.deleted=false GROUP BY s.id ORDER BY m DESC LIMIT :l"),
            {"l": limit})).all()
    else:  # followers
        rows = (await db.execute(text(
            "SELECT s.id, s.username, s.tier, count(f.*) AS m FROM academy_students s "
            "JOIN bn_follows f ON f.target_type='user' AND f.target=CAST(s.id AS varchar) "
            "GROUP BY s.id ORDER BY m DESC LIMIT :l"), {"l": limit})).all()
    return {"metric": metric, "leaders": [
        {"id": r.id, "name": _display_name(r), "tier": r.tier, "value": int(r.m)} for r in rows]}


@router.post("/mute")
async def mute(payload: dict = Body(...),
               st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tt = payload.get("target_type")
    if tt not in ("user", "symbol"):
        raise HTTPException(400, "target_type نامعتبر.")
    target = str(payload.get("target") or "").strip()
    target = target.upper() if tt == "symbol" else target
    if not target:
        raise HTTPException(400, "target لازم است.")
    await db.execute(text("INSERT INTO bn_mutes (student_id, target_type, target) VALUES (:s,:t,:g) "
                          "ON CONFLICT DO NOTHING"), {"s": st.id, "t": tt, "g": target})
    await db.commit()
    return {"ok": True}


# ── آپلودِ تصویر (برای پست‌ها) ──
_MAX_IMG = 2_000_000

@router.post("/upload")
async def upload_image(payload: dict = Body(...),
                       st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    ct = (payload.get("content_type") or "image/jpeg").lower()[:40]
    if not ct.startswith("image/"):
        raise HTTPException(400, "فقط تصویر مجاز است.")
    b64 = payload.get("data_b64") or ""
    if isinstance(b64, str) and b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "دادهٔ تصویر نامعتبر است.")
    if not raw or len(raw) > _MAX_IMG:
        raise HTTPException(400, f"حجمِ تصویر باید تا {_MAX_IMG // 1000}KB باشد.")
    if not await _rate_ok(st.id, "upload", 20, 3600):
        raise HTTPException(429, "تعدادِ آپلود زیاد است.")
    row = (await db.execute(text(
        "INSERT INTO bn_images (student_id, content_type, data, bytes) VALUES (:s,:c,:d,:b) RETURNING id"),
        {"s": st.id, "c": ct, "d": raw, "b": len(raw)})).first()
    await db.commit()
    return {"ok": True, "id": row.id, "url": f"/academy/bn/social/image/{row.id}", "bytes": len(raw)}


@router.get("/image/{iid}")
async def get_image(iid: int, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text("SELECT content_type, data FROM bn_images WHERE id=:i"), {"i": iid})).first()
    if not row:
        raise HTTPException(404, "تصویر یافت نشد.")
    return Response(content=bytes(row.data), media_type=row.content_type,
                    headers={"Cache-Control": "public, max-age=31536000"})


# ── discover: کشفِ تریدرها/پست‌ها با سورت ──
@router.get("/discover")
async def discover(sort: str = "trending", limit: int = 20, cursor: int = 0,
                   st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    limit = max(1, min(int(limit or 20), 50))
    params = {"lim": limit}
    where = "WHERE p.deleted=false AND p.reply_to IS NULL "
    if cursor:
        where += "AND p.id < :cur "; params["cur"] = int(cursor)
    if sort == "new":
        order = "p.id DESC"
    elif sort == "top":
        order = "p.likes_count DESC, p.id DESC"
    else:  # trending: امتیازِ تازگی+تعامل (۷۲ ساعتِ اخیر وزن‌دار)
        order = ("(p.likes_count*3 + p.replies_count*2 + "
                 "GREATEST(0, 72 - EXTRACT(EPOCH FROM (now()-p.created_at))/3600)) DESC, p.id DESC")
    q = ("SELECT p.*, s.username AS author_name, s.tier AS tier FROM bn_posts p "
         "JOIN academy_students s ON s.id=p.author_id " + where + f" ORDER BY {order} LIMIT :lim")
    rows = (await db.execute(text(q), params)).all()
    items = [await _post_row(db, r, st.id) for r in rows]
    return {"sort": sort, "posts": items, "next_cursor": items[-1]["id"] if items else None}
