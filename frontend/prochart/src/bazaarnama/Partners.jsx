import React from 'react';
import { X, Check, ShieldCheck, Coins, TrendingUp } from './tvIcons';

import ReferralDeparture from '../components/ReferralDeparture';

// این کامپوننت فعلاً از گراف import محصول قابل‌دسترسی نیست. اگر دوباره متصل
// شود، فقط لوگوهای محلی و مسیرهای داخلی allowlist شده را استفاده می‌کند.
const PARTNERS = [
  {
    id: 'lbank',
    name: 'LBank',
    logo: '/partners/lbank.svg',
    kind: 'صرافی ارز دیجیتال',
    badge: 'معرفی LBank',
    Icon: Coins,
    accent: '#1f6fff',
    accent2: '#1db8c9',
    tagline: 'LBank تنها صرافی معرفی‌شده در این بخش از Pro Chart است.',
    points: [
      'شرایط ثبت‌نام و ارائه خدمت را در وب‌سایت LBank بررسی کنید',
      'نمایش این مسیر به معنی تضمین دسترسی در محل اقامت شما نیست',
      'تصمیم درباره افتتاح حساب و استفاده از خدمات با کاربر است',
    ],
  },
  {
    id: 'oneroyal',
    name: 'OneRoyal',
    logo: '/partners/oneroyal.svg',
    kind: 'بروکر فارکس',
    badge: 'معرفی OneRoyal',
    Icon: TrendingUp,
    accent: '#c79a3a',
    accent2: '#0a1e3f',
    tagline: 'OneRoyal در Pro Chart فقط در سطح معرفی نمایش داده می‌شود.',
    points: [
      'شرایط ثبت‌نام و ارائه خدمت را در وب‌سایت OneRoyal بررسی کنید',
      'اتصال حساب یا معامله مستقیم OneRoyal در Pro Chart فعال نیست',
      'نمایش این مسیر به معنی تضمین دسترسی در محل اقامت شما نیست',
    ],
  },
];

function PartnerCard({ partner, theme }) {
  const { Icon } = partner;
  return (
    <div className="relative rounded-lg overflow-hidden flex flex-col pc-card-flat" style={{ background: theme.panel, border: `1px solid ${theme.border}` }}>
      <div className="h-px w-full" style={{ background: 'var(--pc-border)' }} />
      <div className="relative p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase"
            style={{ color: 'var(--pc-text-muted)', letterSpacing: '.4px' }}>
            <Icon size={11} /> {partner.badge}
          </span>
          <span className="text-[11px] font-medium" style={{ color: 'var(--pc-text-muted)' }}>{partner.kind}</span>
        </div>

        <div className="rounded-lg px-4 py-4 flex items-center justify-center" style={{ background: '#fff', border: `1px solid ${theme.border}` }}>
          <img src={partner.logo} alt={partner.name} className="h-9 w-auto max-w-[160px] object-contain" loading="lazy" />
        </div>

        <p className="text-[13px] leading-6 font-medium" style={{ color: theme.textStrong }}>{partner.tagline}</p>
        <ul className="flex flex-col gap-2.5 rounded-lg p-3" style={{ background: 'transparent', border: `1px solid ${theme.border}` }}>
          {partner.points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-[12px] leading-5" style={{ color: theme.text }}>
              <span className="mt-px shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: 'var(--pc-hover)', color: 'var(--pc-text-2)' }}><Check size={11} strokeWidth={3} /></span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-1">
          <ReferralDeparture
            provider={partner.name}
            buttonLabel={`لینک معرفی — ورود به وب‌سایت ${partner.name}`}
            buttonClassName="btn-primary w-full text-center text-[13px]"
            buttonStyle={{}}
          />
        </div>
      </div>
    </div>
  );
}

export default function Partners({ open, onClose, TH }) {
  if (!open) return null;
  const theme = TH || { panel: '#131722', bg: '#0b0e14', border: '#2a2e39', text: '#b2b5be', textStrong: '#d1d4dc', accent: '#2962FF' };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center pt-[6vh] px-3 overflow-auto" dir="rtl"
      style={{ background: theme.overlayMask || 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-[min(760px,96vw)] rounded-lg overflow-hidden" style={{ background: theme.panel, border: `1px solid ${theme.border}`, boxShadow: 'var(--pc-shadow-modal)' }} onClick={(event) => event.stopPropagation()}>
        <div className="relative px-5 py-4 flex items-start justify-between gap-3" style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase"
              style={{ color: 'var(--pc-text-muted)', letterSpacing: '.4px' }}>
              <ShieldCheck size={12} /> مسیرهای معرفی Pro Chart
            </span>
            <h2 className="mt-2 text-[14px] font-semibold" style={{ color: theme.textStrong }}>معرفی LBank و OneRoyal</h2>
            <p className="text-[12px] leading-5 mt-1" style={{ color: theme.text }}>پیش از خروج، شرایط ارائه‌دهنده و محدودیت‌های محل اقامت خود را بررسی کنید.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="pc-iconbtn w-8 h-8 shrink-0" style={{ color: theme.text }}><X size={18} /></button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PARTNERS.map((partner) => <PartnerCard key={partner.id} partner={partner} theme={theme} />)}
        </div>

        <div className="px-5 pb-5">
          <p className="text-[11px] leading-5 text-center rounded-lg px-4 py-2.5" style={{ color: 'var(--pc-text-muted)', background: theme.panel, border: `1px solid ${theme.border}` }}>
            ⚠️ معامله در بازارهای مالی ریسک دارد و ممکن است به از دست رفتن سرمایه منجر شود. لینک‌های بالا لینک معرفی هستند؛ انتخاب و مسئولیت استفاده از خدمات با خود شماست.
          </p>
        </div>
      </div>
    </div>
  );
}
