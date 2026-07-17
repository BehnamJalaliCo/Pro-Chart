import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { signalsAPI, createPriceSocket, vipSession } from '../api/client';
import VipGate from '../components/common/VipGate';
import useSeo from '../hooks/useSeo';

const DIRECTIONS = ['', 'BUY', 'SELL'];
const STRENGTHS = ['', 'قوی', 'متوسط', 'ضعیف'];

// نگاشتِ نمادِ خام → نمایشِ خوانا (هم‌راستا با بک‌اند)
const DISPLAY_MAP = {
  XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD', EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY', USDCHF: 'USD/CHF', AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD',
  USDCAD: 'USD/CAD', EURGBP: 'EUR/GBP', EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY',
  AUDJPY: 'AUD/JPY', EURAUD: 'EUR/AUD', XTIUSD: 'WTI Oil', XNGUSD: 'NatGas',
  US30: 'US30', US500: 'US500', NAS100: 'NAS100', DE40: 'GER40',
};
const dispSym = (s) => DISPLAY_MAP[s] || s;

const strengthFa = (score) => {
  const s = Number(score) || 0;
  if (s >= 75) return 'قوی';
  if (s >= 60) return 'متوسط';
  return 'ضعیف';
};
const fmtP = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const d = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 10 ? 3 : 5;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const pnlStr = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toLocaleString('fa-IR')}`;
};
const closedStatus = (s) => {
  if (s.status === 'active') return 'active';
  if (s.status === 'cancelled') return 'cancelled';
  return (Number(s.pnl_pips) || 0) > 0 ? 'tp_hit' : 'sl_hit';
};
const buildAnalysis = (s) => {
  const parts = [];
  if (s.signal_type) parts.push(`نوع سیگنال: ${s.signal_type}`);
  if (s.timeframe) parts.push(`تایم‌فریم: ${s.timeframe}`);
  if (s.signal_score != null) parts.push(`امتیاز موتور: ${s.signal_score}`);
  if (s.close_reason) parts.push(`دلیل بسته‌شدن: ${s.close_reason}`);
  return parts.join(' · ');
};

// تبدیلِ سیگنالِ واقعیِ API → مدلِ نمایشِ صفحه
const mapSignal = (s) => ({
  id: s.id,
  symbol: dispSym(s.symbol),
  rawSymbol: s.symbol,
  direction: ['long', 'buy'].includes(String(s.direction).toLowerCase()) ? 'BUY' : 'SELL',
  entry: fmtP(s.entry_price),
  entryNum: Number(s.entry_price),
  dirSign: ['long', 'buy'].includes(String(s.direction).toLowerCase()) ? 1 : -1,
  isActive: s.status === 'active',
  apiPnlPct: s.pnl_percent != null ? Number(s.pnl_percent) : null,
  apiPips: s.pnl_pips != null ? Number(s.pnl_pips) : null,
  currentPrice: s.current_price != null ? Number(s.current_price) : null,
  tp1: fmtP(s.tp1),
  tp2: s.tp2 != null ? fmtP(s.tp2) : null,
  tp3: s.tp3 != null ? fmtP(s.tp3) : null,
  sl: fmtP(s.sl),
  strength: strengthFa(s.signal_score),
  status: closedStatus(s),
  pnl: pnlStr(s.pnl_pips),
  time: s.created_at,
  closeTime: s.closed_at,
  analysis: buildAnalysis(s),
});

// محاسبهٔ سود/زیانِ لحظه‌ای از قیمتِ زنده (درصد + پیپِ مشتق‌شده از بک‌اند)
function computeLive(signal, livePrices) {
  const live = livePrices[signal.rawSymbol];
  let pct = signal.apiPnlPct;
  let priceNow = signal.currentPrice;
  if (live != null && signal.entryNum) {
    priceNow = live;
    pct = ((live - signal.entryNum) / signal.entryNum) * 100 * signal.dirSign;
  }
  let pips = signal.apiPips;
  if (pct != null && signal.apiPips != null && signal.apiPnlPct != null && Math.abs(signal.apiPnlPct) > 0.0005) {
    const pipsPerPct = signal.apiPips / signal.apiPnlPct;
    if (isFinite(pipsPerPct)) pips = pct * pipsPerPct;
  }
  return { pct, pips, priceNow };
}

// نمایشِ زندهٔ سود/زیان
function LivePnl({ signal, livePrices, showPrice = false }) {
  const { pct, pips, priceNow } = computeLive(signal, livePrices);
  if (pct == null) return <span className="text-dark-400 text-sm font-bold">باز</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${up ? 'text-bullish' : 'text-bearish'}`} title="سود/زیانِ لحظه‌ای">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {up ? '+' : ''}{pct.toFixed(2)}٪
      {pips != null && isFinite(pips) && (
        <span className="text-xs opacity-80">({up ? '+' : ''}{Math.round(pips).toLocaleString('fa-IR')} پیپ)</span>
      )}
      {showPrice && priceNow != null && (
        <span className="text-xs text-dark-400 font-mono ml-1">@ {fmtP(priceNow)}</span>
      )}
    </span>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  if (hours < 24) return `${hours} ساعت پیش`;
  return `${days} روز پیش`;
}

