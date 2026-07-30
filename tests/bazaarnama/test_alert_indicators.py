"""تست‌های توابعِ خالصِ اندیکاتورِ موتورِ آلارم (src/bazaarnama/alert_indicators.py).

این‌ها همان اعدادی‌اند که آلارمِ سمتِ‌سرورِ «اندیکاتور» را می‌ترکانند؛ مقادیر
دستی حساب شده‌اند (نه با کتابخانه) تا رگرسیونِ فرمول — مثلاً عوض‌شدنِ seedِ
EMA یا هموارسازیِ ویلدر — بی‌صدا رد نشود. بدونِ DB/Redis/شبکه.

اجرا:  python -m pytest tests/bazaarnama/test_alert_indicators.py -q
"""

from __future__ import annotations

import pytest

from src.bazaarnama.alert_indicators import (
    bars_needed,
    drop_forming,
    ema_last,
    indicator_last,
    macd_last,
    rsi_last,
    sma_last,
    tf_seconds,
)


def _candles(closes, t0: int = 0, step: int = 3600) -> list[dict]:
    """کندل‌های ساختگی از یک لیستِ close — بقیهٔ فیلدها برای این توابع بی‌اثرند."""
    return [{"t": t0 + i * step, "o": c, "h": c, "l": c, "c": float(c), "v": 0.0}
            for i, c in enumerate(closes)]


# ── SMA / EMA ──
def test_sma_last_exact():
    assert sma_last([1.0, 2.0, 3.0, 4.0, 5.0], 3) == 4.0          # میانگینِ ۳ مقدارِ آخر
    assert sma_last([2.0, 4.0, 6.0], 3) == 4.0                    # کلِ سری = پنجره


def test_sma_last_insufficient_data_is_none():
    assert sma_last([1.0, 2.0], 3) is None
    assert sma_last([], 5) is None
    assert sma_last([1.0], 0) is None                             # دورهٔ نامعتبر


def test_ema_last_hand_computed():
    # p=3 → k=0.5، seed=SMA(1,2,3)=2؛ سپس 2+(4-2)/2=3 و 3+(5-3)/2=4
    assert ema_last([1.0, 2.0, 3.0, 4.0, 5.0], 3) == pytest.approx(4.0)
    # n == p → EMA همان seed (SMA) است — قراردادِ نمودار (academy._ema_list)
    assert ema_last([2.0, 4.0, 6.0], 3) == pytest.approx(4.0)


def test_ema_last_insufficient_data_is_none():
    assert ema_last([1.0, 2.0], 3) is None


# ── RSI ویلدر ──
def test_rsi_wilder_hand_computed():
    # سری [1,2,3,4,3,2,3] با p=3 — تغییرها: +1,+1,+1,-1,-1,+1
    # seed: g=1, l=0
    # گام۴ (ch=-1): g=2/3, l=1/3 → گام۵ (ch=-1): g=4/9, l=5/9 → گام۶ (ch=+1): g=17/27, l=10/27
    # RS=1.7 → RSI = 100 - 100/2.7 = 62.962962…
    assert rsi_last([1.0, 2.0, 3.0, 4.0, 3.0, 2.0, 3.0], 3) == pytest.approx(62.9629629, abs=1e-6)


def test_rsi_all_gains_saturates_to_100():
    # بدونِ افت، l=0 → با epsilonِ فرمولِ نمودار عملاً ۱۰۰
    assert rsi_last([1.0, 2.0, 3.0, 4.0, 5.0], 3) == pytest.approx(100.0, abs=1e-4)


def test_rsi_all_losses_is_0():
    assert rsi_last([5.0, 4.0, 3.0, 2.0, 1.0], 3) == pytest.approx(0.0, abs=1e-9)


def test_rsi_insufficient_data_is_none():
    assert rsi_last([1.0, 2.0, 3.0], 3) is None                   # p+1 مقدار لازم است


# ── MACD ──
def test_macd_hand_computed():
    # fast=2 → EMA=[None,1.5,2.5,3.5]، slow=3 → EMA=[None,None,2,3]
    # سری MACD = [0.5, 0.5] → macd=0.5؛ سیگنال(2)=0.5؛ هیستوگرام=0
    m, s, h = macd_last([1.0, 2.0, 3.0, 4.0], fast=2, slow=3, signal=2)
    assert m == pytest.approx(0.5)
    assert s == pytest.approx(0.5)
    assert h == pytest.approx(0.0)


def test_macd_constant_series_is_zero():
    m, s, h = macd_last([5.0] * 40)
    assert m == pytest.approx(0.0)
    assert s == pytest.approx(0.0)
    assert h == pytest.approx(0.0)


