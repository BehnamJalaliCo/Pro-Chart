"""
اجرای سفارشِ واقعی روی حسابِ LBankِ کاربر (با کلیدِ API خودِ کاربر).
امضای HMAC-SHA256 طبقِ مستندِ LBank v2. بدونِ کلیدِ ما — کلیدِ کاربر استفاده می‌شود.
نکته: اگر کلیدِ APIِ کاربر روی LBank محدودیتِ IP داشته باشد، باید IP سرور
(91.107.181.124) را در LBank وایت‌لیست کند؛ وگرنه LBank سفارش را رد می‌کند.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Dict

import httpx

_BASE = "https://api.lbkex.com"


def _lbank_pair(symbol: str) -> str:
    s = (symbol or "").upper()
    base = s[:-4] if s.endswith("USDT") else (s[:-3] if s.endswith("USD") else s)
    return f"{base.lower()}_usdt"


def _sign(params: Dict[str, str], secret: str) -> str:
    # LBank: مرتب‌سازیِ پارامترها → md5(uppercase) → HMAC-SHA256 با secret
    ordered = "&".join(f"{k}={params[k]}" for k in sorted(params))
    digest = hashlib.md5(ordered.encode()).hexdigest().upper()
    return hmac.new(secret.encode(), digest.encode(), hashlib.sha256).hexdigest()


async def place_order(api_key: str, api_secret: str, symbol: str, side: str,
                      amount: float, price: float | None = None) -> Dict:
    """سفارشِ market/limit روی LBank. side: buy|sell. amount = حجم به کوینِ پایه."""
    pair = _lbank_pair(symbol)
    otype = (("buy" if side == "buy" else "sell") + ("_market" if not price else ""))
    params = {
        "api_key": api_key,
        "symbol": pair,
        "type": otype,
        "amount": f"{amount}",
        "timestamp": str(int(time.time() * 1000)),
        "signature_method": "HmacSHA256",
        "echostr": hashlib.md5(str(time.time()).encode()).hexdigest()[:32],
    }
    if price:
        params["price"] = f"{price}"
    params["sign"] = _sign(params, api_secret)
    try:
        async with httpx.AsyncClient(timeout=12.0) as cli:
            r = await cli.post(f"{_BASE}/v2/supplement/create_order.do", data=params)
            j = r.json()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"ارتباط با LBank ناموفق: {exc}"}
    if str(j.get("result")).lower() == "true":
        return {"ok": True, "order_id": (j.get("data") or {}).get("order_id") or j.get("order_id"), "raw": j}
    # خطای رایج: IP وایت‌لیست نشده یا کلیدِ نامعتبر
    return {"ok": False, "error": j.get("error_code") or j.get("msg") or "سفارش رد شد", "raw": j}
