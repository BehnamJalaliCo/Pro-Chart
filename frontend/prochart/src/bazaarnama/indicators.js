// بازارنما — کتابخانهٔ اندیکاتورهای سمتِ کلاینت (سری‌محور، آرایه‌ها هم‌طولِ کندل‌ها).
// ورودی: closes/highs/lows/... آرایهٔ عدد. خروجی: آرایهٔ عدد یا null (دورهٔ گرم‌شدن).

// افزونه‌های فصل ۵ (PRO_CHART_BUILD_SPEC) — ماژول‌های drop-in، در انتهای فایل با REGISTRY ادغام می‌شوند.
import { EXT_REGISTRY_A } from './indicators_ext_a';
import { EXT_REGISTRY_B } from './indicators_ext_b';

export const sma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= p) sum -= src[i - p];
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
};

export const ema = (src, p) => {
  const out = new Array(src.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    prev = prev == null ? v : v * k + prev * (1 - k);
    if (i >= p - 1) out[i] = prev;
  }
  return out;
};

export const wma = (src, p) => {
  const out = new Array(src.length).fill(null);
  const denom = (p * (p + 1)) / 2;
  for (let i = p - 1; i < src.length; i++) {
    let s = 0;
    for (let j = 0; j < p; j++) s += src[i - j] * (p - j);
    out[i] = s / denom;
  }
  return out;
};

// HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
export const hma = (src, p) => {
  const half = Math.max(1, Math.floor(p / 2));
  const sq = Math.max(1, Math.round(Math.sqrt(p)));
  const w1 = wma(src, half);
  const w2 = wma(src, p);
  const diff = src.map((_, i) => (w1[i] != null && w2[i] != null ? 2 * w1[i] - w2[i] : null));
  const filled = diff.map((v) => (v == null ? 0 : v));
  const h = wma(filled, sq);
  return h.map((v, i) => (diff[i] == null ? null : v));
};

export const rsi = (closes, p = 14) => {
  const out = new Array(closes.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= p) { ag += g; al += l; if (i === p) { ag /= p; al /= p; out[i] = 100 - 100 / (1 + ag / (al || 1e-9)); } }
    else { ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p; out[i] = 100 - 100 / (1 + ag / (al || 1e-9)); }
  }
  return out;
};

export const macd = (closes, fast = 12, slow = 26, sig = 9) => {
  const ef = ema(closes, fast), es = ema(closes, slow);
  const line = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const signal = ema(line.map((v) => (v == null ? 0 : v)), sig).map((v, i) => (line[i] == null ? null : v));
  const hist = line.map((v, i) => (v != null && signal[i] != null ? v - signal[i] : null));
  return { macd: line, signal, hist };
};

export const bollinger = (closes, p = 20, mult = 2) => {
  const basis = sma(closes, p);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let s = 0; for (let j = 0; j < p; j++) { const d = closes[i - j] - basis[i]; s += d * d; }
    const sd = Math.sqrt(s / p);
    upper[i] = basis[i] + mult * sd; lower[i] = basis[i] - mult * sd;
  }
  return { basis, upper, lower };
};

export const atr = (highs, lows, closes, p = 14) => {
  const tr = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { tr[i] = highs[i] - lows[i]; continue; }
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const out = new Array(closes.length).fill(null);
  let prev = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < p) { if (i === p - 1) { let s = 0; for (let j = 0; j < p; j++) s += tr[j]; prev = s / p; out[i] = prev; } continue; }
    prev = (prev * (p - 1) + tr[i]) / p; out[i] = prev;
  }
  return out;
};

export const stoch = (highs, lows, closes, p = 14, d = 3) => {
  const k = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) { hh = Math.max(hh, highs[i - j]); ll = Math.min(ll, lows[i - j]); }
    k[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  const dd = sma(k.map((v) => (v == null ? 0 : v)), d).map((v, i) => (k[i] == null ? null : v));
  return { k, d: dd };
};

// VWAP — پیش‌فرضِ TradingView سشن‌محور است (هر سشنِ معاملاتی/روز ریست می‌شود).
// اگر آرایهٔ times (یونیکس‌ثانیه) داده شود، با تغییرِ روزِ UTC انباشت ریست می‌گردد؛
// بدونِ times رفتارِ تجمعیِ قبلی حفظ می‌شود (سازگاریِ عقب‌رو).
export const vwap = (highs, lows, closes, vols, times) => {
  const out = new Array(closes.length).fill(null);
  let pv = 0, vv = 0, prevDay = null;
  for (let i = 0; i < closes.length; i++) {
    if (times && times[i] != null) {
      const day = Math.floor(times[i] / 86400); // سطلِ روزِ UTC
      if (prevDay !== null && day !== prevDay) { pv = 0; vv = 0; } // سشنِ جدید → ریست
      prevDay = day;
    }
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    pv += tp * (vols[i] || 0); vv += vols[i] || 0;
    out[i] = vv ? pv / vv : closes[i];
  }
  return out;
};

// Anchored VWAP — VWAP از anchorِ N کندلِ پیش + باندهای انحرافِ معیار (±mult·σ) — نسخهٔ مؤسساتی
export const avwap = (highs, lows, closes, vols, anchorBars = 100, mult = 1) => {
  const n = closes.length;
  const out = new Array(n).fill(null), up = new Array(n).fill(null), dn = new Array(n).fill(null);
  const start = Math.max(0, n - (anchorBars || n));
  let pv = 0, vv = 0, pv2 = 0;
  for (let i = start; i < n; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const v = vols[i] || 0;
    pv += tp * v; vv += v; pv2 += tp * tp * v;
    const vw = vv ? pv / vv : closes[i];
    out[i] = vw;
    const variance = vv ? Math.max(0, pv2 / vv - vw * vw) : 0;
    const sd = Math.sqrt(variance);
    up[i] = vw + (mult || 1) * sd; dn[i] = vw - (mult || 1) * sd;
  }
  return { vwap: out, upper: up, lower: dn };
};