function StatusBadge({ status }) {
  const map = {
    active: { text: 'فعال', cls: 'bg-accent/10 text-accent border-accent/20' },
    tp_hit: { text: 'سود محقق شد', cls: 'bg-bullish/10 text-bullish border-bullish/20' },
    sl_hit: { text: 'حد ضرر فعال شد', cls: 'bg-bearish/10 text-bearish border-bearish/20' },
    cancelled: { text: 'لغو شده', cls: 'bg-dark-600/30 text-dark-400 border-dark-600/30' },
  };
  const s = map[status] || map.active;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}>{s.text}</span>;
}

function SignalDetailCard({ signal, onClose, livePrices = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass-card p-6 lg:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto ${
          signal.direction === 'BUY' ? 'glow-bullish' : 'glow-bearish'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-white">{signal.symbol}</span>
            <span className={signal.direction === 'BUY' ? 'badge-bullish' : 'badge-bearish'}>
              {signal.direction === 'BUY' ? 'خرید' : 'فروش'}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-800 hover:bg-dark-700 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-dark-800/50 rounded-xl p-3">
            <span className="text-dark-400 text-xs block mb-1">نقطه ورود</span>
            <span className="text-white font-mono font-bold">{signal.entry}</span>
          </div>
          <div className="bg-dark-800/50 rounded-xl p-3">
            <span className="text-dark-400 text-xs block mb-1">حد ضرر</span>
            <span className="text-bearish font-mono font-bold">{signal.sl}</span>
          </div>
          {signal.tp1 && (
            <div className="bg-dark-800/50 rounded-xl p-3">
              <span className="text-dark-400 text-xs block mb-1">حد سود ۱</span>
              <span className="text-bullish font-mono font-bold">{signal.tp1}</span>
            </div>
          )}
          {signal.tp2 && (
            <div className="bg-dark-800/50 rounded-xl p-3">
              <span className="text-dark-400 text-xs block mb-1">حد سود ۲</span>
              <span className="text-bullish font-mono font-bold">{signal.tp2}</span>
            </div>
          )}
          {signal.tp3 && (
            <div className="col-span-2 bg-dark-800/50 rounded-xl p-3">
              <span className="text-dark-400 text-xs block mb-1">حد سود ۳</span>
              <span className="text-bullish font-mono font-bold">{signal.tp3}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <StatusBadge status={signal.status} />
          <span className={`text-sm font-medium ${
            signal.strength === 'قوی' ? 'text-bullish' : signal.strength === 'متوسط' ? 'text-yellow-500' : 'text-dark-400'
          }`}>
            قدرت: {signal.strength}
          </span>
          {signal.isActive ? (
            <LivePnl signal={signal} livePrices={livePrices} showPrice />
          ) : (
            <span className={`text-sm font-bold ${
              signal.pnl == null ? 'text-dark-400' : signal.pnl.startsWith('-') ? 'text-bearish' : 'text-bullish'
            }`}>
              {signal.pnl == null ? 'باز' : `${signal.pnl} پیپ`}
            </span>
          )}
        </div>

        {signal.analysis && (
          <div className="bg-dark-800/30 rounded-xl p-4">
            <h4 className="text-white font-bold text-sm mb-2">تحلیل:</h4>
            <p className="text-dark-300 text-sm leading-7">{signal.analysis}</p>
          </div>
        )}

        <div className="mt-4 text-dark-500 text-xs">
          زمان ارسال: {formatTime(signal.time)}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SignalsPage() {
  useSeo({
    title: 'سیگنال‌های زندهٔ فارکس و طلا',
    description: 'سیگنال‌های واقعی و فعالِ فارکس، طلا، نفت و شاخص‌ها در کوین پرو FX؛ نقطهٔ ورود، حد سود و حد ضرر دقیق به‌همراه تاریخچهٔ شفاف عملکرد.',
    path: '/signals',
  });
  const [tab, setTab] = useState('active');
  const [filters, setFilters] = useState({ symbol: '', direction: '', strength: '' });
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 6;

  // گِیتِ VIP — تا کاربر با تلگرامِ دارایِ اشتراک وارد نشود، سیگنال‌ها باز نمی‌شوند
  const [isVip, setIsVip] = useState(() => vipSession.isVip());

  const { data: activeData, error: activeErr } = useQuery({
    queryKey: ['activeSignals'],
    queryFn: () => signalsAPI.getActive({ limit: 100 }),
    refetchInterval: 20000,
    enabled: isVip,
    retry: false,
  });

  const { data: recentData, error: recentErr } = useQuery({
    queryKey: ['recentSignals'],
    queryFn: () => signalsAPI.getRecent({ limit: 100 }),
    refetchInterval: 60000,
    enabled: isVip,
    retry: false,
  });

  // اگر توکنِ VIP منقضی/نامعتبر شد (۴۰۱/۴۰۳) → بازگشت به گِیتِ ورود
  useEffect(() => {
    const e = activeErr || recentErr;
    if (e && (e.status === 401 || e.status === 403)) {
      vipSession.clear();
      setIsVip(false);
    }
  }, [activeErr, recentErr]);

  // قیمتِ زنده برای سود/زیانِ لحظه‌ای
  const [livePrices, setLivePrices] = useState({});
  useEffect(() => {
    let closed = false;
    const ws = createPriceSocket((data) => {
      if (closed || !data || typeof data !== 'object') return;
      setLivePrices((prev) => {
        const next = { ...prev };
        for (const [sym, p] of Object.entries(data)) {
          if (!p) continue;
          if (p.bid != null && p.ask != null) next[sym] = (Number(p.bid) + Number(p.ask)) / 2;
          else if (p.price != null) next[sym] = Number(p.price);
        }
        return next;
      });
    });
    return () => { closed = true; try { ws && ws.close && ws.close(); } catch { /* noop */ } };
  }, []);

  const activeSignals = (activeData?.items || []).map(mapSignal);
  // تاریخچه = سیگنال‌های بسته‌شده (غیرفعال)
  const historySignals = (recentData?.items || [])
    .filter((s) => s.status !== 'active')
    .map(mapSignal);
  const currentSignals = tab === 'active' ? activeSignals : historySignals;

  // فهرستِ نمادها برای فیلتر، از دادهٔ واقعی
  const symbolOptions = useMemo(() => {
    const set = new Set([...activeSignals, ...historySignals].map((s) => s.symbol));
    return Array.from(set).sort();
  }, [activeSignals, historySignals]);

  const filtered = useMemo(() => {
    return currentSignals.filter((s) => {
      if (filters.symbol && s.symbol !== filters.symbol) return false;
      if (filters.direction && s.direction !== filters.direction) return false;
      if (filters.strength && s.strength !== filters.strength) return false;
      return true;
    });
  }, [currentSignals, filters]);

  const totalPages = tab === 'history' ? Math.max(1, Math.ceil(filtered.length / perPage)) : 1;
  const visible = tab === 'history' ? filtered.slice((page - 1) * perPage, page * perPage) : filtered;

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">سیگنال‌های معاملاتی</h1>
          <p className="text-dark-400 text-lg">سیگنال‌های فعال و تاریخچه سیگنال‌های گذشته</p>
        </motion.div>

        {!isVip && <VipGate onAuthed={() => setIsVip(true)} />}

        {isVip && (<>
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: 'active', label: 'سیگنال‌های فعال', count: activeSignals.length },
            { key: 'history', label: 'تاریخچه', count: historySignals.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-accent text-white'
                  : 'bg-dark-800/50 text-dark-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              {t.label}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                tab === t.key ? 'bg-white/20' : 'bg-dark-700'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 mb-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-dark-400 text-sm font-medium">فیلتر:</span>
            <select
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
            >
              <option value="">همه نمادها</option>
              {symbolOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.direction}
              onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
            >
              <option value="">همه جهت‌ها</option>
              {DIRECTIONS.filter(Boolean).map((d) => (
                <option key={d} value={d}>{d === 'BUY' ? 'خرید' : 'فروش'}</option>
              ))}
            </select>
            <select
              value={filters.strength}
              onChange={(e) => setFilters({ ...filters, strength: e.target.value })}
              className="bg-dark-800 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:border-accent focus:outline-none"
            >
              <option value="">همه قدرت‌ها</option>
              {STRENGTHS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(filters.symbol || filters.direction || filters.strength) && (
              <button
                onClick={() => setFilters({ symbol: '', direction: '', strength: '' })}
                className="text-accent text-sm hover:text-accent-light transition-colors"
              >
                پاک کردن فیلترها
              </button>
            )}
          </div>
        </motion.div>

        {/* Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {visible.map((signal, index) => (
              <motion.div
                key={signal.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedSignal(signal)}
                className={`glass-card p-5 cursor-pointer hover:border-dark-600/80 transition-all ${
                  signal.direction === 'BUY' ? 'hover:shadow-bullish/5 hover:shadow-lg' : 'hover:shadow-bearish/5 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-lg">{signal.symbol}</span>
                    <span className={signal.direction === 'BUY' ? 'badge-bullish' : 'badge-bearish'}>
                      {signal.direction === 'BUY' ? 'خرید' : 'فروش'}
                    </span>
                  </div>
                  <StatusBadge status={signal.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                  <div>
                    <span className="text-dark-500 text-xs block">ورود</span>
                    <span className="text-white font-mono">{signal.entry}</span>
                  </div>
                  <div>
                    <span className="text-dark-500 text-xs block">حد سود</span>
                    <span className="text-bullish font-mono">{signal.tp1}</span>
                  </div>
                  <div>
                    <span className="text-dark-500 text-xs block">حد ضرر</span>
                    <span className="text-bearish font-mono">{signal.sl}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-dark-800/50">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${
                      signal.strength === 'قوی' ? 'text-bullish' : signal.strength === 'متوسط' ? 'text-yellow-500' : 'text-dark-400'
                    }`}>
                      {signal.strength}
                    </span>
                    <span className="text-dark-500 text-xs">{formatTime(signal.time)}</span>
                  </div>
                  {signal.isActive ? (
                    <LivePnl signal={signal} livePrices={livePrices} />
                  ) : (
                    <span className={`text-sm font-bold ${
                      signal.pnl == null ? 'text-dark-400' : signal.pnl.startsWith('-') ? 'text-bearish' : 'text-bullish'
                    }`}>
                      {signal.pnl == null ? 'باز' : `${signal.pnl} پیپ`}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-dark-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-dark-500 text-lg">سیگنالی با فیلترهای انتخابی یافت نشد</p>
          </div>
        )}

        {/* Pagination for history */}
        {tab === 'history' && filtered.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="w-10 h-10 rounded-lg bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-white rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                  page === p ? 'bg-accent text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-white'
                }`}
              >
                {p.toLocaleString('fa-IR')}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="w-10 h-10 rounded-lg bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-white rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        </>)}
      </div>

      {/* Signal Detail Modal */}
      <AnimatePresence>
        {selectedSignal && (
          <SignalDetailCard
            signal={selectedSignal}
            livePrices={livePrices}
            onClose={() => setSelectedSignal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
