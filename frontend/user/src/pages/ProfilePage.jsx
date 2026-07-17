import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Mail, Phone, Globe, ShieldCheck, ShieldAlert, Crown, Save, Loader2,
  Smartphone, Trash2, LogOut, Monitor, BadgeCheck, CalendarClock, Sparkles,
} from 'lucide-react';
import { bnUserAPI, useAuth } from '../api/client';
import {
  useToast, toPersianDigits, Skeleton, EmptyState, ErrorState,
} from '../components/ui';

const TIER_LABEL = { premium: 'پرمیوم', vip: 'VIP', free: 'رایگان' };
const ACCOUNT_LABEL = {
  crypto: 'کریپتو (صرافی LBank)',
  broker: 'فارکس (معرفی OneRoyal)',
  forex: 'فارکس (معرفی OneRoyal)',
};
const MAX_DEVICES = 2;

// ── قالبِ تاریخ فارسی ──
function faDate(iso, withTime = false) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return toPersianDigits(d.toLocaleDateString('fa-IR', opts));
  } catch { return String(iso); }
}

// ── نرمال‌سازیِ فهرستِ دستگاه‌ها ──
function normalizeDevices(data) {
  const arr = Array.isArray(data) ? data : (data?.items || data?.devices || []);
  return arr.map((d) => ({
    id: d.id ?? d.device_id,
    name: d.device_name || d.name || 'دستگاهِ ناشناس',
    lastSeen: d.last_seen || d.lastSeen || null,
    current: !!(d.current || d.is_current),
  })).filter((d) => d.id != null);
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { logout } = useAuth();

  // ── دادهٔ اصلی (پروفایل از aگرِگیتِ overview) ──
  const overviewQ = useQuery({
    queryKey: ['overview'],
    queryFn: () => bnUserAPI.overview(),
    staleTime: 30000,
  });
  const profile = overviewQ.data?.profile || null;
  const tier = profile?.tier || 'free';
  const isPremium = tier === 'premium' || tier === 'vip';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User size={22} className="text-brand-blue" />
        <h1 className="text-xl font-black text-text-primary">پروفایل و امنیت</h1>
      </div>

      {overviewQ.isLoading ? (
        <ProfileSkeleton />
      ) : overviewQ.isError ? (
        <div className="card"><ErrorState message={overviewQ.error?.message} onRetry={() => overviewQ.refetch()} /></div>
      ) : (
        <>
          <IdentityCard profile={profile} tier={tier} isPremium={isPremium} />
          {!isPremium && <UpgradeCTA />}
          <EditProfileForm profile={profile} onSaved={() => qc.invalidateQueries({ queryKey: ['overview'] })} />
          <DevicesSection />
        </>
      )}

      {/* خروج */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="font-bold text-text-primary">خروج از حساب</div>
          <div className="text-xs text-text-muted mt-0.5">از این دستگاه خارج می‌شوید و به صفحهٔ ورود بازمی‌گردید.</div>
        </div>
        <button onClick={logout} className="btn-danger inline-flex items-center justify-center gap-2 shrink-0">
          <LogOut size={18} /> خروج
        </button>
      </div>
    </div>
  );
}

