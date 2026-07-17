import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, KeyRound, User, UserCircle, Lock, Eye, EyeOff, GraduationCap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';
import AuthShell from '../components/AuthShell';

export default function Register() {
  const { login, setMe } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1); // 1=email, 2=code+credentials
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [full, setFull] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiry, setExpiry] = useState(0); // ثانیه‌های باقی‌مانده برای اعتبارِ کد (۲ دقیقه)

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (expiry <= 0) return;
    const t = setTimeout(() => setExpiry((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [expiry]);

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const sendCode = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setErr(''); setBusy(true);
    try {
      const r = await api.registerRequest(email.trim());
      setCooldown(r.cooldown || 60);
      setExpiry(r.ttl || 120);
      setStep(2);
    } catch (e) { setErr(e?.message || 'ارسالِ کد ناموفق بود.'); } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (expiry <= 0) { setErr('کد منقضی شده؛ دوباره ارسال کن.'); return; }
    if (!full.trim()) { setErr('نام و نام خانوادگی را وارد کن.'); return; }
    setErr(''); setBusy(true);
    try {
      const res = await api.registerVerify(email.trim(), code.trim(), u.trim(), p, full.trim());
      login(res.token);
      // بارگذاریِ پروفایل قبل از ناوبری (رفعِ باگِ قفل + رساندنِ کاربرِ جدید به مرحلهٔ تلفن)
      try { const m = await api.me(); setMe(m); } catch (e) { /* boot دوباره تلاش می‌کند */ }
      nav('/', { replace: true });
    } catch (e) { setErr(e?.message || 'ثبت‌نام ناموفق بود.'); } finally { setBusy(false); }
  };

  return (
    <AuthShell badge="ثبت‌نامِ رایگان">
        <div className="mb-6">
          <h1 className="text-2xl font-black mb-1">حسابِ رایگان بساز ✨</h1>
          <p className="text-text-secondary text-sm">
            با ایمیلت ثبت‌نام کن و ۵ جلسهٔ اولِ هر دوره را رایگان ببین.
          </p>
        </div>

        {/* نوارِ مرحله */}
        <div className="flex items-center gap-2 mb-5 text-xs">
          <span className={`flex items-center gap-1 ${step >= 1 ? 'text-brand-green' : 'text-text-muted'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step > 1 ? 'bg-brand-green text-black' : 'border border-current'}`}>{step > 1 ? '✓' : '۱'}</span> ایمیل
          </span>
          <span className="flex-1 h-px bg-surface-border" />
          <span className={`flex items-center gap-1 ${step >= 2 ? 'text-brand-green' : 'text-text-muted'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center border border-current`}>۲</span> تأیید و ساخت
          </span>
        </div>

        {step === 1 ? (
          <form onSubmit={sendCode} className="space-y-3">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
              <Mail size={18} className="text-text-muted shrink-0" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ایمیل" autoFocus
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none" dir="ltr" />
            </div>
            {err && <p className="text-brand-red text-sm bg-brand-red/10 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy} className="btn-success w-full disabled:opacity-50">
              {busy ? 'در حال ارسال…' : 'ارسالِ کدِ تأیید'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-xs text-text-muted bg-brand-green/5 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-brand-green" /> کدِ ۶ رقمی به <b className="text-text-secondary mx-1" dir="ltr">{email}</b> ارسال شد.
            </p>
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
              <KeyRound size={18} className="text-text-muted shrink-0" />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کدِ تأیید" inputMode="numeric" maxLength={6}
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none tracking-widest" dir="ltr" />
              {expiry > 0
                ? <span className="text-xs font-mono shrink-0 text-brand-green" dir="ltr">{mmss(expiry)}</span>
                : <span className="text-xs shrink-0 text-brand-red">منقضی شد</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">{expiry > 0 ? 'مهلتِ ثبتِ کد' : 'کد منقضی شد'}</span>
              <button type="button" onClick={sendCode} disabled={cooldown > 0 || busy}
                className="text-xs text-brand-blue disabled:text-text-muted">
                {cooldown > 0 ? `ارسالِ دوباره تا ${cooldown} ثانیه` : 'ارسالِ دوبارهٔ کد'}
              </button>
            </div>

            <div className="border-t border-surface-border pt-3 space-y-3">
              <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
                <UserCircle size={18} className="text-text-muted shrink-0" />
                <input value={full} onChange={(e) => setFull(e.target.value)} placeholder="نام و نام خانوادگی"
                  className="flex-1 bg-transparent py-3 text-sm focus:outline-none" />
              </div>
              <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
                <User size={18} className="text-text-muted shrink-0" />
                <input value={u} onChange={(e) => setU(e.target.value)} placeholder="نام‌کاربری (انگلیسی)"
                  className="flex-1 bg-transparent py-3 text-sm focus:outline-none" dir="ltr" />
              </div>
              <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
                <Lock size={18} className="text-text-muted shrink-0" />
                <input value={p} onChange={(e) => setP(e.target.value)} type={show ? 'text' : 'password'} placeholder="رمز عبور (حداقل ۶)"
                  className="flex-1 bg-transparent py-3 text-sm focus:outline-none" dir="ltr" />
                <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1} className="text-text-muted hover:text-text-primary p-1">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {err && <p className="text-brand-red text-sm bg-brand-red/10 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy} className="btn-success w-full disabled:opacity-50">
              {busy ? 'در حال ساخت…' : 'ساختِ حساب و ورود'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-text-secondary text-sm hover:text-emerald-400 transition-colors">
            <ArrowLeft size={15} /> قبلاً حساب داری؟ ورود
          </Link>
        </div>
    </AuthShell>
  );
}