// ── اندیکاتورهای افزوده (پاریتیِ TradingView) ──
const _trueRange = (h, l, c) => { const n = c.length, tr = new Array(n).fill(null); for (let i = 0; i < n; i++) { if (i === 0) { tr[i] = h[i] - l[i]; continue; } tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])); } return tr; };
const _sma = (arr, p) => { const n = arr.length, out = new Array(n).fill(null); let s = 0; for (let i = 0; i < n; i++) { s += arr[i] || 0; if (i >= p) s -= arr[i - p] || 0; if (i >= p - 1) out[i] = s / p; } return out; };

// Choppiness Index (0..100): >61.8 رنج، <38.2 ترند
export const choppiness = (h, l, c, p = 14) => {
  const n = c.length, tr = _trueRange(h, l, c), out = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let atrSum = 0, hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) { atrSum += tr[j] || 0; hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
    const rng = hh - ll;
    out[i] = rng > 0 ? 100 * Math.log10(atrSum / rng) / Math.log10(p) : null;
  }
  return out;
};
// Vortex Indicator → {plus, minus}
export const vortex = (h, l, c, p = 14) => {
  const n = c.length, tr = _trueRange(h, l, c), vmP = new Array(n).fill(0), vmM = new Array(n).fill(0);
  for (let i = 1; i < n; i++) { vmP[i] = Math.abs(h[i] - l[i - 1]); vmM[i] = Math.abs(l[i] - h[i - 1]); }
  const plus = new Array(n).fill(null), minus = new Array(n).fill(null);
  for (let i = p; i < n; i++) {
    let sTR = 0, sP = 0, sM = 0;
    for (let j = i - p + 1; j <= i; j++) { sTR += tr[j] || 0; sP += vmP[j]; sM += vmM[j]; }
    if (sTR > 0) { plus[i] = sP / sTR; minus[i] = sM / sTR; }
  }
  return { plus, minus };
};
// Detrended Price Oscillator
export const dpo = (c, p = 20) => { const sma = _sma(c, p), n = c.length, out = new Array(n).fill(null), k = Math.floor(p / 2) + 1; for (let i = 0; i < n; i++) { if (sma[i] != null && i - k >= 0) out[i] = c[i] - sma[i]; } return out; };
// Balance of Power
export const bop = (o, h, l, c) => c.map((cl, i) => { const rng = h[i] - l[i]; return rng > 0 ? (cl - o[i]) / rng : 0; });
// Ease of Movement
export const eom = (h, l, vol, p = 14) => {
  const n = h.length, raw = new Array(n).fill(null);
  for (let i = 1; i < n; i++) { const dm = (h[i] + l[i]) / 2 - (h[i - 1] + l[i - 1]) / 2; const br = (vol[i] || 1) / 100000000 / Math.max(h[i] - l[i], 1e-9); raw[i] = br > 0 ? dm / br : 0; }
  return _sma(raw.map((x) => x == null ? 0 : x), p);
};

const _ema2 = (arr, p) => { const n = arr.length, out = new Array(n).fill(null), k = 2 / (p + 1); let prev = null; for (let i = 0; i < n; i++) { const v = arr[i]; if (v == null) { out[i] = prev; continue; } prev = prev == null ? v : v * k + prev * (1 - k); out[i] = prev; } return out; };
const _wma2 = (arr, p) => { const n = arr.length, out = new Array(n).fill(null), dw = p * (p + 1) / 2; for (let i = p - 1; i < n; i++) { let s = 0, ok = true; for (let j = 0; j < p; j++) { const v = arr[i - j]; if (v == null) { ok = false; break; } s += v * (p - j); } if (ok) out[i] = s / dw; } return out; };
const _roc2 = (arr, p) => arr.map((v, i) => (i >= p && arr[i - p]) ? (v - arr[i - p]) / arr[i - p] * 100 : null);
const _smma2 = (arr, p) => { const n = arr.length, out = new Array(n).fill(null); let prev = null; for (let i = 0; i < n; i++) { const v = arr[i]; if (v == null) { out[i] = prev; continue; } if (prev == null) { if (i >= p - 1) { let s = 0; for (let j = 0; j < p; j++) s += arr[i - j]; prev = s / p; out[i] = prev; } } else { prev = (prev * (p - 1) + v) / p; out[i] = prev; } } return out; };

