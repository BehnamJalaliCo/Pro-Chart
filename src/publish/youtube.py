"""آپلودِ ویدیو در یوتیوب با YouTube Data API v3 (با httpx خام — بدونِ libِ سنگین).

احراز: OAuth2 با refresh token (مالک یک‌بار Authorize می‌کند → refresh_token در .env).
امکانات: آپلودِ resumable، یافتن/ساختِ playlist و افزودنِ ویدیو، ستِ تامبنیل.
هیچ تابعی throw نمی‌کند — همیشه dict با ok برمی‌گرداند تا مسیرِ drip نشکند.
"""
from __future__ import annotations

import os

import httpx

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_API = "https://www.googleapis.com/youtube/v3"
_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos"
_THUMB = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set"


def enabled() -> bool:
    return bool(
        settings.YOUTUBE_ENABLED and settings.YOUTUBE_CLIENT_ID
        and settings.YOUTUBE_CLIENT_SECRET and settings.YOUTUBE_REFRESH_TOKEN
    )


async def _access_token(cx: httpx.AsyncClient) -> str:
    r = await cx.post(_TOKEN_URL, data={
        "client_id": settings.YOUTUBE_CLIENT_ID,
        "client_secret": settings.YOUTUBE_CLIENT_SECRET,
        "refresh_token": settings.YOUTUBE_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    })
    r.raise_for_status()
    return r.json()["access_token"]


async def _find_or_create_playlist(cx, token: str, title: str) -> str | None:
    h = {"Authorization": f"Bearer {token}"}
    page = None
    while True:
        params = {"part": "snippet", "mine": "true", "maxResults": 50}
        if page:
            params["pageToken"] = page
        r = await cx.get(f"{_API}/playlists", params=params, headers=h)
        r.raise_for_status()
        d = r.json()
        for it in d.get("items", []):
            if (it.get("snippet", {}).get("title") or "").strip() == title.strip():
                return it["id"]
        page = d.get("nextPageToken")
        if not page:
            break
    r = await cx.post(f"{_API}/playlists", params={"part": "snippet,status"}, headers=h, json={
        "snippet": {"title": title, "description": "آموزش جامع فارکس از مقدماتی تا حرفه‌ای — کوین پرو FX"},
        "status": {"privacyStatus": "public"},
    })
    r.raise_for_status()
    return r.json()["id"]


async def upload(video_path: str, title: str, description: str, tags: list[str],
                 thumbnail: str | None = None, playlist_title: str | None = None) -> dict:
    if not enabled():
        return {"ok": False, "reason": "disabled"}
    if not os.path.exists(video_path):
        return {"ok": False, "reason": "no_file"}
    size = os.path.getsize(video_path)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=30.0)) as cx:
            token = await _access_token(cx)
            h = {"Authorization": f"Bearer {token}"}
            meta = {
                "snippet": {"title": title[:100], "description": description[:4900],
                            "tags": [t[:30] for t in (tags or [])][:30], "categoryId": "27"},  # 27=Education
                "status": {"privacyStatus": settings.YOUTUBE_PRIVACY, "selfDeclaredMadeForKids": False},
            }
            # ۱) آغازِ سشنِ resumable
            init = await cx.post(
                _UPLOAD, params={"uploadType": "resumable", "part": "snippet,status"},
                headers={**h, "X-Upload-Content-Type": "video/mp4",
                         "X-Upload-Content-Length": str(size),
                         "Content-Type": "application/json; charset=UTF-8"},
                json=meta)
            init.raise_for_status()
            loc = init.headers.get("Location") or init.headers.get("location")
            if not loc:
                return {"ok": False, "reason": "no_upload_session"}
            # ۲) آپلودِ بایت‌ها
            with open(video_path, "rb") as f:
                body = f.read()
            put = await cx.put(loc, headers={"Content-Type": "video/mp4", "Content-Length": str(size)}, content=body)
            put.raise_for_status()
            vid = put.json().get("id")
            if not vid:
                return {"ok": False, "reason": "no_video_id"}
            # ۳) افزودن به playlist
            try:
                pl = await _find_or_create_playlist(cx, token, playlist_title or settings.YOUTUBE_PLAYLIST_TITLE)
                if pl:
                    await cx.post(f"{_API}/playlistItems", params={"part": "snippet"}, headers=h, json={
                        "snippet": {"playlistId": pl, "resourceId": {"kind": "youtube#video", "videoId": vid}}})
            except Exception as e:  # noqa: BLE001
                logger.warning("yt_playlist_failed", error=str(e)[:200])
            # ۴) تامبنیل
            try:
                if thumbnail and os.path.exists(thumbnail):
                    with open(thumbnail, "rb") as f:
                        img = f.read()
                    ctype = "image/png" if thumbnail.lower().endswith(".png") else "image/jpeg"
                    await cx.post(_THUMB, params={"videoId": vid},
                                  headers={"Authorization": f"Bearer {token}", "Content-Type": ctype}, content=img)
            except Exception as e:  # noqa: BLE001
                logger.warning("yt_thumb_failed", error=str(e)[:200])
            logger.info("yt_uploaded", video_id=vid, title=title[:50])
            return {"ok": True, "id": vid, "url": f"https://youtu.be/{vid}"}
    except httpx.HTTPStatusError as e:
        body = ""
        try:
            body = e.response.text[:300]
        except Exception:  # noqa: BLE001
            pass
        logger.warning("yt_upload_http_error", status=e.response.status_code, body=body)
        return {"ok": False, "reason": f"http_{e.response.status_code}", "detail": body}
    except Exception as e:  # noqa: BLE001
        logger.warning("yt_upload_failed", error=str(e)[:200])
        return {"ok": False, "reason": "error", "detail": str(e)[:200]}
