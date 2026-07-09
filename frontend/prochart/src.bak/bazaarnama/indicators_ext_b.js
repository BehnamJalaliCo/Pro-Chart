// بازارنما — افزونهٔ اندیکاتورها، بسته‌ی B:
//   مومنتوم/اسیلاتورها (§5.2) + حجم (§5.4) + پیووت/ساختار (§5.5).
// این فایل کاملاً افزایشی است: هیچ‌کدام از خروجی‌های موجودِ indicators.js را
// بازنویسی نمی‌کند و فقط ورودی‌های جدیدِ رجیستری (EXT_REGISTRY_B) را اضافه می‌کند.
//
// قرارداد (دقیقاً مثلِ indicators.js):
//   - آرایه‌ها هم‌طولِ کندل‌ها؛ دورهٔ گرم‌شدن → null.
//   - c = { open, high, low, close, volume, time }؛ هر کدام آرایهٔ عدد.
//   - i = ورودی‌های resolve‌شده (پیش‌فرض‌ها + override کاربر + i.source آرایه‌ای، §5.7).
//   - شکل‌های render همان‌هایی‌اند که رندرر می‌فهمد:
//       { line, guides?, range? } | { line, signal, guides, range } |
//       { upper, basis, lower, multi:true } | { lines:[{data,color,dashed?,type?}] } |
//       { hist, line?, palette:(v,k)=>color } | { markers:[{time,position,shape,color,text}] } |
//       { levels:[{price,color,label,extendRight}] }
//
// همهٔ مخرج‌ها در برابرِ صفر محافظت شده‌اند (||1e-9 یا fallbackِ خنثی) تا NaN/Infinity
// به نمودار نرسد. اندیکاتورهای حجمی، در نبودِ حجمِ واقعی، روی tick-volume کار می‌کنند.

// ───────────────────────────── کمک‌تابع‌های محلی ─────────────────────────────
// برای جلوگیری از وابستگی به indicators.js (که اجازهٔ ویرایش‌اش را نداریم)،
// نسخه‌های مستقلِ کمک‌تابع‌های لازم این‌جا تعریف می‌شوند. هم‌نام ولی محلی.

const _sma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i] == null ? 0 : src[i];
    sum += v; cnt++;
    if (i >= p) { sum -= (src[i - p] == null ? 0 : src[i - p]); cnt--; }
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
};

const _ema = (src, p) => {
  const out = new Array(src.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) { out[i] = prev; continue; }
    prev = prev == null ? v : v * k + prev * (1 - k);
    if (i >= p - 1) out[i] = prev;
  }
  return out;
};

// میانگینِ متحرکِ وایلدر (SMMA/RMA): seed=SMA(p)
const _rma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let prev = null, sum = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i] == null ? 0 : src[i];
    if (i < p) { sum += v; if (i === p - 1) { prev = sum / p; out[i] = prev; } continue; }
    prev = (prev * (p - 1) + v) / p; out[i] = prev;
  }
  return out;
};

// انحرافِ معیارِ نمونه‌ایِ (population) روی پنجرهٔ p
const _stdev = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let m = 0; for (let j = 0; j < p; j++) m += src[i - j];
    m /= p;
    let s = 0; for (let j = 0; j < p; j++) { const d = src[i - j] - m; s += d * d; }
    out[i] = Math.sqrt(s / p);
  }
  return out;
};

// True Range (آرایه)
const _trArr = (highs, lows, closes) => {
  const tr = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { tr[i] = highs[i] - lows[i]; continue; }
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  return tr;
};

// ATR با وایلدر (مستقل)
const _atr = (highs, lows, closes, p) => _rma(_trArr(highs, lows, closes), p);

const _hl2 = (c) => c.high.map((h, i) => (h + c.low[i]) / 2);
const _hlc3 = (c) => c.high.map((h, i) => (h + c.low[i] + c.close[i]) / 3);

// ضریبِ جریانِ پول (Money-Flow-Multiplier)
const _mfm = (h, l, c) => { const r = h - l; return r ? ((c - l) - (h - c)) / r : 0; };

// رتبهٔ درصدیِ مقدارِ جاری در پنجرهٔ p (برای Connors RSI)
const _percentRank = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p; i < src.length; i++) {
    if (src[i] == null) continue;
    let cnt = 0, tot = 0;
    for (let j = 1; j <= p; j++) { const v = src[i - j]; if (v == null) continue; tot++; if (v < src[i]) cnt++; }
    out[i] = tot ? (100 * cnt) / tot : null;
  }
  return out;
};

// طولِ رشتهٔ متوالیِ صعود/نزول (برای Connors RSI)
const _streak = (closes) => {
  const out = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] > 0 ? out[i - 1] + 1 : 1;
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] < 0 ? out[i - 1] - 1 : -1;
    else out[i] = 0;
  }
  return out;
};

