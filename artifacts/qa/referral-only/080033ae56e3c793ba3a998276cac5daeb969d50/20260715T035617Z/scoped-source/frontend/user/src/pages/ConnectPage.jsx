import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2, ShieldCheck, ShieldAlert, Lock, Eye, EyeOff,
  Gift, Crown, Unplug, KeyRound, Bitcoin, LineChart,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import { Skeleton, ErrorState, useToast } from '../components/ui';
import Guide from '../components/Guide';
import ReferralDeparture from '../components/ReferralDeparture';
import { normalizeAccountType, providerForAccountType } from '../referrals';

const PREMIUM_TIERS = ['vip', 'premium'];

// ── حبابِ وضعیت ──
function StatusPill({ connected, status, referralVerified }) {
  let tone = 'muted', label = 'متصل نیست';
  if (connected) {
    if (referralVerified === false) { tone = 'amber'; label = 'در انتظارِ تأییدِ معرف'; }
    else if (status === 'pending' || status === 'checking') { tone = 'amber'; label = 'در حال بررسی'; }
    else { tone = 'green'; label = 'متصل'; }
  }
  const cls = {
    green: 'bg-brand-green/12 text-brand-green',
    amber: 'bg-brand-amber/12 text-brand-amber',
    muted: 'bg-surface-elevated text-text-muted',
  }[tone];
  const dot = { green: 'bg-brand-green', amber: 'bg-brand-amber', muted: 'bg-text-muted' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ── ورودیِ امنِ کلید ──
function SecretInput({ value, onChange, placeholder, mono = true }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        autoComplete="off"
        className={`input pl-11 ${mono ? 'font-mono' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-text-primary transition"
        aria-label={show ? 'پنهان‌سازی' : 'نمایش'}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

// ── کارتِ اتصالِ لِی‌بانک ──
function LbankCard({ acct, locked }) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [uid, setUid] = useState('');

  const connect = useMutation({
    mutationFn: () => bnUserAPI.connectLbank({ api_key: apiKey.trim(), api_secret: apiSecret.trim(), uid: uid.trim() || undefined }),
    onSuccess: () => {
      success('کلیدها ثبت شد؛ اتصال در حال بررسی است.');
      setApiKey(''); setApiSecret(''); setUid('');
      qc.invalidateQueries({ queryKey: ['connectStatus'] });
      qc.invalidateQueries({ queryKey: ['bnOverview'] });
    },
    onError: (e) => error(e?.message || 'ثبتِ کلیدها ناموفق بود.'),
  });

  const disconnect = useMutation({
    mutationFn: () => bnUserAPI.disconnectLbank(),
    onSuccess: () => {
      success('اتصالِ صرافی قطع شد.');
      qc.invalidateQueries({ queryKey: ['connectStatus'] });
      qc.invalidateQueries({ queryKey: ['bnOverview'] });
    },
    onError: (e) => error(e?.message || 'قطعِ اتصال ناموفق بود.'),
  });

  const connected = !!acct?.connected;
  const canSubmit = apiKey.trim() && apiSecret.trim() && !connect.isPending && !locked;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-amber/12 text-brand-amber flex items-center justify-center">
            <Bitcoin size={22} />
          </div>
          <div>
            <div className="font-black text-text-primary">صرافیِ LBank</div>
            <div className="text-xs text-text-muted">اتصالِ کیفِ رمزارز برای معاملهٔ واقعی</div>
          </div>
        </div>
        <StatusPill connected={connected} status={acct?.status} referralVerified={acct?.referral_verified} />
      </div>

      {connected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-surface-elevated rounded-xl px-3 py-2.5">
            <span className="text-xs text-text-muted">شناسهٔ حساب</span>
            <span dir="ltr" className="font-mono text-sm text-text-primary">{acct?.account_ref || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {acct?.referral_verified
              ? <><ShieldCheck size={16} className="text-brand-green" /><span className="text-brand-green">کدِ معرف تأیید شد</span></>
              : <><ShieldAlert size={16} className="text-brand-amber" /><span className="text-brand-amber">در انتظارِ تأییدِ کدِ معرف</span></>}
          </div>
          {acct?.note && <p className="text-xs text-text-muted leading-6">{acct.note}</p>}
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="btn-ghost w-full inline-flex items-center justify-center gap-2 text-brand-red"
          >
            <Unplug size={16} /> {disconnect.isPending ? 'در حال قطع…' : 'قطعِ اتصال'}
          </button>
        </div>
      ) : (
        <div className={`space-y-3 ${locked ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-elevated rounded-xl px-3 py-2">
            <Lock size={14} className="text-brand-green shrink-0" />
            کلیدهای شما رمزنگاری‌شده ذخیره می‌شوند. توصیه: دسترسیِ «فقط خواندن + معامله».
          </div>
          <Field label="API Key">
            <SecretInput value={apiKey} onChange={setApiKey} placeholder="API Key" />
          </Field>
          <Field label="API Secret">
            <SecretInput value={apiSecret} onChange={setApiSecret} placeholder="API Secret" />
          </Field>
          <Field label="UID (اختیاری)">
            <input dir="ltr" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID" className="input font-mono" />
          </Field>
          <button
            onClick={() => connect.mutate()}
            disabled={!canSubmit}
            className="btn-success w-full inline-flex items-center justify-center gap-2"
          >
            <KeyRound size={16} /> {connect.isPending ? 'در حال ثبت…' : 'اتصالِ صرافی'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── کارتِ لینکِ معرف ──
function ReferralCard({ provider }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['referralLink'],
    queryFn: () => bnUserAPI.referralLink(),
    retry: false,
  });
  const referralOnly = provider === 'OneRoyal';

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-green/12 text-brand-green flex items-center justify-center">
          <Gift size={22} />
        </div>
        <div>
          <div className="font-black text-text-primary">معرفی {provider}</div>
          <div className="text-xs text-text-muted">
            {referralOnly
              ? 'OneRoyal فقط در سطح معرفی است؛ اتصال حساب و معاملهٔ مستقیم فعال نیست.'
              : 'برای بررسی شرایط حساب LBank، ابتدا اطلاعیهٔ معرفی را بخوانید.'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : isError ? (
        <p className="text-sm text-text-muted">لینکِ معرف در دسترس نیست.</p>
      ) : (
        <ReferralDeparture
          provider={provider}
          href={data?.url}
          buttonLabel={`لینک معرفی — ورود به وب‌سایت ${provider}`}
        />
      )}
    </div>
  );
}

// ── گیتِ اشتراکِ ویژه ──
function UpgradeGate() {
  return (
    <div className="card p-5 border border-brand-amber/40 bg-brand-amber/[0.06]">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-brand-amber/15 text-brand-amber flex items-center justify-center shrink-0">
          <Crown size={22} />
        </div>
        <div className="flex-1 space-y-2">
          <div className="font-black text-text-primary">اتصالِ حساب LBank ویژهٔ اشتراکِ پرمیوم است</div>
          <p className="text-sm text-text-muted leading-7">
            اتصال صرافی و معاملهٔ واقعی فقط برای حساب LBank و پس از ارتقا فعال می‌شود. OneRoyal صرفاً مسیر معرفی است.
          </p>
          <a href="/subscription" className="btn-success inline-flex items-center gap-2 mt-1">
            <Crown size={16} /> ارتقا به پرمیوم
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const status = useQuery({
    queryKey: ['connectStatus'],
    queryFn: () => bnUserAPI.connectStatus(),
    retry: false,
  });
  // همان منبعِ سایرِ صفحات: overview().profile.tier (queryKey ['overview'])
  const overview = useQuery({
    queryKey: ['overview'],
    queryFn: () => bnUserAPI.overview(),
    staleTime: 60000,
    retry: false,
  });

  const tier = (overview.data?.profile?.tier || '').toLowerCase();
  const isPremium = PREMIUM_TIERS.includes(tier);
  const locked = !isPremium && !overview.isLoading;

  const accounts = status.data?.accounts || {};
  const accountType = normalizeAccountType(
    status.data?.account_type ?? overview.data?.profile?.accountType ?? overview.data?.profile?.account_type
  );
  const provider = providerForAccountType(accountType);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link2 size={22} className="text-brand-blue" />
        <h1 className="text-xl font-black text-text-primary">اتصال LBank و معرفی OneRoyal</h1>
      </div>

      <Guide title="این بخش چه می‌کند؟" defaultOpen={false}>
        معاملهٔ واقعی فقط برای حساب LBank و پس از کنترل‌های اشتراک و تأیید قابل استفاده است.
        OneRoyal در Pro Chart صرفاً مسیر معرفی است و هیچ رمز، حساب MT5 یا سفارش مستقیم از این بخش دریافت نمی‌شود.
      </Guide>

      {locked && accountType === 'crypto' && <UpgradeGate />}

      {status.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : status.isError ? (
        <ErrorState message={status.error?.message} onRetry={() => status.refetch()} />
      ) : (
        <>
          {provider ? <ReferralCard provider={provider} /> : (
            <ErrorState message="نوع حساب مشخص نیست؛ برای ادامه، نوع حساب را در پروفایل تکمیل کنید." />
          )}
          {accountType === 'crypto' && <LbankCard acct={accounts.lbank} locked={locked} />}
          {accountType === 'broker' && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-blue/12 text-brand-blue flex items-center justify-center">
                  <LineChart size={22} />
                </div>
                <div>
                  <div className="font-black text-text-primary">OneRoyal — فقط معرفی</div>
                  <div className="text-xs text-text-muted">اتصال MT5، دریافت credential و معامله مستقیم غیرفعال است.</div>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-7">
                ادامهٔ ثبت‌نام و ارائهٔ خدمت تابع شرایط OneRoyal و محل اقامت شماست؛ Pro Chart حساب یا سفارش OneRoyal را دریافت نمی‌کند.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
