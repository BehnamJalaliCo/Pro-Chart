import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { tokenStore } from './api/client';
import BazaarNama from './pages/BazaarNama';
import PremiumModal from './PremiumModal';
import AdminPanel from './AdminPanel';
import UserPanel from './UserPanel';

// Pro-Chart — نسخهٔ مستقلِ تمام‌صفحهٔ بازارنما (دامنه/سرورِ جدا، مستقل از آکادمی).
// ورود: (۱) اگر از آکادمی آمد، توکنش در hash «#t=» پاس می‌شود (سازگاریِ عقب‌رو)؛
// (۲) وگرنه به‌صورتِ «مهمانِ مستقل» وارد می‌شود — بدونِ نیاز به حسابِ آکادمی.
// (داربستِ ثبت‌نامِ مستقلِ بازارنما در آینده اینجا اضافه می‌شود.)
const API = import.meta.env.VITE_API_URL || '/api';

function consumeTokenFromUrl() {
  try {
    const h = window.location.hash || '';
    const m = h.match(/[#&]t=([^&]+)/);
    if (m) {
      tokenStore.set(decodeURIComponent(m[1]));
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get('t')) {
      tokenStore.set(q.get('t'));
      q.delete('t');
      const qs = q.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
      return true;
    }
  } catch (e) { /* noop */ }
  return false;
}

// ورودِ مهمانِ مستقل — اگر توکنی نبود، یک هویتِ مستقلِ بازارنما می‌گیرد (بدونِ آکادمی).
async function ensureToken() {
  if (tokenStore.get()) return true;
  try {
    const r = await axios.post(`${API}/academy/auth/bn-guest`);
    if (r?.data?.token) { tokenStore.set(r.data.token); return true; }
  } catch (e) { /* در صورتِ خطا، صفحهٔ تلاشِ مجدد */ }
  return false;
}

function RetryGate() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#0b0e14] text-gray-200 px-6 text-center">
      <div className="text-3xl font-extrabold tracking-tight">Pro<span className="text-indigo-400">·</span>Chart</div>
      <p className="text-gray-400 max-w-md leading-7">اتصال به سرور برقرار نشد. لطفاً صفحه را تازه‌سازی کنید.</p>
      <button onClick={() => location.reload()} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">تلاشِ مجدد</button>
    </div>
  );
}

// نمایشِ راه‌اندازیِ سینمایی — لوگو/چارتی که خودش را رسم می‌کند، سپس نرم محو می‌شود.
// حسِ «اپِ نیتیو»، نه صفحهٔ وب. کاملاً CSS/SVG، بدون وابستگی.
function LaunchScreen({ fading }) {
  return (
    <div className={'pc-launch' + (fading ? ' pc-launch--out' : '')} dir="rtl" role="status" aria-label="در حال راه‌اندازی">
      <div className="pc-launch__glow" />
      <div className="pc-launch__mark">
        <svg viewBox="0 0 220 120" width="220" height="120" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="pcLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2962FF" /><stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {/* کندل‌ها */}
          <g className="pc-launch__candles">
            <rect x="18"  y="60" width="10" height="30" rx="2" className="pc-cd pc-cd--up" style={{ ['--i']: 0 }} />
            <rect x="48"  y="44" width="10" height="34" rx="2" className="pc-cd pc-cd--dn" style={{ ['--i']: 1 }} />
            <rect x="78"  y="52" width="10" height="26" rx="2" className="pc-cd pc-cd--up" style={{ ['--i']: 2 }} />
            <rect x="108" y="30" width="10" height="40" rx="2" className="pc-cd pc-cd--up" style={{ ['--i']: 3 }} />
            <rect x="138" y="40" width="10" height="28" rx="2" className="pc-cd pc-cd--dn" style={{ ['--i']: 4 }} />
            <rect x="168" y="22" width="10" height="34" rx="2" className="pc-cd pc-cd--up" style={{ ['--i']: 5 }} />
          </g>
          {/* خطِ روند که خودش را می‌کشد */}
          <path className="pc-launch__path" d="M12 78 L53 60 L83 66 L113 42 L143 52 L173 32 L208 24" stroke="url(#pcLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="pc-launch__dot" r="4.5" cx="208" cy="24" fill="#8b5cf6" />
        </svg>
      </div>
      <div className="pc-launch__brand">Pro<span>·</span>Chart</div>
      <div className="pc-launch__sub">بازارنما</div>
      <div className="pc-launch__bar"><i /></div>
    </div>
  );
}

export default function App() {
  // پنلِ ادمین — فقط روی ساب‌دامینِ panel.* (روی دامنهٔ اصلی در دسترس نیست = امن‌تر)
  const _host = (window.location.hostname || '').split('.')[0];
  if (_host === 'panel') return <AdminPanel />;
  if (_host === 'user') return <UserPanel />;

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  // راه‌اندازیِ سینمایی: تا کامل‌شدنِ بوت (با حداقلِ زمانِ نمایش) روی اپ می‌ماند و نرم محو می‌شود.
  const [bootDone, setBootDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = React.useRef(Date.now());

  useEffect(() => {
    (async () => {
      consumeTokenFromUrl();
      const ok = await ensureToken();
      setAuthed(ok);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const MIN = 1500; // حداقل نمایشِ اسپلش برای حسِ سینمایی
    const elapsed = Date.now() - startRef.current;
    const wait = Math.max(0, MIN - elapsed);
    const t1 = setTimeout(() => setFadeOut(true), wait);        // شروعِ محوشدن
    const t2 = setTimeout(() => setBootDone(true), wait + 620); // برداشتن از DOM بعدِ ترنزیشن
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ready]);

  return (
    <>
      {ready && (authed ? (<><BazaarNama /><PremiumModal /></>) : <RetryGate />)}
      {!bootDone && <LaunchScreen fading={fadeOut} />}
    </>
  );
}