// RSI روی هر سری دلخواه (دورهٔ گرم‌شدن → null)
const _rsiSeries = (src, p) => {
  const out = new Array(src.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < src.length; i++) {
    if (src[i] == null || src[i - 1] == null) continue;
    const ch = src[i] - src[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= p) { ag += g; al += l; if (i === p) { ag /= p; al /= p; out[i] = 100 - 100 / (1 + ag / (al || 1e-9)); } }
    else { ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p; out[i] = 100 - 100 / (1 + ag / (al || 1e-9)); }
  }
  return out;
};

// بیشینه/کمینهٔ پنجره روی یک سری (با null-tolerant)
const _highest = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) { let hh = -Infinity, ok = 0; for (let j = 0; j < p; j++) { const v = src[i - j]; if (v == null) continue; ok = 1; if (v > hh) hh = v; } out[i] = ok ? hh : null; }
  return out;
};
const _lowest = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) { let ll = Infinity, ok = 0; for (let j = 0; j < p; j++) { const v = src[i - j]; if (v == null) continue; ok = 1; if (v < ll) ll = v; } out[i] = ok ? ll : null; }
  return out;
};

// آیا حجمِ معناداری وجود دارد؟ (در نبودش، اندیکاتورهای حجمی null برمی‌گردانند)
const _hasVol = (vols) => Array.isArray(vols) && vols.some((v) => v && v > 0);
const _nullLine = (n) => ({ line: new Array(n).fill(null) });

// پالتِ هیستوگرامِ سبز/قرمز بر مبنای مقایسه با کندلِ قبل
const _UP = '#26a69a', _DN = '#ef5350';

// ───────────────────────── §5.2 مومنتوم / اسیلاتورها ─────────────────────────

// 25) مومنتوم: MOM_t = src_t − src_{t-p}
const mom = (c, i) => {
  const s = i.source ?? c.close;
  return { line: s.map((v, k) => (k >= i.period && v != null && s[k - i.period] != null ? v - s[k - i.period] : null)), guides: [0] };
};

// 26) ROC: 100·(src_t − src_{t-p})/src_{t-p}
const roc = (c, i) => {
  const s = i.source ?? c.close;
  return { line: s.map((v, k) => (k >= i.period && v != null && s[k - i.period] ? (100 * (v - s[k - i.period])) / s[k - i.period] : null)), guides: [0] };
};

// 28) شتاب‌دهنده (Accelerator AC): AC = AO − SMA(AO,5)
const accelerator = (c) => {
  const mp = _hl2(c);
  const f = _sma(mp, 5), sl = _sma(mp, 34);
  const aoArr = mp.map((_, k) => (f[k] != null && sl[k] != null ? f[k] - sl[k] : null));
  const aoSma = _sma(aoArr.map((v) => (v == null ? 0 : v)), 5).map((v, k) => (aoArr[k] == null ? null : v));
  const ac = aoArr.map((v, k) => (v != null && aoSma[k] != null ? v - aoSma[k] : null));
  // پالت: سبز اگر نسبت به بارِ قبل صعودی، قرمز اگر نزولی
  return { hist: ac, palette: (v, k) => (k > 0 && ac[k - 1] != null && ac[k] != null ? (ac[k] >= ac[k - 1] ? _UP : _DN) : _UP), guides: [0] };
};

// 29) اسیلاتورِ غایی (Ultimate Oscillator):
// BP=C−min(L,C_{-1}); TR=max(H,C_{-1})−min(L,C_{-1}); avg_n=ΣBP_n/ΣTR_n;
// UO=100·(4·avg(s) + 2·avg(m) + avg(l)) / 7
const ultimateOsc = (c, i) => {
  const n = c.close.length, bp = new Array(n).fill(null), tr = new Array(n).fill(null);
  for (let k = 1; k < n; k++) {
    const minLC = Math.min(c.low[k], c.close[k - 1]);
    const maxHC = Math.max(c.high[k], c.close[k - 1]);
    bp[k] = c.close[k] - minLC;
    tr[k] = maxHC - minLC;
  }
  const sumP = (arr, p, idx) => { let s = 0; for (let j = 0; j < p; j++) { const v = arr[idx - j]; if (v == null) return null; s += v; } return s; };
  const out = new Array(n).fill(null);
  const lng = Math.max(i.long, i.mid, i.short);
  for (let k = lng; k < n; k++) {
    const bs = sumP(bp, i.short, k), ts = sumP(tr, i.short, k);
    const bm = sumP(bp, i.mid, k), tm = sumP(tr, i.mid, k);
    const bl = sumP(bp, i.long, k), tl = sumP(tr, i.long, k);
    if (bs == null || bm == null || bl == null) continue;
    const a1 = bs / (ts || 1e-9), a2 = bm / (tm || 1e-9), a3 = bl / (tl || 1e-9);
    out[k] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }
  return { line: out, guides: [30, 70], range: [0, 100] };
};

