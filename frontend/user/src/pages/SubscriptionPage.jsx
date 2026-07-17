import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Crown, Check, Copy, CheckCircle2, X, Sparkles, ShieldCheck, Link2,
  Wallet, Loader2, AlertTriangle, ChevronLeft, Zap,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import {
  Spinner, ErrorState, Skeleton, toPersianDigits, useToast,
} from '../components/ui';
import ReferralDeparture from '../components/ReferralDeparture';
import { providerForAccountType } from '../referrals';

// رتبهٔ تیرها برای منطقِ ارتقا/تنزل
const RANK = { free: 0, vip: 1, premium: 2 };
const TIER_LABEL = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

// هیچ قیمت یا ویژگیِ ثابتی در فرانت وجود ندارد؛ همه از bnUserAPI.pricing() (بک‌اندِ واقعی) می‌آید.

function faDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
      .format(new Date(iso));
  } catch { return '—'; }
}

function daysBetween(fromIso, toIso) {
  if (!toIso) return null;
  const to = new Date(toIso).getTime();
  const from = fromIso ? new Date(fromIso).getTime() : Date.now();
  return Math.max(0, Math.ceil((to - from) / 86400000));
}

// ─────────────────────────── نشان‌ها ───────────────────────────
function Pill({ tone = 'green', children }) {
  const m = {
    green: 'bg-brand-green/12 text-brand-green',
    amber: 'bg-brand-amber/12 text-brand-amber',
    blue: 'bg-brand-blue/12 text-brand-blue',
    muted: 'bg-surface-elevated text-text-muted',
  }[tone];
  const dot = tone === 'green' ? 'bg-brand-green' : tone === 'amber' ? 'bg-brand-amber' : tone === 'blue' ? 'bg-brand-blue' : 'bg-text-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${m}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

// ─────────────────────────── هیروِ پلنِ فعلی ───────────────────────────
function CurrentPlanHero({ profile, subscription, onUpgrade }) {
  const tier = profile?.tier || 'free';
  const isPaid = tier === 'premium' || tier === 'vip';
  const expiresAt = subscription?.expiresAt || profile?.expiresAt || null;
  const startedAt = subscription?.startedAt || null;
  const left = daysBetween(null, expiresAt);
  const totalSpan = startedAt && expiresAt
    ? Math.max(1, Math.ceil((new Date(expiresAt) - new Date(startedAt)) / 86400000))
    : (left != null && left <= 45 ? 30 : 365);
  const pct = left != null ? Math.max(2, Math.min(100, Math.round((left / totalSpan) * 100))) : 0;
  const expiringSoon = left != null && left <= 7;

  if (!isPaid) {
    return (
      <div className="card p-5 border-brand-amber/40">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-amber/15 text-brand-amber flex items-center justify-center shrink-0">
              <Crown size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-text-primary text-lg">پلنِ رایگان</span>
                <Pill tone="muted">فعال</Pill>
              </div>
              <p className="text-sm text-text-muted mt-1 leading-relaxed max-w-md">
                برای فعال‌سازیِ سیگنال‌های هوشِ مصنوعی، اتصالِ صرافی و معاملهٔ واقعی، به پرمیوم ارتقا دهید.
              </p>
            </div>
          </div>
          <button onClick={onUpgrade} className="btn-success inline-flex items-center justify-center gap-2 shrink-0">
            <Zap size={17} /> ارتقا به پرمیوم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-green/15 text-brand-green flex items-center justify-center shrink-0">
            <Crown size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-text-primary text-lg">پلنِ {TIER_LABEL[tier]}</span>
              <Pill tone="green">فعال</Pill>
            </div>
            {subscription?.amountUsdt != null && (
              <p className="text-xs text-text-muted mt-1">
                مبلغِ پرداختی: <span dir="ltr" className="tabular-nums">{toPersianDigits(subscription.amountUsdt)} USDT</span>
                {startedAt && <> · شروع {faDate(startedAt)}</>}
              </p>
            )}
          </div>
        </div>
        <button onClick={onUpgrade} className="btn-primary inline-flex items-center justify-center gap-2 shrink-0">
          تمدید / ارتقا
        </button>
      </div>

      {expiresAt && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-muted">اعتبار تا {faDate(expiresAt)}</span>
            <span className={`font-bold tabular-nums ${expiringSoon ? 'text-brand-amber' : 'text-text-secondary'}`}>
              {left != null ? `${toPersianDigits(left)} روز باقی‌مانده` : '—'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${expiringSoon ? 'bg-brand-amber' : 'bg-brand-green'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── کارتِ تیر ───────────────────────────
function TierCard({ tier, currentTier, onUpgrade }) {
  const isCurrent = tier.key === currentTier;
  const rankCur = RANK[currentTier] ?? 0;
  const rankThis = RANK[tier.key] ?? 0;
  const recommended = tier.key === 'premium' && !isCurrent && rankThis > rankCur;
  const included = rankThis < rankCur; // شاملِ پلنِ بالاترِ فعلی
  const price = tier.price_monthly;

  let cta;
  if (isCurrent) {
    cta = <button disabled className="btn-ghost w-full opacity-60 cursor-default">پلنِ فعلی</button>;
  } else if (included) {
    cta = <button disabled className="btn-ghost w-full opacity-60 cursor-default">شاملِ پلنِ شما</button>;
  } else if (tier.key === 'premium') {
    cta = <button onClick={onUpgrade} className="btn-success w-full inline-flex items-center justify-center gap-2"><Zap size={16} /> ارتقا</button>;
  } else if (tier.key === 'vip') {
    cta = <button disabled className="btn-ghost w-full opacity-70 cursor-default">با تأییدِ مدیر</button>;
  } else {
    cta = <button disabled className="btn-ghost w-full opacity-60 cursor-default">—</button>;
  }

  const border = isCurrent
    ? 'border-brand-green ring-1 ring-brand-green/50'
    : recommended
      ? 'border-brand-blue shadow-lg shadow-brand-blue/10'
      : 'border-surface-border';

  const Icon = tier.key === 'premium' ? Crown : tier.key === 'vip' ? Sparkles : ShieldCheck;

  return (
    <div className={`card relative p-6 flex flex-col gap-4 border ${border}`}>
      {recommended && (
        <span className="absolute -top-2.5 right-4 bg-brand-blue text-white text-[11px] font-bold rounded-full px-2.5 py-0.5">
          پیشنهادی
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-2.5 right-4 bg-brand-green text-white text-[11px] font-bold rounded-full px-2.5 py-0.5">
          پلنِ فعلی
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tier.key === 'premium' ? 'bg-brand-green/15 text-brand-green' : tier.key === 'vip' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-surface-elevated text-text-muted'}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className="font-black text-text-primary leading-tight">{tier.name || TIER_LABEL[tier.key]}</div>
          {tier.tagline && <div className="text-[11px] text-text-muted">{tier.tagline}</div>}
        </div>
      </div>

      <div className="min-h-[2.5rem]">
        {price == null ? (
          <div className="text-sm text-text-muted">قیمت هنگامِ ارتقا نمایش داده می‌شود</div>
        ) : price === 0 ? (
          <div className="text-2xl font-black text-text-primary">رایگان</div>
        ) : (
          <div className="flex items-end gap-1">
            <span dir="ltr" className="text-2xl font-black text-text-primary tabular-nums">{toPersianDigits(price)}</span>
            <span className="text-sm text-text-muted mb-0.5">USDT / ماه</span>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {(tier.perks || []).map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
            <Check size={16} className="text-brand-green shrink-0 mt-0.5" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {cta}
    </div>
  );
}

// ─────────────────────────── مُدالِ پرداخت ───────────────────────────
function UpgradeModal({ open, onClose, pricing }) {
  const qc = useQueryClient();
  const { success, error: toastErr } = useToast();
  const [step, setStep] = useState(1);
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState(null);

  // همهٔ مقادیر از بک‌اند می‌آید؛ هیچ عددِ ثابتی در فرانت نیست.
  const premiumTier = Array.isArray(pricing?.tiers)
    ? pricing.tiers.find((t) => t.key === 'premium')
    : null;
  const monthlyPrice = premiumTier?.price_monthly ?? null; // مبلغِ دقیقِ ماهانه از بک‌اند
  const wallet = pricing?.wallet || '';
  const network = pricing?.network || 'BEP-20 (BSC)';
  const currency = pricing?.currency || 'USDT';
  // فقط چیزی که بک‌اند تعریف کرده ارائه می‌شود: اشتراکِ ماهانه.
  const chosen = { plan: 'monthly', label: 'ماهانه', days: 30, usdt: monthlyPrice };
  const priceKnown = monthlyPrice != null;

  const mutation = useMutation({
    mutationFn: () => bnUserAPI.submitPayment({ tx_hash: txHash.trim(), plan: chosen.plan }),
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
      success('پرداخت تأیید شد؛ پلنِ شما پرمیوم شد.');
      qc.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (e) => toastErr(e?.message || 'تأییدِ پرداخت ناموفق بود.'),
  });

  if (!open) return null;

  const copyWallet = async () => {
    try { await navigator.clipboard.writeText(wallet); success('آدرس کپی شد.'); }
    catch { toastErr('کپی ناموفق بود.'); }
  };

  const close = () => {
    onClose();
    setTimeout(() => { setStep(1); setTxHash(''); setResult(null); }, 200);
  };

  const steps = ['انتخابِ پلن', 'پرداخت', 'نتیجه'];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={close}>
      <div
        className="bg-surface-card border border-surface-border w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-[fadeIn_.2s_ease]"
        onClick={(e) => e.stopPropagation()}>
        {/* هدر */}
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-brand-green" />
            <span className="font-black text-text-primary">ارتقا به پرمیوم</span>
          </div>
          <button onClick={close} className="text-text-muted hover:text-text-primary p-1"><X size={20} /></button>
        </div>

        {/* استپر */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {steps.map((s, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${done ? 'bg-brand-green text-white' : active ? 'bg-brand-blue text-white' : 'bg-surface-elevated text-text-muted'}`}>
                  {done ? <Check size={13} /> : toPersianDigits(n)}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded ${done ? 'bg-brand-green' : 'bg-surface-elevated'}`} />}
              </div>
            );
          })}
        </div>

        <div className="p-5">
          {/* گامِ ۱ — پلنِ پرمیوم (مبلغ از بک‌اند) */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                اشتراکِ پرمیومِ ماهانه. پرداخت با <b className="text-text-secondary">{currency}</b> روی شبکهٔ <b className="text-text-secondary">{network}</b> انجام می‌شود.
              </p>
              {priceKnown ? (
                <div className="relative rounded-2xl border border-brand-green bg-brand-green/5 ring-1 ring-brand-green/40 p-4 text-right">
                  <div className="font-bold text-text-primary">{chosen.label}</div>
                  <div className="mt-1 flex items-end gap-1">
                    <span dir="ltr" className="text-2xl font-black text-text-primary tabular-nums">{toPersianDigits(chosen.usdt)}</span>
                    <span className="text-xs text-text-muted mb-0.5">{currency}</span>
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">{toPersianDigits(chosen.days)} روز</div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-brand-amber/10 border border-brand-amber/30 px-3 py-2.5 text-xs text-brand-amber leading-relaxed">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  مبلغِ اشتراک در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.
                </div>
              )}
              <button
                onClick={() => setStep(2)}
                disabled={!priceKnown}
                className="btn-success w-full inline-flex items-center justify-center gap-2 disabled:opacity-50">
                ادامه <ChevronLeft size={17} />
              </button>
            </div>
          )}

          {/* گامِ ۲ — پرداخت */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-surface-elevated border border-surface-border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">پلن</span>
                  <span className="font-bold text-text-primary">پرمیوم · {chosen.label}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">مبلغِ دقیق</span>
                  <span dir="ltr" className="font-black text-brand-green tabular-nums">{toPersianDigits(chosen.usdt)} {currency}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">شبکه</span>
                  <span className="font-bold text-text-primary">{network}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary mb-1.5">
                  <Wallet size={15} /> آدرسِ کیفِ‌پولِ مقصد
                </div>
                {wallet ? (
                  <div className="flex items-stretch gap-2">
                    <div dir="ltr" className="flex-1 bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 font-mono text-xs text-text-primary break-all leading-relaxed">
                      {wallet}
                    </div>
                    <button onClick={copyWallet} className="btn-ghost px-3 shrink-0" title="کپی">
                      <Copy size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl bg-brand-amber/10 border border-brand-amber/30 px-3 py-2.5 text-xs text-brand-amber leading-relaxed">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    آدرسِ کیفِ‌پول در دسترس نیست؛ لطفاً با پشتیبانی تماس بگیرید.
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-brand-amber/10 border border-brand-amber/30 px-3 py-2.5 text-xs text-brand-amber leading-relaxed">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                فقط از شبکهٔ {network} استفاده کنید. ارسال روی شبکهٔ دیگر باعثِ ازدست‌رفتنِ وجه می‌شود.
              </div>

              <div>
                <label className="label">هشِ تراکنش (Transaction Hash)</label>
                <input
                  dir="ltr"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x..."
                  className="input font-mono text-sm text-left"
                />
                <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                  پس از واریز، هشِ تراکنش را از کیفِ‌پول/صرافیِ خود کپی و اینجا وارد کنید. تأیید به‌صورتِ خودکار روی زنجیره انجام می‌شود.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1">بازگشت</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={txHash.trim().length < 10 || mutation.isPending}
                  className="btn-success flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> در حال بررسی…</> : 'ثبتِ پرداخت'}
                </button>
              </div>
            </div>
          )}

          {/* گامِ ۳ — نتیجه */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-3xl bg-brand-green/15 text-brand-green flex items-center justify-center mb-4">
                <CheckCircle2 size={34} />
              </div>
              <p className="font-black text-text-primary text-lg">پرداختِ شما تأیید شد</p>
              <p className="text-sm text-text-muted mt-1 leading-relaxed max-w-xs">
                پلنِ شما به پرمیوم ارتقا یافت
                {result?.days != null && <> و به‌مدتِ <b className="text-text-secondary">{toPersianDigits(result.days)} روز</b> فعال است</>}.
              </p>
              {result?.amount != null && (
                <div className="mt-3">
                  <Pill tone="green">مبلغِ تأییدشده: {toPersianDigits(result.amount)} USDT</Pill>
                </div>
              )}
              <button onClick={close} className="btn-primary w-full mt-6">بستن</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── کارتِ رفرال ───────────────────────────
function ReferralCard({ accountType }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bnReferral'],
    queryFn: () => bnUserAPI.referralLink(),
    retry: false,
    staleTime: 300000,
  });

  if (isLoading) return <Skeleton className="h-28" />;
  if (isError) return null;

  const provider = providerForAccountType(accountType ?? data?.account_type);
  if (!provider) return null;

  const minDep = data.min_deposit;
  const referralOnly = provider === 'OneRoyal';

  return (
    <div className="card p-5">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-blue/15 text-brand-blue flex items-center justify-center shrink-0">
            <Link2 size={20} />
          </div>
          <div>
            <div className="font-black text-text-primary">معرفی {provider}</div>
            <p className="text-sm text-text-muted mt-1 leading-relaxed max-w-md">
              {referralOnly
                ? 'OneRoyal فقط در سطح معرفی است؛ اتصال حساب، دریافت رمز و معاملهٔ مستقیم در Pro Chart فعال نیست.'
                : 'برای بررسی شرایط حساب LBank، ابتدا اطلاعیهٔ معرفی را بخوانید. معاملهٔ مستقیم فقط پس از اتصال و تأیید LBank فعال می‌شود.'}
              {minDep ? <> کمترین واریز: <b className="text-text-secondary">{toPersianDigits(minDep)}</b>.</> : null}
            </p>
          </div>
        </div>
        <ReferralDeparture
          provider={provider}
          href={data?.url}
          buttonLabel={`لینک معرفی — ورود به وب‌سایت ${provider}`}
        />
      </div>
    </div>
  );
}

// ─────────────────────────── صفحهٔ اصلی ───────────────────────────
export default function SubscriptionPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const overviewQ = useQuery({
    queryKey: ['overview'],
    queryFn: () => bnUserAPI.overview(),
    staleTime: 60000,
    retry: false,
  });

  const pricingQ = useQuery({
    queryKey: ['bnPricing'],
    queryFn: () => bnUserAPI.pricing(),
    retry: false,
    staleTime: 600000,
  });

  const profile = overviewQ.data?.profile;
  const subscription = overviewQ.data?.subscription;
  const currentTier = profile?.tier || 'free';

  // فقط دادهٔ واقعیِ بک‌اند؛ هیچ fallbackِ ساختگی‌ای وجود ندارد.
  const tiers = useMemo(() => {
    return Array.isArray(pricingQ.data?.tiers) ? pricingQ.data.tiers : [];
  }, [pricingQ.data]);

  if (overviewQ.isLoading) return <Spinner label="در حال بارگذاریِ اشتراک…" />;
  if (overviewQ.isError) {
    return (
      <ErrorState
        message={overviewQ.error?.message || 'دریافتِ اطلاعاتِ اشتراک ناموفق بود.'}
        onRetry={() => overviewQ.refetch()}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-2">
        <Crown size={22} className="text-brand-green" />
        <h1 className="text-xl font-black text-text-primary">اشتراک و صورت‌حساب</h1>
      </div>

      {/* پلنِ فعلی */}
      <CurrentPlanHero
        profile={profile}
        subscription={subscription}
        onUpgrade={() => setModalOpen(true)}
      />

      {/* کارت‌های تیر */}
      <div>
        <h2 className="text-sm font-bold text-text-secondary mb-3">انتخابِ پلن</h2>
        {pricingQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" />
          </div>
        ) : pricingQ.isError ? (
          <ErrorState
            message={pricingQ.error?.message || 'دریافتِ پلن‌ها ناموفق بود.'}
            onRetry={() => pricingQ.refetch()}
          />
        ) : tiers.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">
            در حال حاضر پلنی برای نمایش موجود نیست.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {tiers.map((t) => (
              <TierCard key={t.key} tier={t} currentTier={currentTier} onUpgrade={() => setModalOpen(true)} />
            ))}
          </div>
        )}
      </div>

      {/* رفرالِ صرافی/کارگزار */}
      <ReferralCard accountType={profile?.accountType ?? profile?.account_type} />

      {/* راهنمای پرداخت */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={17} className="text-brand-green" />
          <span className="font-bold text-text-primary text-sm">پرداختِ امن و خودکار</span>
        </div>
        <p className="text-sm text-text-muted leading-relaxed">
          پرداخت‌ها با ارزِ دیجیتالِ USDT روی شبکهٔ BEP-20 انجام و به‌صورتِ خودکار روی زنجیرهٔ BSC تأیید می‌شوند.
          بلافاصله پس از تأیید، پلنِ شما به پرمیوم ارتقا می‌یابد.
        </p>
      </div>

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} pricing={pricingQ.data} />
    </div>
  );
}
