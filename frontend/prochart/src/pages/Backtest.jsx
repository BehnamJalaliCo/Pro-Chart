import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, TrendingUp, TrendingDown, RefreshCw, Play, Pause, SkipForward, SkipBack,
  RotateCcw, Gauge, Activity, Bot, Wallet, Shield, Scissors, XCircle, Flame, Loader2,
  Target, Crosshair, Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { makeStore } from '../lib/persist';
import { GuideButton, InfoTip } from '../components/Guide';
import Terminal from '../components/Terminal';

// سشنِ تمرین در مرورگر ذخیره می‌شود تا رفرش/خروج، پوزیشن‌ها و پیشرفت را پاک نکند.
// کندل‌ها (حجیم) در کلیدِ جدا ذخیره می‌شوند تا ذخیرهٔ مکررِ وضعیتِ زنده سبک بماند.
const store = makeStore('academy_practice');
const candleStore = makeStore('academy_practice_candles');

/*
  شبیه‌سازِ حرفه‌ایِ Replay/Practice (سبکِ TradingView bar-replay / FX Replay)
  - دادهٔ بزرگِ تاریخی از api.chart با شروعِ تصادفی؛ هر سشن متفاوت
  - موتورِ Replay سمتِ کلاینت روی همان Terminal (پراپِ candles کنترل‌شده)
  - معامله: Market/Limit/Stop، SL/TP، حجم/ریسک، خروجِ جزئی، تسویهٔ خودکارِ SL/TP/Limit-Stop
  - آمارِ سشن + اتصال به practiceRecord/practiceFeedback/practiceStats
*/

const START_LIMIT = 800;     // اندازهٔ پنجرهٔ تاریخی که از سرور می‌گیریم
const REVEAL_MIN = 250;      // حداقل تعداد کندلِ آشکار در شروع
const FUTURE_MIN = 200;      // حداقل تعداد کندلِ پنهان برای ادامهٔ معامله
const START_BALANCE = 10000; // موجودیِ مجازیِ شروع
const SPREAD_PIPS = 1.2;     // اسپردِ ثابتِ شبیه‌سازی (پیپ)

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'USDCAD', 'GBPJPY'];
const TFS = ['M5', 'M15', 'H1', 'H4', 'D1'];
// ثانیه‌های هر تایم‌فریم (برای محاسبهٔ لنگرِ تصادفیِ تاریخی)
const TF_SECONDS = { M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };
const SPEEDS = [
  { label: '۰٫۵×', ms: 1600 },
  { label: '۱×', ms: 800 },
  { label: '۲×', ms: 400 },
  { label: '۴×', ms: 200 },
  { label: '۱۰×', ms: 80 },
];
const ORDER_TYPES = [
  { key: 'market', label: 'بازار' },
  { key: 'limit', label: 'لیمیت' },
  { key: 'stop', label: 'استاپ' },
];

const rand = (n) => Math.floor(Math.random() * n);
const isNum = (v) => Number.isFinite(v);

// اندازهٔ پیپ بر اساسِ نماد
function pipSize(symbol, price) {
  const s = (symbol || '').toUpperCase();
  if (s.includes('JPY')) return 0.01;
  if (s.includes('XAU') || s.includes('GOLD')) return 0.1;
  if (price && price > 50) return 0.01; // فلزات/شاخص‌های گران
  return 0.0001;
}