// 33) تبدیلِ فیشر (Fisher Transform):
// hl2 را روی پنجرهٔ p به [−1,1] نگاشت می‌کنیم (با هموارسازیِ 0.5)، بعد
// Fish=0.5·ln((1+x)/(1−x)) با هموارسازیِ بازگشتی؛ signal=Fish_{t-1}
const fisher = (c, i) => {
  const mp = _hl2(c), n = mp.length;
  const hh = _highest(mp, i.period), ll = _lowest(mp, i.period);
  const fish = new Array(n).fill(null), sig = new Array(n).fill(null);
  let v = 0, f = 0;
  for (let k = 0; k < n; k++) {
    if (hh[k] == null || ll[k] == null) continue;
    const rng = hh[k] - ll[k] || 1e-9;
    let x = 0.66 * ((mp[k] - ll[k]) / rng - 0.5) + 0.67 * v;
    x = Math.max(-0.999, Math.min(0.999, x));
    v = x;
    const prevF = f;
    f = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * f;
    fish[k] = f; sig[k] = prevF;
  }
  return { line: fish, signal: sig, guides: [0] };
};

// 32) Connors RSI:
// CRSI = avg( RSI(close,rsiLen), RSI(streak,streakLen), PercentRank(ROC1, rankLen) )
const connorsRsi = (c, i) => {
  const close = i.source ?? c.close, n = close.length;
  const r1 = _rsiSeries(close, i.rsiLen);
  const strk = _streak(close);
  const r2 = _rsiSeries(strk, i.streakLen);
  const roc1 = new Array(n).fill(null);
  for (let k = 1; k < n; k++) roc1[k] = close[k - 1] ? (100 * (close[k] - close[k - 1])) / close[k - 1] : 0;
  const pr = _percentRank(roc1, i.rankLen);
  const out = new Array(n).fill(null);
  for (let k = 0; k < n; k++) if (r1[k] != null && r2[k] != null && pr[k] != null) out[k] = (r1[k] + r2[k] + pr[k]) / 3;
  return { line: out, guides: [20, 80], range: [0, 100] };
};

// 31) SMI Ergodic (Indicator/Signal):
// SMI = TSI(long,short) ؛ signal=EMA(SMI,sig) ؛ hist=SMI−signal
const smiErgodic = (c, i) => {
  const close = i.source ?? c.close, n = close.length;
  const m = new Array(n).fill(0), am = new Array(n).fill(0);
  for (let k = 1; k < n; k++) { m[k] = close[k] - close[k - 1]; am[k] = Math.abs(m[k]); }
  const dbl = _ema(_ema(m, i.long), i.short), adbl = _ema(_ema(am, i.long), i.short);
  const smi = close.map((_, k) => (dbl[k] != null && adbl[k] ? (100 * dbl[k]) / adbl[k] : null));
  const sig = _ema(smi.map((v) => (v == null ? 0 : v)), i.sig).map((v, k) => (smi[k] == null ? null : v));
  const hist = smi.map((v, k) => (v != null && sig[k] != null ? v - sig[k] : null));
  return { line: smi, signal: sig, hist, guides: [0] };
};

// 35) شاخصِ مومنتومِ استوکاستیک (SMI — Stochastic Momentum Index):
// mid=(HH+LL)/2 ؛ SMI=100·EMA(EMA(C−mid,a),b) / (½·EMA(EMA(HH−LL,a),b))
const smi = (c, i) => {
  const n = c.close.length;
  const hh = _highest(c.high, i.period), ll = _lowest(c.low, i.period);
  const rel = new Array(n).fill(null), rng = new Array(n).fill(null);
  for (let k = 0; k < n; k++) {
    if (hh[k] == null || ll[k] == null) continue;
    const mid = (hh[k] + ll[k]) / 2;
    rel[k] = c.close[k] - mid; rng[k] = hh[k] - ll[k];
  }
  const relS = _ema(_ema(rel.map((v) => (v == null ? 0 : v)), i.smoothK), i.smoothD);
  const rngS = _ema(_ema(rng.map((v) => (v == null ? 0 : v)), i.smoothK), i.smoothD);
  const out = new Array(n).fill(null);
  for (let k = 0; k < n; k++) {
    if (rel[k] == null || relS[k] == null || rngS[k] == null) continue;
    const d = (rngS[k] / 2) || 1e-9;
    out[k] = (100 * relS[k]) / d;
  }
  return { line: out, guides: [-40, 40], range: [-100, 100] };
};

