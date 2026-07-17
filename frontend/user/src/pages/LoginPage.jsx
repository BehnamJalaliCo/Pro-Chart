import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Mail, LogIn, Loader2, Smartphone, Trash2, ArrowRight,
  ShieldCheck, KeyRound, UserPlus, Eye, EyeOff,
} from 'lucide-react';
import { authAPI, useAuth } from '../api/client';
import { useToast, toPersianDigits } from '../components/ui';

const ACCOUNT_TYPES = [
  { v: 'crypto', label: 'کریپتو (صرافی)' },
  { v: 'broker', label: 'فارکس (معرفی OneRoyal)' },
];

export default function LoginPage() {
  const nav = useNavigate();
  const doLogin = useAuth((s) => s.login);
  const { success, error: toastErr } = useToast();
  const [view, setView] = useState('login'); // login | register | forgot

  // ── ورود ──
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // مدیریتِ سقفِ دستگاه‌ها
  const [deviceCap, setDeviceCap] = useState(null); // {max, manage_token, devices:[]}
  const [removingId, setRemovingId] = useState(null);

  const finishLogin = (data) => {
    if (data?.token) {
      doLogin(data.token);
      success('خوش آمدید 👋');
      nav('/', { replace: true });
      return true;
    }
    return false;
  };

  const submitLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) { setErr('نام کاربری و رمز عبور را وارد کنید.'); return; }
    setErr(''); setLoading(true);
    try {
      const data = await authAPI.login(username.trim(), password);
      if (data?.device_limit) { setDeviceCap(data); return; }
      if (!finishLogin(data)) setErr('پاسخِ نامعتبر از سرور.');
    } catch (ex) {
      if (ex?.data?.device_limit) { setDeviceCap(ex.data); return; }
      setErr(ex?.message || 'ورود ناموفق بود.');
    } finally { setLoading(false); }
  };

  const removeDevice = async (device_id) => {
    if (!deviceCap?.manage_token) return;
    setRemovingId(device_id);
    try {
      await authAPI.removeDevice(device_id, deviceCap.manage_token);
      success('دستگاه حذف شد. در حالِ ورودِ دوباره…');
      setDeviceCap(null);
      await submitLogin();
    } catch (ex) {
      toastErr(ex?.message || 'حذفِ دستگاه ناموفق بود.');
    } finally { setRemovingId(null); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-surface-DEFAULT">
      <div className="w-full max-w-md">
        {/* برند */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/15 text-brand-green flex items-center justify-center font-black text-2xl mb-3">ب</div>
          <h1 className="text-2xl font-black text-text-primary">بازارنما</h1>
          <p className="text-text-muted text-sm mt-1">پنل کاربری معامله‌گران</p>
        </div>

        <div className="card p-6">
          {deviceCap ? (
            <DeviceCap cap={deviceCap} onRemove={removeDevice} removingId={removingId} onBack={() => setDeviceCap(null)} />
          ) : view === 'login' ? (
            <LoginForm
              {...{ username, setUsername, password, setPassword, showPw, setShowPw, loading, err, submitLogin }}
              onRegister={() => { setView('register'); setErr(''); }}
              onForgot={() => { setView('forgot'); setErr(''); }}
            />
          ) : view === 'register' ? (
            <RegisterForm onDone={() => setView('login')} onBack={() => setView('login')} />
          ) : (
            <ForgotForm onDone={() => setView('login')} onBack={() => setView('login')} />
          )}
        </div>

        <p className="text-center text-[11px] text-text-muted mt-6 leading-relaxed">
          با ورود، ورودِ یکپارچه میانِ سایت اصلی و پنل کاربری فعال می‌شود.
        </p>
      </div>
    </div>
  );
}

// ── فرمِ ورود ──
function LoginForm({ username, setUsername, password, setPassword, showPw, setShowPw, loading, err, submitLogin, onRegister, onForgot }) {
  return (
    <form onSubmit={submitLogin} className="space-y-4">
      <h2 className="font-bold text-text-primary text-lg mb-1">ورود به حساب</h2>
      <Field icon={User} placeholder="نام کاربری یا ایمیل" value={username} onChange={setUsername} autoFocus />
      <div className="relative">
        <Field icon={Lock} type={showPw ? 'text' : 'password'} placeholder="رمز عبور" value={password} onChange={setPassword} />
        <button type="button" onClick={() => setShowPw((v) => !v)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {err && <p className="text-brand-red text-sm">{err}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        ورود
      </button>
      <div className="flex items-center justify-between text-sm pt-1">
        <button type="button" onClick={onForgot} className="text-text-muted hover:text-brand-blue flex items-center gap-1">
          <KeyRound size={15} /> فراموشیِ رمز
        </button>
        <button type="button" onClick={onRegister} className="text-brand-blue font-bold flex items-center gap-1">
          <UserPlus size={15} /> ساختِ حساب
        </button>
      </div>
    </form>
  );
}

// ── سقفِ دستگاه‌ها ──
function DeviceCap({ cap, onRemove, removingId, onBack }) {
  const devices = cap.devices || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-brand-amber">
        <ShieldCheck size={20} />
        <h2 className="font-bold text-text-primary">سقفِ دستگاه‌ها پر است</h2>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed">
        حسابِ شما روی حداکثر {toPersianDigits(cap.max ?? devices.length)} دستگاه فعال است. برای ورود، یکی از دستگاه‌های زیر را حذف کنید.
      </p>
      <div className="space-y-2">
        {devices.map((d) => (
          <div key={d.id} className="flex items-center gap-3 bg-surface-elevated rounded-xl px-3 py-2.5">
            <Smartphone size={18} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary truncate">{d.name || 'دستگاهِ ناشناس'}</div>
              {d.last_seen && <div className="text-[11px] text-text-muted">آخرین فعالیت: {d.last_seen}</div>}
            </div>
            <button onClick={() => onRemove(d.id)} disabled={removingId === d.id}
              className="text-brand-red hover:bg-brand-red/10 rounded-lg p-2 disabled:opacity-40">
              {removingId === d.id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
            </button>
          </div>
        ))}
      </div>
      <button onClick={onBack} className="btn-ghost w-full flex items-center justify-center gap-2">
        <ArrowRight size={17} /> بازگشت
      </button>
    </div>
  );
}

// ── ثبت‌نام ──
function RegisterForm({ onDone, onBack }) {
  const { success, error: toastErr } = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState('crypto');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const request = async (e) => {
    e?.preventDefault();
    if (!email.trim()) { setErr('ایمیل را وارد کنید.'); return; }
    setErr(''); setLoading(true);
    try { await authAPI.registerRequest(email.trim()); success('کدِ تأیید به ایمیل ارسال شد.'); setStep(2); }
    catch (ex) { setErr(ex?.message || 'ارسالِ کد ناموفق بود.'); }
    finally { setLoading(false); }
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (!code.trim() || !regUsername.trim() || !password || !fullName.trim()) { setErr('همهٔ فیلدها را کامل کنید.'); return; }
    setErr(''); setLoading(true);
    try {
      await authAPI.registerVerify({
        email: email.trim(), code: code.trim(), username: regUsername.trim(),
        password, full_name: fullName.trim(), account_type: accountType,
      });
      success('حساب ساخته شد. اکنون وارد شوید.');
      onDone();
    } catch (ex) { setErr(ex?.message || 'ثبت‌نام ناموفق بود.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={step === 1 ? request : verify} className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text-primary"><ArrowRight size={18} /></button>
        <h2 className="font-bold text-text-primary text-lg">ساختِ حساب</h2>
      </div>
      {step === 1 ? (
        <>
          <Field icon={Mail} type="email" placeholder="ایمیل" value={email} onChange={setEmail} autoFocus />
          {err && <p className="text-brand-red text-sm">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />} ارسالِ کدِ تأیید
          </button>
        </>
      ) : (
        <>
          <p className="text-text-muted text-xs">کدِ ارسال‌شده به {email} را وارد کنید.</p>
          <Field icon={KeyRound} placeholder="کدِ تأیید" value={code} onChange={setCode} autoFocus />
          <Field icon={User} placeholder="نامِ کامل" value={fullName} onChange={setFullName} />
          <Field icon={User} placeholder="نام کاربری" value={regUsername} onChange={setRegUsername} />
          <Field icon={Lock} type="password" placeholder="رمز عبور" value={password} onChange={setPassword} />
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">نوعِ حساب</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="input">
              {ACCOUNT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          {err && <p className="text-brand-red text-sm">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} تکمیلِ ثبت‌نام
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-text-muted text-sm hover:text-brand-blue">ویرایشِ ایمیل</button>
        </>
      )}
    </form>
  );
}

// ── فراموشیِ رمز ──
function ForgotForm({ onDone, onBack }) {
  const { success } = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const request = async (e) => {
    e?.preventDefault();
    if (!email.trim()) { setErr('ایمیل را وارد کنید.'); return; }
    setErr(''); setLoading(true);
    try { await authAPI.forgot(email.trim()); success('کدِ بازیابی ارسال شد.'); setStep(2); }
    catch (ex) { setErr(ex?.message || 'ارسالِ کد ناموفق بود.'); }
    finally { setLoading(false); }
  };

  const reset = async (e) => {
    e?.preventDefault();
    if (!code.trim() || !password) { setErr('کد و رمزِ جدید را وارد کنید.'); return; }
    setErr(''); setLoading(true);
    try { await authAPI.reset({ email: email.trim(), code: code.trim(), password }); success('رمز تغییر کرد. وارد شوید.'); onDone(); }
    catch (ex) { setErr(ex?.message || 'بازیابی ناموفق بود.'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={step === 1 ? request : reset} className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text-primary"><ArrowRight size={18} /></button>
        <h2 className="font-bold text-text-primary text-lg">بازیابیِ رمز</h2>
      </div>
      {step === 1 ? (
        <>
          <Field icon={Mail} type="email" placeholder="ایمیلِ حساب" value={email} onChange={setEmail} autoFocus />
          {err && <p className="text-brand-red text-sm">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />} ارسالِ کد
          </button>
        </>
      ) : (
        <>
          <Field icon={KeyRound} placeholder="کدِ بازیابی" value={code} onChange={setCode} autoFocus />
          <Field icon={Lock} type="password" placeholder="رمزِ جدید" value={password} onChange={setPassword} />
          {err && <p className="text-brand-red text-sm">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} تغییرِ رمز
          </button>
        </>
      )}
    </form>
  );
}

// ── فیلدِ ورودی ──
function Field({ icon: Icon, type = 'text', placeholder, value, onChange, autoFocus }) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        type={type} placeholder={placeholder} value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-10"
      />
    </div>
  );
}
