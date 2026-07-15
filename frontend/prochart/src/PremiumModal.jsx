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
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161923] p-6 text-gray-200 shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">⭐</span>
          <h3 className="text-lg font-extrabold">قابلیتِ پرمیومِ بازارنما</h3>
        </div>
        <p className="text-sm leading-7 text-gray-300 mb-4">{msg}</p>
        <div className="rounded-xl bg-white/5 p-4 mb-4 text-sm space-y-2">
          <div className="flex justify-between"><span>اشتراکِ ماهانه</span><b className="text-indigo-300">۲۵ تتر (USDT)</b></div>
          <div className="flex justify-between"><span>اشتراکِ سالانه</span><b className="text-indigo-300">۲۰۰ تتر (USDT)</b></div>
          <p className="text-[12px] text-gray-400 pt-1 leading-6">
            با اشتراک، قفلِ <b>هوش مصنوعی</b>، <b>اسکریپت‌نویسی</b> و قابلیت‌های مجاز حساب <b>LBank</b> باز می‌شود. OneRoyal در Pro Chart فقط مسیر معرفی است.
            فعال‌سازی پس از ثبت‌نام، واریز و تأییدِ مدیر.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition">متوجه شدم</button>
        </div>
      </div>
    </div>
  );
}
