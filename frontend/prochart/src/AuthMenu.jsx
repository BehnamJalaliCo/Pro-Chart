import React from 'react';
import { Menu, X, LogIn, UserPlus, Crown, LogOut, User, Copy, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { api, tokenStore } from './api/client';

// ورودیِ رمز با آیکونِ چشم (نمایش/مخفی‌کردنِ رمز)
function PasswordField({ P, value, onChange, placeholder }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input className={inpCls + ' pl-9'} style={fieldStyle(P)} type={show ? 'text' : 'password'}
             placeholder={placeholder} value={value} onChange={onChange} dir="ltr" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              style={{ color: P.text }} title={show ? 'مخفی' : 'نمایش'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// منوی همبرگری ورود/ثبت‌نام/اشتراک — theme-aware (روشن/تاریک) + انیمیشنِ نرم.
const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};
const tierLabel = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

// پالتِ رنگ بر اساسِ تم
function palette(dark) {
  return dark
    ? { panel: '#0f1117', card: '#161923', border: 'rgba(255,255,255,.10)', text: '#e4e6ed', sub: 'rgba(255,255,255,.6)', field: '#0f1117', fieldBorder: '#2a2e3d', soft: 'rgba(255,255,255,.05)', softHover: 'rgba(255,255,255,.1)' }
    : { panel: '#ffffff', card: '#ffffff', border: 'rgba(15,23,42,.10)', text: '#0f172a', sub: 'rgba(15,23,42,.55)', field: '#f8fafc', fieldBorder: '#e2e8f0', soft: 'rgba(15,23,42,.04)', softHover: 'rgba(15,23,42,.08)' };
}

export default function AuthMenu({ theme = 'dark' }) {
  const dark = theme !== 'light';
  const P = palette(dark);
  const [open, setOpen] = React.useState(false);
  const [shown, setShown] = React.useState(false);      // برای انیمیشنِ نرم (mount→slide)
  const [view, setView] = React.useState(null);
  const [auth, setAuth] = React.useState(authStore.get());

  React.useEffect(() => {
    if (open) { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }
    setShown(false);
  }, [open]);
  React.useEffect(() => {
    if (open && auth) api.me().then((m) => { if (m?.tier) { const a = { ...auth, tier: m.tier }; authStore.set(a); setAuth(a); } }).catch(() => {});
  }, [open]); // eslint-disable-line
  const close = () => { setShown(false); setView(null); setTimeout(() => setOpen(false), 220); };

  const onAuthed = (username, tier) => { const a = { username, tier: tier || 'free' }; authStore.set(a); setAuth(a); setView(null); close(); setTimeout(() => location.reload(), 250); };
  const logout = () => { authStore.clear(); tokenStore.clear(); location.reload(); };

  return (
    <>
      <button onClick={() => setOpen(true)} title="حساب / ورود / ثبت‌نام"
              className="p-1.5 rounded-md transition-colors duration-[120ms]"
              style={{ background: P.soft, color: P.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
        <Menu size={16} />
      </button>

      {open && (
        <div dir="rtl" className="fixed inset-0 z-[150]" onClick={close}>
          {/* backdrop با fade نرم */}
          <div className="absolute inset-0 transition-opacity duration-200"
               style={{ background: 'rgba(0,0,0,.45)', opacity: shown ? 1 : 0 }} />
          {/* پنل با slide نرم */}
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] flex flex-col shadow-2xl transition-transform duration-200 ease-out"
               style={{ background: P.panel, color: P.text, borderLeft: `1px solid ${P.border}`,
                        transform: shown ? 'translateX(0)' : 'translateX(100%)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="font-extrabold">Pro<span className="text-indigo-400">·</span>Chart</div>
              <button onClick={close} className="opacity-60 hover:opacity-100 transition-opacity"><X size={18} /></button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: P.soft }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,.25)' }}>
                  {auth ? <Crown size={18} className="text-amber-400" /> : <User size={18} style={{ color: P.sub }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{auth ? auth.username : 'کاربرِ مهمان'}</div>
                  <div className="text-[12px]" style={{ color: P.sub }}>{auth ? `اشتراک: ${tierLabel[auth.tier] || auth.tier}` : 'بدونِ حساب'}</div>
                </div>
              </div>

              {!view && (
                <div className="space-y-2">
                  {!auth ? (<>
                    <MenuBtn P={P} icon={<LogIn size={16} />} label="ورود به حساب" onClick={() => setView('login')} />
                    <MenuBtn P={P} icon={<UserPlus size={16} />} label="ثبت‌نام" onClick={() => setView('register')} accent />
                  </>) : (
                    <MenuBtn P={P} icon={<LogOut size={16} />} label="خروج از حساب" onClick={logout} danger />
                  )}
                  <MenuBtn P={P} icon={<Crown size={16} className="text-amber-400" />} label="اشتراکِ پرمیوم" onClick={() => setView('subscribe')} />
                </div>
              )}

              {view === 'login' && <LoginForm P={P} onBack={() => setView(null)} onAuthed={onAuthed} />}
              {view === 'register' && <RegisterForm P={P} onBack={() => setView(null)} onAuthed={onAuthed} />}
              {view === 'subscribe' && <SubscribePanel P={P} onBack={() => setView(null)} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuBtn({ P, icon, label, onClick, accent, danger }) {
  const style = accent ? { background: '#4f46e5', color: '#fff' }
    : danger ? { background: 'rgba(239,68,68,.18)', color: '#f87171' }
    : { background: P.soft, color: P.text };
  return (
    <button onClick={onClick} style={style}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-transform duration-100 hover:scale-[1.01] active:scale-[.99]">
      {icon}<span>{label}</span>
    </button>
  );
}

function fieldStyle(P) { return { background: P.field, border: `1px solid ${P.fieldBorder}`, color: P.text }; }
const inpCls = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';

function LoginForm({ P, onBack, onAuthed }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.login(u.trim(), p); if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier); } }
    catch (e) { setErr(e?.message || 'ایمیل/نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ورود به حساب</h4>
      <input className={inpCls} style={fieldStyle(P)} placeholder="ایمیل یا نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <PasswordField P={P} value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ورود</button>
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}

function RegisterForm({ P, onBack, onAuthed }) {
  const [step, setStep] = React.useState(1);
  const [email, setEmail] = React.useState(''); const [code, setCode] = React.useState('');
  const [u, setU] = React.useState(''); const [p, setP] = React.useState(''); const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(''); const [info, setInfo] = React.useState('');
  const sendCode = async () => { setErr(''); setBusy(true); try { await api.registerRequest(email.trim()); setInfo('کدِ تأیید به ایمیلت ارسال شد.'); setStep(2); } catch (e) { setErr(e?.message || 'ارسالِ کد ناموفق.'); } finally { setBusy(false); } };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      await api.registerVerify(email.trim(), code.trim(), u.trim(), p, name.trim() || null);
      const lr = await api.login((u.trim() || email.trim()), p);
      if (lr?.token) { tokenStore.set(lr.token); onAuthed(lr.username || email.trim(), lr.tier); }
    } catch (e) { setErr(e?.message || 'تأیید ناموفق.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ثبت‌نام</h4>
      {step === 1 ? (<>
        <div className="text-[12px]" style={{ color: P.sub }}>ایمیلت را وارد کن؛ یک کدِ تأیید برایت می‌فرستیم. رمز را خودت در مرحلهٔ بعد می‌گذاری.</div>
        <input className={inpCls} style={fieldStyle(P)} placeholder="ایمیل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={sendCode} disabled={busy || !email} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ارسالِ کدِ تأیید</button>
      </>) : (<>
        {info && <div className="text-[12px] text-green-400">{info}</div>}
        <input className={inpCls} style={fieldStyle(P)} placeholder="کدِ تأیید (ایمیل)" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
        <input className={inpCls} style={fieldStyle(P)} placeholder="نامِ کامل (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inpCls} style={fieldStyle(P)} placeholder="نام‌کاربری (الزامی)" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
        <PasswordField P={P} value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور (حداقل ۶ کاراکتر)" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={verify} disabled={busy || !code || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} تأیید و ساختِ حساب</button>
      </>)}
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}

function SubscribePanel({ P, onBack }) {
  const [pr, setPr] = React.useState(null); const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  const wallet = pr?.wallet || '';
  return (
    <div className="space-y-3">
      <h4 className="font-bold flex items-center gap-2"><Crown size={16} className="text-amber-400" /> اشتراکِ پرمیوم</h4>
      <div className="rounded-xl p-3 text-sm space-y-2" style={{ background: P.soft }}>
        <div className="flex justify-between"><span>ماهانه</span><b className="text-indigo-400">۱۵ تتر (USDT)</b></div>
        <div className="flex justify-between"><span>سالانه</span><b className="text-indigo-400">۲۰۰ تتر (USDT)</b></div>
      </div>
      <p className="text-[12px] leading-6" style={{ color: P.sub }}>با اشتراک، قفلِ <b>هوشِ مصنوعی</b>، <b>اسکریپت‌نویسی</b> و <b>ترید روی چارت</b> (البنک/وان‌رویال) باز می‌شود.</p>
      {wallet && (
        <div className="rounded-xl p-3 text-[12px]" style={{ background: P.soft }}>
          <div className="mb-1" style={{ color: P.sub }}>آدرسِ واریز ({pr?.network || 'BEP-20'} · {pr?.currency || 'USDT'}):</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded px-2 py-1" style={{ background: P.field }} dir="ltr">{wallet}</code>
            <button onClick={() => { navigator.clipboard?.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="p-1.5 rounded" style={{ background: P.soft }}>{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
          </div>
        </div>
      )}
      <p className="text-[12px] leading-6" style={{ color: P.sub }}>برای ثبت‌نام و پرداختِ خودکار، واردِ پنلِ کاربری شو: <b dir="ltr">user.pro-chart.com</b></p>
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}
