"""
مدیریت ریسک هوشمند — محاسبه حد ضرر، حد سود و تریلینگ استاپ.

این ماژول مسئول محاسبه سطوح TP و SL بر اساس ترکیبی از:
    - مقدار ATR (Average True Range)
    - نزدیک‌ترین سطوح حمایت/مقاومت
    - سطوح فیبوناچی اکستنشن
    - نواحی اوردر بلاک و عرضه/تقاضا

سطوح خروجی:
    - SL: محافظه‌کارانه‌ترین مقدار بین ATR*2.0 و نزدیک‌ترین S/R
    - TP1: ریسک * ۱.۵ با تایید S/R
    - TP2: ریسک * ۲.۵ با تایید فیبوناچی اکستنشن
    - TP3: ریسک * ۴.۰ با تایید اوردر بلاک / نواحی عرضه-تقاضا
    - تریلینگ استاپ: ATR*1.0 پس از رسیدن به TP1
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.core.config import settings
from src.core.instruments import min_stop_pips_of, pip_dollar_of, spread_pips_of
from src.core.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# ثابت‌ها
# ---------------------------------------------------------------------------

# کفِ استاپ = ۲.۵×ATR (به‌درخواست). S/R فقط می‌تواند استاپ را «گشادتر» کند، نه تنگ‌تر.
ATR_SL_MULTIPLIER: float = 2.5
ATR_TRAILING_MULTIPLIER: float = 1.0
# حداقلِ نسبتِ استاپ به ATR؛ سیگنالی که استاپش از این کمتر شود رد می‌شود (گاردِ نویز).
MIN_SL_ATR_RATIO: float = 1.5

# کالیبراسیونِ ۲۰۲۶-۰۶ (داده): TP1=1.05 ریاضاً ضررده بود (با WR~۴۶٪ به >1.17R نیاز است).
# TP1 به ۱.۵ برگشت تا profit factor مثبت شود؛ TP2/TP3 اجازهٔ دویدن دارند.
TP1_RR_RATIO: float = 1.5
TP2_RR_RATIO: float = 2.2
TP3_RR_RATIO: float = 3.2

# تلرانس نزدیکی سطح S/R به سطح محاسبه‌شده (به درصد)
SR_PROXIMITY_PCT: float = 0.5
FIB_PROXIMITY_PCT: float = 1.0
OB_PROXIMITY_PCT: float = 1.5

# حداقل فاصله TP/SL به پیپ برای هر نماد (پیش‌فرض)
MIN_SL_PIPS: float = 5.0
MIN_TP_PIPS: float = 7.0


@dataclass
class RiskLevels:
    """سطوح مدیریت ریسک محاسبه‌شده برای یک سیگنال.

    شامل قیمت‌های SL، TP1-TP3، تریلینگ، و مقادیر پیپ و دلار.
    """

    entry_price: float = 0.0
    direction: str = "long"
    symbol: str = ""

    # سطوح قیمتی
    sl_price: float = 0.0
    tp1_price: float = 0.0
    tp2_price: float = 0.0
    tp3_price: float = 0.0
    trailing_stop_distance: float = 0.0

    # مقادیر به پیپ
    sl_pips: float = 0.0
    tp1_pips: float = 0.0
    tp2_pips: float = 0.0
    tp3_pips: float = 0.0
    trailing_pips: float = 0.0

    # مقادیر دلاری (بر اساس ۱ لات)
    sl_dollar: float = 0.0
    tp1_dollar: float = 0.0
    tp2_dollar: float = 0.0
    tp3_dollar: float = 0.0

    # نسبت ریسک به ریوارد
    rr_tp1: float = 0.0
    rr_tp2: float = 0.0
    rr_tp3: float = 0.0

    # جزئیات محاسبه
    atr_value: float = 0.0
    sr_used_for_sl: Optional[float] = None
    sr_used_for_tp1: Optional[float] = None
    fib_used_for_tp2: Optional[float] = None
    ob_used_for_tp3: Optional[float] = None
    calculation_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """تبدیل به دیکشنری برای ذخیره در دیتابیس"""
        return {
            "entry_price": round(self.entry_price, 8),
            "direction": self.direction,
            "symbol": self.symbol,
            "sl_price": round(self.sl_price, 8),
            "tp1_price": round(self.tp1_price, 8),
            "tp2_price": round(self.tp2_price, 8),
            "tp3_price": round(self.tp3_price, 8),
            "trailing_stop_distance": round(self.trailing_stop_distance, 8),
            "sl_pips": round(self.sl_pips, 2),
            "tp1_pips": round(self.tp1_pips, 2),
            "tp2_pips": round(self.tp2_pips, 2),
            "tp3_pips": round(self.tp3_pips, 2),
            "trailing_pips": round(self.trailing_pips, 2),
            "sl_dollar": round(self.sl_dollar, 2),
            "tp1_dollar": round(self.tp1_dollar, 2),
            "tp2_dollar": round(self.tp2_dollar, 2),
            "tp3_dollar": round(self.tp3_dollar, 2),
            "rr_tp1": round(self.rr_tp1, 2),
            "rr_tp2": round(self.rr_tp2, 2),
            "rr_tp3": round(self.rr_tp3, 2),
            "atr_value": round(self.atr_value, 8),
            "sr_used_for_sl": self.sr_used_for_sl,
            "sr_used_for_tp1": self.sr_used_for_tp1,
            "fib_used_for_tp2": self.fib_used_for_tp2,
            "ob_used_for_tp3": self.ob_used_for_tp3,
            "calculation_notes": self.calculation_notes,
        }


class RiskManager:
    """
    محاسبه‌گر هوشمند سطوح مدیریت ریسک.

    حد ضرر و حد سود را با استفاده از ATR، سطوح S/R، فیبوناچی
    و نواحی عرضه-تقاضا محاسبه کرده و محافظه‌کارانه‌ترین سطوح
    را انتخاب می‌کند.
    """

    def __init__(
        self,
        atr_sl_mult: float = ATR_SL_MULTIPLIER,
        atr_trail_mult: float = ATR_TRAILING_MULTIPLIER,
        tp1_rr: float = TP1_RR_RATIO,
        tp2_rr: float = TP2_RR_RATIO,
        tp3_rr: float = TP3_RR_RATIO,
    ) -> None:
        """ساخت نمونه مدیر ریسک با ضرایب سفارشی.

        پارامترها:
            atr_sl_mult: ضریب ATR برای حد ضرر
            atr_trail_mult: ضریب ATR برای تریلینگ استاپ
            tp1_rr: نسبت ریسک به ریوارد هدف اول
            tp2_rr: نسبت ریسک به ریوارد هدف دوم
            tp3_rr: نسبت ریسک به ریوارد هدف سوم
        """
        self._atr_sl_mult = atr_sl_mult
        self._atr_trail_mult = atr_trail_mult
        self._tp1_rr = tp1_rr
        self._tp2_rr = tp2_rr
        self._tp3_rr = tp3_rr

    # ------------------------------------------------------------------
    # API اصلی
    # ------------------------------------------------------------------

    def calculate(
        self,
        symbol: str,
        direction: str,
        entry_price: float,
        atr_value: float,
        sr_result: Dict[str, Any],
        smc_result: Dict[str, Any],
        lot_size: float = 1.0,
    ) -> RiskLevels:
        """
        محاسبه کامل سطوح مدیریت ریسک.

        پارامترها:
            symbol: نماد معاملاتی (مثلاً EURUSD)
            direction: جهت معامله ('long' / 'short')
            entry_price: قیمت ورود
            atr_value: مقدار ATR فعلی
            sr_result: خروجی SupportResistanceAnalyzer.analyze()
            smc_result: خروجی SmartMoneyAnalyzer.analyze()
            lot_size: حجم معامله به لات (پیش‌فرض ۱ لات)

        خروجی:
            شیء RiskLevels شامل تمام سطوح و مقادیر محاسبه‌شده.
        """
        levels = RiskLevels(
            entry_price=entry_price,
            direction=direction,
            symbol=symbol,
            atr_value=atr_value,
        )

        pip_value = self._get_pip_value(symbol)
        pip_dollar = self._get_pip_dollar_value(symbol, lot_size)

        is_long = direction == "long"

        # ---- محاسبه SL ----
        sl_price = self._calculate_sl(
            entry_price, atr_value, sr_result, is_long, pip_value, levels, symbol
        )
        levels.sl_price = sl_price

        # فاصله ریسک
        risk_distance = abs(entry_price - sl_price)

        # ---- محاسبه TP ها ----
        tp1_price = self._calculate_tp1(
            entry_price, risk_distance, sr_result, is_long, levels
        )
        tp2_price = self._calculate_tp2(
            entry_price, risk_distance, sr_result, is_long, levels
        )
        tp3_price = self._calculate_tp3(
            entry_price, risk_distance, smc_result, is_long, levels
        )

        # ---- تضمینِ ترتیبِ یکنواختِ TP ها ----
        # snapping به فیبو/اوردربلاک گاهی TP3 را داخلِ TP2 (یا TP2 را داخلِ TP1) می‌کشید
        # → ترتیبِ نامنطق (علتِ ردِ سیگنال توسطِ گیتِ کیفیت). اگر snapping ترتیب را شکست،
        # به TP خامِ مبتنی بر RR برمی‌گردیم که همیشه درست‌ترتیب است.
        raw_tp2 = entry_price + risk_distance * self._tp2_rr * (1 if is_long else -1)
        raw_tp3 = entry_price + risk_distance * self._tp3_rr * (1 if is_long else -1)
        if is_long:
            if not (tp1_price < tp2_price):
                tp2_price = raw_tp2
            if not (tp2_price < tp3_price):
                tp3_price = max(raw_tp3, tp2_price + abs(tp2_price - tp1_price))
        else:
            if not (tp1_price > tp2_price):
                tp2_price = raw_tp2
            if not (tp2_price > tp3_price):
                tp3_price = min(raw_tp3, tp2_price - abs(tp1_price - tp2_price))

        levels.tp1_price = tp1_price
        levels.tp2_price = tp2_price
        levels.tp3_price = tp3_price

        # ---- تریلینگ استاپ ----
        trailing_distance = atr_value * self._atr_trail_mult
        levels.trailing_stop_distance = trailing_distance

        # ---- محاسبه پیپ ----
        levels.sl_pips = abs(entry_price - sl_price) / pip_value
        levels.tp1_pips = abs(tp1_price - entry_price) / pip_value
        levels.tp2_pips = abs(tp2_price - entry_price) / pip_value
        levels.tp3_pips = abs(tp3_price - entry_price) / pip_value
        levels.trailing_pips = trailing_distance / pip_value

        # ---- محاسبه دلاری ----
        levels.sl_dollar = round(levels.sl_pips * pip_dollar, 2)
        levels.tp1_dollar = round(levels.tp1_pips * pip_dollar, 2)
        levels.tp2_dollar = round(levels.tp2_pips * pip_dollar, 2)
        levels.tp3_dollar = round(levels.tp3_pips * pip_dollar, 2)

        # ---- نسبت R/R ----
        if levels.sl_pips > 0:
            levels.rr_tp1 = round(levels.tp1_pips / levels.sl_pips, 2)
            levels.rr_tp2 = round(levels.tp2_pips / levels.sl_pips, 2)
            levels.rr_tp3 = round(levels.tp3_pips / levels.sl_pips, 2)

        logger.info(
            "risk_levels_calculated",
            symbol=symbol,
            direction=direction,
            entry=entry_price,
            sl=round(sl_price, 6),
            tp1=round(tp1_price, 6),
            tp2=round(tp2_price, 6),
            tp3=round(tp3_price, 6),
            sl_pips=round(levels.sl_pips, 1),
            rr_tp1=levels.rr_tp1,
            rr_tp2=levels.rr_tp2,
            rr_tp3=levels.rr_tp3,
        )

        return levels

    def calculate_trailing_stop(
        self,
        symbol: str,
        direction: str,
        current_price: float,
        atr_value: float,
        current_trailing_sl: Optional[float] = None,
    ) -> float:
        """
        محاسبه سطح تریلینگ استاپ جدید.

        این متد پس از رسیدن قیمت به TP1 فعال شده و حد ضرر را
        به اندازه ATR*1.0 پشت قیمت فعلی قرار می‌دهد.

        پارامترها:
            symbol: نماد معاملاتی
            direction: جهت معامله
            current_price: قیمت فعلی
            atr_value: مقدار ATR
            current_trailing_sl: حد ضرر تریلینگ فعلی

        خروجی:
            قیمت جدید تریلینگ استاپ.
            تنها در صورتی که بهتر از مقدار قبلی باشد جابجا می‌شود.
        """
        trail_distance = atr_value * self._atr_trail_mult
        is_long = direction == "long"

        if is_long:
            new_trail = current_price - trail_distance
            if current_trailing_sl is not None:
                new_trail = max(new_trail, current_trailing_sl)
        else:
            new_trail = current_price + trail_distance
            if current_trailing_sl is not None:
                new_trail = min(new_trail, current_trailing_sl)

        return new_trail

    # ------------------------------------------------------------------
    # محاسبات داخلی SL
    # ------------------------------------------------------------------

    def _calculate_sl(
        self,
        entry: float,
        atr: float,
        sr_result: Dict[str, Any],
        is_long: bool,
        pip_value: float,
        levels: RiskLevels,
        symbol: str = "",
    ) -> float:
        """
        محاسبه حد ضرر هوشمند.

        ابتدا SL بر اساس ATR*2.0 حساب می‌شود، سپس با نزدیک‌ترین
        سطح S/R مقایسه شده و محافظه‌کارانه‌ترین (نزدیک‌ترین به ورود)
        انتخاب می‌شود.
        """
        # SL بر اساس ATR
        atr_sl_distance = atr * self._atr_sl_mult
        if is_long:
            atr_sl_price = entry - atr_sl_distance
        else:
            atr_sl_price = entry + atr_sl_distance

        levels.calculation_notes.append(
            f"ATR SL: {round(atr_sl_price, 6)} (ATR={round(atr, 6)} * {self._atr_sl_mult})"
        )

        # SL بر اساس S/R
        sr_sl_price = self._find_sr_sl(entry, sr_result, is_long, pip_value)

        if sr_sl_price is not None:
            levels.sr_used_for_sl = sr_sl_price
            levels.calculation_notes.append(
                f"S/R SL: {round(sr_sl_price, 6)}"
            )

            # استاپ = دورترین از ورود بین ATR و S/R ⇽ S/R فقط می‌تواند گشادتر کند، نه
            # تنگ‌تر. (باگِ قبلی: «نزدیک‌ترین» را می‌گرفت و استاپ را داخلِ نویز می‌چسباند.)
            if is_long:
                sl_price = min(atr_sl_price, sr_sl_price)   # پایین‌تر = دورتر
            else:
                sl_price = max(atr_sl_price, sr_sl_price)   # بالاتر = دورتر

            levels.calculation_notes.append(
                f"SL نهایی (دورترین/ATR-floor): {round(sl_price, 6)}"
            )
        else:
            sl_price = atr_sl_price
            levels.calculation_notes.append("S/R SL یافت نشد — استفاده از ATR SL")

        # ---- بافرِ اسپرد (مهندسیِ ۲۰۲۶-۰۶): استاپ را به اندازهٔ اسپردِ نماد دورتر می‌بریم ----
        # علتِ مهمِ «استاپِ زودرس»: استاپ روی فاصلهٔ ATR گذاشته می‌شد بدونِ درنظرگرفتنِ
        # اسپرد. برای نمادهای پراسپرد (طلا/شاخص/نفت) خودِ اسپرد استاپ را می‌زد. حالا
        # اسپردِ نماد (از مشخصاتِ واقعیِ بروکر اگر موجود، وگرنه پیش‌فرضِ تحقیق‌شده) به SL
        # اضافه می‌شود تا نوسانِ اسپرد، معاملهٔ سالم را خارج نکند.
        if symbol:
            spread_price = spread_pips_of(symbol) * pip_value
            if is_long:
                sl_price -= spread_price
            else:
                sl_price += spread_price
            levels.calculation_notes.append(
                f"بافرِ اسپرد: {round(spread_pips_of(symbol), 1)} پیپ به SL اضافه شد"
            )

        # ---- حداقلِ فاصلهٔ استاپ (per-instrument، نه ژنریک) ----
        # حداقل = بزرگ‌ترینِ (MIN_SL_PIPSِ عمومی، حداقل‌استاپِ نماد=stops_levelِ بروکر).
        min_pips = max(MIN_SL_PIPS, min_stop_pips_of(symbol)) if symbol else MIN_SL_PIPS
        min_distance = min_pips * pip_value
        if abs(entry - sl_price) < min_distance:
            if is_long:
                sl_price = entry - min_distance
            else:
                sl_price = entry + min_distance
            levels.calculation_notes.append(
                f"SL به حداقل فاصله ({round(min_pips, 1)} پیپ) تنظیم شد"
            )

        return sl_price

    def _find_sr_sl(
        self,
        entry: float,
        sr_result: Dict[str, Any],
        is_long: bool,
        pip_value: float,
    ) -> Optional[float]:
        """یافتن نزدیک‌ترین سطح S/R مناسب برای حد ضرر.

        برای لانگ: نزدیک‌ترین حمایت زیر قیمت ورود
        برای شورت: نزدیک‌ترین مقاومت بالای قیمت ورود
        """
        sr_levels = sr_result.get("sr_levels", [])
        # بافر مبتنی بر پیپ نماد (نه درصدی از قیمت)
        buffer = 5 * pip_value

        if is_long:
            # نزدیک‌ترین حمایت زیر قیمت ورود
            nearest = sr_result.get("nearest_support")
            if nearest is not None and nearest < entry:
                # حد ضرر کمی زیر حمایت
                return nearest - buffer

            # جستجو در لیست سطوح
            supports = [
                lvl["price"]
                for lvl in sr_levels
                if lvl.get("type") == "support" and lvl["price"] < entry
            ]
            if supports:
                nearest_support = max(supports)
                return nearest_support - buffer
        else:
            # نزدیک‌ترین مقاومت بالای قیمت ورود
            nearest = sr_result.get("nearest_resistance")
            if nearest is not None and nearest > entry:
                return nearest + buffer

            # جستجو در لیست سطوح
            resistances = [
                lvl["price"]
                for lvl in sr_levels
                if lvl.get("type") == "resistance" and lvl["price"] > entry
            ]
            if resistances:
                nearest_resistance = min(resistances)
                return nearest_resistance + buffer

        return None

    # ------------------------------------------------------------------
    # محاسبات داخلی TP
    # ------------------------------------------------------------------

    def _calculate_tp1(
        self,
        entry: float,
        risk_distance: float,
        sr_result: Dict[str, Any],
        is_long: bool,
        levels: RiskLevels,
    ) -> float:
        """
        محاسبه هدف اول (TP1): ریسک * ۱.۵ با تایید S/R.

        اگر سطح S/R مناسبی در نزدیکی TP1 محاسبه‌شده یافت شود،
        از آن استفاده می‌شود. در غیر این صورت از TP1 محاسباتی.
        """
        raw_tp1_distance = risk_distance * self._tp1_rr
        if is_long:
            raw_tp1 = entry + raw_tp1_distance
        else:
            raw_tp1 = entry - raw_tp1_distance

        # RR floor: قبلاً TP1 به نزدیک‌ترین S/R اسنپ می‌شد حتی اگر RR را زیر
        # tp1_rr می‌شکست (علت اصلی LOW_RR در اکثر ستاپ‌ها). raw_tp1 خودش
        # RR=tp1_rr را تضمین می‌کند؛ پس S/R نزدیک‌تر را فقط ثبت می‌کنیم و TP1 را
        # زیر کف RR نمی‌بریم. ستاپی که تا S/R فضای کافی ندارد، با کف RR می‌ماند و
        # در صورت ناکافی‌بودن کلِ RR توسط گارد ریسک رد می‌شود (نه با TP خفه‌شده).
        sr_tp1 = self._find_sr_tp(entry, sr_result, is_long, raw_tp1)
        if sr_tp1 is not None:
            levels.sr_used_for_tp1 = sr_tp1
        tp1 = raw_tp1
        levels.calculation_notes.append(
            f"TP1: {round(tp1, 6)} (کف RR={self._tp1_rr})"
        )
        return tp1

    def _calculate_tp2(
        self,
        entry: float,
        risk_distance: float,
        sr_result: Dict[str, Any],
        is_long: bool,
        levels: RiskLevels,
    ) -> float:
        """
        محاسبه هدف دوم (TP2): ریسک * ۲.۵ با تایید فیبوناچی اکستنشن.

        سطوح فیبوناچی اکستنشن (۱۲۷.۲٪، ۱۶۱.۸٪، ۲۰۰٪) برای
        تایید TP2 استفاده می‌شوند.
        """
        raw_tp2_distance = risk_distance * self._tp2_rr
        if is_long:
            raw_tp2 = entry + raw_tp2_distance
        else:
            raw_tp2 = entry - raw_tp2_distance

        # تایید با فیبوناچی اکستنشن
        fib_ext = sr_result.get("fibonacci_extension", {})
        fib_levels = fib_ext.get("levels", {})

        fib_tp2 = self._find_nearest_fib_level(raw_tp2, fib_levels, is_long)

        if fib_tp2 is not None:
            levels.fib_used_for_tp2 = fib_tp2
            # استفاده از سطح فیبوناچی اگر در محدوده مناسب باشد
            proximity = abs(fib_tp2 - raw_tp2) / raw_tp2 * 100
            if proximity <= FIB_PROXIMITY_PCT:
                tp2 = fib_tp2
                levels.calculation_notes.append(
                    f"TP2: {round(tp2, 6)} (فیبو تایید: {round(fib_tp2, 6)}, فاصله: {round(proximity, 2)}%)"
                )
            else:
                tp2 = raw_tp2
                levels.calculation_notes.append(
                    f"TP2: {round(tp2, 6)} (فیبو دور: {round(fib_tp2, 6)}, فاصله: {round(proximity, 2)}%)"
                )
        else:
            tp2 = raw_tp2
            levels.calculation_notes.append(
                f"TP2: {round(tp2, 6)} (بدون تایید فیبوناچی)"
            )

        return tp2

    def _calculate_tp3(
        self,
        entry: float,
        risk_distance: float,
        smc_result: Dict[str, Any],
        is_long: bool,
        levels: RiskLevels,
    ) -> float:
        """
        محاسبه هدف سوم (TP3): ریسک * ۴.۰ با تایید اوردر بلاک / عرضه-تقاضا.

        نواحی عرضه (برای لانگ) یا تقاضا (برای شورت) از تحلیل
        اسمارت مانی برای تایید TP3 استفاده می‌شوند.
        """
        raw_tp3_distance = risk_distance * self._tp3_rr
        if is_long:
            raw_tp3 = entry + raw_tp3_distance
        else:
            raw_tp3 = entry - raw_tp3_distance

        # تایید با اوردر بلاک / عرضه-تقاضا
        ob_tp3 = self._find_ob_tp(entry, smc_result, is_long, raw_tp3)

        if ob_tp3 is not None:
            levels.ob_used_for_tp3 = ob_tp3
            proximity = abs(ob_tp3 - raw_tp3) / raw_tp3 * 100
            if proximity <= OB_PROXIMITY_PCT:
                # از لبه ناحیه عرضه/تقاضا استفاده کن (محافظه‌کارانه)
                if is_long:
                    tp3 = min(raw_tp3, ob_tp3)
                else:
                    tp3 = max(raw_tp3, ob_tp3)
                levels.calculation_notes.append(
                    f"TP3: {round(tp3, 6)} (OB/SD تایید: {round(ob_tp3, 6)})"
                )
            else:
                tp3 = raw_tp3
                levels.calculation_notes.append(
                    f"TP3: {round(tp3, 6)} (OB/SD دور: {round(ob_tp3, 6)}, فاصله: {round(proximity, 2)}%)"
                )
        else:
            tp3 = raw_tp3
            levels.calculation_notes.append(
                f"TP3: {round(tp3, 6)} (بدون تایید OB/SD)"
            )

        return tp3

    # ------------------------------------------------------------------
    # یافتن سطوح تایید
    # ------------------------------------------------------------------

    def _find_sr_tp(
        self,
        entry: float,
        sr_result: Dict[str, Any],
        is_long: bool,
        raw_tp: float,
    ) -> Optional[float]:
        """
        یافتن سطح S/R مناسب در نزدیکی TP محاسبه‌شده.

        برای لانگ: مقاومت‌ها در محدوده raw_tp
        برای شورت: حمایت‌ها در محدوده raw_tp
        """
        sr_levels = sr_result.get("sr_levels", [])
        candidates: List[float] = []

        for lvl in sr_levels:
            price = lvl["price"]
            if is_long and price > entry:
                # مقاومت در مسیر صعود
                proximity = abs(price - raw_tp) / raw_tp * 100
                if proximity <= SR_PROXIMITY_PCT:
                    candidates.append(price)
            elif not is_long and price < entry:
                # حمایت در مسیر نزول
                proximity = abs(price - raw_tp) / raw_tp * 100
                if proximity <= SR_PROXIMITY_PCT:
                    candidates.append(price)

        if not candidates:
            # بررسی پیوت‌ها
            pivots = sr_result.get("pivots", {})
            standard = pivots.get("standard", {})
            for key, price in standard.items():
                if price is None:
                    continue
                if is_long and price > entry:
                    proximity = abs(price - raw_tp) / raw_tp * 100
                    if proximity <= SR_PROXIMITY_PCT:
                        candidates.append(price)
                elif not is_long and price < entry:
                    proximity = abs(price - raw_tp) / raw_tp * 100
                    if proximity <= SR_PROXIMITY_PCT:
                        candidates.append(price)

        if candidates:
            # نزدیک‌ترین به TP محاسبه‌شده
            return min(candidates, key=lambda p: abs(p - raw_tp))
        return None

    def _find_nearest_fib_level(
        self,
        raw_tp: float,
        fib_levels: Dict[str, float],
        is_long: bool,
    ) -> Optional[float]:
        """
        یافتن نزدیک‌ترین سطح فیبوناچی اکستنشن به TP محاسبه‌شده.

        فقط سطوحی که در جهت صحیح هستند بررسی می‌شوند.
        """
        candidates: List[float] = []
        for level_name, price in fib_levels.items():
            if price is None:
                continue
            proximity = abs(price - raw_tp) / raw_tp * 100
            if proximity <= FIB_PROXIMITY_PCT:
                candidates.append(price)

        if candidates:
            return min(candidates, key=lambda p: abs(p - raw_tp))
        return None

    def _find_ob_tp(
        self,
        entry: float,
        smc_result: Dict[str, Any],
        is_long: bool,
        raw_tp: float,
    ) -> Optional[float]:
        """
        یافتن ناحیه اوردر بلاک یا عرضه-تقاضا مناسب برای TP3.

        برای لانگ: ناحیه عرضه (supply) بالای قیمت ورود
        برای شورت: ناحیه تقاضا (demand) پایین قیمت ورود
        """
        candidates: List[float] = []

        # بررسی اوردر بلاک‌ها
        order_blocks = smc_result.get("order_blocks", [])
        for ob in order_blocks:
            ob_type = ob.get("type", "")
            ob_high = ob.get("high", 0)
            ob_low = ob.get("low", 0)

            if is_long and ob_type == "bearish" and ob_low > entry:
                # ناحیه عرضه (لبه پایین)
                proximity = abs(ob_low - raw_tp) / raw_tp * 100
                if proximity <= OB_PROXIMITY_PCT:
                    candidates.append(ob_low)
            elif not is_long and ob_type == "bullish" and ob_high < entry:
                # ناحیه تقاضا (لبه بالا)
                proximity = abs(ob_high - raw_tp) / raw_tp * 100
                if proximity <= OB_PROXIMITY_PCT:
                    candidates.append(ob_high)

        # بررسی نواحی عرضه و تقاضا
        sd_zones = smc_result.get("supply_demand_zones", [])
        for zone in sd_zones:
            zone_type = zone.get("type", "")
            zone_high = zone.get("high", 0)
            zone_low = zone.get("low", 0)

            if is_long and zone_type == "supply" and zone_low > entry:
                proximity = abs(zone_low - raw_tp) / raw_tp * 100
                if proximity <= OB_PROXIMITY_PCT:
                    candidates.append(zone_low)
            elif not is_long and zone_type == "demand" and zone_high < entry:
                proximity = abs(zone_high - raw_tp) / raw_tp * 100
                if proximity <= OB_PROXIMITY_PCT:
                    candidates.append(zone_high)

        if candidates:
            return min(candidates, key=lambda p: abs(p - raw_tp))
        return None

    # ------------------------------------------------------------------
    # ابزارهای کمکی
    # ------------------------------------------------------------------

    @staticmethod
    def _get_pip_value(symbol: str) -> float:
        """دریافت مقدار یک پیپ برای نماد.

        پارامترها:
            symbol: نماد معاملاتی

        خروجی:
            مقدار یک پیپ بر حسب واحد قیمت
        """
        return settings.pip_values.get(symbol, 0.0001)

    @staticmethod
    def _get_pip_dollar_value(symbol: str, lot_size: float = 1.0) -> float:
        """
        محاسبه ارزش دلاری یک پیپ برای یک لات استاندارد.

        برای جفت‌ارزهای XXX/USD: ارزش هر پیپ = 10 دلار (۱ لات استاندارد)
        برای طلا: هر ۰.۱ واحد = ۱ دلار  =>  هر پیپ = ۱۰ دلار
        برای شاخص‌ها: بستگی به اندازه قرارداد دارد

        پارامترها:
            symbol: نماد
            lot_size: حجم معامله به لات

        خروجی:
            ارزش دلاری یک پیپ
        """
        # منبع واحد حقیقت: src.core.instruments
        return pip_dollar_of(symbol) * lot_size

    @staticmethod
    def price_to_pips(symbol: str, price_distance: float) -> float:
        """تبدیل فاصله قیمتی به پیپ.

        پارامترها:
            symbol: نماد معاملاتی
            price_distance: فاصله قیمتی

        خروجی:
            تعداد پیپ
        """
        pip_value = settings.pip_values.get(symbol, 0.0001)
        if pip_value == 0:
            return 0.0
        return abs(price_distance) / pip_value

    @staticmethod
    def pips_to_price(symbol: str, pips: float) -> float:
        """تبدیل پیپ به فاصله قیمتی.

        پارامترها:
            symbol: نماد معاملاتی
            pips: تعداد پیپ

        خروجی:
            فاصله قیمتی معادل
        """
        pip_value = settings.pip_values.get(symbol, 0.0001)
        return abs(pips) * pip_value

    @staticmethod
    def calculate_pnl(
        symbol: str,
        direction: str,
        entry_price: float,
        current_price: float,
        lot_size: float = 1.0,
    ) -> Dict[str, float]:
        """
        محاسبه سود/زیان فعلی به پیپ و دلار.

        پارامترها:
            symbol: نماد
            direction: جهت معامله
            entry_price: قیمت ورود
            current_price: قیمت فعلی
            lot_size: حجم معامله

        خروجی:
            دیکشنری شامل pnl_pips و pnl_dollar
        """
        pip_value = settings.pip_values.get(symbol, 0.0001)
        pip_dollar = pip_dollar_of(symbol) * lot_size

        if direction == "long":
            pnl_pips = (current_price - entry_price) / pip_value
        else:
            pnl_pips = (entry_price - current_price) / pip_value

        pnl_dollar = pnl_pips * pip_dollar

        return {
            "pnl_pips": round(pnl_pips, 2),
            "pnl_dollar": round(pnl_dollar, 2),
        }
