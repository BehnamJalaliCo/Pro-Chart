"""
لایهٔ سنجشِ عملکرد (Phase 0 — Foundation & Measurement).

«آنچه را اندازه نگیریم، نمی‌توانیم بهتر کنیم.» این ماژول از معاملاتِ واقعیِ
بسته‌شده (جدولِ trade_history) اسکورکاردِ کوانتِ کامل می‌سازد تا ریشهٔ ضرر و
محلِ برتری را عددی نشان دهد:

- معیارهای کل: نرخِ برد، انتظارِ ریاضیِ هر معامله، profit factor، نسبتِ
  reward:risk، نسبتِ Sharpe (روی سود هر معامله)، حداکثرِ افتِ سرمایه (maxDD)،
  طولانی‌ترین زنجیرهٔ باخت.
- تفکیکِ نماد / ساعتِ روز (UTC) / دلیلِ بسته‌شدن.
- تفکیکِ «سطلِ امتیازِ سیگنال» (با join به جدولِ signals) — برای اثباتِ اینکه
  سیگنال‌های امتیازِ پایین بازنده‌اند.

هیچ وابستگیِ سنگینی ندارد؛ فقط SQL + ریاضیِ ساده. خروجی یک dict قابلِ‌سریال است
که هم در endpointِ ادمین و هم در گزارشِ CLI استفاده می‌شود.
"""

from __future__ import annotations

import math
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _f(v: Any, d: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


def _sharpe(returns: list[float]) -> float:
    """نسبتِ Sharpe روی سودِ هر معامله (بدونِ نرخِ بدونِ‌ریسک). معیارِ ثباتِ سود."""
    n = len(returns)
    if n < 2:
        return 0.0
    mean = sum(returns) / n
    var = sum((r - mean) ** 2 for r in returns) / (n - 1)
    sd = math.sqrt(var)
    if sd == 0:
        return 0.0
    return (mean / sd) * math.sqrt(n)  # مقیاسِ کلِ نمونه


def _max_drawdown(equity: list[float]) -> float:
    """حداکثرِ افتِ سرمایه (دلار) روی منحنیِ سرمایهٔ تجمعی."""
    peak = equity[0] if equity else 0.0
    mdd = 0.0
    for v in equity:
        peak = max(peak, v)
        mdd = min(mdd, v - peak)
    return mdd


def _longest_loss_streak(seq: list[float]) -> int:
    cur = best = 0
    for p in seq:
        if p <= 0:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def _scorecard(rows: list[dict]) -> dict[str, Any]:
    """اسکورکاردِ کوانت از لیستِ معاملاتِ مرتب‌شده بر زمان."""
    nets = [_f(r["net_profit"]) for r in rows]
    n = len(nets)
    if n == 0:
        return {"trades": 0}
    wins = [x for x in nets if x > 0]
    losses = [x for x in nets if x <= 0]
    gross_win = sum(wins)
    gross_loss = -sum(losses)
    avg_win = (gross_win / len(wins)) if wins else 0.0
    avg_loss = (gross_loss / len(losses)) if losses else 0.0
    winrate = len(wins) / n
    rr = (avg_win / avg_loss) if avg_loss else 0.0
    expectancy = sum(nets) / n
    # سربه‌سر: نرخِ بردی که با این R:R انتظار=۰ می‌شود
    breakeven_wr = (1.0 / (1.0 + rr)) if rr else 0.0
    equity, cum = [], 0.0
    for x in nets:
        cum += x
        equity.append(cum)
    return {
        "trades": n,
        "wins": len(wins),
        "losses": len(losses),
        "winrate_pct": round(100 * winrate, 1),
        "net": round(sum(nets), 2),
        "gross_win": round(gross_win, 2),
        "gross_loss": round(gross_loss, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(-avg_loss, 2),
        "reward_risk": round(rr, 2),
        "profit_factor": round((gross_win / gross_loss) if gross_loss else 0.0, 2),
        "expectancy": round(expectancy, 2),
        "breakeven_winrate_pct": round(100 * breakeven_wr, 1),
        "winrate_gap_pct": round(100 * (winrate - breakeven_wr), 1),  # مثبت=سودده
        "sharpe": round(_sharpe(nets), 2),
        "max_drawdown": round(_max_drawdown(equity), 2),
        "longest_loss_streak": _longest_loss_streak(nets),
    }


async def performance_report(db: AsyncSession, uid: int = 0, days: int = 30) -> dict[str, Any]:
    """گزارشِ کاملِ عملکرد برای یک حساب (uid=0 مَستر)."""
    base = (
        "FROM trade_history WHERE account_uid=:uid "
        "AND close_time >= now() - make_interval(days => :days)"
    )
    p = {"uid": uid, "days": days}

    rows = list((await db.execute(text(
        "SELECT net_profit, close_time, symbol, close_reason, signal_id " + base + " ORDER BY close_time ASC"
    ), p)).mappings())
    overall = _scorecard([dict(r) for r in rows])

    # به‌تفکیکِ نماد
    by_symbol = {}
    syms = sorted({r["symbol"] for r in rows if r["symbol"]})
    for sym in syms:
        sub = [dict(r) for r in rows if r["symbol"] == sym]
        sc = _scorecard(sub)
        by_symbol[sym] = {k: sc[k] for k in ("trades", "winrate_pct", "net", "profit_factor", "expectancy")}
    by_symbol = dict(sorted(by_symbol.items(), key=lambda kv: kv[1]["net"]))

    # به‌تفکیکِ ساعتِ UTC
    by_hour = {}
    for h in range(24):
        sub = [dict(r) for r in rows if r["close_time"] and r["close_time"].hour == h]
        if sub:
            sc = _scorecard(sub)
            by_hour[f"{h:02d}"] = {k: sc[k] for k in ("trades", "winrate_pct", "net")}

    # به‌تفکیکِ دلیلِ بسته‌شدن
    by_reason = {}
    for reason in sorted({(r["close_reason"] or "none") for r in rows}):
        sub = [dict(r) for r in rows if (r["close_reason"] or "none") == reason]
        sc = _scorecard(sub)
        by_reason[reason] = {k: sc[k] for k in ("trades", "winrate_pct", "net")}

    # به‌تفکیکِ سطلِ امتیازِ سیگنال (join به signals) — اثباتِ ضررِ امتیازِ پایین
    by_score = {}
    try:
        srows = list((await db.execute(text(
            "SELECT th.net_profit, s.signal_score "
            "FROM trade_history th JOIN signals s ON th.signal_id = s.id "
            "WHERE th.account_uid=:uid AND th.close_time >= now() - make_interval(days => :days) "
            "AND s.signal_score IS NOT NULL"
        ), p)).mappings())
        buckets = [(0, 60), (60, 65), (65, 70), (70, 75), (75, 80), (80, 200)]
        for lo, hi in buckets:
            sub = [{"net_profit": r["net_profit"]} for r in srows if lo <= _f(r["signal_score"]) < hi]
            if sub:
                sc = _scorecard(sub)
                by_score[f"{lo}-{hi if hi < 200 else '∞'}"] = {
                    k: sc[k] for k in ("trades", "winrate_pct", "net", "expectancy")
                }
    except Exception as exc:  # noqa: BLE001
        by_score = {"error": str(exc)}

    return {
        "uid": uid,
        "days": days,
        "overall": overall,
        "by_symbol": by_symbol,
        "by_hour_utc": by_hour,
        "by_close_reason": by_reason,
        "by_score_bucket": by_score,
    }