// ── کارتِ هویت (فقط‌خواندنی) ──
function IdentityCard({ profile, tier, isPremium }) {
  const name = profile?.fullName || profile?.username || 'کاربر';
  const phoneVerified = !!profile?.phoneVerified;
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-blue/15 text-brand-blue flex items-center justify-center text-2xl font-black shrink-0">
          {String(name).trim().charAt(0) || 'ک'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-text-primary text-lg truncate">{name}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
              isPremium ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-elevated text-text-muted'}`}>
              {isPremium ? <Crown size={12} /> : <ShieldCheck size={12} />}
              {TIER_LABEL[tier] || tier}
            </span>
          </div>
          {profile?.username && (
            <div className="text-xs text-text-muted mt-0.5">@{toPersianDigits(profile.username)}</div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mt-5">
        <ReadRow icon={Mail} label="ایمیل" value={profile?.email} ltr />
        <ReadRow
          icon={Phone} label="شمارهٔ موبایل" ltr
          value={profile?.phoneNumber ? toPersianDigits(profile.phoneNumber) : 'ثبت نشده'}
          badge={profile?.phoneNumber ? (
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
              phoneVerified ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-amber/15 text-brand-amber'}`}>
              {phoneVerified ? <BadgeCheck size={11} /> : <ShieldAlert size={11} />}
              {phoneVerified ? 'تأیید شده' : 'تأیید نشده'}
            </span>
          ) : null}
        />
        <ReadRow icon={ShieldCheck} label="نوعِ حساب" value={ACCOUNT_LABEL[profile?.accountType] || profile?.accountType || '—'} />
        <ReadRow icon={CalendarClock} label="اعتبارِ اشتراک" value={profile?.expiresAt ? faDate(profile.expiresAt) : (isPremium ? 'نامحدود' : '—')} />
      </div>
    </div>
  );
}

function ReadRow({ icon: Icon, label, value, badge, ltr }) {
  return (
    <div className="flex items-center gap-3 bg-surface-elevated rounded-xl px-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-surface-card flex items-center justify-center text-text-muted shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-muted">{label}</div>
        <div className={`text-sm text-text-primary truncate ${ltr ? 'font-mono' : ''}`} dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>
          {value || '—'}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── ارتقا به پرمیوم (گیتِ کاربرِ رایگان) ──
function UpgradeCTA() {
  return (
    <div className="card p-5 border border-brand-amber/40 bg-brand-amber/[0.04]">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-amber/15 text-brand-amber flex items-center justify-center shrink-0">
          <Sparkles size={22} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-text-primary">حسابِ شما رایگان است</div>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            برای دسترسی به سیگنال‌های هوشِ مصنوعی، اتصالِ صرافی و معاملهٔ واقعی، اشتراکِ پرمیوم را فعال کنید.
          </p>
          <Link to="/subscription" className="btn-primary inline-flex items-center gap-2 mt-3">
            <Crown size={17} /> ارتقا به پرمیوم
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── فرمِ ویرایشِ پروفایل ──
function EditProfileForm({ profile, onSaved }) {
  const { success, error: toastErr } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phoneNumber || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

  const m = useMutation({
    mutationFn: (payload) => bnUserAPI.updateProfile(payload),
    onSuccess: () => { success('پروفایل به‌روزرسانی شد.'); onSaved?.(); },
    onError: (ex) => toastErr(ex?.message || 'ذخیرهٔ پروفایل ناموفق بود.'),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!fullName.trim()) { toastErr('نامِ کامل را وارد کنید.'); return; }
    m.mutate({ full_name: fullName.trim(), phone: phone.trim(), country: country.trim() });
  };

  const dirty =
    fullName !== (profile?.fullName || '') ||
    phone !== (profile?.phoneNumber || '') ||
    country !== (profile?.country || '');

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <User size={18} className="text-text-secondary" />
        <h2 className="font-bold text-text-primary">ویرایشِ اطلاعات</h2>
      </div>

      <Field icon={User} label="نامِ کامل" value={fullName} onChange={setFullName} placeholder="نام و نامِ خانوادگی" />
      <Field icon={Phone} label="شمارهٔ موبایل" value={phone} onChange={setPhone} placeholder="09xxxxxxxxx" ltr type="tel" />
      <Field icon={Globe} label="کشور" value={country} onChange={setCountry} placeholder="مثلاً ایران" />

      <button type="submit" disabled={m.isPending || !dirty}
        className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2">
        {m.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} ذخیرهٔ تغییرات
      </button>
    </form>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = 'text', ltr }) {
  return (
    <div>
      <label className="text-xs text-text-muted mb-1.5 block">{label}</label>
      <div className="relative">
        <Icon size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          dir={ltr ? 'ltr' : undefined}
          className={`input pr-10 ${ltr ? 'text-right font-mono' : ''}`}
        />
      </div>
    </div>
  );
}

// ── مدیریتِ دستگاه‌ها ──
function DevicesSection() {
  const qc = useQueryClient();
  const { success, error: toastErr } = useToast();
  const [removingId, setRemovingId] = useState(null);

  const q = useQuery({
    queryKey: ['devices'],
    queryFn: () => bnUserAPI.devices(),
    staleTime: 30000,
  });
  const devices = normalizeDevices(q.data);

  const m = useMutation({
    mutationFn: (id) => bnUserAPI.removeDevice(id),
    onMutate: (id) => setRemovingId(id),
    onSuccess: () => { success('دستگاه حذف شد.'); qc.invalidateQueries({ queryKey: ['devices'] }); },
    onError: (ex) => toastErr(ex?.message || 'حذفِ دستگاه ناموفق بود.'),
    onSettled: () => setRemovingId(null),
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-text-secondary" />
          <h2 className="font-bold text-text-primary">دستگاه‌های فعال</h2>
        </div>
        <span className="text-[11px] text-text-muted">
          {toPersianDigits(devices.length)} از {toPersianDigits(MAX_DEVICES)}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-4 leading-relaxed">
        حسابِ شما هم‌زمان روی حداکثر {toPersianDigits(MAX_DEVICES)} دستگاه فعال می‌ماند. برای ورود از دستگاهِ جدید، یکی را حذف کنید.
      </p>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : q.isError ? (
        <ErrorState message={q.error?.message} onRetry={() => q.refetch()} />
      ) : devices.length === 0 ? (
        <EmptyState icon={Smartphone} title="دستگاهی ثبت نشده" desc="هیچ دستگاهِ فعالی برای حسابِ شما یافت نشد." />
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-surface-elevated rounded-xl px-3 py-3">
              <div className="w-9 h-9 rounded-lg bg-surface-card flex items-center justify-center text-text-muted shrink-0">
                <Smartphone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary truncate">{d.name}</span>
                  {d.current && (
                    <span className="text-[10px] bg-brand-green/15 text-brand-green px-1.5 py-0.5 rounded-full shrink-0">این دستگاه</span>
                  )}
                </div>
                {d.lastSeen && (
                  <div className="text-[11px] text-text-muted mt-0.5">آخرین فعالیت: {faDate(d.lastSeen, true)}</div>
                )}
              </div>
              <button
                onClick={() => m.mutate(d.id)}
                disabled={removingId === d.id || d.current}
                title={d.current ? 'برای خروج از این دستگاه، از دکمهٔ خروج استفاده کنید.' : 'حذفِ دستگاه'}
                className="text-brand-red hover:bg-brand-red/10 rounded-lg p-2 disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                {removingId === d.id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── اسکلتِ بارگذاری ──
function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
