import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, Plus, Trash2, Search, TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  Bell, BellPlus, Activity, Radio, X,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import {
  toPersianDigits, Skeleton, EmptyState, ErrorState, StatusLight, useToast,
} from '../components/ui';

// ── قالب‌بندیِ قیمت (بدون عددِ ساختگی؛ فقط قالب‌بندیِ مقدارِ واقعی) ──
function fmtPrice(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const abs = Math.abs(n);
  let d;
  if (abs >= 1000) d = 2;
  else if (abs >= 1) d = 4;
  else if (abs >= 0.01) d = 6;
  else d = 8;
  return toPersianDigits(n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d }));
}

const normSym = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, '');

// نمادهای پیشنهادی برای افزودنِ سریع (فقط راهنمای ورودی؛ افزودن از طریقِ API واقعی است)
const SUGGESTED = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
const TIMEFRAMES = [
  { v: '1m', l: '۱ دقیقه' }, { v: '5m', l: '۵ دقیقه' }, { v: '15m', l: '۱۵ دقیقه' },
  { v: '1h', l: '۱ ساعت' }, { v: '4h', l: '۴ ساعت' }, { v: '1d', l: '۱ روز' },
];

export default function MarketPage() {
  const qc = useQueryClient();
  const { success, error: toastErr } = useToast();

  // ── واچ‌لیست ──
  const wlQ = useQuery({ queryKey: ['bn', 'watchlist'], queryFn: bnUserAPI.watchlist });
  const symbols = useMemo(() => (Array.isArray(wlQ.data?.symbols) ? wlQ.data.symbols : []), [wlQ.data]);

  const setWl = useMutation({
    mutationFn: (next) => bnUserAPI.setWatchlist(next),
    onSuccess: (_r, next) => {
      qc.setQueryData(['bn', 'watchlist'], (old) => ({ ...(old || {}), symbols: next }));
      qc.invalidateQueries({ queryKey: ['bn', 'watchlist'] });
    },
    onError: (e) => toastErr(e?.message || 'ذخیرهٔ واچ‌لیست ناموفق بود.'),
  });

  const addSymbol = (raw) => {
    const s = normSym(raw);
    if (!s) return;
    if (symbols.includes(s)) { toastErr('این نماد از قبل در واچ‌لیست است.'); return; }
    setWl.mutate([...symbols, s], { onSuccess: () => success(`«${s}» افزوده شد.`) });
  };
  const removeSymbol = (s) => {
    setWl.mutate(symbols.filter((x) => x !== s), { onSuccess: () => success(`«${s}» حذف شد.`) });
  };

  const [newSym, setNewSym] = useState('');

  // ── قیمت‌های زنده (هر ۵ ثانیه) ──
  const pricesQ = useQuery({
    queryKey: ['bn', 'prices', symbols],
    queryFn: () => bnUserAPI.prices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const prices = pricesQ.data?.prices || {};
  const marketOpen = pricesQ.data?.market_open;

  // ── بازخوردِ تیک: فلاشِ سبز/قرمز روی تغییرِ قیمت ──
  const prevRef = useRef({});
  const [flash, setFlash] = useState({});
  useEffect(() => {
    if (!pricesQ.data?.prices) return;
    const next = {};
    const changes = {};
    for (const [sym, p] of Object.entries(pricesQ.data.prices)) {
      const mid = p?.mid ?? p?.bid ?? p?.ask;
      const prev = prevRef.current[sym];
      if (prev != null && mid != null && Number(mid) !== Number(prev)) {
        changes[sym] = Number(mid) > Number(prev) ? 'up' : 'down';
      }
      if (mid != null) next[sym] = mid;
    }
    prevRef.current = next;
    if (Object.keys(changes).length) {
      setFlash(changes);
      const t = setTimeout(() => setFlash({}), 600);
      return () => clearTimeout(t);
    }
  }, [pricesQ.data]);

  // ── هشدارهای قیمتی ──
  const alertsQ = useQuery({ queryKey: ['bn', 'alerts'], queryFn: bnUserAPI.alerts });
  const alerts = useMemo(() => {
    const d = alertsQ.data;
    return Array.isArray(d) ? d : (d?.items || d?.alerts || []);
  }, [alertsQ.data]);

  const createAlert = useMutation({
    mutationFn: (payload) => bnUserAPI.createAlert(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bn', 'alerts'] }); success('هشدار ساخته شد.'); },
    onError: (e) => toastErr(e?.message || 'ساختِ هشدار ناموفق بود.'),
  });
  const deleteAlert = useMutation({
    mutationFn: (id) => bnUserAPI.deleteAlert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bn', 'alerts'] }); success('هشدار حذف شد.'); },
    onError: (e) => toastErr(e?.message || 'حذفِ هشدار ناموفق بود.'),
  });

  return (
    <div className="space-y-5">
      {/* سرصفحه */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-text-primary">بازار و واچ‌لیست</h1>
          <p className="text-sm text-text-muted mt-0.5">قیمت‌های زنده و هشدارهای قیمتی</p>
        </div>
        {marketOpen != null && (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
            marketOpen ? 'text-brand-green border-brand-green/30 bg-brand-green/10'
                       : 'text-text-muted border-surface-border bg-surface-elevated'}`}>
            <StatusLight tone={marketOpen ? 'green' : 'red'} />
            {marketOpen ? 'بازار باز است' : 'بازار بسته است'}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── واچ‌لیست + قیمت‌های زنده ── */}
        <section className="lg:col-span-2 space-y-4">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star size={18} className="text-brand-amber" />
              <h2 className="font-black text-text-primary">واچ‌لیست</h2>
              {symbols.length > 0 && (
                <span className="text-xs text-text-muted">({toPersianDigits(symbols.length)} نماد)</span>
              )}
              <span className="mr-auto inline-flex items-center gap-1 text-[11px] text-text-muted">
                <Radio size={12} className={pricesQ.isFetching ? 'text-brand-green animate-pulse' : 'text-text-muted'} />
                زنده
              </span>
            </div>

            {/* افزودنِ نماد */}
            <form
              onSubmit={(e) => { e.preventDefault(); addSymbol(newSym); setNewSym(''); }}
              className="flex items-center gap-2 mb-3"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  dir="ltr"
                  value={newSym}
                  onChange={(e) => setNewSym(e.target.value)}
                  placeholder="مثلاً BTCUSDT"
                  className="input pr-9 font-mono uppercase text-left"
                />
              </div>
              <button type="submit" disabled={setWl.isPending || !newSym.trim()} className="btn-success shrink-0 inline-flex items-center gap-1.5">
                <Plus size={16} /> افزودن
              </button>
            </form>

            {/* پیشنهادها */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {SUGGESTED.filter((s) => !symbols.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => addSymbol(s)}
                  disabled={setWl.isPending}
                  className="font-mono text-xs px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary transition disabled:opacity-50"
                >
                  + {s}
                </button>
              ))}
            </div>

            {/* بدنه */}
            {wlQ.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : wlQ.isError ? (
              <ErrorState message={wlQ.error?.message} onRetry={() => wlQ.refetch()} />
            ) : symbols.length === 0 ? (
              <EmptyState
                icon={Star}
                title="واچ‌لیستِ شما خالی است"
                desc="یک نماد اضافه کنید تا قیمتِ زنده‌اش را دنبال کنید."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-surface-border">
                {/* هدرِ جدول (دسکتاپ) */}
                <div className="hidden sm:grid grid-cols-[1.4fr,1fr,1fr,1fr,auto] gap-2 px-3 py-2 text-[11px] text-text-muted bg-surface-elevated font-bold">
                  <span>نماد</span>
                  <span className="text-left">خرید (Bid)</span>
                  <span className="text-left">فروش (Ask)</span>
                  <span className="text-left">میانگین</span>
                  <span className="text-left">حذف</span>
                </div>
                <ul>
                  {symbols.map((sym) => {
                    const p = prices[sym];
                    const dir = flash[sym];
                    const flashBg = dir === 'up' ? 'bg-brand-green/15' : dir === 'down' ? 'bg-brand-red/15' : '';
                    const midTone = dir === 'up' ? 'text-brand-green' : dir === 'down' ? 'text-brand-red' : 'text-text-primary';
                    const loading = pricesQ.isLoading && !p;
                    return (
                      <li
                        key={sym}
                        className={`grid grid-cols-2 sm:grid-cols-[1.4fr,1fr,1fr,1fr,auto] gap-x-2 gap-y-1 items-center px-3 py-2.5 border-t border-surface-border transition-colors duration-500 ${flashBg} odd:bg-white/[0.015]`}
                      >
                        <span className="font-mono font-bold text-text-primary text-sm flex items-center gap-1.5" dir="ltr">
                          {dir === 'up' && <ArrowUp size={13} className="text-brand-green" />}
                          {dir === 'down' && <ArrowDown size={13} className="text-brand-red" />}
                          {sym}
                        </span>

                        {loading ? (
                          <span className="col-span-1 sm:col-span-3"><Skeleton className="h-4 w-24" /></span>
                        ) : !p ? (
                          <span className="text-xs text-text-muted col-span-1 sm:col-span-3 text-left">در دسترس نیست</span>
                        ) : (
                          <>
                            <span className="font-mono tabular-nums text-sm text-text-secondary text-left" dir="ltr">
                              {fmtPrice(p.bid)}
                            </span>
                            <span className="font-mono tabular-nums text-sm text-text-secondary text-left hidden sm:block" dir="ltr">
                              {fmtPrice(p.ask)}
                            </span>
                            <span className={`font-mono tabular-nums text-sm font-bold text-left ${midTone}`} dir="ltr">
                              {fmtPrice(p.mid ?? p.bid)}
                            </span>
                          </>
                        )}

                        <button
                          onClick={() => removeSymbol(sym)}
                          disabled={setWl.isPending}
                          className="justify-self-end text-text-muted hover:text-brand-red transition p-1 disabled:opacity-50"
                          aria-label={`حذفِ ${sym}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {pricesQ.isError && symbols.length > 0 && (
              <p className="text-xs text-brand-amber mt-2 flex items-center gap-1">
                <Activity size={12} /> دریافتِ قیمتِ زنده موقتاً ناموفق بود؛ تلاشِ دوباره…
              </p>
            )}
          </div>
        </section>

        {/* ── هشدارهای قیمتی ── */}
        <section className="space-y-4">
          <AlertsPanel
            symbols={symbols}
            alerts={alerts}
            isLoading={alertsQ.isLoading}
            isError={alertsQ.isError}
            errorMsg={alertsQ.error?.message}
            onRetry={() => alertsQ.refetch()}
            onCreate={(payload) => createAlert.mutate(payload)}
            creating={createAlert.isPending}
            onDelete={(id) => deleteAlert.mutate(id)}
            deletingId={deleteAlert.isPending ? deleteAlert.variables : null}
          />
        </section>
      </div>
    </div>
  );
}

// ── پنلِ هشدارها ──
function AlertsPanel({ symbols, alerts, isLoading, isError, errorMsg, onRetry, onCreate, creating, onDelete, deletingId }) {
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState('1h');
  const [dir, setDir] = useState('above');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!symbol && symbols.length) setSymbol(symbols[0]);
  }, [symbols, symbol]);

  const submit = (e) => {
    e.preventDefault();
    const sym = normSym(symbol);
    const val = Number(price);
    if (!sym || !price || Number.isNaN(val)) return;
    const opTxt = dir === 'above' ? 'بالاتر از' : 'پایین‌تر از';
    onCreate({
      symbol: sym,
      tf,
      name: `${sym} ${opTxt} ${val}`,
      condition: `${dir === 'above' ? '>' : '<'} ${val}`,
    });
    setPrice('');
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-brand-blue" />
        <h2 className="font-black text-text-primary">هشدارهای قیمتی</h2>
        {alerts.length > 0 && <span className="text-xs text-text-muted">({toPersianDigits(alerts.length)})</span>}
      </div>

      {/* فرمِ ساختِ هشدار */}
      <form onSubmit={submit} className="space-y-2.5 mb-4">
        <div>
          <label className="label">نماد</label>
          {symbols.length ? (
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input font-mono">
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              dir="ltr" value={symbol} onChange={(e) => setSymbol(e.target.value)}
              placeholder="BTCUSDT" className="input font-mono uppercase text-left"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="label">تایم‌فریم</label>
            <select value={tf} onChange={(e) => setTf(e.target.value)} className="input">
              {TIMEFRAMES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">شرط</label>
            <select value={dir} onChange={(e) => setDir(e.target.value)} className="input">
              <option value="above">بالاتر از</option>
              <option value="below">پایین‌تر از</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">قیمتِ هدف</label>
          <input
            dir="ltr" inputMode="decimal" value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00" className="input font-mono tabular-nums text-left"
          />
        </div>

        <button
          type="submit"
          disabled={creating || !symbol || !price}
          className="btn-primary w-full inline-flex items-center justify-center gap-1.5"
        >
          <BellPlus size={16} /> {creating ? 'در حال ساخت…' : 'ساختِ هشدار'}
        </button>
      </form>

      {/* فهرستِ هشدارها */}
      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : isError ? (
        <ErrorState message={errorMsg} onRetry={onRetry} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={Bell} title="هشداری ندارید" desc="با فرمِ بالا اولین هشدارِ قیمتی را بسازید." />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const cond = String(a.condition || '');
            const isAbove = cond.includes('>') || cond.includes('above') || cond.includes('بالا');
            return (
              <li key={a.id} className="flex items-center gap-2.5 rounded-xl bg-surface-elevated px-3 py-2.5">
                <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  isAbove ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-red/12 text-brand-red'}`}>
                  {isAbove ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-bold text-sm text-text-primary truncate" dir="ltr">{a.symbol || a.name || '—'}</div>
                  <div className="text-xs text-text-muted flex items-center gap-1.5 flex-wrap">
                    {a.tf && <span className="font-mono">{a.tf}</span>}
                    {cond && <span className="font-mono tabular-nums" dir="ltr">{cond}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-text-muted hover:text-brand-red transition p-1 disabled:opacity-50"
                  aria-label="حذفِ هشدار"
                >
                  {deletingId === a.id ? <X size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
