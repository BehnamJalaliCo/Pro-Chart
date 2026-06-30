"""تأییدِ رفرالِ LBank — کاربر باید زیرمجموعهٔ لینکِ رفرالِ ما باشد تا تریدِ واقعی مجاز شود.

منطق و امضا مطابقِ پیاده‌سازیِ آزموده‌شدهٔ سرورِ tradeyar (affiliate API):
  base = https://affiliate.lbankverify.com
  امضا = HMAC-SHA256(secret, urlencode(sorted(params))).hexdigest().upper()
  موفقیت = result == "true"
نیازمندِ وایت‌لیستِ IPِ سرورِ بازارنما روی پنلِ افیلیتِ LBank است؛ تا آن زمان
verify_referral با reason="pending_config/http_..." برمی‌گردد و ادمین می‌تواند دستی تأیید کند.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
import urllib.parse


def _base() -> str:
    return (os.getenv("LBANK_REFERRAL_API_BASE") or "https://affiliate.lbankverify.com").rstrip("/")


def _creds() -> tuple[str, str]:
    k = os.getenv("LBANK_REFERRAL_API_KEY") or os.getenv("LBANK_AFFILIATE_API_KEY") or ""
    s = os.getenv("LBANK_REFERRAL_API_SECRET") or os.getenv("LBANK_AFFILIATE_API_SECRET") or ""
    return k.strip(), s.strip()


async def _get(path: str, params: dict) -> dict:
    import aiohttp
    k, s = _creds()
    params = dict(params)
    params["api_key"] = k
    params["timestamp"] = str(int(time.time() * 1000))
    query_string = urllib.parse.urlencode(sorted(params.items()))
    params["sign"] = hmac.new(s.encode("utf-8"), query_string.encode("utf-8"),
                              hashlib.sha256).hexdigest().upper()
    headers = {"signature_method": params.get("signature_method", "HmacSHA256"),
               "timestamp": params["timestamp"], "echostr": params.get("echostr", "")}
    url = f"{_base()}{path}"
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.get(url, params=params, headers=headers,
                                timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status >= 400:
                    return {"_err": f"http_{resp.status}"}
                # LBank گاه JSON را با mimetypeِ غیرِاستاندارد می‌فرستد → بدونِ اعتبارسنجیِ نوع پارس کن
                try:
                    return await resp.json(content_type=None)
                except Exception:  # noqa: BLE001
                    txt = (await resp.text())[:160]
                    return {"_err": f"non_json: {txt}"}
    except Exception as e:  # noqa: BLE001
        return {"_err": str(e)[:120]}


async def verify_referral(uid: str) -> dict:
    """آیا کاربرِ uid زیرمجموعهٔ رفرالِ ماست؟ → {verified: bool, reason: str}."""
    uid = (uid or "").strip()
    if not uid:
        return {"verified": False, "reason": "no_uid"}
    k, s = _creds()
    if not (k and s):
        return {"verified": False, "reason": "pending_config"}
    # echostr طبقِ خطای LBank باید ۳۰–۴۰ کاراکترِ صرفاً عددی باشد
    _echo = (str(int(time.time() * 1000)) * 3)[:36]
    params = {
        "signature_method": os.getenv("LBANK_REFERRAL_SIGNATURE_METHOD", "HmacSHA256"),
        "echostr": _echo,
    }
    params["numOpenId" if uid.isdigit() else "openId"] = uid
    data = await _get("/affiliate-api/v2/invite/user/info", params)
    if data.get("_err"):
        return {"verified": False, "reason": data["_err"]}
    if str(data.get("result")).lower() == "true" and data.get("data"):
        return {"verified": True, "reason": "ok"}
    return {"verified": False, "reason": str(data.get("msg") or data.get("error_code") or "not_invitee")[:80]}