export const elderRay = (h, l, c, p = 13) => { const e = _ema2(c, p); return { bull: h.map((x, i) => e[i] == null ? null : x - e[i]), bear: l.map((x, i) => e[i] == null ? null : x - e[i]) }; };
export const chandeKroll = (h, l, c, p = 10, x = 1, q = 9) => { const atrv = _sma(_trueRange(h, l, c), p); const n = c.length, hs = new Array(n).fill(null), ls = new Array(n).fill(null); for (let i = p - 1; i < n; i++) { let hh = -Infinity, ll = Infinity; for (let j = i - p + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); } hs[i] = hh - x * (atrv[i] || 0); ls[i] = ll + x * (atrv[i] || 0); } const hf = new Array(n).fill(null), lf = new Array(n).fill(null); for (let i = q - 1; i < n; i++) { let hh = -Infinity, ll = Infinity; for (let j = i - q + 1; j <= i; j++) { if (hs[j] != null) hh = Math.max(hh, hs[j]); if (ls[j] != null) ll = Math.min(ll, ls[j]); } hf[i] = hh === -Infinity ? null : hh; lf[i] = ll === Infinity ? null : ll; } return { high: hf, low: lf }; };
export const massIndex = (h, l, p = 9, sum = 25) => { const n = h.length, range = h.map((x, i) => x - l[i]); const e1 = _ema2(range, p), e2 = _ema2(e1, p); const ratio = e1.map((x, i) => (x != null && e2[i]) ? x / e2[i] : null); const out = new Array(n).fill(null); for (let i = sum - 1; i < n; i++) { let s = 0, ok = true; for (let j = 0; j < sum; j++) { const v = ratio[i - j]; if (v == null) { ok = false; break; } s += v; } if (ok) out[i] = s; } return out; };
export const coppock = (c, a = 14, b = 11, w = 10) => { const r = _roc2(c, a), r2 = _roc2(c, b); const sum = r.map((x, i) => (x != null && r2[i] != null) ? x + r2[i] : null); return _wma2(sum, w); };
export const kst = (c) => { const r1 = _sma(_roc2(c, 10), 10), r2 = _sma(_roc2(c, 15), 10), r3 = _sma(_roc2(c, 20), 10), r4 = _sma(_roc2(c, 30), 15); const n = c.length, line = new Array(n).fill(null); for (let i = 0; i < n; i++) { if (r1[i] != null && r2[i] != null && r3[i] != null && r4[i] != null) line[i] = r1[i] + 2 * r2[i] + 3 * r3[i] + 4 * r4[i]; } return { line, signal: _sma(line.map((x) => x == null ? 0 : x), 9) }; };
export const alligator = (h, l) => { const med = h.map((x, i) => (x + l[i]) / 2); return { jaw: _smma2(med, 13), teeth: _smma2(med, 8), lips: _smma2(med, 5) }; };
export const rvi = (o, h, l, c) => { const n = c.length, co = c.map((x, i) => x - o[i]), hl = h.map((x, i) => x - l[i]); const swma = (a) => { const out = new Array(n).fill(null); for (let i = 3; i < n; i++) { if ([a[i], a[i - 1], a[i - 2], a[i - 3]].some((v) => v == null)) continue; out[i] = (a[i] + 2 * a[i - 1] + 2 * a[i - 2] + a[i - 3]) / 6; } return out; }; const num = swma(co), den = swma(hl); const line = num.map((x, i) => (x != null && den[i]) ? x / den[i] : null); const sig = new Array(n).fill(null); for (let i = 3; i < n; i++) { if ([line[i], line[i - 1], line[i - 2], line[i - 3]].some((v) => v == null)) continue; sig[i] = (line[i] + 2 * line[i - 1] + 2 * line[i - 2] + line[i - 3]) / 6; } return { line, signal: sig }; };
export const bbWidth = (c, p = 20, mult = 2) => { const ma = _sma(c, p), n = c.length, out = new Array(n).fill(null); for (let i = p - 1; i < n; i++) { let s = 0; for (let j = 0; j < p; j++) { const d = c[i - j] - ma[i]; s += d * d; } const sd = Math.sqrt(s / p); out[i] = ma[i] ? (2 * mult * sd) / ma[i] * 100 : null; } return out; };
export const stc = (c, fast = 23, slow = 50, cycle = 10) => { const ef = _ema2(c, fast), es = _ema2(c, slow); const macd = ef.map((x, i) => (x != null && es[i] != null) ? x - es[i] : null); const n = c.length; const stoch = (src, p) => { const out = new Array(n).fill(null); for (let i = p - 1; i < n; i++) { let hh = -Infinity, ll = Infinity, ok = true; for (let j = 0; j < p; j++) { const v = src[i - j]; if (v == null) { ok = false; break; } hh = Math.max(hh, v); ll = Math.min(ll, v); } if (ok) out[i] = hh > ll ? (src[i] - ll) / (hh - ll) * 100 : 0; } return out; }; const d1 = _ema2(stoch(macd, cycle), 3); const d2 = _ema2(stoch(d1, cycle), 3); return d2; };
export const netVolume = (o, c, v) => c.map((cl, i) => (v[i] || 0) * (cl >= o[i] ? 1 : -1));
export const stdErrBands = (c, p = 21, mult = 2) => { const n = c.length, mid = new Array(n).fill(null), up = new Array(n).fill(null), dn = new Array(n).fill(null); for (let i = p - 1; i < n; i++) { let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let j = 0; j < p; j++) { const x = j, y = c[i - p + 1 + j]; sx += x; sy += y; sxx += x * x; sxy += x * y; } const b = (p * sxy - sx * sy) / (p * sxx - sx * sx || 1); const a = (sy - b * sx) / p; const yhat = a + b * (p - 1); let se = 0; for (let j = 0; j < p; j++) { const x = j, y = c[i - p + 1 + j]; const e = y - (a + b * x); se += e * e; } const stderr = Math.sqrt(se / Math.max(1, p - 2)); mid[i] = yhat; up[i] = yhat + mult * stderr; dn[i] = yhat - mult * stderr; } return { mid, up, dn }; };
export const accelerator = (h, l) => { const med = h.map((x, i) => (x + l[i]) / 2); const ao = _sma(med, 5).map((v, i) => (v != null && _sma(med, 34)[i] != null) ? v - _sma(med, 34)[i] : null); return ao.map((v, i) => (v != null && _sma(ao.map((x) => x == null ? 0 : x), 5)[i] != null) ? v - _sma(ao.map((x) => x == null ? 0 : x), 5)[i] : null); };
export const chaikinVol = (h, l, p = 10) => { const hl = h.map((x, i) => x - l[i]); const e = _ema2(hl, p); return e.map((v, i) => (v != null && e[i - p] != null && e[i - p] !== 0) ? (v - e[i - p]) / e[i - p] * 100 : null); };
// MTF: resampleِ کندل‌های موجود به تایم‌فریمِ بالاتر (factor)، محاسبه، و گسترشِ مقادیر به طولِ اصلی
const _resampleC = (c, f) => { f = Math.max(1, f | 0); const o = [], h = [], l = [], cl = [], v = []; for (let i = 0; i < c.close.length; i += f) { const end = Math.min(i + f, c.close.length); let mh = -Infinity, ml = Infinity, sv = 0; for (let j = i; j < end; j++) { if (c.high[j] > mh) mh = c.high[j]; if (c.low[j] < ml) ml = c.low[j]; sv += c.volume[j] || 0; } o.push(c.open[i]); h.push(mh); l.push(ml); cl.push(c.close[end - 1]); v.push(sv); } return { open: o, high: h, low: l, close: cl, volume: v }; };
const _expandA = (arr, f, len) => { f = Math.max(1, f | 0); const out = new Array(len).fill(null); for (let i = 0; i < arr.length; i++) { for (let j = 0; j < f; j++) { const idx = i * f + j; if (idx < len) out[idx] = arr[i]; } } return out; };

