import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuth } from '../store';
import { Spinner } from '../components/ui';

function Step({ n, title, done, active, icon: Icon }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : 'opacity-50'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-brand-green text-white' : active ? 'bg-brand-blue text-white' : 'bg-surface-elevated text-text-muted'}`}>
        {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
      </div>
      <span className="text-sm font-medium text-text-primary">{title}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const { profile, setProfile } = useAuth();
  const nav = useNavigate();

  const refresh = async () => { const p = await userAPI.me(); setProfile(p); return p; };

  // ── ایمیل ──
  const [email, setEmail] = useState(profile?.email || '');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [emailErr, setEmailErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendOtp = async () => {
    setEmailErr(''); setBusy(true);
    try { const r = await userAPI.requestOtp(email); setOtpSent(true); setCooldown(r.cooldown || 60); }
    catch (e) { setEmailErr(e?.message || 'ارسال ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setEmailErr(''); setBusy(true);
    try { await userAPI.verifyOtp(email, code); await refresh(); }
    catch (e) { setEmailErr(e?.message || 'کد نادرست است.'); }
    finally { setBusy(false); }
  };

  // ── سلبِ مسئولیت ──
  const { data: disc } = useQuery({ queryKey: ['disclaimer'], queryFn: () => userAPI.getDisclaimer() });
  const [agreed, setAgreed] = useState(false);
  const [discErr, setDiscErr] = useState('');
  const acceptDisc = async () => {
    setDiscErr(''); setBusy(true);
    try { await userAPI.acceptDisclaimer(disc.version, profile?.name); const p = await refresh();
      if (p.email_verified && p.disclaimer_accepted) nav('/', { replace: true }); }
    catch (e) { setDiscErr(e?.message || 'ثبت ناموفق بود.'); }
    finally { setBusy(false); }
  };

  const emailDone = !!profile?.email_verified;
  const discDone = !!profile?.disclaimer_accepted;

  useEffect(() => { if (emailDone && discDone) nav('/', { replace: true }); }, [emailDone, discDone, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="card p-6 md:p-8 w-full max-w-xl">
        <h1 className="text-2xl font-black text-text-primary mb-1">تکمیلِ ثبت‌نام</h1>
        <p className="text-text-secondary text-sm mb-6">برای فعال‌سازیِ پنل، دو مرحلهٔ زیر را کامل کنید.</p>

        <div className="flex items-center justify-between mb-7 px-1">
          <Step n={1} title="تأیید ایمیل" done={emailDone} active={!emailDone} icon={Mail} />
          <div className="flex-1 h-px bg-surface-border mx-3" />
          <Step n={2} title="سلب مسئولیت" done={discDone} active={emailDone && !discDone} icon={FileText} />
        </div>

        {/* مرحلهٔ ۱: ایمیل */}
        {!emailDone && (
          <div className="space-y-4">
            <div>
              <label className="label">ایمیل شما</label>
              <input className="input" type="email" dir="ltr" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={otpSent} />
            </div>
            {!otpSent ? (
              <button className="btn-primary w-full" onClick={sendOtp} disabled={busy || !email}>
                {busy ? 'در حال ارسال…' : 'ارسالِ کدِ تأیید'}
              </button>
            ) : (
              <>
                <div>
                  <label className="label">کدِ ۶ رقمیِ ارسال‌شده به ایمیل</label>
                  <input className="input text-center tracking-[0.5em] text-lg" dir="ltr" maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="------" />
                </div>
                <button className="btn-success w-full" onClick={verify} disabled={busy || code.length < 4}>
                  {busy ? 'بررسی…' : 'تأیید ایمیل'}
                </button>
                <button className="text-text-muted text-sm w-full" onClick={sendOtp} disabled={cooldown > 0}>
                  {cooldown > 0 ? `ارسال مجدد تا ${cooldown} ثانیه` : 'ارسال مجدد کد'}
                </button>
              </>
            )}
            {emailErr && <p className="text-brand-red text-sm">{emailErr}</p>}
          </div>
        )}

        {/* مرحلهٔ ۲: سلب مسئولیت */}
        {emailDone && !discDone && (
          disc ? (
            <div className="space-y-4">
              <h3 className="font-bold text-text-primary flex items-center gap-2"><ShieldCheck size={18} className="text-brand-amber" /> {disc.title}</h3>
              <div className="bg-surface-DEFAULT border border-surface-border rounded-xl p-4 max-h-64 overflow-y-auto text-sm text-text-secondary leading-7 whitespace-pre-line">
                {disc.text}
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 accent-brand-green" />
                <span className="text-sm text-text-primary">متن بالا را کامل خواندم و آگاهانه می‌پذیرم.</span>
              </label>
              <button className="btn-success w-full" onClick={acceptDisc} disabled={!agreed || busy}>
                {busy ? 'ثبت…' : 'می‌پذیرم و ادامه'}
              </button>
              {discErr && <p className="text-brand-red text-sm">{discErr}</p>}
            </div>
          ) : <Spinner />
        )}
      </div>
    </div>
  );
}
