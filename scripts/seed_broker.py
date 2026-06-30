"""ساختِ دیاگرام‌های بخش بروکر OneRoyal (HTML→PNG در edu_assets).

اجرا داخل bot-worker:
    docker compose exec bot-worker-1 python -m scripts.seed_broker
"""

from __future__ import annotations

import asyncio

from src.bot.education import diagrams as d
from src.core.logger import get_logger, setup_logging

logger = get_logger("scripts.seed_broker")

GREEN, BLUE, GOLD, PURPLE, CYAN, RED = d.GREEN, d.BLUE, d.GOLD, d.PURPLE, d.CYAN, d.RED

DIAGRAMS: dict[str, dict] = {
    # معرفی کلی
    "broker-intro": {
        "t": "infographic",
        "title": "بروکر OneRoyal",
        "subtitle": "شریکِ معاملاتیِ مطمئنِ شما در بازارِ جهانی",
        "height": 720,
        "center": '<div style="text-align:center;font-size:46px;font-weight:800;color:#fff;">🏦 OneRoyal</div>',
        "lead": "کارگزاریِ بین‌المللی با پشتیبانیِ فارسی، واریزِ ریالی و کریپتو — فعال از سال ۲۰۰۶.",
        "stats": [["۲۰ سال", "سابقهٔ فعالیت (از ۲۰۰۶)", GREEN],
                  ["۴ رگوله", "ASIC · CySEC · VFSC · FSA", BLUE],
                  ["۱:۱۰۰۰", "حداکثر اهرم", GOLD]],
    },
    # راهنمای ثبت‌نام
    "broker-steps": {
        "t": "steps",
        "title": "ثبت‌نام در OneRoyal",
        "subtitle": "شش گام تا شروعِ معامله",
        "height": 900,
        "color": BLUE,
        "steps": [["ورود از لینکِ رفرال", "روی «ثبت‌نام در OneRoyal» بزنید."],
                  ["ساختِ حساب", "ایمیل + انتخابِ کشور (ایران) + کدِ تأیید."],
                  ["تکمیلِ پروفایل", "نام، تاریخ تولد و چند سؤالِ مالیِ ساده."],
                  ["احراز هویت (KYC)", "مدرکِ شناسایی + سلفی؛ تأییدِ هوشمند."],
                  ["انتخابِ حساب و واریز", "Classic/ECN/Cent + واریزِ ریالی یا USDT."],
                  ["دانلودِ پلتفرم", "MT4/MT5 یا orTrader و شروعِ معامله."]],
        "note": "در هر مرحله، پشتیبانیِ فارسی در کنارِ شماست.",
    },
    # واریز و برداشت
    "broker-funding": {
        "t": "cards",
        "title": "واریز و برداشت",
        "subtitle": "سریع، متنوع و بدونِ کارمزدِ بروکر",
        "height": 660,
        "cols": 3,
        "cards": [["💰", "ریالی", "از طریقِ درگاهِ سورینکس — مناسبِ داخلِ ایران.", GREEN],
                  ["🪙", "رمزارز (USDT)", "روی شبکه‌های TRC20 و ERC20؛ کم‌هزینه.", BLUE],
                  ["💳", "بین‌المللی", "کارت، Skrill، Neteller و انتقالِ بانکی.", GOLD]],
        "note": "بدونِ کارمزدِ واریز/برداشت؛ پردازشِ اغلب سریع.",
    },
    # اشتراکِ رایگانِ همیشگی (از طریق بروکر)
    "free-sub": {
        "t": "steps",
        "title": "اشتراکِ رایگانِ همیشگیِ VIP",
        "subtitle": "سه قدم تا دسترسیِ رایگانِ مادام‌العمر به کانال",
        "height": 720,
        "color": GREEN,
        "steps": [["ثبت‌نام در OneRoyal", "با لینکِ اختصاصیِ ما حساب بساز."],
                  ["شارژِ حساب با ۵۰۰ دلار", "سرمایه متعلق به خودت است و با آن معامله می‌کنی."],
                  ["ارسالِ شناسه به پشتیبانی", "آیدی‌ات را بده تا دسترسیِ رایگان صادر شود."]],
        "note": "✅ پس از تأیید: اشتراکِ VIP <b>بدونِ هیچ هزینهٔ ماهانه‌ای</b> و همیشگی!",
    },
    # معرفیِ دستیارِ هوش مصنوعی
    "ai-intro": {
        "t": "infographic",
        "title": "دستیارِ هوش مصنوعیِ فارکس",
        "subtitle": "متخصصِ بازارهای مالی، همیشه در دسترسِ شما",
        "height": 700,
        "center": '<div style="text-align:center;font-size:48px;font-weight:800;color:#fff;">🤖 💹</div>',
        "lead": "هر پرسشی دربارهٔ فارکس، طلا، شاخص‌ها و کریپتو داری بپرس — تحلیل، مفاهیم و مدیریتِ ریسک.",
        "stats": [["۲۴/۷", "همیشه پاسخگو", GREEN],
                  ["تخصصی", "فقط بازارِ مالی", BLUE],
                  ["فوری", "پاسخِ لحظه‌ای", GOLD]],
    },
    # امکانات و اعتبار
    "broker-features": {
        "t": "cards",
        "title": "امکانات و اعتبارِ OneRoyal",
        "subtitle": "چرا یک انتخابِ حرفه‌ای است",
        "height": 700,
        "cols": 2,
        "cards": [["🛡️", "رگولاتوری", "ASIC، CySEC، VFSC، FSA + عضوِ FinaCom.", GREEN],
                  ["📊", "انواعِ حساب", "Cent از ۵$، Classic، ECN، اسلامی.", BLUE],
                  ["🧰", "۲۰۰۰+ نماد", "فارکس، طلا، نفت، شاخص، سهام و کریپتو.", GOLD],
                  ["⭐", "اعتبار", "امتیازِ ~۴.۴ از ۵ در Trustpilot.", PURPLE]],
        "note": "پشتیبانیِ فارسیِ ۲۴ساعته + پلتفرم‌های MT4/MT5.",
    },
}


async def seed() -> None:
    ok = 0
    for name, spec in DIAGRAMS.items():
        path = await d.render_spec(spec, name)
        if path:
            ok += 1
            logger.info("broker_diagram_ok", name=name)
        else:
            logger.error("broker_diagram_failed", name=name)
    print(f"broker diagrams: {ok}/{len(DIAGRAMS)}")


async def main() -> None:
    setup_logging()
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
