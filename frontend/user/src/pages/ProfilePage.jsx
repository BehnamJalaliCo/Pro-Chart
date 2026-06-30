import { useState } from 'react';
import { Mail, Phone, Award, Crown, BadgeCheck, IdCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuth } from '../store';
import Guide from '../components/Guide';

const SKILL_FA = { beginner: 'مبتدی', intermediate: 'متوسط', advanced: 'پیشرفته', expert: 'حرفه‌ای' };
const KYC_FA = { none: 'انجام نشده', pending: 'در حالِ بررسی', approved: 'تأییدشده ✓', rejected: 'ردشده' };
const KYC_TONE = { none: 'text-text-muted', pending: 'text-brand-amber', approved: 'text-brand-green', rejected: 'text-brand-red' };

function Row({ icon: Icon, label, value, tone = 'text-text-primary' }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      <Icon size={18} className="text-text-muted shrink-0" />
      <span className="text-sm text-text-secondary flex-1">{label}</span>
      <span className={`text-sm font-bold ${tone}`}>{value || '—'}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, setProfile } = useAuth();
  const [kyc, setKyc] = useState({
    full_name: profile?.kyc_full_name || '', country: profile?.kyc_country || '',
    dob: '', nationality: '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const valid = kyc.full_name.trim().length >= 3 && kyc.country.trim().length >= 2
    && /^\d{4}-\d{2}-\d{2}$/.test(kyc.dob) && kyc.nationality.trim().length >= 2;

  const submitKyc = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await userAPI.submitKyc(kyc);
      const p = await userAPI.me(); setProfile(p);
      setMsg(r.approved ? 'احرازِ هویتِ شما با موفقیت تأیید شد ✓' : 'اطلاعات ثبت شد.');
    } catch (e) { setErr(e?.message || 'ثبت ناموفق بود.'); }
    finally { setBusy(false); }
  };

  const planFa = { trial: 'آزمایشی', monthly: 'یک‌ماهه', quarterly: 'سه‌ماهه', biannual: 'شش‌ماهه', free: 'رایگان' };
  const kycStatus = profile?.kyc_status || 'none';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-text-primary">پروفایل و احراز هویت</h1>
        <p className="text-text-secondary text-sm">اطلاعاتِ حساب و سطحِ مهارتِ شما</p>
      </div>

      {/* مشخصات */}
      <div className="card p-5">
        <Row icon={Mail} label="ایمیل" value={profile?.email ? (profile.email_verified ? `${profile.email} ✓` : profile.email) : 'ثبت نشده'}
          tone={profile?.email_verified ? 'text-brand-green' : 'text-text-primary'} />
        <Row icon={Phone} label="شمارهٔ تماس" value={profile?.phone} />
        <Row icon={Crown} label="اشتراک" value={`${planFa[profile?.plan] || profile?.plan || '—'}${profile?.is_paid ? ' (پولی)' : ''}`}
          tone={profile?.is_vip ? 'text-brand-green' : 'text-text-muted'} />
        <Row icon={Award} label="سطحِ مهارت" value={profile?.skill_level ? `${SKILL_FA[profile.skill_level] || profile.skill_level}${profile?.skill_score != null ? ` (امتیاز ${profile.skill_score})` : ''}` : 'تعیین‌نشده'}
          tone="text-brand-blue" />
        <Row icon={BadgeCheck} label="وضعیتِ احراز هویت (KYC)" value={KYC_FA[kycStatus]} tone={KYC_TONE[kycStatus]} />
      </div>

      {/* احراز هویتِ تأییدشده */}
      {kycStatus === 'approved' && (
        <div className="card p-5 border-brand-green/30 flex items-center gap-3">
          <ShieldCheck size={22} className="text-brand-green shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-text-primary">احرازِ هویتِ شما تأییدشده است</div>
            <div className="text-xs text-text-muted mt-0.5">{profile?.kyc_full_name}{profile?.kyc_country ? ` · ${profile.kyc_country}` : ''}</div>
          </div>
        </div>
      )}

      {/* فرمِ KYC — حرفه‌ای، تأییدِ آنی */}
      {kycStatus !== 'approved' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <IdCard size={18} className="text-brand-blue" />
            <h3 className="font-bold text-text-primary">احرازِ هویت</h3>
            <span className="ms-auto flex items-center gap-1 text-[11px] bg-brand-green/12 text-brand-green px-2 py-0.5 rounded-full">
              <CheckCircle2 size={12} /> تأییدِ آنی
            </span>
          </div>
          <p className="text-xs text-text-muted -mt-1">اطلاعات را مطابقِ مدرکِ شناساییِ معتبر وارد کنید؛ پس از ثبت، بلافاصله تأیید می‌شود.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">نام و نام خانوادگی (لاتین، مطابقِ مدرک)</label>
              <input className="input" placeholder="Ali Rezaei" value={kyc.full_name} onChange={(e) => setKyc({ ...kyc, full_name: e.target.value })} /></div>
            <div><label className="label">تاریخِ تولد</label>
              <input type="date" className="input" value={kyc.dob} onChange={(e) => setKyc({ ...kyc, dob: e.target.value })} /></div>
            <div><label className="label">ملیت</label>
              <input className="input" placeholder="ایرانی" value={kyc.nationality} onChange={(e) => setKyc({ ...kyc, nationality: e.target.value })} /></div>
            <div><label className="label">کشورِ محلِ اقامت</label>
              <input className="input" placeholder="ایران" value={kyc.country} onChange={(e) => setKyc({ ...kyc, country: e.target.value })} /></div>
          </div>

          <button onClick={submitKyc} disabled={busy || !valid} className="btn-primary flex items-center gap-2">
            <ShieldCheck size={16} /> {busy ? 'در حالِ تأیید…' : 'ثبت و تأییدِ احراز هویت'}
          </button>
          {msg && <p className="text-sm text-brand-green flex items-center gap-1"><CheckCircle2 size={14} /> {msg}</p>}
          {err && <p className="text-sm text-brand-red">{err}</p>}
        </div>
      )}

      {!profile?.skill_level && (
        <Guide title="سطحِ مهارتم چطور تعیین می‌شود؟" defaultOpen>
          سطحِ مهارتِ شما از آزمونِ کوتاهِ ابتدای ربات تلگرام به‌دست می‌آید. اگر هنوز آن را انجام
          نداده‌اید، در ربات <b>@CoineProFxBot</b> آزمونِ سطح‌سنجی را کامل کنید تا اینجا نمایش داده شود.
        </Guide>
      )}

      <Guide title="چرا احراز هویت لازم است؟">
        ورود با تلگرام هویتِ حسابِ تلگرامِ شما را تأیید می‌کند، اما برای خدماتِ مالی طبقِ استانداردهای
        KYC به اطلاعاتِ هویتیِ تکمیلی (نام، تاریخِ تولد، ملیت، نوع و شمارهٔ مدرک) نیاز داریم. پس از
        تکمیلِ این اطلاعات، احرازِ هویتِ شما <b>بلافاصله و خودکار</b> تأیید می‌شود — بدونِ معطلی. این
        اطلاعات محرمانه است و فقط برای تأییدِ حساب استفاده می‌شود.
      </Guide>
    </div>
  );
}
