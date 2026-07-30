import React from 'react';

// مودالِ ارتقاء به پرمیوم — با رویدادِ سراسریِ `bn:premium` (از اینترسپتورِ axios روی ۴۰۳)
// باز می‌شود. قابلیت‌های پرمیوم: هوش مصنوعی، اسکریپت‌نویسی و قابلیت‌های مجاز حساب LBank.
export default function PremiumModal() {
  const [open, setOpen] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => {
    const h = (e) => { setMsg(e.detail || 'این قابلیت ویژهٔ کاربرانِ پرمیومِ بازارنماست.'); setOpen(true); };
    window.addEventListener('bn:premium', h);
    return () => window.removeEventListener('bn:premium', h);
  }, []);
  if (!open) return null;
  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
         onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-lg p-6"
           style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-border)', boxShadow: 'var(--pc-shadow-modal)', color: 'var(--pc-text)' }}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">⭐</span>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--pc-text)' }}>قابلیتِ پرمیومِ بازارنما</h3>
        </div>
        <p className="text-sm leading-7 mb-4" style={{ color: 'var(--pc-text-2)' }}>{msg}</p>
        <div className="rounded-lg p-4 mb-4 text-sm space-y-2" style={{ border: '1px solid var(--pc-border)' }}>
          <div className="flex justify-between"><span>اشتراکِ ماهانه</span><b className="tnum" style={{ color: 'var(--pc-accent)', fontWeight: 600 }}>۲۵ تتر (USDT)</b></div>
          <div className="flex justify-between"><span>اشتراکِ سالانه</span><b className="tnum" style={{ color: 'var(--pc-accent)', fontWeight: 600 }}>۲۰۰ تتر (USDT)</b></div>
          <p className="text-[12px] pt-1 leading-6" style={{ color: 'var(--pc-text-muted)' }}>
            با اشتراک، قفلِ <b>هوش مصنوعی</b>، <b>اسکریپت‌نویسی</b> و قابلیت‌های مجاز حساب <b>LBank</b> باز می‌شود. OneRoyal در Pro Chart فقط مسیر معرفی است.
            فعال‌سازی پس از ثبت‌نام، واریز و تأییدِ مدیر.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)}
                  className="btn-primary flex-1">متوجه شدم</button>
        </div>
      </div>
    </div>
  );
}
