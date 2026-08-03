import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Crown, Link2, Sparkles, ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  ShieldCheck, ShieldAlert, ListChecks, Bell, Star, Newspaper, ChevronLeft,
  BadgeCheck, Clock, CircleDot, Wallet, Activity, ArrowUpCircle,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import {
  toPersianDigits, faNum, Skeleton, EmptyState, ErrorState, StatusLight,
} from '../components/ui';
import ReferralDeparture from '../components/ReferralDeparture';
import { normalizeAccountType } from '../referrals';

// ── کمک‌ابزارها ──────────────────────────────────────────────
const TIER_LABEL = { premium: 'پرمیوم', vip: 'VIP', free: 'رایگان' };
const isPremiumTier = (t) => t === 'premium' || t === 'vip';

function faDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  } catch {
    return toPersianDigits(d.toLocaleDateString('en-US'));
  }
}
function faTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return toPersianDigits(d.toLocaleString('en-US'));
  }
}
function daysLeft(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// ── سلام بر پایهٔ ساعت ──
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'شبت به‌خیر';
  if (h < 12) return 'صبح‌ به‌خیر';
  if (h < 17) return 'ظهرت به‌خیر';
  if (h < 21) return 'عصرت به‌خیر';
  return 'شبت به‌خیر';
}

// ── کارت عنوان‌دار ──
function SectionCard({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-text-secondary" />}
            <h2 className="font-bold text-text-primary">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── چیپ آمار کوچک ──
function CountChip({ icon: Icon, label, value, tone = 'text-brand-blue', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card p-3.5 flex items-center gap-3 text-right w-full ${onClick ? 'hover:bg-surface-hover transition' : ''}`}
    >
      <span className={`w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center ${tone} shrink-0`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-black text-text-primary tabular-nums leading-tight">{value}</span>
        <span className="block text-xs text-text-muted truncate">{label}</span>
      </span>
    </Tag>
  );
}

// ── وضعیتِ سفارش ──
const ORDER_STATUS = {
  filled: { label: 'انجام‌شده', cls: 'bg-brand-green/12 text-brand-green' },
  done: { label: 'انجام‌شده', cls: 'bg-brand-green/12 text-brand-green' },
  closed: { label: 'بسته‌شده', cls: 'bg-text-muted/15 text-text-secondary' },
  pending: { label: 'در انتظار', cls: 'bg-brand-amber/12 text-brand-amber' },
  open: { label: 'باز', cls: 'bg-brand-blue/12 text-brand-blue' },
  rejected: { label: 'ردشده', cls: 'bg-brand-red/12 text-brand-red' },
  error: { label: 'خطا', cls: 'bg-brand-red/12 text-brand-red' },
  canceled: { label: 'لغوشده', cls: 'bg-text-muted/15 text-text-secondary' },
};
function orderStatus(s) {
  return ORDER_STATUS[String(s || '').toLowerCase()] || { label: s || '—', cls: 'bg-text-muted/15 text-text-secondary' };
}

// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const nav = useNavigate();

  const overviewQ = useQuery({ queryKey: ['overview'], queryFn: () => bnUserAPI.overview() });
  const tier = overviewQ.data?.profile?.tier;
  const premium = isPremiumTier(tier);

  const quotaQ = useQuery({ queryKey: ['ai-quota'], queryFn: () => bnUserAPI.aiQuota(), retry: false, staleTime: 60000 });
  const watchlistQ = useQuery({ queryKey: ['watchlist'], queryFn: () => bnUserAPI.watchlist(), retry: false, staleTime: 30000 });
  const newsQ = useQuery({ queryKey: ['news'], queryFn: () => bnUserAPI.news(), retry: false, staleTime: 120000 });

  const symbols = useMemo(() => {
    const s = watchlistQ.data?.symbols;
    return Array.isArray(s) ? s.filter(Boolean).slice(0, 8) : [];
  }, [watchlistQ.data]);

  const pricesQ = useQuery({
    queryKey: ['prices', symbols],
    queryFn: () => bnUserAPI.prices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 5000,
    retry: false,
  });

  // ── جهتِ تیک (سبز/قرمز) با مقایسهٔ mid پیشین ──
  const prevRef = useRef({});
  const [dirs, setDirs] = useState({});
  useEffect(() => {
    const p = pricesQ.data?.prices;
    if (!p) return;
    setDirs((prev) => {
      const next = { ...prev };
      for (const sym of Object.keys(p)) {
        const mid = p[sym]?.mid ?? p[sym]?.bid;
        const old = prevRef.current[sym];
        if (old != null && mid != null) {
          if (mid > old) next[sym] = 'up';
          else if (mid < old) next[sym] = 'down';
        }
        if (mid != null) prevRef.current[sym] = mid;
      }
      return next;
    });
  }, [pricesQ.data]);

  // ── حالتِ بارگذاری/خطا برای اسکلتِ کل صفحه ──
  if (overviewQ.isLoading) return <DashboardSkeleton />;
  if (overviewQ.isError) {
    return (
      <div className="card">
        <ErrorState message={overviewQ.error?.message} onRetry={() => overviewQ.refetch()} />
      </div>
    );
  }

  const data = overviewQ.data || {};
  const profile = data.profile || {};
  const accountType = normalizeAccountType(profile.accountType ?? profile.account_type);
  const name = profile.fullName || profile.username || 'کاربر';
  const subscription = data.subscription || null;
  const connections = Array.isArray(data.connections) ? data.connections : [];
  const counts = data.counts || {};
  const recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const aiSignalsActive = data.aiSignalsActive ?? 0;

  const expiresAt = subscription?.expiresAt || subscription?.expires_at || profile.expiresAt;
  const dLeft = daysLeft(expiresAt);
  const marketOpen = pricesQ.data?.market_open;

  return (
    <div className="space-y-5">
      {/* ── قهرمان: سلام + سطح + وضعیت ── */}
      <div className="card p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -left-16 -top-16 w-52 h-52 rounded-full bg-brand-green/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-text-muted text-sm">{greeting()}،</span>
              <h1 className="text-2xl font-black text-text-primary truncate">{name}</h1>
              <TierBadge tier={tier} />
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-text-muted flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                {profile.phoneVerified
                  ? <><BadgeCheck size={15} className="text-brand-green" /> هویت تأییدشده</>
                  : <><ShieldAlert size={15} className="text-brand-amber" /> نیازمندِ تکمیل پروفایل</>}
              </span>
              {marketOpen != null && (
                <span className="inline-flex items-center gap-1.5">
                  <StatusLight tone={marketOpen ? 'green' : 'red'} />
                  {marketOpen ? 'بازار باز است' : 'بازار بسته است'}
                </span>
              )}
            </div>
          </div>
          {!premium && (
            <button onClick={() => nav('/subscription')}
              className="btn-success inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap">
              <Crown size={17} /> ارتقا به پرمیوم
            </button>
          )}
        </div>

        {/* اکشن‌های سریع */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          <QuickAction icon={ArrowLeftRight} label="معامله" onClick={() => nav('/trade')} tone="text-brand-blue" />
          <QuickAction icon={Sparkles} label="سیگنال AI" onClick={() => nav('/signals')} tone="text-brand-amber" />
          <QuickAction
            icon={Link2}
            label={accountType === 'broker' ? 'معرفی OneRoyal' : 'اتصال LBank'}
            onClick={() => nav('/connect')}
            tone="text-brand-green"
          />
          <QuickAction icon={Crown} label="اشتراک" onClick={() => nav('/subscription')} tone="text-brand-amber" />
        </div>
      </div>

      {/* ── شمارنده‌ها ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CountChip icon={Star} label="واچ‌لیست" value={toPersianDigits(counts.watchlists ?? 0)} tone="text-brand-amber" onClick={() => nav('/market')} />
        <CountChip icon={ListChecks} label="سفارش‌ها" value={toPersianDigits(counts.orders ?? 0)} tone="text-brand-blue" onClick={() => nav('/trade')} />
        <CountChip icon={Bell} label="هشدارها" value={toPersianDigits(counts.alerts ?? 0)} tone="text-brand-green" onClick={() => nav('/market')} />
        <CountChip icon={Sparkles} label="سیگنال فعال" value={toPersianDigits(aiSignalsActive)} tone="text-brand-amber" onClick={() => nav('/signals')} />
      </div>

      {/* ── شبکهٔ اصلی ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* اشتراک */}
        <SubscriptionCard tier={tier} premium={premium} subscription={subscription} expiresAt={expiresAt} dLeft={dLeft} onUpgrade={() => nav('/subscription')} />

        {/* اتصال‌ها */}
        <ConnectionsCard connections={connections} accountType={accountType} onManage={() => nav('/connect')} />

        {/* سیگنال AI + سهمیه */}
        <AiCard premium={premium} active={aiSignalsActive} quota={quotaQ.data} loading={quotaQ.isLoading} onGo={() => nav('/signals')} onUpgrade={() => nav('/subscription')} />

        {/* واچ‌لیست زنده */}
        <SectionCard title="واچ‌لیست زنده" icon={Activity}
          action={<button onClick={() => nav('/market')} className="text-xs text-brand-blue inline-flex items-center gap-1 hover:opacity-80">مدیریت <ChevronLeft size={14} /></button>}>
          <LiveWatchlist symbols={symbols} pricesQ={pricesQ} watchlistQ={watchlistQ} dirs={dirs} onGo={() => nav('/market')} />
        </SectionCard>
      </div>

      {/* ── سفارش‌های اخیر ── */}
      <SectionCard title="سفارش‌های اخیر" icon={ListChecks}
        action={recentOrders.length > 0 && <button onClick={() => nav('/trade')} className="text-xs text-brand-blue inline-flex items-center gap-1 hover:opacity-80">همه <ChevronLeft size={14} /></button>}>
        <RecentOrders orders={recentOrders} onGo={() => nav('/trade')} />
      </SectionCard>

      {/* ── اخبار بازار ── */}
      <SectionCard title="اخبار بازار" icon={Newspaper}>
        <NewsStrip newsQ={newsQ} />
      </SectionCard>
    </div>
  );
}

// ── نشانِ سطح ──
function TierBadge({ tier }) {
  const premium = isPremiumTier(tier);
  const cls = premium ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-elevated text-text-muted';
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-bold ${cls}`}>
      {premium ? <Crown size={12} /> : <CircleDot size={11} />}
      {TIER_LABEL[tier] || tier || 'رایگان'}
    </span>
  );
}

// ── اکشن سریع ──
function QuickAction({ icon: Icon, label, onClick, tone }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover transition min-h-[64px]">
      <Icon size={20} className={tone} />
      <span className="text-[11px] text-text-secondary font-medium">{label}</span>
    </button>
  );
}

