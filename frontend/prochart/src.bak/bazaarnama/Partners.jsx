import React from 'react';
import { X, Check, ShieldCheck, Zap, Coins, TrendingUp, ArrowLeft, Star } from 'lucide-react';

// پارتنرهای رسمی (رفرال) — دیزاینِ بازاریابیِ حرفه‌ای برای جذبِ کاربر.
// لینک‌های رفرال ثابت‌اند (کاربر تأیید کرده). لوگوها در public/partners/*.svg.
const LBANK_URL = 'https://www.lbank.com/signup/a?icode=TRADEYAR';
const ONEROYAL_URL = 'https://vc.cabinet.oneroyal.com/fa/links/go/12412';

const PARTNERS = [
  {
    id: 'lbank',
    name: 'LBank',
    logo: '/partners/lbank.svg',
    logoRemote: 'https://logo.clearbit.com/lbank.com',
    kind: 'صرافیِ ارز دیجیتال',
    badge: 'پیشنهادِ ویژهٔ کریپتو',
    Icon: Coins,
    // پالتِ برندِ LBank (آبی–فیروزه‌ای)
    accent: '#1f6fff', accent2: '#1db8c9',
    tagline: 'خرید و فروشِ +۵۰۰ ارزِ دیجیتال با کارمزدِ پایین و نقدینگیِ بالا',
    perks: [
      'کارمزدِ رقابتی روی اسپات و فیوچرز',
      '+۵۰۰ ارزِ دیجیتال و صدها جفت‌ارز',
      'واریز/برداشتِ سریع و پشتیبانیِ ۲۴ ساعته',
      'اپلیکیشنِ موبایل + امنیتِ سطحِ سازمانی',
    ],
    cta: 'ثبت‌نامِ رایگان در LBank',
    reward: 'با ثبت‌نام از این لینک، از پاداش‌ها و کارمزدِ ویژهٔ کاربرانِ Pro-Chart بهره‌مند شو.',
    url: LBANK_URL,
  },
  {
    id: 'oneroyal',
    name: 'One Royal',
    logo: '/partners/oneroyal.svg',
    logoRemote: 'https://logo.clearbit.com/oneroyal.com',
    kind: 'بروکرِ فارکس',
    badge: 'بروکرِ رگوله‌شده',
    Icon: TrendingUp,
    // پالتِ برندِ One Royal (سرمه‌ای–طلایی)
    accent: '#c79a3a', accent2: '#0a1e3f',
    tagline: 'معاملهٔ فارکس، طلا و شاخص‌ها با اسپردِ کم و اجرای سریع',
    perks: [
      'رگولهٔ معتبر و امنیتِ سرمایه',
      'اسپردِ کم از ۰.۰ پیپ + اجرای سریع',
      'اهرمِ انعطاف‌پذیر و ابزارهای حرفه‌ای',
      'واریز/برداشتِ آسان + پشتیبانیِ فارسی',
    ],
    cta: 'افتتاحِ حساب در One Royal',
    reward: 'حسابت را از این لینک باز کن تا زیرمجموعهٔ Pro-Chart شوی و از مزایای اختصاصی استفاده کنی.',
    url: ONEROYAL_URL,
  },
];

function PartnerCard({ p, TH }) {
  const { Icon } = p;
  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
      {/* نوارِ رنگیِ برند بالای کارت */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})` }} />
      {/* هالهٔ نرمِ برند */}
      <div className="pointer-events-none absolute -top-16 -left-16 w-52 h-52 rounded-full opacity-20 blur-2xl" style={{ background: p.accent }} />
      <div className="relative p-4 sm:p-5 flex flex-col gap-3.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: p.accent + '22', color: p.accent }}>
            <Star size={11} className="fill-current" /> {p.badge}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: TH.text, opacity: 0.7 }}>{p.kind}</span>
        </div>

        {/* لوگو روی زمینهٔ روشن تا در هر تم خوانا باشد */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-center" style={{ background: '#ffffff', border: `1px solid ${TH.border}` }}>
          <img src={p.logoRemote || p.logo} alt={p.name} className="h-9 w-auto max-w-[160px] object-contain" loading="lazy"
            onError={(e) => { if (p.logo && e.currentTarget.src !== window.location.origin + p.logo) { e.currentTarget.onerror = null; e.currentTarget.src = p.logo; } }} />
        </div>

        <p className="text-[13px] leading-6" style={{ color: TH.textStrong }}>{p.tagline}</p>

        <ul className="flex flex-col gap-2 mt-0.5">
          {p.perks.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: TH.text }}>
              <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: p.accent + '22', color: p.accent }}><Check size={11} /></span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-1 flex flex-col gap-2">
          <a href={p.url} target="_blank" rel="noopener noreferrer sponsored"
            className="group w-full py-3 rounded-xl text-center text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, boxShadow: `0 8px 22px -8px ${p.accent}` }}>
            <Icon size={17} /> {p.cta}
            <ArrowLeft size={16} className="transition-transform duration-150 group-hover:-translate-x-1" />
          </a>
          <p className="text-[11px] leading-5 flex items-start gap-1.5" style={{ color: TH.text, opacity: 0.75 }}>
            <Zap size={12} className="mt-0.5 shrink-0" style={{ color: p.accent }} /> {p.reward}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Partners({ open, onClose, TH }) {
  if (!open) return null;
  const T = TH || { panel: '#131722', bg: '#0b0e14', border: '#2a2e39', text: '#b2b5be', textStrong: '#d1d4dc', accent: '#2962FF' };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center pt-[6vh] px-3 overflow-auto" dir="rtl"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-[min(760px,96vw)] rounded-2xl overflow-hidden shadow-2xl" style={{ background: T.bg, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
        {/* هدرِ جذاب */}
        <div className="relative px-5 py-4 flex items-start justify-between" style={{ background: `linear-gradient(120deg, ${T.panel}, ${T.bg})`, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: (T.accent || '#2962FF') + '22', color: T.accent }}><ShieldCheck size={12} /> پارتنرهای رسمیِ Pro-Chart</span>
            </div>
            <h2 className="mt-2 text-lg font-black" style={{ color: T.textStrong }}>با بهترین‌ها معامله کن 🚀</h2>
            <p className="text-[12px] mt-0.5" style={{ color: T.text }}>برای کریپتو و فارکس، صرافی و بروکرِ منتخبِ ما را انتخاب کن و از مزایای اختصاصی بهره‌مند شو.</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="pc-iconbtn w-8 h-8 shrink-0" style={{ color: T.text }}><X size={18} /></button>
        </div>

        {/* دو کارت */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PARTNERS.map((p) => <PartnerCard key={p.id} p={p} TH={T} />)}
        </div>

        {/* دیسکلیمرِ ریسک */}
        <div className="px-5 pb-4 -mt-1">
          <p className="text-[10.5px] leading-5 text-center" style={{ color: T.text, opacity: 0.6 }}>
            ⚠️ معامله در بازارهای مالی ریسک دارد و ممکن است به از دست رفتنِ سرمایه منجر شود. لینک‌های بالا رفرال (سازمانی) هستند؛ انتخاب و مسئولیتِ افتتاحِ حساب با خودِ شماست.
          </p>
        </div>
      </div>
    </div>
  );
}