// 36) توازنِ قدرت (Balance of Power): BOP=(C−O)/(H−L) ، با هموارسازیِ اختیاری SMA
const bop = (c, i) => {
  const raw = c.close.map((cl, k) => { const r = c.high[k] - c.low[k]; return r ? (cl - c.open[k]) / r : 0; });
  const line = i.smooth > 1 ? _sma(raw, i.smooth) : raw;
  return { line, guides: [0], range: [-1, 1] };
};

// 8) TRIX: e=EMA(EMA(EMA(close,p))) ؛ TRIX=10000·(e_t−e_{t-1})/e_{t-1} ؛ signal=EMA(TRIX,sig)
const trix = (c, i) => {
  const src = i.source ?? c.close;
  const e3 = _ema(_ema(_ema(src, i.period), i.period), i.period);
  const line = e3.map((v, k) => (k > 0 && v != null && e3[k - 1]) ? (10000 * (v - e3[k - 1])) / e3[k - 1] : null);
  const sig = _ema(line.map((v) => (v == null ? 0 : v)), i.sig).map((v, k) => (line[k] == null ? null : v));
  return { line, signal: sig, guides: [0] };
};

// ───────────────────────────── §5.4 حجم ─────────────────────────────

// 47/48) حجم + میانگینِ حجم (هیستوگرامِ رنگی + خطِ MA)
const volume = (c, i) => {
  if (!_hasVol(c.volume)) return { hist: new Array(c.close.length).fill(null) };
  return {
    hist: c.volume,
    line: _sma(c.volume.map((v) => v || 0), i.maLen),
    palette: (_, k) => (c.close[k] >= c.open[k] ? _UP : _DN),
  };
};

// 50) خطِ تجمع/توزیع (A/D): A/D += MFM·vol  (تجمعی)
const adline = (c) => {
  if (!_hasVol(c.volume)) return _nullLine(c.close.length);
  const out = new Array(c.close.length).fill(null);
  let ad = 0;
  for (let k = 0; k < c.close.length; k++) { ad += _mfm(c.high[k], c.low[k], c.close[k]) * (c.volume[k] || 0); out[k] = ad; }
  return { line: out };
};

// 51) اسیلاتورِ چایکین: EMA(A/D,fast) − EMA(A/D,slow)
const chaikinOsc = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const ad = new Array(c.close.length).fill(0); let acc = 0;
  for (let k = 0; k < c.close.length; k++) { acc += _mfm(c.high[k], c.low[k], c.close[k]) * (c.volume[k] || 0); ad[k] = acc; }
  const ef = _ema(ad, i.fast), es = _ema(ad, i.slow);
  return { line: ad.map((_, k) => (ef[k] != null && es[k] != null ? ef[k] - es[k] : null)), guides: [0] };
};

// 54) سهولتِ حرکت (Ease of Movement):
// DM=((H+L)/2 − (H_{-1}+L_{-1})/2) ؛ BR=(vol/scale)/(H−L) ؛ EMV=DM/BR ؛ EoM=SMA(EMV,p)
const eom = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, emv = new Array(n).fill(null);
  const scale = i.scale || 100000000; // مقیاسِ مرسوم برای خوانایی
  for (let k = 1; k < n; k++) {
    const dm = (c.high[k] + c.low[k]) / 2 - (c.high[k - 1] + c.low[k - 1]) / 2;
    const rng = c.high[k] - c.low[k];
    const vol = c.volume[k] || 0;
    const br = vol ? (vol / scale) / (rng || 1e-9) : 0;
    emv[k] = br ? dm / br : 0;
  }
  const line = _sma(emv.map((v) => (v == null ? 0 : v)), i.period).map((v, k) => (k < i.period ? null : v));
  return { line, guides: [0] };
};

// (افزودنی) شاخصِ نیرو (Force Index): FI=(C_t−C_{t-1})·vol ؛ هموار با EMA(p)
const forceIndex = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, raw = new Array(n).fill(null);
  for (let k = 1; k < n; k++) raw[k] = (c.close[k] - c.close[k - 1]) * (c.volume[k] || 0);
  const line = _ema(raw.map((v) => (v == null ? 0 : v)), i.period).map((v, k) => (k < 1 ? null : v));
  return { line, guides: [0] };
};

