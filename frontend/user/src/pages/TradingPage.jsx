import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp, ShieldCheck, ShieldAlert, Link2, Crown,
  TrendingUp, TrendingDown, History, X, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, Wallet,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import {
  toPersianDigits, faNum, Spinner, Skeleton, EmptyState, ErrorState, useToast,
} from '../components/ui';
import ReferralDeparture from '../components/ReferralDeparture';
import { normalizeAccountType } from '../referrals';

const PREMIUM_TIERS = ['vip', 'premium'];

// ── نگاشتِ وضعیتِ سفارش به pill ──
const STATUS_MAP = {
  filled:    { label: 'انجام‌شده', cls: 'bg-brand-green/12 text-brand-green' },
  closed:    { label: 'بسته‌شده', cls: 'bg-brand-green/12 text-brand-green' },
  done:      { label: 'انجام‌شده', cls: 'bg-brand-green/12 text-brand-green' },
  open:      { label: 'باز', cls: 'bg-brand-blue/12 text-brand-blue' },
  active:    { label: 'فعال', cls: 'bg-brand-blue/12 text-brand-blue' },
  pending:   { label: 'در انتظار', cls: 'bg-brand-amber/12 text-brand-amber' },
  submitted: { label: 'ارسال‌شده', cls: 'bg-brand-amber/12 text-brand-amber' },
  rejected:  { label: 'ردشده', cls: 'bg-brand-red/12 text-brand-red' },
  error:     { label: 'خطا', cls: 'bg-brand-red/12 text-brand-red' },
  failed:    { label: 'ناموفق', cls: 'bg-brand-red/12 text-brand-red' },
  cancelled: { label: 'لغوشده', cls: 'bg-text-muted/15 text-text-muted' },
  canceled:  { label: 'لغوشده', cls: 'bg-text-muted/15 text-text-muted' },
};
function StatusPill({ status }) {
  const key = String(status || '').toLowerCase();
  const s = STATUS_MAP[key] || { label: status || '—', cls: 'bg-text-muted/15 text-text-muted' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function SideChip({ side }) {
  const buy = String(side || '').toLowerCase() === 'buy';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${buy ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-red/12 text-brand-red'}`}>
      {buy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {buy ? 'خرید' : 'فروش'}
    </span>
  );
}

// ── تاریخِ فارسی کوتاه ──
function faDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return toPersianDigits(
      new Intl.DateTimeFormat('fa-IR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(d)
    );
  } catch {
    return toPersianDigits(d.toLocaleString());
  }
}

// ── حالتِ ارتقا برای کاربرِ رایگان ──
function UpgradeGate() {
  return (
    <div className="card p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-amber/12 text-brand-amber flex items-center justify-center mx-auto mb-3">
        <Crown size={26} />
      </div>
      <p className="text-text-primary font-bold">ثبتِ سفارشِ واقعی ویژهٔ اشتراکِ پرمیوم است</p>
      <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto leading-relaxed">
        برای اتصال به صرافی LBank و ثبتِ سفارشِ واقعی، اشتراکِ خود را ارتقا دهید.
      </p>
      <Link to="/subscription" className="btn-success inline-flex items-center gap-2 mt-4">
        <Crown size={18} /> ارتقا به پرمیوم
      </Link>
    </div>
  );
}

export default function TradingPage() {
  const qc = useQueryClient();
  const { success, error: toastErr } = useToast();

  const [side, setSide] = useState('buy');
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(''); // خالی = بازار (market)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // پروفایل/تیر
  const overviewQ = useQuery({ queryKey: ['bn-overview'], queryFn: bnUserAPI.overview });
  const tier = overviewQ.data?.profile?.tier;
  const isPremium = PREMIUM_TIERS.includes(String(tier || '').toLowerCase());

  // وضعیتِ اتصال
  const connQ = useQuery({ queryKey: ['bn-connect-status'], queryFn: bnUserAPI.connectStatus });
  const accountType = normalizeAccountType(
    connQ.data?.account_type
      ?? overviewQ.data?.profile?.accountType
      ?? overviewQ.data?.profile?.account_type
  );

  // فقط LBank مجاز به معاملهٔ مستقیم است؛ حساب‌های بروکر referral-only هستند.
  const connected = useMemo(() => {
    const account = connQ.data?.accounts?.lbank || {};
    if (!account.connected) return null;
    return {
      kind: 'lbank',
      accountRef: account.account_ref,
      referralVerified: !!account.referral_verified,
      status: account.status,
      note: account.note,
    };
  }, [connQ.data]);

  const canTrade = Boolean(
    accountType === 'crypto' && isPremium && connected?.referralVerified
  );

  // قیمتِ زندهٔ نماد (دادهٔ واقعی)
  const priceQ = useQuery({
    queryKey: ['bn-price', symbol],
    queryFn: () => bnUserAPI.prices([symbol.trim().toUpperCase()]),
    enabled: Boolean(canTrade && symbol.trim().length >= 2),
    refetchInterval: 5000,
  });
  const livePrice = priceQ.data?.prices?.[symbol.trim().toUpperCase()] || null;

  // سفارش‌های کاربر
  const ordersQ = useQuery({
    queryKey: ['bn-my-orders', statusFilter],
    queryFn: () => bnUserAPI.myOrders(statusFilter ? { status: statusFilter, limit: 50 } : { limit: 50 }),
  });

  const placeMut = useMutation({
    mutationFn: (payload) => bnUserAPI.realOrder(payload),
    onSuccess: () => {
      success('سفارش با موفقیت ثبت شد.');
      setConfirmOpen(false);
      setAmount('');
      setPrice('');
      qc.invalidateQueries({ queryKey: ['bn-my-orders'] });
      qc.invalidateQueries({ queryKey: ['bn-overview'] });
    },
    onError: (e) => {
      toastErr(e?.message || 'ثبتِ سفارش ناموفق بود.');
      setConfirmOpen(false);
    },
  });

  const symClean = symbol.trim().toUpperCase();
  const amountNum = Number(amount);
  const priceNum = price === '' ? 0 : Number(price);
  const formValid =
    symClean.length >= 2 &&
    Number.isFinite(amountNum) && amountNum > 0 &&
    (price === '' || (Number.isFinite(priceNum) && priceNum >= 0));

  const submitOrder = () => {
    if (!formValid) return;
    placeMut.mutate({ side, symbol: symClean, amount: amountNum, price: priceNum });
  };

  // ── وضعیتِ کلیِ بارگذاری/خطا برای بخشِ بالا ──
  const topLoading = overviewQ.isLoading || connQ.isLoading;
  const topError = overviewQ.isError || connQ.isError;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-brand-blue/12 text-brand-blue flex items-center justify-center">
          <ArrowDownUp size={18} />
        </div>
        <h1 className="text-xl font-black text-text-primary">معاملات</h1>
      </div>

      {topLoading ? (
        <div className="card p-5"><Spinner /></div>
      ) : topError ? (
        <div className="card">
          <ErrorState
            message={overviewQ.error?.message || connQ.error?.message}
            onRetry={() => { overviewQ.refetch(); connQ.refetch(); }}
          />
        </div>
      ) : accountType === 'broker' ? (
        <BrokerReferralOnly />
      ) : !isPremium ? (
        <UpgradeGate />
      ) : (
        <>
          {/* کارتِ وضعیتِ اتصال */}
          <ConnectionCard connected={connected} onRefresh={() => connQ.refetch()} />

          {/* فرمِ ثبتِ سفارش — فقط اگر متصل و رفرال تأییدشده */}
          {canTrade ? (
            <OrderForm
              side={side} setSide={setSide}
              symbol={symbol} setSymbol={setSymbol}
              amount={amount} setAmount={setAmount}
              price={price} setPrice={setPrice}
              livePrice={livePrice}
              priceLoading={priceQ.isFetching}
              formValid={formValid}
              onSubmit={() => setConfirmOpen(true)}
            />
          ) : null}
        </>
      )}

      {/* تاریخچهٔ سفارش‌ها */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <History size={18} className="text-text-muted" />
            <h2 className="font-bold text-text-primary">سفارش‌های من</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {[
              { v: '', l: 'همه' },
              { v: 'filled', l: 'انجام‌شده' },
              { v: 'pending', l: 'در انتظار' },
              { v: 'rejected', l: 'ردشده' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setStatusFilter(f.v)}
                className={`rounded-full px-3 py-1 transition font-medium ${statusFilter === f.v ? 'bg-brand-blue text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <OrdersTable q={ordersQ} />
      </div>

      {/* دیالوگِ تأیید */}
      {confirmOpen && (
        <ConfirmDialog
          side={side}
          symbol={symClean}
          amount={amountNum}
          price={priceNum}
          livePrice={livePrice}
          pending={placeMut.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitOrder}
        />
      )}
    </div>
  );
}

// ── کارتِ وضعیتِ اتصال ──
function ConnectionCard({ connected, onRefresh }) {
  if (!connected) {
    return (
      <div className="card p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-amber/12 text-brand-amber flex items-center justify-center mx-auto mb-3">
          <Link2 size={26} />
        </div>
        <p className="text-text-primary font-bold">هنوز به صرافی LBank متصل نیستید</p>
        <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto leading-relaxed">
          برای ثبتِ سفارشِ واقعی، ابتدا حسابِ صرافی LBank خود را متصل کنید.
        </p>
        <Link to="/connect" className="btn-primary inline-flex items-center gap-2 mt-4">
          <Link2 size={18} /> اتصال به صرافی
        </Link>
      </div>
    );
  }

  const verified = connected.referralVerified;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${verified ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-amber/12 text-brand-amber'}`}>
            {verified ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-primary uppercase">{connected.kind}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-brand-green/12 text-brand-green">
                <CheckCircle2 size={12} /> متصل
              </span>
            </div>
            {connected.accountRef && (
              <div className="text-xs text-text-muted mt-0.5" dir="ltr">
                {toPersianDigits(connected.accountRef)}
              </div>
            )}
          </div>
        </div>
        <button onClick={onRefresh} className="btn-ghost inline-flex items-center gap-2 text-sm">
          <RefreshCw size={15} /> به‌روزرسانی
        </button>
      </div>

      {!verified && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-amber/10 border border-brand-amber/25 p-3 text-sm">
          <ShieldAlert size={18} className="text-brand-amber shrink-0 mt-0.5" />
          <div className="text-text-secondary leading-relaxed">
            کدِ معرفِ شما هنوز تأیید نشده است. تا زمانِ تأییدِ رفرال امکانِ ثبتِ سفارشِ واقعی وجود ندارد.
            <Link to="/connect" className="text-brand-amber font-bold mr-1">تکمیلِ تأیید</Link>
            {connected.note && <div className="text-text-muted text-xs mt-1">{connected.note}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BrokerReferralOnly() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-blue/12 text-brand-blue flex items-center justify-center shrink-0">
          <Link2 size={22} />
        </div>
        <div>
          <div className="font-black text-text-primary">OneRoyal — فقط معرفی</div>
          <p className="text-sm text-text-muted leading-7 mt-1">
            اتصال MT5، دریافت رمز و ثبت سفارش مستقیم OneRoyal در Pro Chart فعال نیست.
          </p>
        </div>
      </div>
      <ReferralDeparture
        provider="OneRoyal"
        href="/go/oneroyal"
        buttonLabel="لینک معرفی — ورود به وب‌سایت OneRoyal"
      />
    </div>
  );
}

// ── فرمِ ثبتِ سفارش ──
function OrderForm({
  side, setSide, symbol, setSymbol, amount, setAmount, price, setPrice,
  livePrice, priceLoading, formValid, onSubmit,
}) {
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-text-muted" />
        <h2 className="font-bold text-text-primary">ثبتِ سفارشِ واقعی</h2>
      </div>

      {/* خرید/فروش */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide('buy')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition ${side === 'buy' ? 'bg-brand-green text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'}`}
        >
          <TrendingUp size={18} /> خرید
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition ${side === 'sell' ? 'bg-brand-red text-white' : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'}`}
        >
          <TrendingDown size={18} /> فروش
        </button>
      </div>

      {/* نماد */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">نماد</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="مثلاً BTCUSDT"
          dir="ltr"
          className="input font-mono tracking-wide"
        />
        {symbol.trim().length >= 2 && (
          <div className="mt-1.5 text-xs flex items-center gap-2">
            {priceLoading && !livePrice ? (
              <span className="text-text-muted inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> دریافتِ قیمت…
              </span>
            ) : livePrice ? (
              <span className="text-text-secondary inline-flex items-center gap-3" dir="ltr">
                <span className="text-brand-green">Bid {toPersianDigits(livePrice.bid)}</span>
                <span className="text-brand-red">Ask {toPersianDigits(livePrice.ask)}</span>
              </span>
            ) : (
              <span className="text-text-muted">قیمتِ زنده برای این نماد در دسترس نیست.</span>
            )}
          </div>
        )}
      </div>

      {/* مقدار */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">مقدار</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="۰"
          inputMode="decimal"
          dir="ltr"
          className="input font-mono tabular-nums"
        />
      </div>

      {/* قیمت (خالی = بازار) */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">قیمت (خالی بگذارید برای سفارشِ بازار)</label>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="بازار (Market)"
          inputMode="decimal"
          dir="ltr"
          className="input font-mono tabular-nums"
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={!formValid}
        className={`w-full inline-flex items-center justify-center gap-2 font-bold rounded-xl px-4 py-3 transition disabled:opacity-50 ${side === 'buy' ? 'bg-brand-green text-white hover:opacity-90' : 'bg-brand-red text-white hover:opacity-90'}`}
      >
        {side === 'buy' ? 'ثبتِ سفارشِ خرید' : 'ثبتِ سفارشِ فروش'}
      </button>
    </div>
  );
}

// ── دیالوگِ تأیید ──
function ConfirmDialog({ side, symbol, amount, price, livePrice, pending, onCancel, onConfirm }) {
  const buy = side === 'buy';
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/60 animate-[fadeIn_.15s_ease]">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-text-primary">تأییدِ سفارش</h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className={`rounded-xl p-3 mb-4 flex items-center gap-2 ${buy ? 'bg-brand-green/10' : 'bg-brand-red/10'}`}>
          {buy ? <TrendingUp size={18} className="text-brand-green" /> : <TrendingDown size={18} className="text-brand-red" />}
          <span className={`font-bold ${buy ? 'text-brand-green' : 'text-brand-red'}`}>{buy ? 'خرید' : 'فروش'}</span>
          <span className="font-mono text-text-primary mr-auto" dir="ltr">{symbol}</span>
        </div>

        <dl className="space-y-2 text-sm mb-5">
          <Row label="مقدار" value={<span className="font-mono tabular-nums" dir="ltr">{faNum(amount, 8)}</span>} />
          <Row
            label="قیمت"
            value={price > 0
              ? <span className="font-mono tabular-nums" dir="ltr">{faNum(price, 8)}</span>
              : <span className="text-brand-blue font-medium">بازار (Market)</span>}
          />
          {price === 0 && livePrice && (
            <Row label="قیمتِ زندهٔ تقریبی" value={<span className="font-mono tabular-nums text-text-muted" dir="ltr">{toPersianDigits(livePrice.mid ?? livePrice.ask)}</span>} />
          )}
        </dl>

        <div className="flex items-start gap-2 rounded-xl bg-brand-amber/10 border border-brand-amber/25 p-2.5 text-xs text-text-secondary mb-4">
          <AlertTriangle size={15} className="text-brand-amber shrink-0 mt-0.5" />
          این یک سفارشِ واقعی روی حسابِ متصلِ شماست و بلافاصله اجرا می‌شود.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} disabled={pending} className="btn-ghost">انصراف</button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex items-center justify-center gap-2 font-bold rounded-xl px-4 py-2.5 text-white transition disabled:opacity-50 ${buy ? 'bg-brand-green' : 'bg-brand-red'}`}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            تأیید
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}

// ── جدولِ سفارش‌ها ──
function OrdersTable({ q }) {
  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    );
  }
  if (q.isError) {
    return <ErrorState message={q.error?.message} onRetry={() => q.refetch()} />;
  }
  const items = q.data?.items || [];
  if (!items.length) {
    return (
      <EmptyState
        icon={History}
        title="هنوز سفارشی ثبت نکرده‌اید"
        desc="پس از ثبتِ اولین سفارش، تاریخچهٔ آن اینجا نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[560px]">
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
          {items.map((o) => (
            <tr key={o.id} className="odd:bg-white/[0.02] border-t border-surface-border/50">
              <td className="py-2.5 px-2 text-text-muted whitespace-nowrap">{faDate(o.createdAt)}</td>
              <td className="py-2.5 px-2">
                <div className="font-mono text-text-primary" dir="ltr">{o.symbol || '—'}</div>
                {o.broker && <div className="text-[10px] text-text-muted uppercase">{o.broker}</div>}
              </td>
              <td className="py-2.5 px-2"><SideChip side={o.side} /></td>
              <td className="py-2.5 px-2 font-mono tabular-nums text-text-primary" dir="ltr">{faNum(o.amount, 8)}</td>
              <td className="py-2.5 px-2 font-mono tabular-nums text-text-secondary" dir="ltr">
                {o.price ? faNum(o.price, 8) : <span className="text-brand-blue">بازار</span>}
              </td>
              <td className="py-2.5 px-2">
                <StatusPill status={o.status} />
                {o.error && <div className="text-[10px] text-brand-red mt-0.5 max-w-[160px] truncate" title={o.error}>{o.error}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
