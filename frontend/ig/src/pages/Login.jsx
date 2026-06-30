import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Instagram, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';

export default function Login() {
  const nav = useNavigate();
  const { login, setMe } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.login(u.trim(), p);
      login(res.access_token, res.refresh_token);
      setMe(res.user);
      nav('/', { replace: true });
    } catch (e) { setErr(e.message || 'ورود ناموفق'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* سمتِ سینماییِ برند */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand-grad text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center"><Instagram size={26} /></div>
          <div className="font-black text-xl">کوین‌پرو FX</div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-black leading-tight">مدیریتِ حرفه‌ای<br />اینستاگرام</h1>
          <p className="text-white/80 mt-4 text-lg max-w-sm">پاسخِ هوشمند، انتشارِ خودکار، خلبانِ هوش مصنوعی و آمارِ زنده — همه در یک پنل.</p>
        </div>
        <div className="text-white/60 text-sm relative">© کوین‌پرو FX · سطحِ جهانی</div>
      </div>
      {/* فرمِ ورود */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-6">
            <div className="w-11 h-11 rounded-2xl bg-brand-grad grid place-items-center text-white shadow-glow"><Instagram size={22} /></div>
            <div className="font-black text-lg text-ink">کوین‌پرو IG</div>
          </div>
          <h2 className="text-2xl font-black text-ink mb-1">ورود به پنل</h2>
          <p className="text-sm text-ink-muted mb-6">با نام کاربری و رمزی که مدیر برایتان ساخته وارد شوید.</p>
          <label className="label">نام کاربری</label>
          <div className="relative mb-4">
            <User size={17} className="absolute right-3 top-3 text-ink-muted" />
            <input className="input pr-10" value={u} onChange={(e) => setU(e.target.value)} placeholder="username" dir="ltr" />
          </div>
          <label className="label">رمز عبور</label>
          <div className="relative mb-5">
            <Lock size={17} className="absolute right-3 top-3 text-ink-muted" />
            <input type={show ? 'text' : 'password'} className="input pr-10 pl-10" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" dir="ltr" />
            <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
              title={show ? 'پنهان‌کردنِ رمز' : 'نمایشِ رمز'}
              className="absolute left-3 top-3 text-ink-muted hover:text-ink">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {err && <div className="mb-4 text-sm text-accent-red bg-red-50 rounded-xl px-3 py-2 font-bold">{err}</div>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  );
}