// (افزودنی) اسیلاتورِ کلینگر (Klinger Volume Oscillator):
// trend بر مبنای جهتِ hlc3 ؛ VF=vol·|2·(dm/cm−1)|·trend·100 ؛ KVO=EMA(VF,fast)−EMA(VF,slow) ؛ signal=EMA(KVO,sig)
const klinger = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, vf = new Array(n).fill(0);
  let trend = 1, cm = 0, prevDm = 0, prevTrend = 1;
  for (let k = 1; k < n; k++) {
    const hlc = (c.high[k] + c.low[k] + c.close[k]);
    const hlcPrev = (c.high[k - 1] + c.low[k - 1] + c.close[k - 1]);
    const dm = c.high[k] - c.low[k];
    trend = hlc > hlcPrev ? 1 : -1;
    if (trend === prevTrend) cm = cm + dm; else cm = prevDm + dm;
    const vol = c.volume[k] || 0;
    const ratio = cm ? Math.abs(2 * (dm / cm) - 1) : 0;
    vf[k] = vol * ratio * trend * 100;
    prevTrend = trend; prevDm = dm;
  }
  const ef = _ema(vf, i.fast), es = _ema(vf, i.slow);
  const kvo = vf.map((_, k) => (ef[k] != null && es[k] != null ? ef[k] - es[k] : null));
  const sig = _ema(kvo.map((v) => (v == null ? 0 : v)), i.sig).map((v, k) => (kvo[k] == null ? null : v));
  return { line: kvo, signal: sig, guides: [0] };
};

// (افزودنی) PVT — Price Volume Trend: PVT += ((C_t−C_{t-1})/C_{t-1})·vol  (تجمعی)
const pvt = (c) => {
  if (!_hasVol(c.volume)) return _nullLine(c.close.length);
  const out = new Array(c.close.length).fill(null); let acc = 0; out[0] = 0;
  for (let k = 1; k < c.close.length; k++) {
    const r = c.close[k - 1] ? (c.close[k] - c.close[k - 1]) / c.close[k - 1] : 0;
    acc += r * (c.volume[k] || 0); out[k] = acc;
  }
  return { line: out };
};

// 38/39) باندِ بولینگرِ مشتق — %B و پهنای باند (Bandwidth)
const _bollinger = (src, p, mult) => {
  const basis = _sma(src, p), sd = _stdev(src, p);
  const upper = src.map((_, k) => (basis[k] != null && sd[k] != null ? basis[k] + mult * sd[k] : null));
  const lower = src.map((_, k) => (basis[k] != null && sd[k] != null ? basis[k] - mult * sd[k] : null));
  return { basis, upper, lower };
};
const bbpercent = (c, i) => {
  const s = i.source ?? c.close;
  const b = _bollinger(s, i.period, i.mult);
  return { line: b.upper.map((u, k) => (u != null ? (s[k] - b.lower[k]) / ((u - b.lower[k]) || 1e-9) : null)), guides: [0, 0.5, 1], range: [-0.5, 1.5] };
};
const bbw = (c, i) => {
  const s = i.source ?? c.close;
  const b = _bollinger(s, i.period, i.mult);
  return { line: b.upper.map((u, k) => (u != null && b.basis[k] ? (u - b.lower[k]) / b.basis[k] : null)) };
};

// ───────────────────────── §5.5 پیووت / ساختار ─────────────────────────

// 59–62) پیووتِ چندنوعه (کلاسیک/فیبوناچی/وودی/کامارلا/DM) روی کندلِ قبل
//   انواع از طریقِ ورودیِ pivotType انتخاب می‌شوند. خروجی: lines (پله‌ای).
const _pivotLevels = (h, l, cl, prevClose, type) => {
  const rng = h - l;
  let P, r1, r2, r3, s1, s2, s3;
  if (type === 'Fibonacci') {
    P = (h + l + cl) / 3;
    r1 = P + 0.382 * rng; r2 = P + 0.618 * rng; r3 = P + 1.0 * rng;
    s1 = P - 0.382 * rng; s2 = P - 0.618 * rng; s3 = P - 1.0 * rng;
  } else if (type === 'Camarilla') {
    P = (h + l + cl) / 3;
    r1 = cl + 1.1 * rng / 12; r2 = cl + 1.1 * rng / 6; r3 = cl + 1.1 * rng / 4;
    s1 = cl - 1.1 * rng / 12; s2 = cl - 1.1 * rng / 6; s3 = cl - 1.1 * rng / 4;
  } else if (type === 'Woodie') {
    P = (h + l + 2 * cl) / 4;
    r1 = 2 * P - l; s1 = 2 * P - h;
    r2 = P + rng; s2 = P - rng;
    r3 = h + 2 * (P - l); s3 = l - 2 * (h - P);
  } else if (type === 'DM') {
    // DeMark: X بسته به رابطهٔ close و open(=prevClose به‌عنوان تقریب)
    let X;
    if (cl < (prevClose ?? cl)) X = h + 2 * l + cl;
    else if (cl > (prevClose ?? cl)) X = 2 * h + l + cl;
    else X = h + l + 2 * cl;
    P = X / 4;
    r1 = X / 2 - l; s1 = X / 2 - h;
    r2 = null; r3 = null; s2 = null; s3 = null;
  } else { // Classic
    P = (h + l + cl) / 3;
    r1 = 2 * P - l; s1 = 2 * P - h;
    r2 = P + rng; s2 = P - rng;
    r3 = h + 2 * (P - l); s3 = l - 2 * (h - P);
  }
  return { P, r1, r2, r3, s1, s2, s3 };
};
const pivotsMulti = (c, i) => {
  const n = c.close.length, type = i.pivotType || 'Classic';
  const P = new Array(n).fill(null), R1 = new Array(n).fill(null), R2 = new Array(n).fill(null), R3 = new Array(n).fill(null),
    S1 = new Array(n).fill(null), S2 = new Array(n).fill(null), S3 = new Array(n).fill(null);
  for (let k = 1; k < n; k++) {
    const lv = _pivotLevels(c.high[k - 1], c.low[k - 1], c.close[k - 1], k > 1 ? c.close[k - 2] : null, type);
    P[k] = lv.P; R1[k] = lv.r1; R2[k] = lv.r2; R3[k] = lv.r3; S1[k] = lv.s1; S2[k] = lv.s2; S3[k] = lv.s3;
  }
  return {
    lines: [
      { data: R3, color: '#dc2626', dashed: true, name: 'R3' },
      { data: R2, color: '#ef4444', dashed: true, name: 'R2' },
      { data: R1, color: '#f87171', dashed: true, name: 'R1' },
      { data: P, color: '#94a3b8', name: 'P' },
      { data: S1, color: '#4ade80', dashed: true, name: 'S1' },
      { data: S2, color: '#22c55e', dashed: true, name: 'S2' },
      { data: S3, color: '#16a34a', dashed: true, name: 'S3' },
    ],
  };
};