// SuperTrend → { trend:[-1/1], line:[price] }
export const supertrend = (highs, lows, closes, p = 10, mult = 3) => {
  const a = atr(highs, lows, closes, p);
  const line = new Array(closes.length).fill(null);
  const trend = new Array(closes.length).fill(null);
  let up = null, dn = null, dir = 1;
  for (let i = 0; i < closes.length; i++) {
    if (a[i] == null) continue;
    const mid = (highs[i] + lows[i]) / 2;
    let ub = mid + mult * a[i], lb = mid - mult * a[i];
    if (up != null) ub = closes[i - 1] > up ? Math.max(ub, up) : ub;
    if (dn != null) lb = closes[i - 1] < dn ? Math.min(lb, dn) : lb;
    if (dir === 1 && closes[i] < (dn ?? lb)) dir = -1;
    else if (dir === -1 && closes[i] > (up ?? ub)) dir = 1;
    up = ub; dn = lb;
    trend[i] = dir; line[i] = dir === 1 ? lb : ub;
  }
  return { trend, line };
};

// CCI
export const cci = (highs, lows, closes, p = 20) => {
  const tp = closes.map((_, i) => (highs[i] + lows[i] + closes[i]) / 3);
  const m = sma(tp, p);
  const out = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let md = 0; for (let j = 0; j < p; j++) md += Math.abs(tp[i - j] - m[i]);
    md /= p; out[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0;
  }
  return out;
};

// Williams %R
export const williamsR = (highs, lows, closes, p = 14) => {
  const out = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) { hh = Math.max(hh, highs[i - j]); ll = Math.min(ll, lows[i - j]); }
    out[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return out;
};

// OBV
export const obv = (closes, vols) => {
  const out = new Array(closes.length).fill(null);
  let v = 0; out[0] = 0;
  for (let i = 1; i < closes.length; i++) { v += closes[i] > closes[i - 1] ? (vols[i] || 0) : closes[i] < closes[i - 1] ? -(vols[i] || 0) : 0; out[i] = v; }
  return out;
};

// Ichimoku → چند خط
export const ichimoku = (highs, lows, closes, t = 9, k = 26, b = 52) => {
  const mid = (p) => highs.map((_, i) => {
    if (i < p - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) { hh = Math.max(hh, highs[i - j]); ll = Math.min(ll, lows[i - j]); }
    return (hh + ll) / 2;
  });
  const tenkan = mid(t), kijun = mid(k), b52 = mid(b);
  const spanA = tenkan.map((v, i) => (v != null && kijun[i] != null ? (v + kijun[i]) / 2 : null));
  return { tenkan, kijun, spanA, spanB: b52 };
};

// Donchian channel
export const donchian = (highs, lows, p = 20) => {
  const up = new Array(highs.length).fill(null), lo = new Array(highs.length).fill(null), mid = new Array(highs.length).fill(null);
  for (let i = p - 1; i < highs.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) { hh = Math.max(hh, highs[i - j]); ll = Math.min(ll, lows[i - j]); }
    up[i] = hh; lo[i] = ll; mid[i] = (hh + ll) / 2;
  }
  return { upper: up, basis: mid, lower: lo };
};

// Keltner channel
export const keltner = (highs, lows, closes, p = 20, mult = 2) => {
  const basis = ema(closes, p), a = atr(highs, lows, closes, 10);
  return { basis, upper: basis.map((v, i) => (v != null && a[i] != null ? v + mult * a[i] : null)), lower: basis.map((v, i) => (v != null && a[i] != null ? v - mult * a[i] : null)) };
};

// ADX
export const adx = (highs, lows, closes, p = 14) => {
  const n = closes.length, tr = new Array(n).fill(0), pdm = new Array(n).fill(0), ndm = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    pdm[i] = up > dn && up > 0 ? up : 0; ndm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const sm = (a) => { const o = new Array(n).fill(null); let s = 0; for (let i = 1; i <= p; i++) s += a[i]; o[p] = s; for (let i = p + 1; i < n; i++) { s = s - s / p + a[i]; o[i] = s; } return o; };
  const str = sm(tr), spd = sm(pdm), snd = sm(ndm), out = new Array(n).fill(null);
  let adxPrev = null, dxs = [];
  for (let i = p; i < n; i++) {
    if (str[i] == null || !str[i]) continue;
    const pdi = 100 * spd[i] / str[i], ndi = 100 * snd[i] / str[i];
    const dx = (pdi + ndi) ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    dxs.push(dx);
    if (dxs.length === p) { adxPrev = dxs.reduce((x, y) => x + y, 0) / p; out[i] = adxPrev; }
    else if (adxPrev != null) { adxPrev = (adxPrev * (p - 1) + dx) / p; out[i] = adxPrev; }
  }
  return out;
};

// DEMA / TEMA
export const dema = (closes, p = 20) => { const e = ema(closes, p), e2 = ema(e.map((v) => (v == null ? 0 : v)), p); return closes.map((_, i) => (e[i] != null && e2[i] != null ? 2 * e[i] - e2[i] : null)); };
export const tema = (closes, p = 20) => { const e1 = ema(closes, p), e2 = ema(e1.map((v) => (v == null ? 0 : v)), p), e3 = ema(e2.map((v) => (v == null ? 0 : v)), p); return closes.map((_, i) => (e1[i] != null && e2[i] != null && e3[i] != null ? 3 * e1[i] - 3 * e2[i] + e3[i] : null)); };

// VWMA
export const vwma = (closes, vols, p = 20) => { const pv = closes.map((c, i) => c * (vols[i] || 0)); const spv = sma(pv, p), sv = sma(vols.map((v) => v || 0), p); return closes.map((_, i) => (spv[i] != null && sv[i] ? spv[i] / sv[i] : null)); };

