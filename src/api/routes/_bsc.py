"""
تأییدِ خودکارِ پرداختِ USDT روی شبکهٔ BSC (BEP-20) برای اشتراکِ بازارنما.
بدونِ کلید — از RPCِ عمومیِ BSC (eth_getTransactionReceipt) استفاده می‌کند و لاگِ
رویدادِ Transfer قراردادِ USDT را می‌خواند تا واریزِ درست به آدرسِ ما را تأیید کند.
"""
from __future__ import annotations

from typing import Dict

import httpx

# چند RPCِ عمومیِ BSC (fallback)
_RPCS = [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed1.ninicoin.io/",
    "https://rpc.ankr.com/bsc",
]
# قراردادِ USDT روی BSC (Binance-Peg BSC-USD) — ۱۸ رقمِ اعشار
USDT_BSC = "0x55d398326f99059ff775485246999027b3197955"
# امضای رویدادِ Transfer(address,address,uint256)
_TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


async def _rpc(method: str, params: list) -> dict:
    payload = {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    last = None
    async with httpx.AsyncClient(timeout=12.0) as cli:
        for url in _RPCS:
            try:
                r = await cli.post(url, json=payload)
                r.raise_for_status()
                j = r.json()
                if "result" in j:
                    return j
            except Exception as exc:  # noqa: BLE001
                last = exc
                continue
    return {"error": str(last) if last else "rpc unavailable"}


def _topic_addr(topic: str) -> str:
    # topic 32-byte → آدرسِ ۲۰بایتیِ آخر
    return ("0x" + topic[-40:]).lower()


async def verify_usdt_payment(tx_hash: str, to_address: str, min_amount: float) -> Dict:
    """تأیید: tx یک انتقالِ USDTِ موفق به to_address با مقدار ≥ min_amount است."""
    tx_hash = (tx_hash or "").strip()
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        return {"valid": False, "reason": "هشِ تراکنش نامعتبر است."}
    to_address = (to_address or "").lower()
    if not to_address:
        return {"valid": False, "reason": "آدرسِ مقصد تنظیم نشده."}

    rec = await _rpc("eth_getTransactionReceipt", [tx_hash])
    result = rec.get("result")
    if not result:
        return {"valid": False, "reason": "تراکنش هنوز روی شبکه ثبت نشده؛ چند لحظه بعد دوباره امتحان کن."}
    if str(result.get("status", "")).lower() not in ("0x1", "1"):
        return {"valid": False, "reason": "تراکنش روی شبکه ناموفق بوده."}

    for log in (result.get("logs") or []):
        try:
            if (log.get("address") or "").lower() != USDT_BSC:
                continue
            topics = log.get("topics") or []
            if len(topics) < 3 or (topics[0] or "").lower() != _TRANSFER_SIG:
                continue
            if _topic_addr(topics[2]) != to_address:
                continue
            raw = int(log.get("data") or "0x0", 16)
            amount = raw / 1e18  # USDT روی BSC = ۱۸ اعشار
            if amount + 1e-9 >= float(min_amount):
                return {"valid": True, "amount": round(amount, 4),
                        "from": _topic_addr(topics[1]), "tx": tx_hash}
            return {"valid": False, "reason": f"مبلغِ واریز ({round(amount, 2)} USDT) کمتر از حدِ لازم است."}
        except Exception:  # noqa: BLE001
            continue
    return {"valid": False, "reason": "در این تراکنش واریزِ USDT به آدرسِ ما یافت نشد."}
