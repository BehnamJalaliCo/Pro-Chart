import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowLeft, MonitorSmartphone, Trash2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const { login, setMe } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlimit, setDlimit] = useState(null); // {manage_token, devices, max}

  const doLogin = async () => {
    const res = await api.login(u.trim(), p);
    if (res.device_limit) { setDlimit(res); return false; }
    login(res.token);
    // رفعِ باگِ «قفل تا رفرش»: قبل از ناوبری، پروفایل (tier) را بارگذاری کن تا گیتِ VIP درست باز شود
    try { const m = await api.me(); setMe(m); } catch (e) { /* در صورتِ خطا، boot دوباره تلاش می‌کند */ }
    nav('/', { replace: true });
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!u.trim() || !p) return;
    setErr(''); setBusy(true);
    try { await doLogin(); } catch (e) { setErr(e?.message || 'ورود ناموفق بود.'); } finally { setBusy(false); }
  };

  const removeAndRetry = async (id) => {
    setErr(''); setBusy(true);
    try {
      await api.removeDevicePre(dlimit.manage_token, id);
      setDlimit(null);
      await doLogin();
    } catch (e) { setErr(e?.message || 'حذفِ دستگاه ناموفق بود.'); } finally { setBusy(false); }
  };

  return (
    <AuthShell badge="ورود به آکادمی">
        <div className="mb-6">
          <h1 className="text-2xl font-black mb-1">خوش آمدی 👋</h1>
          <p className="text-text-secondary text-sm">با نام‌کاربری و رمزی که دریافت کرده‌ای وارد شو.</p>
        </div>

        {dlimit ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-brand-amber/10 text-brand-amber rounded-xl px-3 py-3 text-sm">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <span>به سقفِ <b>{dlimit.max} دستگاه</b> رسیده‌ای. برای ورود با این دستگاه، یکی از دستگاه‌های زیر را حذف کن (آن دستگاه خارج می‌شود).</span>
            </div>
            <div className="space-y-2">
              {dlimit.devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-3 py-3">
                  <MonitorSmartphone size={20} className="text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{d.name || 'دستگاه'}</div>
                    <div className="text-xs text-text-muted">آخرین فعالیت: {d.last_seen ? new Date(d.last_seen).toLocaleString('fa-IR') : '—'}</div>
                  </div>
                  <button onClick={() => removeAndRetry(d.id)} disabled={busy}
                    className="text-brand-red hover:bg-brand-red/10 rounded-lg p-2 disabled:opacity-50"><Trash2 size={17} /></button>
                </div>
              ))}
            </div>
            {err && <p className="text-brand-red text-sm bg-brand-red/10 rounded-lg px-3 py-2">{err}</p>}
            <button onClick={() => { setDlimit(null); setErr(''); }} className="text-text-secondary text-sm hover:text-text-primary w-full">بازگشت</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
              <User size={18} className="text-text-muted shrink-0" />
              <input value={u} onChange={(e) => setU(e.target.value)} placeholder="نام‌کاربری" autoFocus
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none" dir="ltr" />
            </div>
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 focus-within:border-brand-green transition-colors">
              <Lock size={18} className="text-text-muted shrink-0" />
              <input value={p} onChange={(e) => setP(e.target.value)} type={show ? 'text' : 'password'} placeholder="رمز عبور"
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none" dir="ltr" />
              <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
                className="text-text-muted hover:text-text-primary shrink-0 p-1">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {err && <p className="text-brand-red text-sm bg-brand-red/10 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy} className="btn-success w-full disabled:opacity-50">{busy ? 'در حال ورود…' : 'ورود'}</button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-3">
          <Link to="/register" className="block w-full py-2.5 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/10 transition-colors">ثبت‌نامِ رایگان با ایمیل</Link>
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-text-secondary text-sm hover:text-emerald-400 transition-colors">مشاهدهٔ پلن‌ها و قیمت‌ها <ArrowLeft size={15} /></Link>
        </div>
    </AuthShell>
  );
}