def test_macd_relation_and_sign_on_uptrend():
    # روندِ صعودی → EMA سریع بالای کند → MACD مثبت؛ hist همیشه macd - signal
    m, s, h = macd_last([float(x) for x in range(1, 61)])
    assert m is not None and s is not None and h is not None
    assert m > 0
    assert h == pytest.approx(m - s)


def test_macd_insufficient_data_is_none_tuple():
    assert macd_last([1.0, 2.0], fast=12, slow=26, signal=9) == (None, None, None)


# ── حذفِ کندلِ درحال‌شکل‌گیری ──
def test_drop_forming_drops_open_candle():
    cs = _candles([1, 2], t0=0, step=3600)                        # سطل‌ها: [0,3600) و [3600,7200)
    assert drop_forming(cs, "H1", now_ts=7199) == cs[:-1]         # سطلِ آخر هنوز باز است


def test_drop_forming_keeps_closed_candle():
    cs = _candles([1, 2], t0=0, step=3600)
    assert drop_forming(cs, "H1", now_ts=7200) == cs              # پایانِ سطل == now → بسته
    assert drop_forming(cs, "H1", now_ts=10000) == cs             # دادهٔ کهنه (بازارِ بسته) دست نمی‌خورد


def test_drop_forming_empty_and_unknown_tf():
    assert drop_forming([], "H1", now_ts=0) == []
    # tf ناشناخته → پیش‌فرضِ H1 (۳۶۰۰ ثانیه)؛ نباید exception بدهد
    cs = _candles([1], t0=0, step=3600)
    assert drop_forming(cs, "XX9", now_ts=100) == []
    assert tf_seconds("XX9") == 3600


# ── تعدادِ کندلِ لازم ──
def test_bars_needed_clamped_to_60_300():
    assert bars_needed({"key": "rsi", "period": 14}) == 60        # 42 → کفِ ۶۰
    assert bars_needed({"key": "sma", "period": 100}) == 300      # 300 → سقف
    assert bars_needed({"key": "macd"}) == 105                    # (26+9)*3
    assert bars_needed({"key": "ema"}) == 60                      # پیش‌فرضِ 20 → 60
    assert bars_needed({"key": "rsi", "period": "junk"}) == 60    # ورودیِ خراب → پیش‌فرض


# ── dispatch با شکلِ cond.ind ذخیره‌شده در آلارم ──
def test_indicator_last_rsi_value_and_label():
    v, label = indicator_last(_candles([1, 2, 3, 4, 3, 2, 3]), {"key": "rsi", "period": 3})
    assert v == pytest.approx(62.9629629, abs=1e-6)
    assert label == "RSI(3)"


def test_indicator_last_sma_ema_labels():
    cs = _candles([1, 2, 3, 4, 5])
    v, label = indicator_last(cs, {"key": "sma", "period": 3})
    assert (v, label) == (4.0, "SMA(3)")
    v, label = indicator_last(cs, {"key": "ema", "period": 3, "source": "close"})
    assert v == pytest.approx(4.0)
    assert label == "EMA(3)"


def test_indicator_last_macd_variants():
    cs = _candles([1, 2, 3, 4])
    v, label = indicator_last(cs, {"key": "macd", "fast": 2, "slow": 3, "signal": 2})
    assert (v, label) == (pytest.approx(0.5), "MACD(2,3)")
    v, label = indicator_last(cs, {"key": "macd_signal", "fast": 2, "slow": 3, "signal": 2})
    assert (v, label) == (pytest.approx(0.5), "MACD-Signal(2,3,2)")
    v, label = indicator_last(cs, {"key": "macd_hist", "fast": 2, "slow": 3, "signal": 2})
    assert (v, label) == (pytest.approx(0.0), "MACD-Hist(2,3,2)")


def test_indicator_last_unknown_key_and_missing_data():
    v, _ = indicator_last(_candles([1, 2, 3]), {"key": "bollinger"})
    assert v is None                                              # کلیدِ ناشناخته → بی‌صدا رد
    v, _ = indicator_last([], {"key": "rsi", "period": 14})
    assert v is None                                              # بدونِ کندل → بی‌صدا رد


def test_indicator_last_defaults_match_ui_contract():
    # UI فقط key می‌فرستد → پیش‌فرض‌ها: RSI(14)، SMA/EMA(20)، MACD(12,26)
    cs = _candles(list(range(1, 61)))
    assert indicator_last(cs, {"key": "rsi"})[1] == "RSI(14)"
    assert indicator_last(cs, {"key": "sma"})[1] == "SMA(20)"
    assert indicator_last(cs, {"key": "macd"})[1] == "MACD(12,26)"
