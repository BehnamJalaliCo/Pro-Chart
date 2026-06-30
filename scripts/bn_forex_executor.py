#!/usr/bin/env python3
"""
اجراکنندهٔ سفارشِ فارکسِ بازارنما روی حسابِ خودِ کاربر (per-user) — روی سرورِ ویندوزِ کپی.

بازارنما (pro-chart) وقتی کاربرِ پرمیوم روی چارت سفارشِ فارکس می‌زند، آن را به این سرویس
فوروارد می‌کند (BN_FOREX_EXEC_URL → /bn-forex-open). این سرویس با کردنشالِ خودِ کاربر به
MT5ِ او لاگین می‌کند و سفارشِ بازار را روی **حسابِ خودِ کاربر** می‌زند — هرگز روی مَستر.

ایمنی:
  • احراز با X-Exec-Token == BN_EXEC_TOKEN (همان مقدارِ .env سرورِ pro-chart).
  • هر سفارش روی ترمینالِ جدا (BN_EXEC_TERMINAL) لاگین/اجرا می‌شود تا با مَستر تداخل نکند.
  • قفلِ سراسری: order_send سریالی (instagrapi/MT5 thread-safe نیست).

اجرا (روی سرورِ ویندوز، کنارِ MT5):
  set BN_EXEC_TOKEN=<همان BN_EXEC_TOKEN در .env سرور pro-chart>
  set BN_EXEC_TERMINAL=C:\Path\to\terminal64.exe   (ترمینالِ مجزا برای اجرای کاربران)
  python bn_forex_executor.py        # روی 0.0.0.0:8770
سپس در .env سرورِ pro-chart:
  BN_FOREX_LIVE=1
  BN_FOREX_EXEC_URL=http://<copy-server-ip>:8770
  BN_EXEC_TOKEN=<همان توکن>
"""
import hmac
import os
import threading

from flask import Flask, jsonify, request

try:
    import MetaTrader5 as mt5
except Exception as e:  # noqa: BLE001
    raise SystemExit("MetaTrader5 لازم است: pip install MetaTrader5 flask  (فقط ویندوز)") from e

TOKEN = os.getenv("BN_EXEC_TOKEN", "")
TERMINAL = os.getenv("BN_EXEC_TERMINAL", "")     # مسیرِ terminal64.exe مجزا (اختیاری)
MAGIC = int(os.getenv("BN_EXEC_MAGIC", "778899"))
DEVIATION = int(os.getenv("BN_EXEC_DEVIATION", "30"))
SUFFIXES = ["", ".r", ".m", ".raw", "m", "."]    # تلاش برای پسوندِ نمادِ بروکر

app = Flask(__name__)
_lock = threading.Lock()


def _auth_ok() -> bool:
    tok = request.headers.get("X-Exec-Token", "")
    return bool(TOKEN) and bool(tok) and hmac.compare_digest(tok, TOKEN)


def _resolve_symbol(symbol: str):
    """نمادِ معتبرِ بروکر را پیدا کن (با/بدونِ پسوند) و در MarketWatch فعال کن."""
    base = (symbol or "").upper()
    for suf in SUFFIXES:
        name = base + suf
        info = mt5.symbol_info(name)
        if info is not None:
            if not info.visible:
                mt5.symbol_select(name, True)
            return name
    return None


def _place(o: dict) -> dict:
    login = int(o["login"])
    password = o.get("password", "")
    server = o.get("server", "")
    side = (o.get("side") or "").lower()
    symbol_in = o.get("symbol") or ""
    volume = float(o.get("amount") or 0)
    sl = float(o.get("sl") or 0)
    tp = float(o.get("tp") or 0)
    if side not in ("buy", "sell") or volume <= 0:
        return {"ok": False, "error": "invalid side/volume"}

    kw = {"login": login, "password": password, "server": server}
    if TERMINAL:
        kw["path"] = TERMINAL
    if not mt5.initialize(**kw):
        return {"ok": False, "error": f"login failed: {mt5.last_error()}"}
    try:
        ai = mt5.account_info()
        if ai is None or int(ai.login) != login:
            return {"ok": False, "error": "account mismatch after login"}
        symbol = _resolve_symbol(symbol_in)
        if not symbol:
            return {"ok": False, "error": f"symbol not found: {symbol_in}"}
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"ok": False, "error": "no tick"}
        price = tick.ask if side == "buy" else tick.bid
        req = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": mt5.ORDER_TYPE_BUY if side == "buy" else mt5.ORDER_TYPE_SELL,
            "price": price,
            "deviation": DEVIATION,
            "magic": MAGIC,
            "comment": "bazaarnama",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        if sl > 0:
            req["sl"] = sl
        if tp > 0:
            req["tp"] = tp
        res = mt5.order_send(req)
        if res is None:
            return {"ok": False, "error": f"order_send None: {mt5.last_error()}"}
        if res.retcode != mt5.TRADE_RETCODE_DONE:
            return {"ok": False, "error": f"retcode {res.retcode}: {res.comment}", "retcode": res.retcode}
        return {"ok": True, "ticket": res.order, "price": res.price, "volume": res.volume, "symbol": symbol}
    finally:
        mt5.shutdown()


@app.post("/bn-forex-open")
def bn_forex_open():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    o = request.get_json(force=True, silent=True) or {}
    try:
        with _lock:
            r = _place(o)
        code = 200 if r.get("ok") else 502
        return jsonify({"order_id": o.get("order_id"), **r}), code
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)[:200]}), 500


@app.get("/health")
def health():
    return jsonify({"status": "ok", "terminal": bool(TERMINAL)})


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("BN_EXEC_TOKEN لازم است")
    app.run(host="0.0.0.0", port=int(os.getenv("BN_EXEC_PORT", "8770")))