// 63) نقاطِ چرخشِ بالا/پایین (Pivot High/Low) → markers
const pivotHL = (c, i) => {
  const m = [];
  for (let k = i.left; k < c.high.length - i.right; k++) {
    let ph = true, pl = true;
    for (let j = 1; j <= i.left; j++) { if (c.high[k - j] >= c.high[k]) ph = false; if (c.low[k - j] <= c.low[k]) pl = false; }
    for (let j = 1; j <= i.right; j++) { if (c.high[k + j] >= c.high[k]) ph = false; if (c.low[k + j] <= c.low[k]) pl = false; }
    if (ph) m.push({ time: c.time[k], position: 'aboveBar', shape: 'arrowDown', color: _DN, text: 'H' });
    if (pl) m.push({ time: c.time[k], position: 'belowBar', shape: 'arrowUp', color: _UP, text: 'L' });
  }
  return { markers: m };
};

// 68) فرکتالِ ویلیامز (n=2): up اگر H بیشینهٔ ±n، down اگر L کمینهٔ ±n
const fractals = (c, i) => {
  const n2 = i.n || 2, m = [];
  for (let k = n2; k < c.high.length - n2; k++) {
    let up = true, dn = true;
    for (let j = 1; j <= n2; j++) {
      if (c.high[k - j] >= c.high[k] || c.high[k + j] >= c.high[k]) up = false;
      if (c.low[k - j] <= c.low[k] || c.low[k + j] <= c.low[k]) dn = false;
    }
    if (up) m.push({ time: c.time[k], position: 'aboveBar', shape: 'arrowDown', color: '#f59e0b', text: '▲' });
    if (dn) m.push({ time: c.time[k], position: 'belowBar', shape: 'arrowUp', color: '#3b82f6', text: '▼' });
  }
  return { markers: m };
};

// هستهٔ ZigZag: نقاطِ چرخش با حدِّ بازگشتِ dev٪ — خروجی: ایندکس‌های سوینگ
const _zigzagPivots = (highs, lows, devPct) => {
  const n = highs.length;
  if (n < 2) return [];
  const piv = []; // {idx, price, dir:1=قله، -1=دره}
  let lastIdx = 0, lastHigh = highs[0], lastLow = lows[0], dir = 0;
  const th = devPct / 100;
  for (let k = 1; k < n; k++) {
    if (dir >= 0) {
      // در جستجوی ادامهٔ قله یا چرخش به دره
      if (highs[k] > lastHigh) { lastHigh = highs[k]; lastIdx = k; }
      if (lows[k] < lastHigh * (1 - th)) {
        piv.push({ idx: lastIdx, price: lastHigh, dir: 1 });
        dir = -1; lastLow = lows[k]; lastIdx = k;
      }
    }
    if (dir <= 0) {
      if (lows[k] < lastLow) { lastLow = lows[k]; lastIdx = k; }
      if (highs[k] > lastLow * (1 + th)) {
        piv.push({ idx: lastIdx, price: lastLow, dir: -1 });
        dir = 1; lastHigh = highs[k]; lastIdx = k;
      }
    }
  }
  // آخرین سوینگِ (تأییدنشده) را هم اضافه کن
  piv.push({ idx: lastIdx, price: dir >= 0 ? lastHigh : lastLow, dir: dir >= 0 ? 1 : -1 });
  return piv;
};