// ── کارتِ اشتراک ──
function SubscriptionCard({ tier, premium, subscription, expiresAt, dLeft, onUpgrade }) {
  if (!premium || !subscription) {
    return (
      <SectionCard title="اشتراک" icon={Crown} className="border-brand-amber/40">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-text-primary font-bold mb-1">پلنِ رایگان</div>
            <p className="text-sm text-text-muted leading-relaxed">
              با ارتقا به پرمیوم به سیگنال‌های هوشِ مصنوعی، معاملهٔ واقعی و اسکریپت‌ها دسترسی پیدا می‌کنید.
            </p>
          </div>
          <button onClick={onUpgrade} className="btn-success inline-flex items-center justify-center gap-2 shrink-0">
            <Crown size={16} /> تهیهٔ اشتراک
          </button>
        </div>
      </SectionCard>
    );
  }

  const expiring = dLeft != null && dLeft <= 7;
  const planName = subscription.plan || subscription.name || TIER_LABEL[tier] || 'پرمیوم';
  // نوارِ پیشرفتِ روزهای باقی‌مانده (سقفِ ۳۰ روز برای نمایش)
  const pct = dLeft == null ? 0 : Math.max(4, Math.min(100, (dLeft / 30) * 100));

  return (
    <SectionCard title="اشتراک" icon={Crown} className="border-brand-green/40">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-text-primary">{planName}</span>
            <span className="text-[11px] bg-brand-green/15 text-brand-green px-2 py-0.5 rounded-full font-bold">فعال</span>
          </div>
          <div className="text-xs text-text-muted mt-1 inline-flex items-center gap-1">
            <Clock size={12} /> انقضا: {faDate(expiresAt)}
          </div>
        </div>
        <button onClick={onUpgrade} className="btn-ghost text-sm inline-flex items-center gap-1.5 shrink-0">
          <ArrowUpCircle size={15} /> تمدید / ارتقا
        </button>
      </div>
      {dLeft != null && (
        <>
          <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
            <div className={`h-full rounded-full transition-all ${expiring ? 'bg-brand-amber' : 'bg-brand-green'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className={`text-xs mt-1.5 ${expiring ? 'text-brand-amber' : 'text-text-muted'}`}>
            {dLeft > 0
              ? <>{toPersianDigits(dLeft)} روز باقی‌مانده{expiring ? ' — به‌زودی منقضی می‌شود' : ''}</>
              : 'منقضی شده است'}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── کارتِ اتصال‌ها ──
const CONN_META = {
  lbank: { name: 'LBank', tone: 'text-brand-amber' },
};
function ConnectionsCard({ connections, accountType, onManage }) {
  if (accountType === 'broker') {
    return (
      <SectionCard title="OneRoyal — فقط معرفی" icon={Link2}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted leading-7">
            اتصال MT5، دریافت رمز و معاملهٔ مستقیم OneRoyal در Pro Chart فعال نیست.
          </p>
          <ReferralDeparture
            provider="OneRoyal"
            href="/go/oneroyal"
            buttonLabel="لینک معرفی — ورود به وب‌سایت OneRoyal"
          />
        </div>
      </SectionCard>
    );
  }

  const connected = connections.filter((c) => (
    String(c.kind || '').toLowerCase() === 'lbank'
      && (c.status === 'connected' || c.connected)
  ));
  return (
    <SectionCard title="اتصالِ صرافی LBank" icon={Link2}
      action={<button onClick={onManage} className="text-xs text-brand-blue inline-flex items-center gap-1 hover:opacity-80">مدیریت <ChevronLeft size={14} /></button>}>
      {connected.length === 0 ? (
        <EmptyState icon={Link2} title="حساب LBank متصل نیست"
          desc="برای معاملهٔ واقعی، حساب صرافی LBank خود را متصل کنید."
          action={<button onClick={onManage} className="btn-primary text-sm">اتصال LBank</button>} />
      ) : (
        <ul className="space-y-2.5">
          {connected.map((c, i) => {
            const meta = CONN_META[String(c.kind || '').toLowerCase()] || { name: c.kind, tone: 'text-text-secondary' };
            return (
              <li key={c.kind || i} className="flex items-center justify-between bg-surface-elevated rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusLight tone="green" />
                  <div className="min-w-0">
                    <div className={`font-bold ${meta.tone}`}>{meta.name}</div>
                    {c.accountRef && <div className="text-xs text-text-muted truncate" dir="ltr">{toPersianDigits(c.accountRef)}</div>}
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full inline-flex items-center gap-1 font-medium shrink-0 ${
                  c.referralVerified ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-amber/12 text-brand-amber'}`}>
                  {c.referralVerified ? <><ShieldCheck size={12} /> رفرال تأییدشده</> : <><ShieldAlert size={12} /> رفرال در انتظار</>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ── کارتِ سیگنالِ AI ──
function AiCard({ premium, active, quota, loading, onGo, onUpgrade }) {
  if (!premium) {
    return (
      <SectionCard title="سیگنال‌های هوشِ مصنوعی" icon={Sparkles}>
        <EmptyState icon={Crown} title="ویژهٔ پرمیوم"
          desc="سیگنال‌های هوشِ مصنوعی تنها برای کاربرانِ پرمیوم فعال است."
          action={<button onClick={onUpgrade} className="btn-success text-sm inline-flex items-center gap-1.5"><Crown size={15} /> ارتقا</button>} />
      </SectionCard>
    );
  }
  const limit = quota?.limit;
  const used = quota?.used ?? 0;
  const remaining = quota?.remaining;
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <SectionCard title="سیگنال‌های هوشِ مصنوعی" icon={Sparkles}
      action={<button onClick={onGo} className="text-xs text-brand-blue inline-flex items-center gap-1 hover:opacity-80">مشاهده <ChevronLeft size={14} /></button>}>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-amber/12 text-brand-amber flex flex-col items-center justify-center shrink-0">
          <span className="text-2xl font-black tabular-nums leading-none">{toPersianDigits(active)}</span>
          <span className="text-[10px]">فعال</span>
        </div>
        <div className="flex-1 min-w-0">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : quota ? (
            <>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-text-muted">سهمیهٔ امروز</span>
                <span className="text-text-primary font-bold tabular-nums">
                  {toPersianDigits(used)}<span className="text-text-muted"> / {limit != null ? toPersianDigits(limit) : '∞'}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full rounded-full bg-brand-amber transition-all" style={{ width: `${pct}%` }} />
              </div>
              {remaining != null && (
                <div className="text-xs text-text-muted mt-1.5">{toPersianDigits(remaining)} سیگنال باقی‌مانده</div>
              )}
            </>
          ) : (
            <div className="text-sm text-text-muted">سهمیه در دسترس نیست.</div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ── واچ‌لیستِ زنده ──
function LiveWatchlist({ symbols, pricesQ, watchlistQ, dirs, onGo }) {
  if (watchlistQ.isLoading) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>;
  }
  if (watchlistQ.isError) {
    return <ErrorState message={watchlistQ.error?.message} onRetry={() => watchlistQ.refetch()} />;
  }
  if (symbols.length === 0) {
    return <EmptyState icon={Star} title="واچ‌لیستِ شما خالی است"
      desc="نمادهای موردِ علاقه را برای پیگیریِ زندهٔ قیمت اضافه کنید."
      action={<button onClick={onGo} className="btn-primary text-sm">افزودنِ نماد</button>} />;
  }
  const prices = pricesQ.data?.prices || {};
  return (
    <ul className="divide-y divide-surface-border">
      {symbols.map((sym) => {
        const p = prices[sym];
        const mid = p?.mid ?? p?.bid;
        const dir = dirs[sym];
        const color = dir === 'up' ? 'text-brand-green' : dir === 'down' ? 'text-brand-red' : 'text-text-primary';
        const flash = dir === 'up' ? 'bg-brand-green/[0.07]' : dir === 'down' ? 'bg-brand-red/[0.07]' : '';
        const Arrow = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
        return (
          <li key={sym} className={`flex items-center justify-between py-2.5 px-1 rounded-lg transition-colors duration-500 ${flash}`}>
            <span className="font-bold text-text-primary" dir="ltr">{sym}</span>
            <span className="flex items-center gap-1.5 tabular-nums font-mono">
              <Arrow size={15} className={color} />
              <span className={color} dir="ltr">
                {mid != null ? toPersianDigits(Number(mid).toLocaleString('en-US', { maximumFractionDigits: 6 })) : (pricesQ.isLoading ? '…' : '—')}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── سفارش‌های اخیر ──
function RecentOrders({ orders, onGo }) {
  if (orders.length === 0) {
    return <EmptyState icon={Wallet} title="هنوز سفارشی ثبت نشده"
      desc="نخستین سفارشِ خود را از بخشِ معاملات ثبت کنید."
      action={<button onClick={onGo} className="btn-primary text-sm">رفتن به معاملات</button>} />;
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-text-muted text-xs text-right">
            <th className="font-medium py-2 px-2">زمان</th>
            <th className="font-medium py-2 px-2">نماد</th>
            <th className="font-medium py-2 px-2">نوع</th>
            <th className="font-medium py-2 px-2">مقدار</th>
            <th className="font-medium py-2 px-2">قیمت</th>
            <th className="font-medium py-2 px-2">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 6).map((o, i) => {
            const st = orderStatus(o.status);
            const buy = String(o.side || '').toLowerCase() === 'buy';
            return (
              <tr key={o.id || i} className="odd:bg-white/[0.02] text-text-secondary">
                <td className="py-2.5 px-2 whitespace-nowrap text-xs text-text-muted">{faTime(o.createdAt)}</td>
                <td className="py-2.5 px-2 font-bold text-text-primary" dir="ltr">{o.symbol || '—'}</td>
                <td className="py-2.5 px-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${buy ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-red/12 text-brand-red'}`}>
                    {buy ? 'خرید' : 'فروش'}
                  </span>
                </td>
                <td className="py-2.5 px-2 tabular-nums" dir="ltr">{o.amount != null ? faNum(o.amount, 6) : '—'}</td>
                <td className="py-2.5 px-2 tabular-nums" dir="ltr">{o.price != null ? faNum(o.price, 6) : '—'}</td>
                <td className="py-2.5 px-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── نوارِ اخبار ──
function NewsStrip({ newsQ }) {
  if (newsQ.isLoading) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (newsQ.isError) {
    return <ErrorState message={newsQ.error?.message} onRetry={() => newsQ.refetch()} />;
  }
  const items = Array.isArray(newsQ.data?.items) ? newsQ.data.items : [];
  if (items.length === 0) {
    return <EmptyState icon={Newspaper} title="خبری برای نمایش نیست" desc="به‌محضِ انتشارِ اخبارِ بازار، این‌جا نمایش داده می‌شود." />;
  }
  return (
    <ul className="space-y-2.5">
      {items.slice(0, 5).map((n, i) => {
        const title = n.title || n.headline || n.text || '—';
        const src = n.source || n.provider;
        const when = n.publishedAt || n.published_at || n.date || n.ts;
        const href = n.url || n.link;
        const Row = href ? 'a' : 'div';
        return (
          <li key={n.id || i}>
            <Row {...(href ? { href, target: '_blank', rel: 'noreferrer' } : {})}
              className="flex items-start gap-3 bg-surface-elevated rounded-xl px-3.5 py-3 hover:bg-surface-hover transition">
              <span className="w-8 h-8 rounded-lg bg-brand-blue/12 text-brand-blue flex items-center justify-center shrink-0 mt-0.5">
                <Newspaper size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-text-primary font-medium line-clamp-2 leading-relaxed">{title}</span>
                <span className="block text-xs text-text-muted mt-0.5">
                  {src && <span>{src}</span>}{src && when && <span> · </span>}{when && <span>{faTime(when)}</span>}
                </span>
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

// ── اسکلتِ کلِ صفحه ──
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
      </div>
      <Skeleton className="h-52 w-full" />
    </div>
  );
}
