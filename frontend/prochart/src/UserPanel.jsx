import React from 'react';
import { User, Crown, LogOut, Loader2, Bitcoin, LineChart, Link2, Copy, Check, ShieldCheck, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { api, tokenStore } from './api/client';

// ورودیِ رمز با آیکونِ چشم
function PwInput({ value, onChange, placeholder }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input className={inp + ' pl-9'} style={FS} type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} dir="ltr" />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 text-gray-300">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// پنلِ کاربرِ بازارنما (user.pro-chart.com) — حساب، اشتراک، اتصالِ صرافی/بروکر، رفرال.
// جداسازیِ کریپتو (LBank) و بروکر (وان‌رویال) از بدوِ ثبت‌نام.
const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};
const FS = { background: '#0f1117', border: '1px solid #2a2e3d', color: '#e4e6ed' };
const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';
const TIER = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

export default function UserPanel() {
  const [auth, setAuth] = React.useState(authStore.get());
  const [me, setMe] = React.useState(null);
  React.useEffect(() => { if (auth) api.me().then(setMe).catch(() => {}); }, [auth]);
  const onAuthed = (username, tier, account_type) => {
    const a = { username, tier: tier || 'free', account_type }; authStore.set(a); setAuth(a);
  };
  const logout = () => { authStore.clear(); tokenStore.clear(); setAuth(null); setMe(null); };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b0e14] text-gray-200">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0f1117]">
        <div className="font-extrabold text-lg">Pro<span className="text-indigo-400">·</span>Chart <span className="text-sm opacity-60 font-normal">پنلِ کاربری</span></div>
        {auth && <button onClick={logout} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-sm"><LogOut size={14} /> خروج</button>}
      </header>
      <div className="max-w-3xl mx-auto p-5">
        {!auth ? <AuthGate onAuthed={onAuthed} /> : <Dashboard auth={auth} me={me} />}
      </div>
    </div>
  );
}

function AuthGate({ onAuthed }) {
  const [mode, setMode] = React.useState('login'); // login | register
  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="rounded-2xl border border-white/10 bg-[#161923] p-6">
        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode('login')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'login' ? 'bg-indigo-600' : 'bg-white/5'}`}>ورود</button>
          <button onClick={() => setMode('register')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'register' ? 'bg-indigo-600' : 'bg-white/5'}`}>ثبت‌نام</button>
        </div>
        {mode === 'login' ? <LoginForm onAuthed={onAuthed} /> : <RegisterForm onAuthed={onAuthed} />}
      </div>
    </div>
  );
}

function LoginForm({ onAuthed }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.login(u.trim(), p); if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier, r.account_type); } }
    catch (e) { setErr(e?.message || 'نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <input className={inp} style={FS} placeholder="ایمیل یا نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <PwInput value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ورود</button>
    </div>
  );
}