export default function Backtest() {
  const qc = useQueryClient();

  const _saved = useMemo(() => ({ ...store.load(), ...candleStore.load() }), []);
  const _hasSession = Array.isArray(_saved.allCandles) && _saved.allCandles.length > 0;

  // ── پیکربندیِ سشن ── (از مرورگر بازیابی می‌شود تا رفرش پاکش نکند)
  const [symbol, setSymbol] = useState(_saved.symbol || 'EURUSD');
  const [tf, setTf] = useState(_saved.tf || 'H1');

  // ── دادهٔ کاملِ تاریخی + مرزِ آشکار ──
  const [allCandles, setAllCandles] = useState(_hasSession ? _saved.allCandles : []); // کلِ پنجره (شاملِ آینده‌ی پنهان)
  const [cursor, setCursor] = useState(_hasSession ? (_saved.cursor ?? 0) : 0);          // آخرین ایندکسِ آشکار (۰..len-1)
  const [revealStart, setRevealStart] = useState(_hasSession ? (_saved.revealStart ?? 0) : 0);// ایندکسِ شروعِ آشکار (برای نوارِ پیشرفت)
  const [loading, setLoading] = useState(!_hasSession);
  const [errored, setErrored] = useState(false);
  const [sessionDate, setSessionDate] = useState(_saved.sessionDate || ''); // تاریخِ بازهٔ تاریخیِ سشن (برای نمایش)

  // ── موتورِ پخش ──
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);

  // ── معامله ──
  const [otype, setOtype] = useState(_saved.otype || 'market');
  const [dir, setDir] = useState(_saved.dir || 'buy');
  const [riskUsd, setRiskUsd] = useState(_saved.riskUsd ?? 100);   // ریسکِ دلاریِ هر معامله
  const [slPips, setSlPips] = useState(_saved.slPips ?? 20);
  const [tpPips, setTpPips] = useState(_saved.tpPips ?? 40);
  const [limitPrice, setLimitPrice] = useState(_saved.limitPrice ?? ''); // قیمتِ ورودِ سفارشِ معلق

  const [positions, setPositions] = useState(_hasSession ? (_saved.positions || []) : []); // معاملاتِ باز
  const [pending, setPending] = useState(_hasSession ? (_saved.pending || []) : []);     // سفارش‌های معلق
  const [closed, setClosed] = useState(_hasSession ? (_saved.closed || []) : []);       // تاریخچهٔ سشن
  const [balance, setBalance] = useState(_hasSession ? (_saved.balance ?? START_BALANCE) : START_BALANCE);
  const [lastResult, setLastResult] = useState(_hasSession ? (_saved.lastResult ?? null) : null); // {pnl, r, how, dir}
  const [fb, setFb] = useState(null);
  const [fbBusy, setFbBusy] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['practiceStats'], queryFn: () => api.practiceStats() });

  // ── مشتقات ──
  const len = allCandles.length;
  const revealed = useMemo(() => allCandles.slice(0, cursor + 1), [allCandles, cursor]);
  const curBar = allCandles[cursor] || null;
  const price = curBar ? curBar.c : 0;
  const pip = pipSize(symbol, price);
  const dec = price && price < 10 ? 5 : (pip <= 0.01 ? 3 : 2);
  const atEnd = len > 0 && cursor >= len - 1;
  const spread = SPREAD_PIPS * pip;

  // قیمتِ معاملاتیِ خرید/فروش با احتسابِ اسپرد
  const askPrice = price + spread / 2; // خرید با ask
  const bidPrice = price - spread / 2; // فروش با bid

  // ── بارگذاریِ سشنِ جدید ──
  const loadSession = useCallback(async (sym, timeframe) => {
    setLoading(true); setErrored(false);
    setPlaying(false); setPositions([]); setPending([]); setClosed([]);
    setBalance(START_BALANCE); setLastResult(null); setFb(null);
    setSessionDate('');
    try {
      // ۱) لنگرِ تصادفیِ تاریخی: ابتدا بازهٔ کلِ دادهٔ موجود را می‌گیریم،
      //    سپس یک نقطهٔ «before» تصادفی انتخاب می‌کنیم تا هم گذشتهٔ کافی برای نمایش
      //    و هم آیندهٔ کافی برای آشکارسازی وجود داشته باشد. هر سشن لنگرِ نو دارد.
      let before; // unix seconds؛ undefined ⇒ رفتارِ پیشین (آخرین کندل‌ها)
      const tfSec = TF_SECONDS[timeframe] || 3600;
      try {
        const range = await api.chartRange(sym, timeframe);
        const minTs = Number(range?.min_ts), maxTs = Number(range?.max_ts);
        const count = Number(range?.count);
        // باید به‌اندازهٔ یک پنجرهٔ کامل (START_LIMIT کندل) گذشته داشته باشیم
        // و پس از آن دست‌کم چند کندل آینده برای آشکارسازی.
        if (isNum(minTs) && isNum(maxTs) && isNum(count) && count > START_LIMIT + FUTURE_MIN) {
          const lo = minTs + START_LIMIT * tfSec;        // کفِ لنگر: یک پنجرهٔ کامل گذشته تضمین شود
          const hi = maxTs - FUTURE_MIN * tfSec;          // سقفِ لنگر: آیندهٔ کافی برای آشکارسازی بماند
          if (hi > lo) before = lo + Math.floor(Math.random() * (hi - lo));
        }
      } catch { /* بازه در دسترس نبود ⇒ fallback به رفتارِ پیشین */ }

      // ۲) دریافتِ پنجره: اگر «before» داریم پنجره‌ای که در آن نقطه پایان می‌یابد،
      //    وگرنه آخرین کندل‌ها (رفتارِ کاملاً پیشین).
      const res = await api.chart(sym, timeframe, '', START_LIMIT, before);
      const cs = Array.isArray(res?.candles) ? res.candles.filter(
        (c) => c && isNum(c.o) && isNum(c.h) && isNum(c.l) && isNum(c.c)
      ) : [];
      if (cs.length < REVEAL_MIN + 30) { setAllCandles(cs); setErrored(true); setLoading(false); return; }
      // شروعِ تصادفی: مرزِ آشکار جایی بینِ REVEAL_MIN و (len - FUTURE_MIN)
      const maxStart = Math.max(REVEAL_MIN, cs.length - FUTURE_MIN);
      const start = REVEAL_MIN + rand(Math.max(1, maxStart - REVEAL_MIN));
      setAllCandles(cs);
      setRevealStart(start);
      setCursor(Math.min(start, cs.length - 1));
      // تاریخِ بازهٔ تمرین = زمانِ کندلِ شروعِ آشکار (اگر زمان موجود باشد)
      const startBar = cs[Math.min(start, cs.length - 1)];
      const ts = startBar && (startBar.t ?? startBar.time);
      if (isNum(Number(ts))) {
        try {
          setSessionDate(new Date(Number(ts) * 1000).toLocaleDateString('fa-IR', {
            year: 'numeric', month: 'long', day: 'numeric',
          }));
        } catch { /* */ }
      }
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // در شروع: اگر سشنِ ذخیره‌شده‌ای در مرورگر هست، همان را ادامه بده؛ وگرنه سشنِ جدید بساز
  useEffect(() => { if (!_hasSession) loadSession(symbol, tf); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ذخیرهٔ خودکارِ وضعیتِ زندهٔ سشن (سبک؛ بدونِ کندل‌ها) — مکان‌نما/پوزیشن‌ها/موجودی/پارامترها
  useEffect(() => {
    store.save({ symbol, tf, cursor, revealStart, sessionDate,
      positions, pending, closed, balance, lastResult,
      otype, dir, riskUsd, slPips, tpPips, limitPrice });
  }, [symbol, tf, cursor, revealStart, sessionDate, positions, pending, closed, balance, lastResult, otype, dir, riskUsd, slPips, tpPips, limitPrice]);
  // ذخیرهٔ کندل‌ها فقط هنگامِ تغییرِ پنجره (سشنِ جدید) — نه در هر تیکِ پخش
  useEffect(() => { candleStore.save({ allCandles }); }, [allCandles]);

  const newSession = () => loadSession(symbol, tf);
  const changeSymbol = (s) => { setSymbol(s); loadSession(s, tf); };
  const changeTf = (t) => { setTf(t); loadSession(symbol, t); };

  // ── پیشرویِ یک کندل (هستهٔ همه‌ی حرکت‌ها) ──
  const settleBarRef = useRef(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const stepForward = useCallback(() => {
    const c = cursorRef.current;
    if (c >= len - 1) { setPlaying(false); return; }
    const next = c + 1;
    if (settleBarRef.current) settleBarRef.current(next); // تسویهٔ سفارش‌ها/معاملات روی کندلِ تازه
    setCursor(next);
  }, [len]);

  const stepBack = useCallback(() => {
    setPlaying(false);
    setCursor((c) => Math.max(revealStart, c - 1));
  }, [revealStart]);

  const resetToStart = useCallback(() => {
    setPlaying(false);
    setCursor(revealStart);
  }, [revealStart]);

  // ── حلقهٔ پخش ──
  useEffect(() => {
    if (!playing) return;
    if (atEnd) { setPlaying(false); return; }
    const t = setTimeout(() => stepForward(), speedMs);
    return () => clearTimeout(t);
  }, [playing, cursor, atEnd, speedMs, stepForward]);

  // ── تسویهٔ خودکار روی کندلِ تازه‌آشکار (idx) ──
  // فعال‌شدنِ سفارش‌های معلق + برخوردِ SL/TP معاملاتِ باز
  // نکته: تابع هر رِندر تازه ساخته و در ref نگه‌داری می‌شود تا closureها (symbol/cursor/...) همیشه به‌روز باشند.
  const settleBar = (idx) => {
    const bar = allCandles[idx];
    if (!bar) return;

    // ۱) فعال‌شدنِ سفارش‌های معلق وقتی high/low قیمتِ ورود را لمس کند
    setPending((pend) => {
      if (!pend.length) return pend;
      const stillPending = [];
      const newlyFilled = [];
      pend.forEach((o) => {
        let fill = false;
        if (o.type === 'limit') {
          fill = o.dir === 'buy' ? bar.l <= o.entry : bar.h >= o.entry;
        } else { // stop
          fill = o.dir === 'buy' ? bar.h >= o.entry : bar.l <= o.entry;
        }
        if (fill) newlyFilled.push({ ...o, pending: false, filledAt: idx });
        else stillPending.push(o);
      });
      if (newlyFilled.length) setPositions((ps) => [...ps, ...newlyFilled]);
      return stillPending;
    });

    // ۲) برخوردِ SL/TP برای معاملاتِ باز (شاملِ آن‌هایی که همین کندل فعال شدند)
    setPositions((ps) => {
      if (!ps.length) return ps;
      const survivors = [];
      ps.forEach((p) => {
        let hitSL = false, hitTP = false;
        if (p.dir === 'buy') {
          if (isNum(p.sl) && bar.l <= p.sl) hitSL = true;
          if (isNum(p.tp) && bar.h >= p.tp) hitTP = true;
        } else {
          if (isNum(p.sl) && bar.h >= p.sl) hitSL = true;
          if (isNum(p.tp) && bar.l <= p.tp) hitTP = true;
        }
        // اگر هردو در یک کندل خوردند، محافظه‌کارانه SL را اولویت می‌دهیم
        if (hitSL) finalizeClose(p, p.sl, 'sl');
        else if (hitTP) finalizeClose(p, p.tp, 'tp');
        else survivors.push(p);
      });
      return survivors;
    });
  };
  settleBarRef.current = settleBar; // به‌روزرسانی در هر رِندر

  // ── محاسبهٔ حجم بر اساسِ ریسکِ دلاری و فاصلهٔ SL ──
  const calcSize = (entry, sl) => {
    const slDist = Math.abs(entry - sl);
    if (!slDist) return 0;
    // ارزشِ هر واحدِ قیمت ≈ riskUsd / slDist (مدلِ سادهٔ ۱ لات = ۱ واحدِ ارزش)
    return riskUsd / slDist;
  };

  // ── P&L یک معامله در قیمتِ مفروض ──
  const pnlAt = (p, exitPrice) => {
    const move = (exitPrice - p.entry) * (p.dir === 'buy' ? 1 : -1);
    return move * p.size * p.frac;
  };
  const rAt = (p, exitPrice) => {
    const risk = Math.abs(p.entry - p.sl) * p.size || 1e-9;
    return pnlAt(p, exitPrice) / risk;
  };

  // ── نهایی‌کردنِ بستنِ یک معامله (ثبت + موجودی + API) ──
  const finalizeClose = (p, exitPrice, how) => {
    const ex = isNum(exitPrice) ? exitPrice : price;
    const pnl = +(pnlAt(p, ex) + (p.realizedPnl || 0)).toFixed(2);
    const risk0 = Math.abs(p.entry - p.sl) * (p.size0 || p.size) || 1e-9;
    const r = +(pnl / risk0).toFixed(2);
    setBalance((b) => +(b + pnlAt(p, ex)).toFixed(2));
    const rec = { ...p, exit: ex, how, pnl, r, closedAt: cursor };
    setClosed((arr) => [rec, ...arr]);
    setLastResult({ pnl, r, how, dir: p.dir });
    setFb(null);
    // ثبت در آمارِ تمرینِ موجود
    api.practiceRecord({
      symbol, direction: p.dir, entry: p.entry, exit: ex, pnl_r: r, outcome: how,
    }).then(() => qc.invalidateQueries({ queryKey: ['practiceStats'] })).catch(() => {});
  };

  // ── ثبتِ سفارش ──
  const placeOrder = () => {
    if (!curBar) return;
    const d = dir;
    let entry;
    if (otype === 'market') entry = d === 'buy' ? askPrice : bidPrice;
    else {
      const lp = parseFloat(limitPrice);
      if (!isNum(lp)) return;
      entry = lp;
    }
    entry = +entry.toFixed(dec);
    const slDist = slPips * pip;
    const tpDist = tpPips * pip;
    const sl = +(d === 'buy' ? entry - slDist : entry + slDist).toFixed(dec);
    const tp = tpPips > 0 ? +(d === 'buy' ? entry + tpDist : entry - tpDist).toFixed(dec) : null;
    const size = calcSize(entry, sl);
    if (!size) return;
    const base = {
      id: 'o' + Date.now() + '_' + rand(9999),
      type: otype, dir: d, entry, sl, tp, size, size0: size,
      frac: 1, realizedPnl: 0, openedAt: cursor,
      pending: otype !== 'market',
    };
    if (otype === 'market') setPositions((ps) => [...ps, base]);
    else setPending((pd) => [...pd, base]);
    setLastResult(null);
  };

  // ── بستنِ دستی ──
  const closeManual = (p) => {
    const ex = p.dir === 'buy' ? bidPrice : askPrice;
    setPositions((ps) => ps.filter((x) => x.id !== p.id));
    finalizeClose(p, +ex.toFixed(dec), 'manual');
  };
  // ── خروجِ جزئی ۵۰٪ ──
  const closePartial = (p) => {
    if (p.frac <= 0.5) return;
    const ex = p.dir === 'buy' ? bidPrice : askPrice;
    const halfFrac = p.frac / 2;
    const realized = (ex - p.entry) * (p.dir === 'buy' ? 1 : -1) * p.size * halfFrac;
    setBalance((b) => +(b + realized).toFixed(2));
    setPositions((ps) => ps.map((x) =>
      x.id === p.id ? { ...x, frac: x.frac - halfFrac, realizedPnl: (x.realizedPnl || 0) + realized } : x
    ));
  };
  const moveBreakeven = (p) => {
    setPositions((ps) => ps.map((x) => x.id === p.id ? { ...x, sl: x.entry } : x));
  };
  const cancelPending = (o) => setPending((pd) => pd.filter((x) => x.id !== o.id));

  // ── بازخوردِ AI روی آخرین معاملهٔ بسته‌شده ──
  const askFeedback = async () => {
    const last = closed[0];
    if (!last || fbBusy) return;
    setFbBusy(true);
    try {
      const risk = Math.abs(last.entry - last.sl) || pip;
      const f = await api.practiceFeedback({
        symbol, direction: last.dir, entry: last.entry, sl: last.sl, tp: last.tp,
        rr: last.tp ? +(Math.abs(last.tp - last.entry) / risk).toFixed(2) : 0,
        outcome: last.how, context: `تایم‌فریم ${tf} · شبیه‌سازِ Replay`,
      });
      setFb(f.feedback);
    } catch { /* */ } finally { setFbBusy(false); }
  };

  // ── خطوطِ قیمت روی نمودار (entry/SL/TP هر معامله + سفارش‌های معلق) ──
  const priceLines = useMemo(() => {
    const lines = [];
    positions.forEach((p) => {
      lines.push({ price: p.entry, color: '#94a3b8', title: (p.dir === 'buy' ? '▲' : '▼') + ' ورود' });
      if (isNum(p.sl)) lines.push({ price: p.sl, color: '#ef4444', title: 'SL' });
      if (isNum(p.tp)) lines.push({ price: p.tp, color: '#22c55e', title: 'TP' });
    });
    pending.forEach((o) => {
      lines.push({ price: o.entry, color: '#a78bfa', title: 'معلق ' + (o.type === 'limit' ? 'لیمیت' : 'استاپ') });
    });
    return lines;
  }, [positions, pending]);

  // ── شناورِ کلِ معاملاتِ باز ──
  const floatPnl = useMemo(() => positions.reduce((s, p) => {
    const ex = p.dir === 'buy' ? bidPrice : askPrice;
    return s + pnlAt(p, ex);
  }, 0), [positions, bidPrice, askPrice]);

  // ── آمارِ سشن ──
  const sess = useMemo(() => {
    const n = closed.length;
    const wins = closed.filter((c) => c.pnl > 0).length;
    const netPnl = closed.reduce((s, c) => s + c.pnl, 0);
    const netR = closed.reduce((s, c) => s + c.r, 0);
    return {
      n, wins,
      wr: n ? Math.round((wins / n) * 100) : null,
      netPnl: +netPnl.toFixed(2),
      netR: +netR.toFixed(2),
    };
  }, [closed]);

  // ── کیبورد: Space=play/pause، →=step، ←=back ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.code === 'Space') { e.preventDefault(); if (!atEnd) setPlaying((p) => !p); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); setPlaying(false); stepForward(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [atEnd, stepForward, stepBack]);

  // ── رِندر ──
  if (loading) return (
    <div className="text-center py-16 text-text-secondary flex flex-col items-center gap-3">
      <Loader2 className="animate-spin text-brand-green" size={28} />
      در حال آماده‌سازیِ شبیه‌ساز…
    </div>
  );
  if (errored || len < REVEAL_MIN) return (
    <div className="text-center py-12">
      <p className="text-text-muted mb-3">دادهٔ کافی برای این سناریو نبود.</p>
      <button onClick={newSession} className="btn-ghost text-sm inline-flex items-center gap-1.5">
        <RefreshCw size={15} /> سشنِ جدید
      </button>
    </div>
  );

  const total = Math.max(1, len - 1 - revealStart);
  const done = Math.max(0, cursor - revealStart);
  const balUp = balance + floatPnl >= START_BALANCE;

  const Chip = ({ on, onClick, children, title }) => (
    <button onClick={onClick} title={title}
      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${on
        ? 'bg-brand-green/15 border-brand-green text-brand-green'
        : 'border-surface-border text-text-secondary hover:bg-surface-hover'}`}>
      {children}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      {/* سربرگ */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">
          <LineChart className="text-brand-green" /> شبیه‌سازِ تمرین (Replay)
        </h1>
        <div className="flex items-center gap-2">
          <GuideButton guideKey="backtest" auto />
          <button onClick={newSession} className="btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw size={15} /> سشنِ جدید
          </button>
        </div>
      </div>

      {/* نوارِ حساب */}
      <div className="card p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-text-muted flex items-center gap-1"><Wallet size={13} /> موجودیِ مجازی</div>
          <div className={`text-xl font-black ${balUp ? 'text-brand-green' : 'text-brand-red'}`}>
            ${(balance).toFixed(2)}
            {floatPnl !== 0 && (
              <span className={`text-xs font-bold ms-2 ${floatPnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                (شناور {floatPnl >= 0 ? '+' : ''}{floatPnl.toFixed(2)})
              </span>
            )}
          </div>
        </div>
        <div className="text-center"><div className="text-xs text-text-muted">نرخِ بردِ سشن</div>
          <div className="font-black">{sess.wr != null ? sess.wr + '٪' : '—'}</div></div>
        <div className="text-center"><div className="text-xs text-text-muted">معاملاتِ سشن</div>
          <div className="font-black">{sess.n}</div></div>
        <div className="text-center"><div className="text-xs text-text-muted">خالصِ R</div>
          <div className={`font-black ${sess.netR >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            {sess.netR >= 0 ? '+' : ''}{sess.netR}R</div></div>
        {stats && (
          <div className="text-center"><div className="text-xs text-text-muted flex items-center justify-center gap-1"><Flame size={12} className="text-brand-green" /> کلِ تمرین</div>
            <div className="font-black">{stats.count ?? 0}</div></div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ستونِ نمودار + کنترل‌ها */}
        <div className="lg:col-span-2 space-y-3">
          <div className="card p-3 sm:p-4">
            {/* انتخابِ نماد/تایم‌فریم */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <select value={symbol} onChange={(e) => changeSymbol(e.target.value)}
                className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs">
                {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center gap-1">
                {TFS.map((t) => <Chip key={t} on={tf === t} onClick={() => changeTf(t)}>{t}</Chip>)}
              </div>
              {sessionDate && (
                <span className="text-xs text-text-muted ms-auto inline-flex items-center gap-1">
                  بازهٔ تمرین: <b className="text-brand-green">{sessionDate}</b>
                </span>
              )}
              <span className={`text-xs text-text-muted ${sessionDate ? '' : 'ms-auto'}`}>قیمتِ فعلی: <b className="text-text-primary" dir="ltr">{price.toFixed(dec)}</b></span>
            </div>

            {/* نمودارِ Replay (Terminal کنترل‌شده با کندل‌های آشکار) */}
            <Terminal
              symbol={symbol}
              tf={tf}
              height={420}
              candles={revealed}
              priceLines={priceLines}
              showToolbar={false}
            />

            {/* کنترل‌های Replay */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={resetToStart} title="پرش به ابتدا"
                className="p-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-brand-green"><RotateCcw size={16} /></button>
              <button onClick={stepBack} title="یک کندل عقب (←)" disabled={cursor <= revealStart}
                className="p-2 rounded-lg bg-surface-elevated text-text-secondary disabled:opacity-40 hover:text-brand-green"><SkipBack size={16} /></button>
              <button onClick={() => !atEnd && setPlaying((p) => !p)} disabled={atEnd} title="پخش/مکث (Space)"
                className="p-2.5 rounded-xl bg-brand-green/15 border border-brand-green text-brand-green disabled:opacity-40">
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              {/* دکمهٔ بزرگِ «بازِ بعدی» */}
              <button onClick={() => { setPlaying(false); stepForward(); }} disabled={atEnd} title="کندلِ بعدی (→)"
                className="px-4 py-2.5 rounded-xl bg-brand-green-strong text-white font-black flex items-center gap-2 disabled:opacity-40">
                <SkipForward size={18} /> کندلِ بعدی
              </button>

              {/* نوارِ پیشرفت */}
              <div className="flex-1 min-w-[120px] h-1.5 bg-surface-border rounded-full overflow-hidden">
                <div className="h-full bg-brand-green transition-all" style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
              </div>
              <span className="text-xs text-text-muted tabular-nums">{done}/{total}</span>

              {/* سرعت */}
              <div className="flex items-center gap-1">
                <InfoTip text="سرعتِ پخشِ کندل‌ها: ۱۰× برای مرورِ سریعِ بازار، ۰٫۵× برای تصمیمِ دقیق روی هر کندل." />
                <Gauge size={14} className="text-text-muted" />
                {SPEEDS.map((s) => (
                  <button key={s.ms} onClick={() => setSpeedMs(s.ms)}
                    className={`px-1.5 py-1 rounded-md text-[11px] font-bold border ${speedMs === s.ms
                      ? 'bg-brand-green/15 border-brand-green text-brand-green'
                      : 'border-surface-border text-text-muted hover:bg-surface-hover'}`}>{s.label}</button>
                ))}
              </div>
            </div>
            {atEnd && <p className="text-[11px] text-brand-red mt-2">به انتهای داده رسیدی — «سشنِ جدید» را بزن.</p>}
          </div>

          {/* معاملاتِ باز و معلق */}
          <div className="card p-3 sm:p-4">
            <div className="text-sm font-bold mb-2 flex items-center gap-2"><Activity size={15} className="text-brand-green" /> معاملاتِ باز</div>
            {positions.length === 0 && pending.length === 0 && (
              <p className="text-xs text-text-muted">معاملهٔ بازی نداری. از پنلِ کناری سفارش ثبت کن.</p>
            )}
            <div className="space-y-2">
              {positions.map((p) => {
                const ex = p.dir === 'buy' ? bidPrice : askPrice;
                const fp = pnlAt(p, ex);
                const fr = rAt(p, ex);
                return (
                  <div key={p.id} className="bg-surface-elevated rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-black ${p.dir === 'buy' ? 'text-brand-green' : 'text-brand-red'}`}>
                        {p.dir === 'buy' ? <TrendingUp size={14} className="inline" /> : <TrendingDown size={14} className="inline" />} {p.dir === 'buy' ? 'خرید' : 'فروش'}
                      </span>
                      <span className="text-text-muted" dir="ltr">@ {p.entry.toFixed(dec)}</span>
                      <span className="text-brand-red" dir="ltr">SL {isNum(p.sl) ? p.sl.toFixed(dec) : '—'}</span>
                      <span className="text-brand-green" dir="ltr">TP {isNum(p.tp) ? p.tp.toFixed(dec) : '—'}</span>
                      {p.frac < 1 && <span className="text-text-muted">({Math.round(p.frac * 100)}٪)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${fp >= 0 ? 'text-brand-green' : 'text-brand-red'}`} dir="ltr">
                        {fp >= 0 ? '+' : ''}{fp.toFixed(2)} ({fr >= 0 ? '+' : ''}{fr.toFixed(2)}R)
                      </span>
                      <button onClick={() => moveBreakeven(p)} title="سر‌به‌سر" className="p-1 rounded-md text-text-muted hover:text-brand-green"><Shield size={14} /></button>
                      <button onClick={() => closePartial(p)} disabled={p.frac <= 0.5} title="خروجِ ۵۰٪" className="p-1 rounded-md text-text-muted hover:text-brand-green disabled:opacity-30"><Scissors size={14} /></button>
                      <button onClick={() => closeManual(p)} title="بستن" className="p-1 rounded-md text-brand-red"><XCircle size={15} /></button>
                    </div>
                  </div>
                );
              })}
              {pending.map((o) => (
                <div key={o.id} className="bg-surface-elevated/60 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-dashed border-surface-border">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#a78bfa]">معلق · {o.type === 'limit' ? 'لیمیت' : 'استاپ'}</span>
                    <span className={o.dir === 'buy' ? 'text-brand-green' : 'text-brand-red'}>{o.dir === 'buy' ? 'خرید' : 'فروش'}</span>
                    <span className="text-text-muted" dir="ltr">@ {o.entry.toFixed(dec)}</span>
                  </div>
                  <button onClick={() => cancelPending(o)} title="لغو" className="p-1 rounded-md text-brand-red"><XCircle size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ریلِ کناری: پنلِ سفارش + نتیجه + تاریخچه */}
        <div className="space-y-3">
          {/* پنلِ سفارش */}
          <div className="card p-3 sm:p-4 space-y-3">
            <div className="text-sm font-bold flex items-center gap-2"><Crosshair size={15} className="text-brand-green" /> ثبتِ سفارش</div>

            {/* نوعِ سفارش */}
            <div className="flex gap-1">
              {ORDER_TYPES.map((o) => (
                <button key={o.key} onClick={() => setOtype(o.key)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${otype === o.key
                    ? 'bg-brand-green/15 border-brand-green text-brand-green'
                    : 'border-surface-border text-text-secondary hover:bg-surface-hover'}`}>{o.label}</button>
              ))}
            </div>

            {/* جهت */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDir('buy')}
                className={`py-2 rounded-lg font-black text-sm flex items-center justify-center gap-1.5 border ${dir === 'buy'
                  ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>
                <TrendingUp size={16} /> خرید</button>
              <button onClick={() => setDir('sell')}
                className={`py-2 rounded-lg font-black text-sm flex items-center justify-center gap-1.5 border ${dir === 'sell'
                  ? 'bg-brand-red/15 border-brand-red text-brand-red' : 'border-surface-border text-text-secondary'}`}>
                <TrendingDown size={16} /> فروش</button>
            </div>

            {/* قیمتِ ورود برای لیمیت/استاپ */}
            {otype !== 'market' && (
              <div>
                <label className="text-xs text-text-muted">قیمتِ ورود</label>
                <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} dir="ltr"
                  placeholder={price.toFixed(dec)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" />
              </div>
            )}

            {/* SL / TP بر حسبِ پیپ */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-brand-red">حدِ ضرر (پیپ)</label>
                <input type="number" value={slPips} onChange={(e) => setSlPips(Math.max(1, +e.target.value || 0))} dir="ltr"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-brand-green">حدِ سود (پیپ)</label>
                <input type="number" value={tpPips} onChange={(e) => setTpPips(Math.max(0, +e.target.value || 0))} dir="ltr"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" />
              </div>
            </div>

            {/* ریسکِ دلاری */}
            <div>
              <label className="text-xs text-text-muted flex items-center gap-1"><Target size={12} /> ریسکِ هر معامله ($)</label>
              <input type="number" value={riskUsd} onChange={(e) => setRiskUsd(Math.max(1, +e.target.value || 0))} dir="ltr"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" />
              <div className="text-[11px] text-text-muted mt-1">
                R/R ≈ <b className="text-text-primary">{slPips > 0 ? (tpPips / slPips).toFixed(2) : '—'}</b>
                {' · '}اسپرد ≈ {SPREAD_PIPS} پیپ
              </div>
            </div>

            <button onClick={placeOrder} disabled={atEnd}
              className={`w-full py-2.5 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-40 ${dir === 'buy' ? 'bg-brand-green' : 'bg-brand-red'}`}>
              <Zap size={16} /> ثبتِ {otype === 'market' ? 'بازار' : otype === 'limit' ? 'لیمیت' : 'استاپ'} · {dir === 'buy' ? 'خرید' : 'فروش'}
            </button>
          </div>

          {/* نتیجهٔ آخرین معامله + بازخوردِ AI */}
          {lastResult && (
            <div className="card p-4 text-center">
              <div className={`text-xl font-black mb-1 ${lastResult.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                {lastResult.how === 'tp' ? '🎯 حدِ سود' : lastResult.how === 'sl' ? '🛑 حدِ ضرر' : 'بسته شد'}
                {' · '}{lastResult.pnl >= 0 ? '+' : ''}{lastResult.pnl.toFixed(2)}$ ({lastResult.r >= 0 ? '+' : ''}{lastResult.r}R)
              </div>
              {!fb ? (
                <button onClick={askFeedback} disabled={fbBusy}
                  className="btn-ghost text-xs inline-flex items-center gap-1.5 mt-1 disabled:opacity-50">
                  {fbBusy ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} بازخوردِ AI
                </button>
              ) : (
                <div className="text-sm text-text-secondary leading-7 mt-2 bg-surface-elevated rounded-xl p-3 text-right flex gap-2">
                  <Bot size={16} className="text-brand-green shrink-0 mt-1" /><span>{fb}</span>
                </div>
              )}
            </div>
          )}

          {/* تاریخچهٔ سشن */}
          {closed.length > 0 && (
            <div className="card p-3 sm:p-4">
              <div className="text-sm font-bold mb-2 flex items-center gap-2"><Activity size={15} /> تاریخچهٔ سشن</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {closed.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-surface-elevated rounded-lg px-2.5 py-1.5">
                    <span className={c.dir === 'buy' ? 'text-brand-green' : 'text-brand-red'}>{c.dir === 'buy' ? 'خرید' : 'فروش'}</span>
                    <span className="text-text-muted">{c.how === 'tp' ? 'TP' : c.how === 'sl' ? 'SL' : 'دستی'}</span>
                    <span className={`font-black ${c.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`} dir="ltr">
                      {c.pnl >= 0 ? '+' : ''}{c.pnl.toFixed(2)}$ ({c.r >= 0 ? '+' : ''}{c.r}R)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-text-muted text-center mt-4 leading-6">
        📊 دادهٔ واقعیِ تاریخی · موتورِ Replay سمتِ کلاینت · Market/Limit/Stop + SL/TP + خروجِ جزئی + تسویهٔ خودکار · حسابِ مجازی $10k · بازخوردِ AI. بدونِ پول و حسابِ واقعی.
        <br />میان‌بر: Space = پخش/مکث · → کندلِ بعدی · ← یک کندل عقب.
      </p>
    </div>
  );
}
