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

export default function App() {
  // پنلِ ادمین — فقط روی ساب‌دامینِ panel.* (روی دامنهٔ اصلی در دسترس نیست = امن‌تر)
  const _host = (window.location.hostname || '').split('.')[0];
  if (_host === 'panel') return <AdminPanel />;
  if (_host === 'user') return <UserPanel />;

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      consumeTokenFromUrl();
      const ok = await ensureToken();
      setAuthed(ok);
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="min-h-screen bg-[#0b0e14]" />;
  if (!authed) return <RetryGate />;
  return (<><BazaarNama /><PremiumModal /></>);
}
