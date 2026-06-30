"""
Paper trading mode — اجرای موازی سیگنال‌ها بدون انتشار به کاربر.

منطق متخصص بازار:
    قبل از رفتن به live، چند هفته paper-trading انجام می‌دهیم:
        - سیستم سیگنال صادر می‌کند (دقیقاً مثل live)
        - **به کانال عمومی ارسال نمی‌شوند**
        - فقط به کانال beta-test (محدود به ادمین/تستر) ارسال می‌شوند
        - در DB با flag `is_paper=true` ذخیره می‌گردند
        - tracker آن‌ها را معمولی track می‌کند
        - performance جداگانه محاسبه می‌شود

    این به ما اجازه می‌دهد:
        1. متریک live (paper) را با backtest روی همان دوره مقایسه کنیم
        2. اگر degradation وجود دارد، قبل از live پیدا کنیم
        3. UI/UX bot را با سیگنال‌های واقعی تست کنیم
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class TradingMode(str, Enum):
    """حالت کاری سیستم."""

    PAPER = "paper"      # فقط forward-test، بدون انتشار به کاربر
    LIVE = "live"        # انتشار به کاربر واقعی
    DISABLED = "disabled"  # متوقف


@dataclass(frozen=True)
class PaperTradingConfig:
    """پیکربندی paper trading."""

    mode: TradingMode = TradingMode.PAPER
    # کانال beta-test (محدود به admin/tester) — اگر موجود، paper به آنجا ارسال می‌شود
    beta_channel_id: Optional[str] = None
    # آیا paper signals را در DB ذخیره کنیم؟ (پیشنهاد: True)
    persist_paper_signals: bool = True
    # برچسب در DB برای جدا‌سازی
    paper_flag_key: str = "is_paper"

    @classmethod
    def from_settings(cls, settings) -> "PaperTradingConfig":
        """ساخت از Settings — TRADING_MODE و BETA_CHANNEL_ID از env."""
        raw_mode = str(getattr(settings, "TRADING_MODE", "paper")).lower()
        try:
            mode = TradingMode(raw_mode)
        except ValueError:
            mode = TradingMode.PAPER
        return cls(
            mode=mode,
            beta_channel_id=getattr(settings, "BETA_CHANNEL_ID", None) or None,
            persist_paper_signals=True,
        )


def should_publish_to_users(config: PaperTradingConfig) -> bool:
    """آیا سیگنال‌های جدید به کاربر عمومی ارسال شوند؟"""
    return config.mode == TradingMode.LIVE


def should_emit_signal(config: PaperTradingConfig) -> bool:
    """آیا سیستم باید هیچ سیگنالی صادر کند؟ (در DISABLED خاموش است)."""
    return config.mode != TradingMode.DISABLED


async def publish_signal(
    config: PaperTradingConfig,
    redis_client,
    signal_data: dict,
    public_channel_id: Optional[str] = None,
) -> dict:
    """
    انتشار سیگنال متناسب با mode.

    رفتار:
        - LIVE: ارسال به public channel + ثبت در `signal:active:{id}`
        - PAPER: ارسال به beta channel (اگر تنظیم شده) + ثبت در `paper:active:{id}`
        - DISABLED: هیچ کاری نمی‌کند

    خروجی: dict گزارش انتشار {channel, persisted_in, mode}
    """
    import orjson

    if config.mode == TradingMode.DISABLED:
        return {"mode": "disabled", "published": False, "persisted_in": None}

    signal_id = signal_data.get("id")
    is_paper = config.mode == TradingMode.PAPER
    signal_data = dict(signal_data)
    signal_data[config.paper_flag_key] = is_paper

    if is_paper:
        # paper: ذخیره در namespace جدا
        if signal_id is not None and config.persist_paper_signals:
            try:
                await redis_client.set_json(
                    f"paper:active:{signal_id}",
                    signal_data,
                    expire=86400 * 7,  # paper signals بیشتر نگه‌داری
                )
            except Exception:
                pass
        # ارسال به beta channel در صورت موجود بودن
        target = config.beta_channel_id
        try:
            await redis_client.publish(
                "paper_signals" if not target else "beta_signals",
                {**signal_data, "target_channel": target},
            )
        except Exception:
            pass
        return {
            "mode": "paper",
            "published": target is not None,
            "channel": target,
            "persisted_in": f"paper:active:{signal_id}",
        }

    # LIVE
    if signal_id is not None:
        try:
            await redis_client.set_active_signal(signal_id, signal_data)
        except Exception:
            pass
    try:
        await redis_client.publish(
            "live_signals",
            {**signal_data, "target_channel": public_channel_id},
        )
    except Exception:
        pass
    return {
        "mode": "live",
        "published": True,
        "channel": public_channel_id,
        "persisted_in": f"signal:active:{signal_id}",
    }