// 64) ZigZag → خطِ شکسته (lines با نقاطِ سوینگ، بقیه null) + markers
const zigzag = (c, i) => {
  const piv = _zigzagPivots(c.high, c.low, i.dev);
  const line = new Array(c.close.length).fill(null);
  const m = [];
  for (const pv of piv) {
    line[pv.idx] = pv.price;
    m.push({ time: c.time[pv.idx], position: pv.dir === 1 ? 'aboveBar' : 'belowBar', shape: 'circle', color: pv.dir === 1 ? _DN : _UP });
  }
  return { lines: [{ data: line, color: i.color || '#f59e0b', connectNulls: true, name: 'ZigZag' }], markers: m };
};

// 65) فیبوناچیِ خودکار — آخرین لگِ ZigZag (A→B) → سطوحِ افقی levels
const autoFib = (c, i) => {
  const piv = _zigzagPivots(c.high, c.low, i.dev);
  if (piv.length < 2) return { levels: [] };
  const b = piv[piv.length - 1], a = piv[piv.length - 2];
  const lo = Math.min(a.price, b.price), hi = Math.max(a.price, b.price), rng = hi - lo;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const palette = ['#94a3b8', '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#94a3b8'];
  const up = b.price >= a.price; // جهتِ لگ
  const levels = ratios.map((r, idx) => ({
    price: up ? hi - rng * r : lo + rng * r,
    color: palette[idx],
    label: (r * 100).toFixed(1) + '٪',
    extendRight: true,
  }));
  return { levels };
};

// 66) حمایت/مقاومت — خوشه‌بندیِ پیووت‌های H/L در باندهای قیمتی (قدرت=تعدادِ تماس)
const srLevels = (c, i) => {
  const lb = i.lookback || 15, tolPct = (i.tol || 0.1) / 100;
  // ابتدا پیووت‌های فرکتالی را جمع کن
  const piv = [];
  for (let k = lb; k < c.high.length - lb; k++) {
    let ph = true, pl = true;
    for (let j = 1; j <= lb; j++) { if (c.high[k - j] >= c.high[k] || c.high[k + j] >= c.high[k]) ph = false; if (c.low[k - j] <= c.low[k] || c.low[k + j] <= c.low[k]) pl = false; }
    if (ph) piv.push(c.high[k]);
    if (pl) piv.push(c.low[k]);
  }
  // خوشه‌بندیِ سادهٔ مبتنی بر تلورانس
  piv.sort((a, b) => a - b);
  const clusters = [];
  for (const p of piv) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p - last.sum / last.count) <= (last.sum / last.count) * tolPct) { last.sum += p; last.count++; }
    else clusters.push({ sum: p, count: 1 });
  }
  // فقط خوشه‌های با ≥۲ تماس را نگه دار، قوی‌ترها پررنگ‌تر
  const levels = clusters.filter((cl) => cl.count >= 2).map((cl) => {
    const price = cl.sum / cl.count;
    return { price, color: cl.count >= 4 ? '#f59e0b' : cl.count >= 3 ? '#fbbf24' : '#94a3b8', label: 'S/R ×' + cl.count, extendRight: true };
  });
  return { levels };
};

// 67) نواحیِ عرضه/تقاضا — کندلِ پایه پیش از حرکتِ پرشتاب (impulse×ATR) → levels (مستطیلی)
const supplyDemand = (c, i) => {
  const a = _atr(c.high, c.low, c.close, i.atrLen || 14);
  const mult = i.impulse || 2;
  const levels = [];
  for (let k = 1; k < c.close.length - 1; k++) {
    if (a[k] == null) continue;
    const move = Math.abs(c.close[k + 1] - c.open[k + 1]);
    if (move >= mult * a[k]) {
      // کندلِ پایه = کندلِ k (پیش از ایمپالس)
      const up = c.close[k + 1] >= c.open[k + 1];
      levels.push({ price: c.high[k], color: up ? '#22c55e' : '#ef4444', label: up ? 'تقاضا' : 'عرضه', extendRight: true });
      levels.push({ price: c.low[k], color: up ? '#22c55e' : '#ef4444', label: '', extendRight: true });
    }
  }
  // فقط چند ناحیهٔ اخیر را نگه دار (تازگی)
  return { levels: levels.slice(-Math.max(2, (i.maxZones || 5) * 2)) };
};

