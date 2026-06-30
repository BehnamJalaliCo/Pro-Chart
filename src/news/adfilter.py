"""فیلترِ تبلیغاتِ بروکر/پراپ‌فرم — جلوگیری از ورودِ هرگونه تبلیغ/رپورتاژ/پرس‌ریلیز.

طبق درخواستِ مالک: به‌هیچ‌عنوان تبلیغِ هیچ بروکری منتشر نشود.

طراحی (تیتر-محور تا false-positive ندهد):
  • نامِ بروکر/پراپ‌فرم در «تیتر» → تبلیغ (پرس‌ریلیز همیشه نامِ شرکت را در تیتر دارد).
  • عبارتِ تبلیغیِ «قوی» در تیتر → تبلیغ.
  • نامِ بروکر + عبارتِ تبلیغیِ قوی در «متن» → تبلیغ.
  • «بروکر/broker/کارگزاری»ِ تنها سیگنالِ ضعیف است (در تحلیلِ سالم هم می‌آید) و
    به‌تنهایی چیزی را رد نمی‌کند تا تحلیل‌های واقعی پاک نشوند.
"""

from __future__ import annotations

# نام‌های بروکر/پراپ‌فرم/شرکت‌های مالی (انگلیسی)
_BROKERS = (
    "etoro", "exness", "avatrade", "ava trade", "pepperstone", "plus500", "plus 500",
    "roboforex", "robo forex", "octafx", "octa fx", "instaforex", "insta forex",
    "litefinance", "liteforex", "lite forex", "fxtm", "forextime", "ic markets",
    "icmarkets", "fxpro", "fx pro", "hotforex", "hfm markets", "tickmill",
    "admiral markets", "admirals", "thinkmarkets", "think markets", "blackbull",
    "eightcap", "fusion markets", "cmc markets", "fxopen", "fx open", "fbs broker",
    "fbs markets", "alpari", "libertex", "capital.com", "markets.com", "fxcm",
    "ig group", "ig markets", "axitrader", "bdswiss", "fxprimus", "windsor broker",
    "amarkets", "just2trade", "justmarkets", "just markets", "skilling",
    "fxchoice", "coinexx", "xmtrading", "xm group", "xm broker", "xm.com", "oanda",
    "saxo bank", "vantage markets", "vantage fx", "opofinance",
    "easymarkets", "easy markets", "switch markets", "primexbt", "prime xbt",
    "fxify", "swissquote", "dukascopy", "ironfx", "iron fx", "weltrade",
    "world forex", "grand capital", "grandcapital", "moneta markets",
    "blueberry markets", "errante", "tradeview", "purple trading",
    "key to markets", "hycm", "city index",
    # پراپ‌فرم‌ها
    "ftmo", "fundednext", "funded next", "the5ers", "the 5ers", "myforexfunds",
    "funding pips", "fundingpips", "e8 markets", "e8 funding", "the funded trader",
    "topstep", "apex trader", "fpfx", "alpha capital", "blueberry funded",
)

# ترجمهٔ فارسیِ نامِ بروکرها/شرکت‌ها (تیترهای ترجمه‌شده)
_BROKERS_FA = (
    "ایزی‌مارکتس", "ایزی مارکتس", "لیبرتکس", "سوئیچ مارکتس", "پرایم‌ایکس‌بی‌تی",
    "پرایم ایکس بی تی", "دوکاس‌کپی", "سوئیس‌کوت", "آیرون‌اف‌ایکس", "اکسنس",
    "پپرستون", "اواترید", "آوا ترید", "اوپوفایننس", "آلپاری", "ای‌توترید",
    "ای توترید", "روبوفارکس", "لایت فایننس", "لایت‌فایننس", "ولترید",
    "اف‌ایکس‌پرو", "اف ایکس پرو", "تیک‌میل", "اکتافارکس", "اف‌بی‌اس",
    "ویندزور", "هات‌فارکس", "اینستافارکس", "اف‌ایکس‌تی‌ام", "وانتیج", "ساکسو",
    "آی‌سی مارکتس", "آی‌سی‌مارکتس",
)

# عبارت‌های تبلیغیِ «قوی» (بدونِ ابهام) — انگلیسی
_AD_PHRASES_EN = (
    "best broker", "top broker", "best forex broker", "best forex brokers",
    "broker review", "broker of the year", "trusted broker", "best brokers",
    "sponsored", "advertorial", "press release", "sign-up bonus", "sign up bonus",
    "deposit bonus", "no deposit bonus", "welcome bonus", "best trading platform",
    "open a trading account", "best mt4 broker", "best mt5 broker", "best ctrader",
    "low spread broker", "best cfd broker", "prop trading", "prop firm",
    "proprietary trading firm", "ifx expo", "fintech award", "giveaway",
    "funded trader", "funded account", "challenge account",
)

# عبارت‌های تبلیغیِ «قوی» — فارسی
_AD_PHRASES_FA = (
    "بهترین بروکر", "معرفی بروکر", "بروکر فارکس", "بروکرهای فارکس", "کارگزاری فارکس",
    "بهترین کارگزاری", "کارگزاری آنلاین فارکس", "ثبت‌نام در بروکر", "ثبت نام در بروکر",
    "افتتاح حساب", "بونوس", "پاداش ثبت‌نام", "پاداش ثبت نام", "رپورتاژ",
    "حساب معاملاتی رایگان", "بدون احراز هویت", "اسپرد پایین", "پراپ‌تریدینگ",
    "پراپ تریدینگ", "پراپ‌فرم", "پراپ فرم", "نمایشگاه فینتک", "آی‌اف‌ایکس",
    "قرعه‌کشی", "جوایز صنعت", "نامزدی جوایز", "حساب فاندد", "حساب چالش",
    "تجربه معاملاتی جدید",
)


def is_broker_ad(title: str, body: str = "") -> bool:
    """True اگر محتوا تبلیغ/رپورتاژ/پرس‌ریلیزِ بروکر/پراپ‌فرم باشد."""
    title = title or ""
    body = body or ""
    t_low = title.lower()
    full_low = (title + " " + body).lower()
    full_fa = title + " " + body

    broker_in_title = (
        any(b in t_low for b in _BROKERS) or any(b in title for b in _BROKERS_FA)
    )
    ad_in_title = (
        any(p in t_low for p in _AD_PHRASES_EN) or any(p in title for p in _AD_PHRASES_FA)
    )
    if broker_in_title or ad_in_title:
        return True

    # در متن: نامِ بروکر + عبارتِ تبلیغیِ قوی (نه فقط کلمهٔ «بروکر»)
    broker_anywhere = (
        any(b in full_low for b in _BROKERS) or any(b in full_fa for b in _BROKERS_FA)
    )
    ad_anywhere = (
        any(p in full_low for p in _AD_PHRASES_EN) or any(p in full_fa for p in _AD_PHRASES_FA)
    )
    return bool(broker_anywhere and ad_anywhere)
