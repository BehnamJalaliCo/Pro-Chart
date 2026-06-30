import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// ─────────────────────────────────────────────────────────────────────────────
// Legal.jsx — صفحهٔ «قوانین استفاده و حریمِ خصوصیِ» اصیلِ بازارنما (Pro·Chart)
//
//  • متنِ حقوقیِ کاملاً اصیلِ خودِ بازارنماست؛ ساختار از سایت‌های معتبرِ جهانی
//    الهام گرفته شده ولی هیچ بخشی کپیِ کلمه‌به‌کلمه نیست.
//  • کاملاً مستقل و خوداتکا: نه react-router لازم دارد، نه ویرایشِ هیچ فایلِ دیگر.
//      ۱) با رویدادِ سراسریِ `bn:terms` (که از منوی همبرگری/AuthMenu dispatch می‌شود)
//         به‌صورتِ مودالِ تمام‌صفحه باز می‌شود — دقیقاً مثلِ PremiumModal.
//      ۲) یا به‌عنوانِ یک صفحهٔ معمولی با <LegalPage/> در هر route نمایش داده می‌شود.
//      ۳) یا با propِ اختیاریِ open/onClose به‌صورتِ کنترل‌شده.
//  • تمِ روز/شب را از همان workspaceِ بازارنما (`bn_workspace.theme`) می‌خواند تا
//    با چارت هماهنگ بماند. RTL فارسی، فونتِ فعلیِ پروژه (AnjomanMax/Vazirmatn).
//  • backward-compatible: هیچ propِ موجودی حذف/تغییرِ نام نشده؛ همه اختیاری‌اند.
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORT_TG = 'https://t.me/CoinProFXBot'; // پشتیبانِ رسمیِ CoinePro FX
const SUPPORT_HANDle = '@CoinProFXBot';
const BRAND = 'بازارنما';
const BRAND_EN = 'Pro·Chart';
const LAST_UPDATE = '۹ تیر ۱۴۰۵'; // تاریخِ آخرین بازنگری (به‌روزرسانیِ دستی)

// پالتِ تمِ هماهنگ با THEMES چارتِ بازارنما — بدونِ وابستگیِ import (خوداتکا).
const PALETTE = {
  dark: {
    mask: 'rgba(3,6,12,.72)', bg: '#131722', panel: '#1b1f2a', raised: '#1e2330',
    border: '#2a2e39', borderSoft: 'rgba(255,255,255,.06)',
    text: '#b2b5be', strong: '#e8eaed', muted: '#787b86',
    accent: '#2962FF', accentSoft: 'rgba(41,98,255,.14)',
    chip: 'rgba(255,255,255,.05)', chipHover: 'rgba(255,255,255,.09)',
    up: '#26a69a', warn: '#f0b429', warnSoft: 'rgba(240,180,41,.12)',
    scroll: 'rgba(255,255,255,.16)',
  },
  light: {
    mask: 'rgba(20,28,44,.38)', bg: '#ffffff', panel: '#f7f9fc', raised: '#ffffff',
    border: '#e0e3eb', borderSoft: 'rgba(19,23,34,.08)',
    text: '#3c4150', strong: '#0f1320', muted: '#787b86',
    accent: '#2962FF', accentSoft: 'rgba(41,98,255,.10)',
    chip: 'rgba(19,23,34,.04)', chipHover: 'rgba(19,23,34,.07)',
    up: '#089981', warn: '#9a6700', warnSoft: 'rgba(240,180,41,.16)',
    scroll: 'rgba(19,23,34,.18)',
  },
};

const readTheme = () => {
  try {
    const ws = JSON.parse(localStorage.getItem('bn_workspace') || '{}') || {};
    return ws.theme === 'light' ? 'light' : 'dark';
  } catch (e) { return 'dark'; }
};