function RegisterForm({ onAuthed }) {
  const [acct, setAcct] = React.useState(''); // crypto | broker — جداسازیِ از بدوِ ثبت‌نام
  const [step, setStep] = React.useState(1);
  const [email, setEmail] = React.useState(''); const [code, setCode] = React.useState('');
  const [u, setU] = React.useState(''); const [p, setP] = React.useState(''); const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(''); const [info, setInfo] = React.useState('');
  const send = async () => { setErr(''); setBusy(true); try { await api.registerRequest(email.trim()); setInfo('کدِ تأیید به ایمیلت ارسال شد.'); setStep(3); } catch (e) { setErr(e?.message || 'ارسالِ کد ناموفق.'); } finally { setBusy(false); } };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      await api.registerVerify(email.trim(), code.trim(), u.trim(), p, name.trim() || null, acct);
      const lr = await api.login(u.trim(), p);
      if (lr?.token) { tokenStore.set(lr.token); onAuthed(lr.username || u.trim(), lr.tier, acct); }
    } catch (e) { setErr(e?.message || 'تأیید ناموفق.'); } finally { setBusy(false); }
  };
  if (!acct) {
    return (
      <div className="space-y-3">
        <p className="text-sm opacity-80 mb-1">نوعِ حسابت را انتخاب کن (جدا و بدونِ تداخل):</p>
        <button onClick={() => { setAcct('crypto'); setStep(2); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition">
          <Bitcoin size={22} className="text-amber-400" />
          <div className="text-right"><div className="font-bold">کاربرِ کریپتو</div><div className="text-[12px] opacity-70">تریدِ واقعیِ کریپتو روی صرافیِ LBank (البنک)</div></div>
        </button>
        <button onClick={() => { setAcct('broker'); setStep(2); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition">
          <LineChart size={22} className="text-indigo-400" />
          <div className="text-right"><div className="font-bold">کاربرِ فارکس</div><div className="text-[12px] opacity-70">تریدِ واقعیِ فارکس روی بروکرِ وان‌رویال (MT5)</div></div>
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-[12px] opacity-70 flex items-center gap-2">
        {acct === 'crypto' ? <Bitcoin size={14} className="text-amber-400" /> : <LineChart size={14} className="text-indigo-400" />}
        نوعِ حساب: <b>{acct === 'crypto' ? 'کریپتو (LBank)' : 'فارکس (وان‌رویال)'}</b>
        <button onClick={() => { setAcct(''); setStep(1); }} className="opacity-50 hover:opacity-100 underline">تغییر</button>
      </div>
      {step === 2 && (<>
        <input className={inp} style={FS} placeholder="ایمیل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={send} disabled={busy || !email} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ارسالِ کدِ تأیید</button>
      </>)}
      {step === 3 && (<>
        {info && <div className="text-[12px] text-green-400">{info}</div>}
        <input className={inp} style={FS} placeholder="کدِ تأیید" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
        <input className={inp} style={FS} placeholder="نامِ کامل (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inp} style={FS} placeholder="نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
        <PwInput value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={verify} disabled={busy || !code || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} تأیید و ساختِ حساب</button>
      </>)}
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161923] p-5 mb-4">
      <div className="flex items-center gap-2 mb-3 font-bold">{icon}{title}</div>
      {children}
    </div>
  );
}

function PaymentForm() {
  const [plan, setPlan] = React.useState('monthly');
  const [tx, setTx] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const submit = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await api.bnPaymentSubmit(tx.trim(), plan);
      setMsg({ ok: true, text: `پرداخت تأیید شد ✅ پرمیوم برای ${r.days} روز فعال شد (مبلغ: ${r.amount} USDT).` });
      setTimeout(() => location.reload(), 2500);
    } catch (e) { setMsg({ ok: false, text: e?.message || 'تأییدِ پرداخت ناموفق بود.' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
      <div className="opacity-70">پس از واریز، هشِ تراکنش را بفرست — خودکار از شبکهٔ BSC بررسی و فعال می‌شود:</div>
      <div className="flex gap-1">
        <button onClick={() => setPlan('monthly')} className={`flex-1 py-1.5 rounded ${plan === 'monthly' ? 'bg-indigo-600' : 'bg-white/5'}`}>ماهانه ۱۵</button>
        <button onClick={() => setPlan('yearly')} className={`flex-1 py-1.5 rounded ${plan === 'yearly' ? 'bg-indigo-600' : 'bg-white/5'}`}>سالانه ۲۰۰</button>
      </div>
      <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="هشِ تراکنش (0x...)" className="w-full rounded-lg px-3 py-2 outline-none" style={FS} dir="ltr" />
      {msg && <div className={msg.ok ? 'text-green-400' : 'text-red-400'}>{msg.text}</div>}
      <button onClick={submit} disabled={busy || !tx} className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ارسال و تأییدِ خودکار</button>
    </div>
  );
}

function ConnectLbank({ conn, onDone }) {
  const [key, setKey] = React.useState(''); const [sec, setSec] = React.useState(''); const [uid, setUid] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState(null); const [edit, setEdit] = React.useState(false);
  const save = async () => {
    setMsg(null); setBusy(true);
    try { await api.bnConnectLbank(key.trim(), sec.trim(), uid.trim()); setMsg({ ok: true, text: 'کلیدِ API ذخیره شد ✅' }); setEdit(false); onDone && onDone(); }
    catch (e) { setMsg({ ok: false, text: e?.premium ? 'ابتدا اشتراکِ پرمیوم تهیه کن.' : (e?.message || 'خطا') }); }
    finally { setBusy(false); }
  };
  if (conn && !edit) {
    return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-1">
      <div className="flex items-center gap-2 text-green-400"><Check size={14} /> حسابِ LBank وصل است</div>
      <div className="opacity-70">تأییدِ رفرال: {conn.referral_verified ? '✅ تأییدشده' : '⏳ در انتظار (وایت‌لیستِ IP)'}</div>
      <button onClick={() => setEdit(true)} className="text-indigo-300 hover:underline">ویرایش/تعویضِ کلید</button>
    </div>);
  }
  return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-2">
    <div className="opacity-80">کلیدِ API صرافیِ LBank را وارد کن (برای تریدِ واقعی روی حسابِ خودت):</div>
    <input className={inp} style={FS} placeholder="API Key" value={key} onChange={(e) => setKey(e.target.value)} dir="ltr" />
    <PwInput value={sec} onChange={(e) => setSec(e.target.value)} placeholder="API Secret" />
    <input className={inp} style={FS} placeholder="UID لِی‌بنک (اختیاری — برای تأییدِ رفرال)" value={uid} onChange={(e) => setUid(e.target.value)} dir="ltr" />
    {msg && <div className={msg.ok ? 'text-green-400' : 'text-red-400'}>{msg.text}</div>}
    <button onClick={save} disabled={busy || !key || !sec} className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ذخیرهٔ امن</button>
  </div>);
}

function ConnectMt5({ conn, onDone }) {
  const [login, setLogin] = React.useState(''); const [pass, setPass] = React.useState(''); const [server, setServer] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState(null); const [edit, setEdit] = React.useState(false);
  const save = async () => {
    setMsg(null); setBusy(true);
    try { await api.bnConnectMt5(login.trim(), pass.trim(), server.trim()); setMsg({ ok: true, text: 'حسابِ MT5 ذخیره شد ✅' }); setEdit(false); onDone && onDone(); }
    catch (e) { setMsg({ ok: false, text: e?.premium ? 'ابتدا اشتراکِ پرمیوم تهیه کن.' : (e?.message || 'خطا') }); }
    finally { setBusy(false); }
  };
  if (conn && !edit) {
    return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-1">
      <div className="flex items-center gap-2 text-green-400"><Check size={14} /> حسابِ MT5 وصل است (#{conn.account_ref})</div>
      <button onClick={() => setEdit(true)} className="text-indigo-300 hover:underline">ویرایش</button>
    </div>);
  }
  return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-2">
    <div className="opacity-80">حسابِ MT5ِ وان‌رویال را وارد کن (برای تریدِ واقعی روی حسابِ خودت):</div>
    <input className={inp} style={FS} placeholder="شمارهٔ حساب (Login)" value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" />
    <PwInput value={pass} onChange={(e) => setPass(e.target.value)} placeholder="رمزِ معاملاتی" />
    <input className={inp} style={FS} placeholder="سرور (مثلاً OneRoyal-Live)" value={server} onChange={(e) => setServer(e.target.value)} dir="ltr" />
    {msg && <div className={msg.ok ? 'text-green-400' : 'text-red-400'}>{msg.text}</div>}
    <button onClick={save} disabled={busy || !login || !pass} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ذخیرهٔ امن</button>
  </div>);
}

function Dashboard({ auth, me }) {
  const tier = me?.tier || auth.tier || 'free';
  const isVip = tier === 'vip' || tier === 'premium';
  const acct = auth.account_type || me?.account_type;
  const [pr, setPr] = React.useState(null); const [copied, setCopied] = React.useState('');
  const [ref, setRef] = React.useState(null);
  const [conn, setConn] = React.useState(null);
  const loadConn = () => api.bnConnectStatus().then(setConn).catch(() => {});
  React.useEffect(() => {
    api.pricing().then(setPr).catch(() => {});
    api.bnReferralLink().then(setRef).catch(() => {});
    loadConn();
  }, []);
  const refUrl = ref?.url;
  const copy = (t, k) => { navigator.clipboard?.writeText(t); setCopied(k); setTimeout(() => setCopied(''), 1500); };

  return (
    <div className="mt-2">
      <Card title="حساب" icon={<User size={16} className="text-gray-300" />}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="opacity-60">نام‌کاربری:</span> <b dir="ltr">{auth.username}</b></div>
          <div><span className="opacity-60">نوعِ حساب:</span> <b>{acct === 'crypto' ? 'کریپتو (LBank)' : acct === 'broker' ? 'فارکس (وان‌رویال)' : '—'}</b></div>
          {me?.email && <div className="col-span-2"><span className="opacity-60">ایمیل:</span> <b dir="ltr">{me.email}</b></div>}
        </div>
      </Card>

      <Card title="اشتراک" icon={<Crown size={16} className="text-amber-300" />}>
        <div className="flex items-center justify-between">
          <div>وضعیتِ فعلی: <b className={isVip ? 'text-amber-300' : ''}>{TIER[tier] || tier}</b></div>
          {!isVip && <span className="text-[12px] opacity-70">برای تریدِ واقعی، اشتراکِ پرمیوم لازم است</span>}
        </div>
        {!isVip && pr?.wallet && (
          <div className="mt-3 rounded-xl bg-white/5 p-3 text-[12px] space-y-2">
            <div className="flex justify-between"><span>ماهانه</span><b className="text-indigo-300">۱۵ تتر</b></div>
            <div className="flex justify-between"><span>سالانه</span><b className="text-indigo-300">۲۰۰ تتر</b></div>
            <div className="opacity-70 pt-1">آدرسِ واریز ({pr.network} · {pr.currency}):</div>
            <div className="flex items-center gap-2"><code className="flex-1 break-all bg-black/30 rounded px-2 py-1" dir="ltr">{pr.wallet}</code>
              <button onClick={() => copy(pr.wallet, 'w')} className="p-1.5 rounded bg-white/10 hover:bg-white/20">{copied === 'w' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button></div>
            <PaymentForm />
          </div>
        )}
      </Card>

      {acct === 'crypto' ? (
        <Card title="اتصال به صرافیِ LBank (البنک)" icon={<Bitcoin size={16} className="text-amber-400" />}>
          <p className="text-sm opacity-80 leading-7 mb-3">برای تریدِ واقعیِ کریپتو روی چارت، باید حسابِ LBankِ خودت را وصل کنی و <b>زیرمجموعهٔ رفرالِ ما</b> باشی (شرطِ تریدِ واقعی).</p>
          <a href={refUrl || 'https://www.lbank.com'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-sm mb-3"><Link2 size={14} /> ساختِ حساب با لینکِ رفرالِ ما <ExternalLink size={12} /></a>
          <ConnectLbank conn={conn?.accounts?.lbank} isVip={isVip} onDone={loadConn} />
        </Card>
      ) : acct === 'broker' ? (
        <Card title="اتصال به بروکرِ وان‌رویال (MT5)" icon={<LineChart size={16} className="text-indigo-400" />}>
          <p className="text-sm opacity-80 leading-7 mb-3">برای تریدِ واقعیِ فارکس روی چارت، باید حسابِ MT5ِ وان‌رویالِ خودت را وصل کنی و <b>زیرمجموعهٔ رفرالِ ما</b> باشی.</p>
          <a href={refUrl || 'https://www.oneroyal.com'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-sm mb-3"><Link2 size={14} /> ساختِ حساب با لینکِ رفرالِ ما <ExternalLink size={12} /></a>
          <ConnectMt5 conn={conn?.accounts?.mt5} isVip={isVip} onDone={loadConn} />
        </Card>
      ) : (
        <Card title="اتصالِ حساب" icon={<Link2 size={16} />}><p className="text-sm opacity-70">نوعِ حساب مشخص نیست. لطفاً دوباره ثبت‌نام کن و کریپتو یا فارکس را انتخاب کن.</p></Card>
      )}

      <Card title="تریدِ واقعی روی چارت" icon={<ShieldCheck size={16} className="text-green-400" />}>
        <p className="text-sm opacity-80 leading-7">
          {isVip ? 'اشتراکت فعال است. پس از اتصالِ حساب و تأییدِ رفرال، می‌توانی مستقیم از روی چارت سفارشِ واقعی باز کنی.'
                 : 'این قابلیت ویژهٔ کاربرانِ پرمیومِ زیرمجموعهٔ رفرال است. ابتدا اشتراک تهیه کن.'}
        </p>
        <a href={acct === 'crypto' ? 'https://pro-chart.ir/' : 'https://pro-chart.ir/'} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm">رفتن به چارتِ بازارنما <ExternalLink size={12} /></a>
      </Card>
    </div>
  );
}
