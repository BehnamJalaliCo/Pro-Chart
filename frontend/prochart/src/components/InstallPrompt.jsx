import { useState, useEffect, useRef } from 'react';
import { Download, X, Share, SquarePlus, Smartphone, Check, ArrowDown } from 'lucide-react';

const DISMISS_KEY = 'cp_install_dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const detect = () => {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const mobileLike = /mobile|android|iphone|ipad|ipod|tablet|silk/i.test(ua) || (touch && Math.min(window.innerWidth, window.innerHeight) < 1024);
  return { ios, android, mobileLike, tablet: /ipad|tablet/i.test(ua) || (touch && Math.min(window.innerWidth, window.innerHeight) >= 600 && mobileLike) };
};

/** بنرِ نصبِ اپ (فقط موبایل/تبلت) + راهنمای افزودن به صفحهٔ اصلیِ iOS. */
export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);
  const dev = useRef(detect());
  const deferred = useRef(null);

  useEffect(() => {
    if (isStandalone()) return;                                  // قبلاً نصب شده
    if (localStorage.getItem(DISMISS_KEY)) return;               // قبلاً بسته شده
    if (!dev.current.mobileLike) return;                         // فقط موبایل/تبلت
    const onBip = (e) => { e.preventDefault(); deferred.current = e; };
    window.addEventListener('beforeinstallprompt', onBip);
    const t = setTimeout(() => setShow(true), 1500);             // کمی بعد از ورود
    return () => { window.removeEventListener('beforeinstallprompt', onBip); clearTimeout(t); };
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setShow(false); setIosGuide(false); };

  const install = async () => {
    if (deferred.current) {                                      // اندروید/کروم → پرامپتِ نیتیو
      deferred.current.prompt();
      try { await deferred.current.userChoice; } catch (e) {}
      deferred.current = null; setShow(false);
    } else {                                                     // iOS یا بدونِ پرامپت → راهنما
      setIosGuide(true);
    }
  };

  if (!show && !iosGuide) return null;
  const { ios, tablet } = dev.current;
  const deviceName = tablet ? 'تبلت' : 'موبایل';

  return (
    <>
      {/* بنرِ پایین */}
      {show && !iosGuide && (
        <div dir="rtl" className="fixed bottom-0 inset-x-0 z-[60] p-3 pointer-events-none">
          <div className="pointer-events-auto max-w-md mx-auto rounded-2xl border border-emerald-500/30 bg-[#0c1119]/95 backdrop-blur-xl shadow-2xl p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Smartphone size={22} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black">اپِ آکادمی روی {deviceName}ت</div>
              <div className="text-[11px] text-text-muted">نصبش کن تا مثلِ یک اپلیکیشن، سریع و تمام‌صفحه باز شود.</div>
            </div>
            <button onClick={install} className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-500 text-white text-sm font-bold flex items-center gap-1.5">
              <Download size={16} /> نصب
            </button>
            <button onClick={dismiss} className="shrink-0 text-text-muted hover:text-text-primary p-1"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* راهنمای افزودن به صفحهٔ اصلیِ iOS */}
      {iosGuide && (
        <div dir="rtl" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setIosGuide(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1119] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2">
                <SquarePlus size={20} className="text-emerald-400" /> نصب روی {deviceName} اپل
              </h3>
              <button onClick={dismiss} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
            </div>
            <p className="text-sm text-text-secondary mb-4 leading-7">
              {ios ? 'در Safari فقط ۳ قدم تا داشتنِ آیکونِ آکادمی روی صفحهٔ گوشی‌ات:' : 'برای افزودن به صفحهٔ اصلی، از منوی مرورگر «Add to Home Screen» را بزن:'}
            </p>

            <ol className="space-y-3 mb-5">
              <li className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 font-black flex items-center justify-center shrink-0">۱</span>
                <span className="text-sm flex items-center gap-2 flex-wrap">دکمهٔ <b className="inline-flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1"><Share size={15} className="text-sky-400" /> اشتراک‌گذاری</b> را در نوارِ پایینِ مرورگر بزن.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 font-black flex items-center justify-center shrink-0">۲</span>
                <span className="text-sm flex items-center gap-2 flex-wrap">کمی <ArrowDown size={14} className="inline text-text-muted" /> پایین بیا و <b className="inline-flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1"><SquarePlus size={15} className="text-emerald-400" /> افزودن به صفحهٔ اصلی</b> را انتخاب کن.</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 font-black flex items-center justify-center shrink-0">۳</span>
                <span className="text-sm flex items-center gap-2 flex-wrap">روی <b className="bg-white/5 rounded-lg px-2 py-1">افزودن</b> بزن — آیکونِ آکادمی <Check size={15} className="inline text-emerald-400" /> روی صفحه می‌نشیند!</span>
              </li>
            </ol>

            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-3 mb-4">
              <img src="/logo.png" alt="آکادمی" className="h-10 w-10 rounded-xl" />
              <div className="text-xs text-text-secondary">بعد از نصب، اپ <b className="text-emerald-400">تمام‌صفحه و بدونِ نوارِ مرورگر</b> باز می‌شود — درست مثلِ یک اپلیکیشنِ واقعی.</div>
            </div>

            <button onClick={dismiss} className="w-full py-2.5 rounded-xl bg-white/5 text-sm font-bold hover:bg-white/10">متوجه شدم</button>
          </div>
        </div>
      )}
    </>
  );
}