// Parabolic SAR
export const psar = (highs, lows, start = 0.02, inc = 0.02, max = 0.2) => {
  const n = highs.length, out = new Array(n).fill(null);
  let trend = 1, af = start, ep = highs[0], sar = lows[0];
  for (let i = 1; i < n; i++) {
    sar = sar + af * (ep - sar);
    if (trend > 0) { if (lows[i] < sar) { trend = -1; sar = ep; ep = lows[i]; af = start; } else if (highs[i] > ep) { ep = highs[i]; af = Math.min(max, af + inc); } }
    else { if (highs[i] > sar) { trend = 1; sar = ep; ep = highs[i]; af = start; } else if (lows[i] < ep) { ep = lows[i]; af = Math.min(max, af + inc); } }
    out[i] = sar;
  }
  return out;
};

// Aroon → { up, down }
export const aroon = (highs, lows, p = 14) => {
  const up = new Array(highs.length).fill(null), down = new Array(highs.length).fill(null);
  for (let i = p; i < highs.length; i++) {
    let hi = -Infinity, lo = Infinity, hb = 0, lb = 0;
    for (let j = 0; j <= p; j++) { if (highs[i - j] > hi) { hi = highs[i - j]; hb = j; } if (lows[i - j] < lo) { lo = lows[i - j]; lb = j; } }
    up[i] = 100 * (p - hb) / p; down[i] = 100 * (p - lb) / p;
  }
  return { up, down };
};

// MFI
export const mfi = (highs, lows, closes, vols, p = 14) => {
  const n = closes.length, tp = new Array(n), pos = new Array(n).fill(0), neg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { tp[i] = (highs[i] + lows[i] + closes[i]) / 3; const rmf = tp[i] * (vols[i] || 0); if (i > 0) { if (tp[i] > tp[i - 1]) pos[i] = rmf; else if (tp[i] < tp[i - 1]) neg[i] = rmf; } }
  const sp = sma(pos, p).map((v) => (v == null ? null : v * p)), sn = sma(neg, p).map((v) => (v == null ? null : v * p));
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (sp[i] != null) out[i] = sn[i] ? 100 - 100 / (1 + sp[i] / sn[i]) : 100;
  return out;
};

// CMF
export const cmf = (highs, lows, closes, vols, p = 20) => {
  const n = closes.length, mfv = new Array(n);
  for (let i = 0; i < n; i++) { const rng = highs[i] - lows[i]; mfv[i] = (rng ? ((closes[i] - lows[i]) - (highs[i] - closes[i])) / rng : 0) * (vols[i] || 0); }
  const sm = sma(mfv, p).map((v) => (v == null ? null : v * p)), sv = sma(vols.map((v) => v || 0), p).map((v) => (v == null ? null : v * p));
  return closes.map((_, i) => (sm[i] != null && sv[i] ? sm[i] / sv[i] : null));
};

// Stochastic RSI → { k, d }
export const stochRsi = (closes, p = 14, k = 3, d = 3) => {
  const r = rsi(closes, p), n = closes.length, raw = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) { let hh = -Infinity, ll = Infinity, ok = 0; for (let j = 0; j < p; j++) { const v = r[i - j]; if (v == null) continue; ok = 1; hh = Math.max(hh, v); ll = Math.min(ll, v); } if (ok && r[i] != null) raw[i] = hh === ll ? 0 : 100 * (r[i] - ll) / (hh - ll); }
  const ks = sma(raw.map((v) => (v == null ? 0 : v)), k).map((v, i) => (raw[i] == null ? null : v));
  const ds = sma(ks.map((v) => (v == null ? 0 : v)), d).map((v, i) => (ks[i] == null ? null : v));
  return { k: ks, d: ds };
};

// Awesome Oscillator
export const ao = (highs, lows) => { const mp = highs.map((_, i) => (highs[i] + lows[i]) / 2); const f = sma(mp, 5), s = sma(mp, 34); return mp.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null)); };

// TSI
export const tsi = (closes, short = 13, long = 25) => {
  const n = closes.length, m = new Array(n).fill(0), am = new Array(n).fill(0);
  for (let i = 1; i < n; i++) { m[i] = closes[i] - closes[i - 1]; am[i] = Math.abs(m[i]); }
  const dbl = ema(ema(m, long), short), adbl = ema(ema(am, long), short);
  return closes.map((_, i) => (dbl[i] != null && adbl[i] ? 100 * dbl[i] / adbl[i] : null));
};

// CMO
export const cmo = (closes, p = 9) => {
  const n = closes.length, up = new Array(n).fill(0), dn = new Array(n).fill(0);
  for (let i = 1; i < n; i++) { const ch = closes[i] - closes[i - 1]; if (ch > 0) up[i] = ch; else dn[i] = -ch; }
  const su = sma(up, p).map((v) => (v == null ? null : v * p)), sd = sma(dn, p).map((v) => (v == null ? null : v * p));
  return closes.map((_, i) => { if (su[i] == null) return null; const t = su[i] + sd[i]; return t ? 100 * (su[i] - sd[i]) / t : 0; });
};

// Pivot Points (کلاسیک، چرخشی روی کندلِ قبل) → P/R1/R2/S1/S2
export const pivots = (highs, lows, closes) => {
  const n = closes.length, p = new Array(n).fill(null), r1 = new Array(n).fill(null), r2 = new Array(n).fill(null), s1 = new Array(n).fill(null), s2 = new Array(n).fill(null);
  for (let i = 1; i < n; i++) { const pp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3; p[i] = pp; r1[i] = 2 * pp - lows[i - 1]; s1[i] = 2 * pp - highs[i - 1]; r2[i] = pp + (highs[i - 1] - lows[i - 1]); s2[i] = pp - (highs[i - 1] - lows[i - 1]); }
  return { p, r1, r2, s1, s2 };
};