// ─── محتوای حقوقی (اصیل) ─────────────────────────────────────────────────────
// هر بخش: { id, title, body: [paragraph|{list:[...]}] }
const SECTIONS = [
  {
    id: 'intro',
    title: '۱) پذیرشِ شرایط',
    body: [
      `با ورود، ثبت‌نام یا استفاده از پلتفرمِ ${BRAND} (${BRAND_EN}) — اعم از وب، نسخهٔ موبایل یا هر سرویسِ مرتبط — شما تأیید می‌کنید که این «شرایطِ استفاده و سیاستِ حریمِ خصوصی» را به‌طورِ کامل خوانده، درک کرده و پذیرفته‌اید. این سند یک توافق‌نامهٔ حقوقیِ الزام‌آور میانِ شما (کاربر) و بازارنماست.`,
      `چنانچه با هر بخشی از این شرایط موافق نیستید، لطفاً از سرویس استفاده نکنید. ادامهٔ استفاده پس از انتشارِ هر نسخهٔ به‌روزشده، به‌منزلهٔ پذیرشِ همان نسخه است.`,
      `استفاده از این سرویس مشروط به آن است که سنِ قانونیِ لازم برای انعقادِ قرارداد را داشته باشید و طبقِ قوانینِ حوزهٔ قضاییِ محلِ اقامتِ خود مجاز به استفاده از ابزارهای تحلیلِ بازارهای مالی باشید.`,
    ],
  },
  {
    id: 'service',
    title: '۲) ماهیتِ سرویس — ابزارِ تحلیل، نه توصیهٔ مالی',
    body: [
      `${BRAND} یک «ابزارِ تحلیلِ تکنیکالِ بازار» است: نمودار، اندیکاتور، اسکریپت‌نویسی، دیده‌بانِ نماد، تقویمِ اقتصادی و امکاناتِ آموزشی را در اختیارِ شما می‌گذارد تا خودتان بازار را تحلیل و تصمیم‌گیری کنید.`,
      `هیچ‌یک از محتوا، سیگنال، عدد، نمودار، خروجیِ هوشِ مصنوعی یا تحلیلِ ارائه‌شده در این پلتفرم «مشاورهٔ سرمایه‌گذاری»، «توصیهٔ مالی»، «دعوت به خرید یا فروش» یا «تضمینِ نتیجه» تلقی نمی‌شود. تمامِ تصمیماتِ معاملاتی صرفاً برعهدهٔ خودِ شماست.`,
      { list: [
        `ما کارگزار (بروکر) نیستیم و سفارشِ معاملاتیِ شما را نزدِ خود نگه نمی‌داریم.`,
        `داده‌های قیمتی ممکن است با تأخیر، تقریبی یا از منابعِ ثالث باشند و نباید مبنای انحصاریِ اجرای معامله قرار گیرند.`,
        `خروجیِ ابزارهای هوشِ مصنوعی و اسکریپت‌های کاربری می‌توانند خطا داشته باشند و باید مستقل بازبینی شوند.`,
      ] },
      `${BRAND} هیچ مسئولیتی در قبالِ سود یا زیانِ ناشی از تصمیماتی که بر پایهٔ اطلاعاتِ این پلتفرم گرفته می‌شوند نمی‌پذیرد.`,
    ],
  },
  {
    id: 'risk',
    title: '۳) هشدارِ ریسکِ بازار',
    risk: true,
    body: [
      `معامله در بازارهای مالی (فارکس، شاخص‌ها، کالاها و رمزارزها) با ریسکِ بالا همراه است و ممکن است به از دست رفتنِ بخشی یا تمامِ سرمایهٔ شما بینجامد. این فعالیت برای همهٔ افراد مناسب نیست.`,
      `اهرم (Leverage) می‌تواند سود و زیان را به یک اندازه بزرگ کند؛ زیانِ احتمالی ممکن است از مبلغِ اولیهٔ شما فراتر رود. عملکردِ گذشته — چه واقعی و چه شبیه‌سازی‌شده — هیچ تضمینی برای نتایجِ آینده نیست.`,
      `پیش از هر معامله، اهدافِ سرمایه‌گذاری، سطحِ تجربه و میزانِ تحملِ ریسکِ خود را بسنجید و در صورتِ نیاز از مشاورِ مالیِ مستقلِ دارای مجوز کمک بگیرید. هرگز با سرمایه‌ای که توانِ از دست دادنش را ندارید معامله نکنید.`,
    ],
  },
  {
    id: 'account',
    title: '۴) حساب کاربری و مسئولیتِ شما',
    body: [
      `برای دسترسی به برخی امکانات لازم است حسابِ کاربری بسازید. شما موظف‌اید اطلاعاتِ درست ارائه دهید و محرمانگیِ اطلاعاتِ ورود (رمز/توکن) را حفظ کنید. مسئولیتِ تمامِ فعالیت‌هایی که از طریقِ حسابِ شما انجام می‌شود برعهدهٔ خودِ شماست.`,
      { list: [
        `از سرویس برای فعالیتِ غیرقانونی، نقضِ حقوقِ دیگران یا اخلال در پلتفرم استفاده نکنید.`,
        `تلاش برای مهندسیِ معکوس، نفوذ، استخراجِ انبوهِ داده یا دور زدنِ محدودیت‌ها ممنوع است.`,
        `اسکریپت‌ها و محتوایی که می‌سازید نباید بدافزار، اسپم یا محتوای مجرمانه باشند.`,
      ] },
      `در صورتِ نقضِ این شرایط، بازارنما می‌تواند بدونِ اطلاعِ قبلی دسترسیِ حساب را محدود یا مسدود کند.`,
    ],
  },
  {
    id: 'privacy',
    title: '۵) حریمِ خصوصی و داده‌ها',
    body: [
      `حفظِ حریمِ خصوصیِ شما برای ما اهمیت دارد. تنها داده‌هایی را گردآوری می‌کنیم که برای ارائه و بهبودِ سرویس لازم‌اند و آن‌ها را با حداقلِ دسترسی و رمزنگاریِ متعارف نگه می‌داریم.`,
      `داده‌هایی که ممکن است پردازش شوند:`,
      { list: [
        `اطلاعاتِ حساب: شناسهٔ کاربری و اطلاعاتِ ورود/احرازِ هویت.`,
        `تنظیماتِ کاری: چیدمانِ نمودار، دیده‌بان، تمِ روز/شب و اسکریپت‌های شما (عمدتاً به‌صورتِ محلی روی مرورگرِ شما ذخیره می‌شوند).`,
        `داده‌های فنی: نوعِ مرورگر/دستگاه و گزارشِ خطا، صرفاً برای پایداری و امنیت.`,
      ] },
      `ما داده‌های شخصیِ شما را نمی‌فروشیم. اشتراک‌گذاری تنها در حدِ لازم با سرویس‌دهنده‌های زیرساختی (میزبانی/پرداخت) و در صورتِ الزامِ قانونی انجام می‌شود.`,
      `شما می‌توانید درخواستِ اصلاح یا حذفِ داده‌های حسابِ خود را از طریقِ پشتیبانی مطرح کنید. پاک‌کردنِ حافظهٔ مرورگر، تنظیماتِ محلیِ ذخیره‌شده را نیز حذف می‌کند.`,
    ],
  },
  {
    id: 'subscription',
    title: '۶) اشتراک و پرداخت',
    body: [
      `بخشی از امکاناتِ پیشرفته (مانندِ هوشِ مصنوعی، اسکریپت‌نویسیِ نمااسکریپت و قابلیت‌های ویژه) در قالبِ اشتراک ارائه می‌شوند. تعرفه‌ها:`,
      { plans: [
        { label: 'اشتراکِ ماهانه', price: '۲۵ تتر', unit: 'USDT / ماه' },
        { label: 'اشتراکِ سالانه', price: '۲۰۰ تتر', unit: 'USDT / سال', badge: 'صرفه‌جویی' },
      ] },
      `پرداخت‌ها با ارزِ دیجیتالِ تتر (USDT) انجام می‌شوند. پس از واریز، رسید/هشِ تراکنش را برای پشتیبانی ارسال کنید تا اشتراک پس از تأییدِ مدیر فعال شود.`,
      { list: [
        `اشتراک تا پایانِ دورهٔ پرداخت‌شده معتبر است و به‌طورِ خودکار تمدیدِ سرخود نمی‌شود.`,
        `به‌دلیلِ ماهیتِ دیجیتالی و فعال‌سازیِ آنیِ سرویس، مبالغِ پرداخت‌شده پس از فعال‌سازی عودت داده نمی‌شوند، مگر در مواردِ نقصِ فنیِ احرازشده از سمتِ ما.`,
        `قیمت‌ها ممکن است در آینده تغییر کنند؛ تغییر، اشتراکِ فعالِ جاری را تا پایانِ دوره متأثر نمی‌کند.`,
      ] },
    ],
  },
  {
    id: 'ip',
    title: '۷) مالکیتِ معنوی',
    body: [
      `تمامِ حقوقِ نرم‌افزار، طراحیِ رابطِ کاربری، نام و نشانِ ${BRAND} (${BRAND_EN})، موتورِ نمودار، اندیکاتورها، مستندات و محتوای آموزشی متعلق به بازارنما و دارندگانِ مجازِ آن است و تحتِ قوانینِ مالکیتِ معنوی حمایت می‌شود.`,
      `به شما یک مجوزِ محدود، غیرانحصاری و غیرقابلِ‌واگذاری برای استفادهٔ شخصی از سرویس داده می‌شود. کپی، توزیعِ مجدد، فروش یا استفادهٔ تجاری بدونِ اجازهٔ کتبی ممنوع است.`,
      `محتوا و اسکریپت‌هایی که خودتان می‌سازید متعلق به شماست؛ با این حال، با ساختِ آن‌ها روی پلتفرم، اجازهٔ فنیِ لازم برای ذخیره و اجرای آن‌ها در سرویس را به ما می‌دهید.`,
    ],
  },
  {
    id: 'changes',
    title: '۸) تغییراتِ سرویس و شرایط',
    body: [
      `ما می‌توانیم در هر زمان امکانات را افزوده، تغییر داده یا حذف کنیم و این شرایط را به‌روزرسانی نماییم. نسخهٔ معتبر همان نسخه‌ای است که در این صفحه نمایش داده می‌شود و تاریخِ «آخرین بازنگری» در بالای صفحه درج شده است.`,
      `در صورتِ تغییراتِ بااهمیت تلاش می‌کنیم از طریقِ پلتفرم اطلاع‌رسانی کنیم؛ اما مسئولیتِ مرورِ دوره‌ایِ این صفحه برعهدهٔ خودِ شماست. ادامهٔ استفاده پس از تغییر، به‌منزلهٔ پذیرشِ آن است.`,
      `این سرویس «همان‌گونه که هست» (as-is) ارائه می‌شود و ما تضمینی برای در دسترس بودنِ بی‌وقفه، بی‌نقص یا بدونِ خطا نمی‌دهیم.`,
    ],
  },
  {
    id: 'contact',
    title: '۹) تماس و پشتیبانی',
    body: [
      `برای هرگونه پرسش، درخواستِ مربوط به داده‌ها، مسائلِ اشتراک یا گزارشِ مشکل، با پشتیبانیِ رسمیِ CoinePro FX در ارتباط باشید. تیمِ پشتیبانی در سریع‌ترین زمانِ ممکن پاسخ‌گوست.`,
      { support: true },
    ],
  },
];

