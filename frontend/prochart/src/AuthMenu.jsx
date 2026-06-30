import React from 'react';
import { Menu, X, LogIn, UserPlus, Crown, LogOut, User, Copy, Check, Loader2 } from 'lucide-react';
import { api, tokenStore } from './api/client';

// منوی همبرگری برای ورود/ثبت‌نام/اشتراک — مستقلِ بازارنما (Pro-Chart).
const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};

const F = { background: '#0f1117', border: '1px solid #2a2e3d', color: '#e4e6ed' };
const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';

export default function AuthMenu() {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(null);          // null|login|register|subscribe
  const [auth, setAuth] = React.useState(authStore.get());

  React.useEffect(() => {
    // باز که شد، اگر کاربر واردشده، tier را تازه کن (شاید مدیر ارتقا داده)
    if (open && auth) {
      api.me().then((m) => { if (m?.tier) { const a = { ...auth, tier: m.tier }; authStore.set(a); setAuth(a); } }).catch(() => {});
    }
  }, [open]); // eslint-disable-line

  const onAuthed = (username, tier) => {
    const a = { username, tier: tier || 'free' };
    authStore.set(a); setAuth(a); setView(null); setOpen(false);
    setTimeout(() => location.reload(), 200); // توکنِ جدید اعمال شود (قفل‌های پرمیوم به‌روز)
  };
  const logout = () => { authStore.clear(); tokenStore.clear(); location.reload(); };

  const tierLabel = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

  return (
    <>
      <button onClick={() => setOpen(true)} title="حساب / ورود / ثبت‌نام"
              className="p-1.5 rounded-md transition-colors" style={{ background: '#161923' }}>
        <Menu size={16} />
      </button>

      {open && (
        <div dir="rtl" className="fixed inset-0 z-[150] bg-black/50" onClick={() => { setOpen(false); setView(null); }}>
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-[#0f1117] border-l border-white/10 shadow-2xl flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-extrabold text-gray-100">Pro<span className="text-indigo-400">·</span>Chart</div>
              <button onClick={() => { setOpen(false); setView(null); }} className="opacity-60 hover:opacity-100"><X size={18} /></button>
            </div>

            <div className="p-4 overflow-auto flex-1 text-gray-200">
              {/* وضعیتِ کاربر */}
              <div className="rounded-xl bg-white/5 p-3 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/30 flex items-center justify-center">
                  {auth ? <Crown size={18} className="text-amber-300" /> : <User size={18} className="text-gray-300" />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{auth ? auth.username : 'کاربرِ مهمان'}</div>
                  <div className="text-[12px] opacity-70">{auth ? `اشتراک: ${tierLabel[auth.tier] || auth.tier}` : 'بدونِ حساب'}</div>
                </div>
              </div>

              {!view && (
                <div className="space-y-2">
                  {!auth ? (
                    <>
                      <MenuBtn icon={<LogIn size={16} />} label="ورود به حساب" onClick={() => setView('login')} />
                      <MenuBtn icon={<UserPlus size={16} />} label="ثبت‌نام" onClick={() => setView('register')} accent />
                    </>
                  ) : (
                    <MenuBtn icon={<LogOut size={16} />} label="خروج از حساب" onClick={logout} danger />
                  )}
                  <MenuBtn icon={<Crown size={16} className="text-amber-300" />} label="اشتراکِ پرمیوم" onClick={() => setView('subscribe')} />
                </div>
              )}

              {view === 'login' && <LoginForm onBack={() => setView(null)} onAuthed={onAuthed} />}
              {view === 'register' && <RegisterForm onBack={() => setView(null)} onAuthed={onAuthed} />}
              {view === 'subscribe' && <SubscribePanel onBack={() => setView(null)} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuBtn({ icon, label, onClick, accent, danger }) {
  const cls = accent ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
    : danger ? 'bg-red-600/20 hover:bg-red-600/30 text-red-300'
    : 'bg-white/5 hover:bg-white/10 text-gray-200';
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${cls}`}>
      {icon}<span>{label}</span>
    </button>
  );
}

function LoginForm({ onBack, onAuthed }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api.login(u.trim(), p);
      if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier); }
      else setErr('پاسخِ نامعتبر.');
    } catch (e) { setErr(e?.message || 'نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ورود به حساب</h4>
      <input className={inputCls} style={F} placeholder="نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <input className={inputCls} style={F} placeholder="رمزِ عبور" type="password" value={p} onChange={(e) => setP(e.target.value)} dir="ltr" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {busy && <Loader2 size={15} className="animate-spin" />} ورود
      </button>
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}

function RegisterForm({ onBack, onAuthed }) {
  const [step, setStep] = React.useState(1);
  const [email, setEmail] = React.useState(''); const [code, setCode] = React.useState('');
  const [u, setU] = React.useState(''); const [p, setP] = React.useState(''); const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(''); const [info, setInfo] = React.useState('');
  const sendCode = async () => {
    setErr(''); setBusy(true);
    try { await api.registerRequest(email.trim()); setInfo('کدِ تأیید به ایمیلت ارسال شد.'); setStep(2); }
    catch (e) { setErr(e?.message || 'ارسالِ کد ناموفق بود.'); } finally { setBusy(false); }
  };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api.registerVerify(email.trim(), code.trim(), u.trim(), p, name.trim() || null);
      if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier); return; }
      const lr = await api.login(u.trim(), p);   // اگر verify توکن نداد، لاگین کن
      if (lr?.token) { tokenStore.set(lr.token); onAuthed(lr.username || u.trim(), lr.tier); }
    } catch (e) { setErr(e?.message || 'تأیید ناموفق بود.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ثبت‌نام</h4>
      {step === 1 ? (
        <>
          <input className={inputCls} style={F} placeholder="ایمیل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          {err && <div className="text-[12px] text-red-400">{err}</div>}
          <button onClick={sendCode} disabled={busy || !email} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} ارسالِ کدِ تأیید
          </button>
        </>
      ) : (
        <>
          {info && <div className="text-[12px] text-green-400">{info}</div>}
          <input className={inputCls} style={F} placeholder="کدِ تأیید (ایمیل)" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          <input className={inputCls} style={F} placeholder="نامِ کامل (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} style={F} placeholder="نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
          <input className={inputCls} style={F} placeholder="رمزِ عبور" type="password" value={p} onChange={(e) => setP(e.target.value)} dir="ltr" />
          {err && <div className="text-[12px] text-red-400">{err}</div>}
          <button onClick={verify} disabled={busy || !code || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} تأیید و ساختِ حساب
          </button>
        </>
      )}
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}

function SubscribePanel({ onBack }) {
  const [pr, setPr] = React.useState(null); const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  const wallet = pr?.wallet || '';
  return (
    <div className="space-y-3">
      <h4 className="font-bold flex items-center gap-2"><Crown size={16} className="text-amber-300" /> اشتراکِ پرمیوم</h4>
      <div className="rounded-xl bg-white/5 p-3 text-sm space-y-2">
        <div className="flex justify-between"><span>ماهانه</span><b className="text-indigo-300">۱۵ تتر (USDT)</b></div>
        <div className="flex justify-between"><span>سالانه</span><b className="text-indigo-300">۲۰۰ تتر (USDT)</b></div>
      </div>
      <p className="text-[12px] leading-6 opacity-80">با اشتراک، قفلِ <b>هوش مصنوعی</b>، <b>اسکریپت‌نویسی</b> و <b>ترید روی چارت</b> (البنک/وان‌رویال) باز می‌شود.</p>
      {wallet && (
        <div className="rounded-xl bg-white/5 p-3 text-[12px]">
          <div className="opacity-70 mb-1">آدرسِ واریز ({pr?.network || 'BEP-20'} · {pr?.currency || 'USDT'}):</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all bg-black/30 rounded px-2 py-1" dir="ltr">{wallet}</code>
            <button onClick={() => { navigator.clipboard?.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="p-1.5 rounded bg-white/10 hover:bg-white/20">{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
          </div>
        </div>
      )}
      <p className="text-[12px] leading-6 opacity-70">پس از واریز، حساب توسطِ مدیر بررسی و فعال می‌شود. (ابتدا با ثبت‌نام واردِ حساب شو تا واریزت به حسابت نسبت داده شود.)</p>
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}