// ───────────────────────────── رجیستریِ افزونه ─────────────────────────────
export const EXT_REGISTRY_B = {
  // — §5.2 مومنتوم / اسیلاتورها —
  mom:        { label: 'مومنتوم', pane: 'sub', inputs: { period: 10 }, color: '#60a5fa', calc: mom },
  roc:        { label: 'ROC (نرخِ تغییر)', pane: 'sub', inputs: { period: 9 }, color: '#f472b6', calc: roc },
  trix:       { label: 'TRIX', pane: 'sub', inputs: { period: 18, sig: 9 }, color: '#34d399', calc: trix },
  ac:         { label: 'شتاب‌دهنده (AC)', pane: 'sub', inputs: {}, color: '#22d3ee', calc: accelerator },
  uo:         { label: 'اسیلاتورِ غایی (UO)', pane: 'sub', inputs: { short: 7, mid: 14, long: 28 }, color: '#a78bfa', calc: ultimateOsc },
  fisher:     { label: 'تبدیلِ فیشر', pane: 'sub', inputs: { period: 9 }, color: '#fb923c', calc: fisher },
  crsi:       { label: 'Connors RSI', pane: 'sub', inputs: { rsiLen: 3, streakLen: 2, rankLen: 100 }, color: '#e879f9', calc: connorsRsi },
  smiErgodic: { label: 'SMI ارگودیک', pane: 'sub', inputs: { long: 20, short: 5, sig: 5 }, color: '#38bdf8', calc: smiErgodic },
  smi:        { label: 'شاخصِ مومنتومِ استوکاستیک', pane: 'sub', inputs: { period: 10, smoothK: 3, smoothD: 3 }, color: '#facc15', calc: smi },
  bop:        { label: 'توازنِ قدرت (BOP)', pane: 'sub', inputs: { smooth: 1 }, color: '#c084fc', calc: bop },

  // — §5.3 (مشتقاتِ بولینگر؛ بخشی از بستهٔ B) —
  bbpercent:  { label: 'باندِ بولینگر ٪B', pane: 'sub', inputs: { period: 20, mult: 2 }, color: '#22d3ee', calc: bbpercent },
  bbw:        { label: 'پهنای باندِ بولینگر', pane: 'sub', inputs: { period: 20, mult: 2 }, color: '#94a3b8', calc: bbw },

  // — §5.4 حجم —
  volume:     { label: 'حجم', pane: 'sub', inputs: { maLen: 20 }, color: '#26a69a', calc: volume },
  adline:     { label: 'تجمع/توزیع (A/D)', pane: 'sub', inputs: {}, color: '#0ea5e9', calc: adline },
  chaikinOsc: { label: 'اسیلاتورِ چایکین', pane: 'sub', inputs: { fast: 3, slow: 10 }, color: '#f97316', calc: chaikinOsc },
  eom:        { label: 'سهولتِ حرکت (EoM)', pane: 'sub', inputs: { period: 14, scale: 100000000 }, color: '#84cc16', calc: eom },
  forceIndex: { label: 'شاخصِ نیرو (Force Index)', pane: 'sub', inputs: { period: 13 }, color: '#fb7185', calc: forceIndex },
  klinger:    { label: 'اسیلاتورِ کلینگر', pane: 'sub', inputs: { fast: 34, slow: 55, sig: 13 }, color: '#a855f7', calc: klinger },
  pvt:        { label: 'روندِ قیمت-حجم (PVT)', pane: 'sub', inputs: {}, color: '#10b981', calc: pvt },

  // — §5.5 پیووت / ساختار —
  pivotsMulti: { label: 'پیووت (چندنوعه)', pane: 'main', inputs: { pivotType: 'Classic' }, color: '#94a3b8', calc: pivotsMulti },
  pivotHL:     { label: 'نقاطِ چرخش بالا/پایین', pane: 'main', inputs: { left: 5, right: 5 }, color: '#f59e0b', calc: pivotHL },
  fractals:    { label: 'فرکتالِ ویلیامز', pane: 'main', inputs: { n: 2 }, color: '#f59e0b', calc: fractals },
  zigzag:      { label: 'زیگزاگ (ZigZag)', pane: 'main', inputs: { dev: 5 }, color: '#f59e0b', calc: zigzag },
  autoFib:     { label: 'فیبوناچیِ خودکار', pane: 'main', inputs: { dev: 5 }, color: '#22d3ee', calc: autoFib },
  srLevels:    { label: 'حمایت/مقاومت', pane: 'main', inputs: { lookback: 15, tol: 0.1 }, color: '#f59e0b', calc: srLevels },
  supplyDemand:{ label: 'نواحیِ عرضه/تقاضا', pane: 'main', inputs: { impulse: 2, atrLen: 14, maxZones: 5 }, color: '#22c55e', calc: supplyDemand },
};

export default EXT_REGISTRY_B;