// ALMA — میانگینِ گاوسیِ آرنو لِگو (offset 0..1 محلِ قله، sigma هموارسازی)
export const alma = (src, p = 9, offset = 0.85, sigma = 6) => {
  const n = src.length, out = new Array(n).fill(null);
  const m = offset * (p - 1), s = p / sigma || 1e-9;
  const w = new Array(p); let wsum = 0;
  for (let j = 0; j < p; j++) { w[j] = Math.exp(-((j - m) * (j - m)) / (2 * s * s)); wsum += w[j]; }
  for (let i = p - 1; i < n; i++) {
    let acc = 0, ok = true;
    for (let j = 0; j < p; j++) { const v = src[i - (p - 1) + j]; if (v == null) { ok = false; break; } acc += v * w[j]; }
    out[i] = ok && wsum ? acc / wsum : null;
  }
  return out;
};

// MA Ribbon — نوارِ چند میانگینِ متحرک (base، گام step، تعداد count؛ SMA یا EMA)
export const maRibbon = (src, base = 20, step = 10, count = 6, type = 'sma') => {
  const fn = type === 'ema' ? ema : sma;
  const out = [];
  for (let k = 0; k < count; k++) out.push(fn(src, Math.max(1, base + k * step)));
  return out;
};

// GMMA — گاپیِ چندمیانگینِ متحرک: گروهِ کوتاه‌مدت {3,5,8,10,12,15} + بلندمدت {30,35,40,45,50,60}
export const gmma = (src) => {
  const shortL = [3, 5, 8, 10, 12, 15], longL = [30, 35, 40, 45, 50, 60];
  return { short: shortL.map((p) => ema(src, p)), long: longL.map((p) => ema(src, p)) };
};