// ─── اجزای نمایشی ─────────────────────────────────────────────────────────────
function Plans({ P, plans }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
      {plans.map((p, i) => (
        <div key={i} className="rounded-xl p-4 flex items-center justify-between"
             style={{ background: P.chip, border: `1px solid ${P.borderSoft}` }}>
          <div>
            <div className="text-[13px]" style={{ color: P.text }}>{p.label}</div>
            <div className="font-extrabold text-lg mt-0.5" style={{ color: P.strong }}>
              {p.price}<span className="text-[11px] font-normal mr-1" style={{ color: P.muted }}> {p.unit}</span>
            </div>
          </div>
          {p.badge && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-md"
                  style={{ background: P.accentSoft, color: P.accent }}>{p.badge}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SupportCard({ P }) {
  return (
    <a href={SUPPORT_TG} target="_blank" rel="noreferrer"
       className="flex items-center justify-between gap-3 rounded-xl p-4 my-2 transition-colors duration-150 no-underline"
       style={{ background: P.accentSoft, border: `1px solid ${P.accent}33` }}
       onMouseEnter={(e) => (e.currentTarget.style.background = P.chipHover)}
       onMouseLeave={(e) => (e.currentTarget.style.background = P.accentSoft)}>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-full shrink-0"
              style={{ background: P.accent, color: '#fff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9.04 15.47 8.86 18c.36 0 .52-.16.71-.34l1.7-1.63 3.53 2.58c.65.36 1.11.17 1.28-.6l2.32-10.9c.21-.96-.35-1.34-.97-1.1L4.2 9.9c-.93.36-.92.88-.16 1.11l3.5 1.09 8.13-5.12c.38-.23.73-.1.44.15z"/>
          </svg>
        </span>
        <div>
          <div className="font-bold text-[14px]" style={{ color: P.strong }}>پشتیبانیِ CoinePro FX</div>
          <div className="text-[12px]" dir="ltr" style={{ color: P.muted, textAlign: 'right' }}>{SUPPORT_HANDle}</div>
        </div>
      </div>
      <span className="text-[12px] font-bold px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: P.accent, color: '#fff' }}>گفت‌وگو در تلگرام</span>
    </a>
  );
}

function Para({ P, node, risk }) {
  if (typeof node === 'string') {
    return <p className="text-[13.5px] leading-8 my-2" style={{ color: risk ? P.strong : P.text }}>{node}</p>;
  }
  if (node.list) {
    return (
      <ul className="my-2 space-y-2">
        {node.list.map((li, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-7" style={{ color: P.text }}>
            <span className="mt-2.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: P.accent }} />
            <span>{li}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (node.plans) return <Plans P={P} plans={node.plans} />;
  if (node.support) return <SupportCard P={P} />;
  return null;
}

function Section({ P, s }) {
  return (
    <section id={`legal-${s.id}`} className="scroll-mt-4">
      <div className="rounded-2xl p-5 sm:p-6"
           style={{
             background: s.risk ? P.warnSoft : P.panel,
             border: `1px solid ${s.risk ? `${P.warn}44` : P.border}`,
           }}>
        <h2 className="font-extrabold text-[15px] sm:text-base mb-1 flex items-center gap-2"
            style={{ color: s.risk ? P.warn : P.strong }}>
          {s.risk && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
          )}
          {s.title}
        </h2>
        <div>{s.body.map((node, i) => <Para key={i} P={P} node={node} risk={s.risk} />)}</div>
      </div>
    </section>
  );
}

// ─── بدنهٔ اصلیِ صفحه (قابلِ استفاده مستقل یا داخلِ مودال) ─────────────────────
function LegalBody({ theme, onClose, embedded }) {
  const P = useMemo(() => PALETTE[theme === 'light' ? 'light' : 'dark'], [theme]);
  const scrollRef = useRef(null);

  const goto = useCallback((id) => {
    try {
      const el = document.getElementById(`legal-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { /* noop */ }
  }, []);

  return (
    <div dir="rtl" className="flex flex-col min-h-0"
         style={{ background: P.bg, color: P.text, height: embedded ? 'auto' : '100%' }}>
      <style>{`
        .legal-scroll::-webkit-scrollbar{width:9px}
        .legal-scroll::-webkit-scrollbar-thumb{background:${P.scroll};border-radius:9px;border:2px solid transparent;background-clip:content-box}
        .legal-scroll::-webkit-scrollbar-track{background:transparent}
        .legal-scroll{scrollbar-width:thin;scrollbar-color:${P.scroll} transparent}
        .legal-anim{animation:legalIn .22s cubic-bezier(.2,.7,.2,1)}
        @keyframes legalIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
      `}</style>

      {/* سربرگِ چسبان */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b"
              style={{ borderColor: P.border, background: P.bg }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-9 h-9 rounded-xl shrink-0"
                style={{ background: P.accentSoft, color: P.accent }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6M9 13h6M9 17h6"/>
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-extrabold text-[15px] sm:text-base truncate" style={{ color: P.strong }}>
              قوانینِ استفاده و حریمِ خصوصی
            </div>
            <div className="text-[11.5px] truncate" style={{ color: P.muted }}>
              {BRAND} · {BRAND_EN} — آخرین بازنگری: {LAST_UPDATE}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="بستن"
                  className="grid place-items-center w-9 h-9 rounded-lg shrink-0 transition-colors"
                  style={{ background: P.chip, color: P.text }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = P.chipHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = P.chip)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </header>

      {/* بدنه: ناوبریِ کناری + متن */}
      <div ref={scrollRef} className="legal-scroll flex-1 min-h-0 overflow-y-auto"
           style={{ overflowY: embedded ? 'visible' : 'auto' }}>
        <div className="mx-auto max-w-3xl px-5 sm:px-7 py-6">
          {/* فهرستِ پرشی */}
          <nav className="flex flex-wrap gap-2 mb-6">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => goto(s.id)}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: P.chip, color: P.text, border: `1px solid ${P.borderSoft}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = P.chipHover; e.currentTarget.style.color = P.strong; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = P.chip; e.currentTarget.style.color = P.text; }}>
                {s.title}
              </button>
            ))}
          </nav>

          <p className="text-[13px] leading-8 mb-5" style={{ color: P.muted }}>
            این سند توافق‌نامهٔ استفاده از پلتفرمِ تحلیلیِ {BRAND} و سیاستِ حفاظت از داده‌های شماست.
            لطفاً پیش از استفاده آن را به‌دقت مطالعه کنید. این متن جایگزینِ مشاورهٔ حقوقی یا مالیِ تخصصی نیست.
          </p>

          <div className="space-y-3.5 legal-anim">
            {SECTIONS.map((s) => <Section key={s.id} P={P} s={s} />)}
          </div>

          <footer className="mt-7 pt-5 text-center" style={{ borderTop: `1px solid ${P.border}` }}>
            <p className="text-[12px] leading-7" style={{ color: P.muted }}>
              © {new Date().getFullYear()} {BRAND} ({BRAND_EN}). تمامیِ حقوق محفوظ است.
              <br />استفاده از این پلتفرم به‌منزلهٔ پذیرشِ این شرایط است.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ─── خروجی ۱: صفحهٔ معمولی برای route (مثلاً <Route path="/legal" element={<LegalPage/>} />) ──
export function LegalPage({ theme: themeProp }) {
  const [theme, setTheme] = useState(() => themeProp || readTheme());
  useEffect(() => { if (themeProp) setTheme(themeProp); }, [themeProp]);
  return (
    <div className="min-h-screen w-full" style={{ background: PALETTE[theme === 'light' ? 'light' : 'dark'].bg }}>
      <div className="h-screen"><LegalBody theme={theme} /></div>
    </div>
  );
}

// ─── خروجی ۲ (پیش‌فرض): مودالِ خوداتکا — با رویدادِ `bn:terms` باز می‌شود ──────────
// propهای اختیاری (همگی backward-compatible): open, onClose, theme.
export default function Legal({ open: openProp, onClose, theme: themeProp }) {
  const controlled = typeof openProp === 'boolean';
  const [openState, setOpenState] = useState(false);
  const [theme, setTheme] = useState(() => themeProp || readTheme());
  const open = controlled ? openProp : openState;

  const close = useCallback(() => {
    if (onClose) onClose();
    if (!controlled) setOpenState(false);
  }, [onClose, controlled]);

  // باز شدن با رویدادِ سراسری (از منوی همبرگری) + کلیدِ Esc برای بستن.
  // نکته: یک شنوندهٔ قدیمیِ `bn:terms` در BazaarNama.jsx صفحه را به یک لینکِ خارجی
  // (pro-chart.com) می‌بَرَد. برای جلوگیری از بازشدنِ همزمانِ تب و مودال، در فازِ
  // capture گوش می‌دهیم و propagation را قطع می‌کنیم تا شنوندهٔ bubbleِ قدیمی اجرا نشود.
  useEffect(() => {
    const onTerms = (e) => {
      try { e.stopImmediatePropagation(); e.stopPropagation(); } catch (err) { /* noop */ }
      setTheme(themeProp || readTheme());
      if (!controlled) setOpenState(true);
    };
    window.addEventListener('bn:terms', onTerms, true); // capture: قبل از شنوندهٔ قدیمیِ خارجی
    window.addEventListener('bn:legal', onTerms, true); // نامِ جایگزین
    return () => {
      window.removeEventListener('bn:terms', onTerms, true);
      window.removeEventListener('bn:legal', onTerms, true);
    };
  }, [controlled, themeProp]);

  useEffect(() => { if (themeProp) setTheme(themeProp); }, [themeProp]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  if (!open) return null;
  const P = PALETTE[theme === 'light' ? 'light' : 'dark'];

  return (
    <div dir="rtl" className="fixed inset-0 z-[300] flex items-stretch sm:items-center justify-center sm:p-4"
         style={{ background: P.mask, backdropFilter: 'blur(2px)' }}
         onClick={close}>
      <div className="w-full sm:max-w-3xl h-full sm:h-[88vh] sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col legal-anim"
           style={{ border: `1px solid ${P.border}` }}
           onClick={(e) => e.stopPropagation()}>
        <LegalBody theme={theme} onClose={close} />
      </div>
    </div>
  );
}

// ─── خروجی ۳: نصبِ خوداتکا (zero-config) ────────────────────────────────────────
// با یک importِ ساده (`import './pages/Legal'`) مودال خودش را به DOM می‌چسباند و به
// رویدادِ `bn:terms` گوش می‌دهد — بدونِ نیازی به ویرایشِ App.jsx یا هر فایلِ دیگر.
// idempotent است (دوبار mount نمی‌شود) و SSR-safe (روی سرور اجرا نمی‌شود).
export function mountLegal() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__bnLegalMounted) return;
  window.__bnLegalMounted = true;
  try {
    const host = document.createElement('div');
    host.id = 'bn-legal-root';
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(<Legal />);
  } catch (e) { window.__bnLegalMounted = false; /* بی‌صدا — تجربهٔ کاربر را نمی‌شکند */ }
}

// اجرای خودکار پس از بارگذاریِ ماژول (در محیطِ مرورگر).
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLegal, { once: true });
  } else {
    mountLegal();
  }
}