// رجیستریِ اندیکاتورها (برای UI). pane: 'main' (اورلی) یا 'sub'.
export const REGISTRY = {
  ma:   { label: 'میانگین متحرک (MA)', pane: 'main', inputs: { period: 20 }, color: '#60a5fa', calc: (c, i) => ({ line: sma(c.close, i.period) }) },
  ema:  { label: 'EMA', pane: 'main', inputs: { period: 20 }, color: '#f59e0b', calc: (c, i) => ({ line: ema(c.close, i.period) }) },
  wma:  { label: 'WMA', pane: 'main', inputs: { period: 20 }, color: '#a78bfa', calc: (c, i) => ({ line: wma(c.close, i.period) }) },
  hma:  { label: 'HMA (هال)', pane: 'main', inputs: { period: 21 }, color: '#22d3ee', calc: (c, i) => ({ line: hma(c.close, i.period) }) },
  vwap: { label: 'VWAP (سشن‌محور)', pane: 'main', inputs: {}, color: '#e879f9', calc: (c) => ({ line: vwap(c.high, c.low, c.close, c.volume, c.time) }) },
  avwap: { label: 'VWAP لنگرانداخته (±σ)', pane: 'main', inputs: { anchorBars: 100, mult: 1 }, color: '#e879f9', calc: (c, i) => { const r = avwap(c.high, c.low, c.close, c.volume, i.anchorBars, i.mult); return { lines: [{ data: r.vwap, color: '#e879f9' }, { data: r.upper, color: '#a855f7', dashed: true }, { data: r.lower, color: '#a855f7', dashed: true }] }; } },
  choppiness: { label: 'شاخصِ چاپینس', pane: 'sub', inputs: { period: 14 }, color: '#94a3b8', calc: (c, i) => ({ line: choppiness(c.high, c.low, c.close, i.period), guides: [61.8, 38.2] }) },
  vortex: { label: 'وُرتکس (VI±)', pane: 'sub', inputs: { period: 14 }, color: '#22c55e', calc: (c, i) => { const r = vortex(c.high, c.low, c.close, i.period); return { line: r.plus, signal: r.minus }; } },
  dpo: { label: 'DPO', pane: 'sub', inputs: { period: 20 }, color: '#f59e0b', calc: (c, i) => ({ line: dpo(c.close, i.period), guides: [0] }) },
  bop: { label: 'موازنهٔ قدرت (BOP)', pane: 'sub', inputs: {}, color: '#8b5cf6', calc: (c) => ({ line: bop(c.open, c.high, c.low, c.close), guides: [0] }) },
  eom: { label: 'سهولتِ حرکت (EOM)', pane: 'sub', inputs: { period: 14 }, color: '#06b6d4', calc: (c, i) => ({ line: eom(c.high, c.low, c.volume, i.period), guides: [0] }) },
  elderRay: { label: 'اِلدر ری (قدرتِ گاو/خرس)', pane: 'sub', inputs: { period: 13 }, color: '#22c55e', calc: (c, i) => { const r = elderRay(c.high, c.low, c.close, i.period); return { line: r.bull, signal: r.bear, guides: [0] }; } },
  chandeKroll: { label: 'استاپِ چاند کرول', pane: 'main', inputs: { p: 10, x: 1, q: 9 }, color: '#ef4444', calc: (c, i) => { const r = chandeKroll(c.high, c.low, c.close, i.p, i.x, i.q); return { lines: [{ data: r.high, color: '#ef4444' }, { data: r.low, color: '#22c55e' }] }; } },
  massIndex: { label: 'شاخصِ توده', pane: 'sub', inputs: { period: 9, sum: 25 }, color: '#f59e0b', calc: (c, i) => ({ line: massIndex(c.high, c.low, i.period, i.sum), guides: [27, 26.5] }) },
  coppock: { label: 'منحنیِ کاپاک', pane: 'sub', inputs: {}, color: '#8b5cf6', calc: (c) => ({ line: coppock(c.close), guides: [0] }) },
  kst: { label: 'KST', pane: 'sub', inputs: {}, color: '#06b6d4', calc: (c) => { const r = kst(c.close); return { line: r.line, signal: r.signal, guides: [0] }; } },
  alligator: { label: 'تمساحِ ویلیامز', pane: 'main', inputs: {}, color: '#3b82f6', calc: (c) => { const r = alligator(c.high, c.low); return { lines: [{ data: r.jaw, color: '#3b82f6' }, { data: r.teeth, color: '#ef4444' }, { data: r.lips, color: '#22c55e' }] }; } },
  rvi: { label: 'سرزندگیِ نسبی (RVI)', pane: 'sub', inputs: {}, color: '#22c55e', calc: (c) => { const r = rvi(c.open, c.high, c.low, c.close); return { line: r.line, signal: r.signal, guides: [0] }; } },
  bbWidth: { label: 'پهنای باندِ بولینگر', pane: 'sub', inputs: { period: 20, mult: 2 }, color: '#f59e0b', calc: (c, i) => ({ line: bbWidth(c.close, i.period, i.mult) }) },
  stc: { label: 'چرخهٔ روندِ شاف (STC)', pane: 'sub', inputs: { fast: 23, slow: 50, cycle: 10 }, color: '#8b5cf6', calc: (c, i) => ({ line: stc(c.close, i.fast, i.slow, i.cycle), guides: [75, 25] }) },
  netVolume: { label: 'حجمِ خالص', pane: 'sub', inputs: {}, color: '#26a69a', calc: (c) => ({ line: netVolume(c.open, c.close, c.volume), guides: [0] }) },
  stdErrBands: { label: 'باندهای خطای معیار', pane: 'main', inputs: { period: 21, mult: 2 }, color: '#3b82f6', calc: (c, i) => { const r = stdErrBands(c.close, i.period, i.mult); return { lines: [{ data: r.mid, color: '#3b82f6' }, { data: r.up, color: '#94a3b8', dashed: true }, { data: r.dn, color: '#94a3b8', dashed: true }] }; } },
  accelerator: { label: 'نوسان‌سازِ شتاب (AC)', pane: 'sub', inputs: {}, color: '#26a69a', calc: (c) => ({ line: accelerator(c.high, c.low), guides: [0] }) },
  chaikinVol: { label: 'نوسانِ چایکین', pane: 'sub', inputs: { period: 10 }, color: '#f59e0b', calc: (c, i) => ({ line: chaikinVol(c.high, c.low, i.period), guides: [0] }) },
  mtfEma: { label: 'EMA چندتایم‌فریمی (×factor)', pane: 'main', inputs: { period: 50, factor: 4 }, color: '#22d3ee', calc: (c, i) => ({ line: _expandA(ema(_resampleC(c, i.factor).close, i.period), i.factor, c.close.length) }) },
  mtfRsi: { label: 'RSI چندتایم‌فریمی (×factor)', pane: 'sub', inputs: { period: 14, factor: 4 }, color: '#f59e0b', calc: (c, i) => ({ line: _expandA(rsi(_resampleC(c, i.factor).close, i.period), i.factor, c.close.length), guides: [70, 30] }) },
  bb:   { label: 'باند بولینگر', pane: 'main', inputs: { period: 20, mult: 2 }, color: '#94a3b8', calc: (c, i) => { const b = bollinger(c.close, i.period, i.mult); return { upper: b.upper, basis: b.basis, lower: b.lower, multi: true }; } },
  supertrend: { label: 'سوپرترند', pane: 'main', inputs: { period: 10, mult: 3 }, color: '#10b981', calc: (c, i) => ({ line: supertrend(c.high, c.low, c.close, i.period, i.mult).line }) },
  rsi:  { label: 'RSI', pane: 'sub', inputs: { period: 14 }, color: '#a78bfa', calc: (c, i) => ({ line: rsi(c.close, i.period), guides: [30, 70], range: [0, 100] }) },
  macd: { label: 'MACD', pane: 'sub', inputs: { fast: 12, slow: 26, sig: 9 }, color: '#60a5fa', calc: (c, i) => { const m = macd(c.close, i.fast, i.slow, i.sig); return { line: m.macd, signal: m.signal, hist: m.hist, macd: true }; } },
  stoch:{ label: 'استوکاستیک', pane: 'sub', inputs: { period: 14, d: 3 }, color: '#34d399', calc: (c, i) => { const s = stoch(c.high, c.low, c.close, i.period, i.d); return { line: s.k, signal: s.d, guides: [20, 80], range: [0, 100] }; } },
  atr:  { label: 'ATR', pane: 'sub', inputs: { period: 14 }, color: '#fb7185', calc: (c, i) => ({ line: atr(c.high, c.low, c.close, i.period) }) },
  cci:  { label: 'CCI', pane: 'sub', inputs: { period: 20 }, color: '#f472b6', calc: (c, i) => ({ line: cci(c.high, c.low, c.close, i.period), guides: [-100, 100] }) },
  willr:{ label: 'ویلیامز %R', pane: 'sub', inputs: { period: 14 }, color: '#facc15', calc: (c, i) => ({ line: williamsR(c.high, c.low, c.close, i.period), guides: [-20, -80], range: [-100, 0] }) },
  obv:  { label: 'OBV', pane: 'sub', inputs: {}, color: '#38bdf8', calc: (c) => ({ line: obv(c.close, c.volume) }) },
  adx:  { label: 'ADX', pane: 'sub', inputs: { period: 14 }, color: '#f97316', calc: (c, i) => ({ line: adx(c.high, c.low, c.close, i.period), guides: [25] }) },
  donchian: { label: 'کانال دونچیان', pane: 'main', inputs: { period: 20 }, color: '#94a3b8', calc: (c, i) => { const d = donchian(c.high, c.low, i.period); return { lines: [{ data: d.upper, color: '#60a5fa', dashed: true }, { data: d.basis, color: '#94a3b8' }, { data: d.lower, color: '#60a5fa', dashed: true }] }; } },
  keltner: { label: 'کانال کلتنر', pane: 'main', inputs: { period: 20, mult: 2 }, color: '#f472b6', calc: (c, i) => { const k = keltner(c.high, c.low, c.close, i.period, i.mult); return { lines: [{ data: k.upper, color: '#f472b6', dashed: true }, { data: k.basis, color: '#f472b6' }, { data: k.lower, color: '#f472b6', dashed: true }] }; } },
  ichimoku: { label: 'ایچیموکو', pane: 'main', inputs: { tenkan: 9, kijun: 26, span: 52 }, color: '#22d3ee', calc: (c, i) => { const k = ichimoku(c.high, c.low, c.close, i.tenkan, i.kijun, i.span); return { lines: [{ data: k.tenkan, color: '#3b82f6' }, { data: k.kijun, color: '#ef4444' }, { data: k.spanA, color: '#22c55e', dashed: true }, { data: k.spanB, color: '#f59e0b', dashed: true }] }; } },
  dema: { label: 'DEMA (نمایی دوگانه)', pane: 'main', inputs: { period: 20 }, color: '#38bdf8', calc: (c, i) => ({ line: dema(c.close, i.period) }) },
  tema: { label: 'TEMA (نمایی سه‌گانه)', pane: 'main', inputs: { period: 20 }, color: '#fb923c', calc: (c, i) => ({ line: tema(c.close, i.period) }) },
  vwma: { label: 'VWMA (وزنیِ حجمی)', pane: 'main', inputs: { period: 20 }, color: '#c084fc', calc: (c, i) => ({ line: vwma(c.close, c.volume, i.period) }) },
  psar: { label: 'پارابولیک SAR', pane: 'main', inputs: { start: 0.02, inc: 0.02, max: 0.2 }, color: '#a855f7', calc: (c, i) => ({ lines: [{ data: psar(c.high, c.low, i.start, i.inc, i.max), color: '#a855f7', dashed: true }] }) },
  pivots: { label: 'نقاطِ پیووت (کلاسیک)', pane: 'main', inputs: {}, color: '#94a3b8', calc: (c) => { const v = pivots(c.high, c.low, c.close); return { lines: [{ data: v.r2, color: '#ef4444', dashed: true }, { data: v.r1, color: '#f87171', dashed: true }, { data: v.p, color: '#94a3b8' }, { data: v.s1, color: '#4ade80', dashed: true }, { data: v.s2, color: '#22c55e', dashed: true }] }; } },
  aroon: { label: 'آرون (Aroon)', pane: 'sub', inputs: { period: 14 }, color: '#22c55e', calc: (c, i) => { const a = aroon(c.high, c.low, i.period); return { line: a.up, signal: a.down, guides: [30, 70], range: [0, 100] }; } },
  mfi: { label: 'MFI (جریانِ نقدینگی)', pane: 'sub', inputs: { period: 14 }, color: '#10b981', calc: (c, i) => ({ line: mfi(c.high, c.low, c.close, c.volume, i.period), guides: [20, 80], range: [0, 100] }) },
  cmf: { label: 'CMF (پولِ چایکین)', pane: 'sub', inputs: { period: 20 }, color: '#0ea5e9', calc: (c, i) => ({ line: cmf(c.high, c.low, c.close, c.volume, i.period), guides: [0] }) },
  stochrsi: { label: 'استوکاستیک RSI', pane: 'sub', inputs: { period: 14, k: 3, d: 3 }, color: '#34d399', calc: (c, i) => { const s = stochRsi(c.close, i.period, i.k, i.d); return { line: s.k, signal: s.d, guides: [20, 80], range: [0, 100] }; } },
  ao: { label: 'اسیلاتورِ شگفت‌انگیز (AO)', pane: 'sub', inputs: {}, color: '#60a5fa', calc: (c) => ({ line: ao(c.high, c.low), guides: [0] }) },
  tsi: { label: 'TSI (قدرتِ واقعی)', pane: 'sub', inputs: { short: 13, long: 25 }, color: '#f472b6', calc: (c, i) => ({ line: tsi(c.close, i.short, i.long), guides: [0] }) },
  cmo: { label: 'CMO (مومنتومِ چاند)', pane: 'sub', inputs: { period: 9 }, color: '#fbbf24', calc: (c, i) => ({ line: cmo(c.close, i.period), guides: [-50, 50] }) },
  alma: { label: 'ALMA (آرنو لِگو)', pane: 'main', inputs: { period: 9, offset: 0.85, sigma: 6 }, color: '#2dd4bf', calc: (c, i) => ({ line: alma(c.close, i.period, i.offset, i.sigma) }) },
  maRibbon: { label: 'نوارِ میانگین‌ها (MA Ribbon)', pane: 'main', inputs: { base: 20, step: 10, count: 6 }, color: '#60a5fa', calc: (c, i) => { const rs = maRibbon(c.close, i.base, i.step, i.count, 'sma'); const pal = ['#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf', '#34d399', '#4ade80', '#a3e635', '#facc15']; return { lines: rs.map((data, k) => ({ data, color: pal[k % pal.length] })) }; } },
  gmma: { label: 'گاپی (GMMA)', pane: 'main', inputs: {}, color: '#3b82f6', calc: (c) => { const g = gmma(c.close); return { lines: [...g.short.map((data) => ({ data, color: '#3b82f6' })), ...g.long.map((data) => ({ data, color: '#ef4444' }))] }; } },
  maCross: { label: 'تقاطعِ میانگین‌ها (MA Cross)', pane: 'main', inputs: { fast: 10, slow: 30 }, color: '#22c55e', calc: (c, i) => ({ lines: [{ data: sma(c.close, i.fast), color: '#22c55e' }, { data: sma(c.close, i.slow), color: '#ef4444' }] }) },
};

// ادغامِ افزونه‌های فصل ۵ (۳۷ اندیکاتورِ جدید: روند/MA/نوسان + مومنتوم/حجم/پیوت).
// ترتیب: A سپس B (در ۳ کلیدِ مشترک trix/bbpercent/bbw نسخهٔ B برنده می‌شود).
Object.assign(REGISTRY, EXT_REGISTRY_A, EXT_REGISTRY_B);
