// src/bazaarnama/indicators_ext_a.js
var _sma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) {
      out[i] = null;
      sum = 0;
      cnt = 0;
      continue;
    }
    sum += v;
    cnt++;
    if (i >= p) {
      const old = src[i - p];
      if (old != null) {
        sum -= old;
        cnt--;
      }
    }
    if (cnt >= p) out[i] = sum / p;
  }
  return out;
};
var _ema = (src, p) => {
  const out = new Array(src.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null, seen = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    prev = prev == null ? v : v * k + prev * (1 - k);
    seen++;
    if (seen >= p) out[i] = prev;
  }
  return out;
};
var _smma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let prev = null, sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    if (prev == null) {
      sum += v;
      cnt++;
      if (cnt === p) {
        prev = sum / p;
        out[i] = prev;
      }
    } else {
      prev = (prev * (p - 1) + v) / p;
      out[i] = prev;
    }
  }
  return out;
};
var _stdev = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let ok = true, mean = 0;
    for (let j = 0; j < p; j++) {
      const v = src[i - j];
      if (v == null) {
        ok = false;
        break;
      }
      mean += v;
    }
    if (!ok) {
      out[i] = null;
      continue;
    }
    mean /= p;
    let s = 0;
    for (let j = 0; j < p; j++) {
      const d = src[i - j] - mean;
      s += d * d;
    }
    out[i] = Math.sqrt(s / p);
  }
  return out;
};
var _linreg = (src, p, offset = 0) => {
  const out = new Array(src.length).fill(null);
  const sumX = (p - 1) * p / 2;
  const sumX2 = (p - 1) * p * (2 * p - 1) / 6;
  const denom = p * sumX2 - sumX * sumX;
  for (let i = p - 1; i < src.length; i++) {
    let ok = true, sumY = 0, sumXY = 0;
    for (let j = 0; j < p; j++) {
      const x = j;
      const y = src[i - (p - 1) + j];
      if (y == null) {
        ok = false;
        break;
      }
      sumY += y;
      sumXY += x * y;
    }
    if (!ok || !denom) {
      out[i] = null;
      continue;
    }
    const b = (p * sumXY - sumX * sumY) / denom;
    const a = (sumY - b * sumX) / p;
    out[i] = a + b * (p - 1 + offset);
  }
  return out;
};
var _zlema = (src, p) => {
  const lag = Math.floor((p - 1) / 2);
  const de = src.map((v, i) => v == null || src[i - lag] == null || i < lag ? null : v + (v - src[i - lag]));
  return _ema(de, p);
};
var _kama = (src, p = 10, fastN = 2, slowN = 30) => {
  const out = new Array(src.length).fill(null);
  const fast = 2 / (fastN + 1), slow = 2 / (slowN + 1);
  let prev = null;
  for (let i = 0; i < src.length; i++) {
    if (i < p) {
      if (i === p - 1) {
        prev = src[i];
        out[i] = prev;
      }
      continue;
    }
    const change = Math.abs(src[i] - src[i - p]);
    let vol = 0;
    for (let j = 0; j < p; j++) vol += Math.abs(src[i - j] - src[i - j - 1]);
    const er = vol ? change / vol : 0;
    const sc = Math.pow(er * (fast - slow) + slow, 2);
    prev = prev + sc * (src[i] - prev);
    out[i] = prev;
  }
  return out;
};
var _t3 = (src, p = 10, a = 0.7) => {
  const e1 = _ema(src, p);
  const e2 = _ema(e1.map((v) => v == null ? null : v), p);
  const e3 = _ema(e2.map((v) => v == null ? null : v), p);
  const e4 = _ema(e3.map((v) => v == null ? null : v), p);
  const e5 = _ema(e4.map((v) => v == null ? null : v), p);
  const e6 = _ema(e5.map((v) => v == null ? null : v), p);
  const c1 = -a * a * a;
  const c2 = 3 * a * a + 3 * a * a * a;
  const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
  const c4 = 1 + 3 * a + a * a * a + 3 * a * a;
  return src.map(
    (_, i) => e6[i] != null && e5[i] != null && e4[i] != null && e3[i] != null ? c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i] : null
  );
};
var _mcginley = (src, p = 14) => {
  const out = new Array(src.length).fill(null);
  let md = null, sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    if (md == null) {
      sum += v;
      cnt++;
      if (cnt === p) {
        md = sum / p;
        out[i] = md;
      }
    } else {
      const ratio = md ? v / md : 1;
      const denom = p * Math.pow(ratio, 4);
      md = md + (v - md) / (denom || 1e-9);
      out[i] = md;
    }
  }
  return out;
};
var _trix = (src, p = 18, sig = 9) => {
  const e1 = _ema(src, p);
  const e2 = _ema(e1, p);
  const e3 = _ema(e2, p);
  const line = e3.map((v, i) => v != null && e3[i - 1] != null && e3[i - 1] ? 1e4 * (v - e3[i - 1]) / e3[i - 1] : null);
  const signal = _ema(line, sig);
  return { line, signal };
};
var _bb = (src, p, mult) => {
  const basis = _sma(src, p);
  const sd = _stdev(src, p);
  const upper = src.map((_, i) => basis[i] != null && sd[i] != null ? basis[i] + mult * sd[i] : null);
  const lower = src.map((_, i) => basis[i] != null && sd[i] != null ? basis[i] - mult * sd[i] : null);
  return { basis, upper, lower, sd };
};
var _hv = (closes, p = 10, annual = 365) => {
  const n = closes.length, lr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) lr[i] = closes[i] > 0 && closes[i - 1] > 0 ? Math.log(closes[i] / closes[i - 1]) : null;
  const sd = _stdev(lr, p);
  return sd.map((v) => v == null ? null : 100 * v * Math.sqrt(annual));
};
var _chaikinVol = (highs, lows, p = 10, roc2 = 10) => {
  const hl = highs.map((h, i) => h - lows[i]);
  const e = _ema(hl, p);
  return e.map((v, i) => v != null && e[i - roc2] != null && e[i - roc2] ? 100 * (v - e[i - roc2]) / e[i - roc2] : null);
};
var _ppo = (src, fast = 12, slow = 26, sig = 9) => {
  const ef = _ema(src, fast), es = _ema(src, slow);
  const line = src.map((_, i) => ef[i] != null && es[i] != null && es[i] ? 100 * (ef[i] - es[i]) / es[i] : null);
  const signal = _ema(line, sig);
  const hist = line.map((v, i) => v != null && signal[i] != null ? v - signal[i] : null);
  return { line, signal, hist };
};
var _dmi = (highs, lows, closes, p = 14) => {
  const n = closes.length, tr = new Array(n).fill(0), pdm = new Array(n).fill(0), ndm = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    pdm[i] = up > dn && up > 0 ? up : 0;
    ndm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const sm = (a) => {
    const o = new Array(n).fill(null);
    let s = 0;
    for (let i = 1; i <= p; i++) s += a[i];
    o[p] = s;
    for (let i = p + 1; i < n; i++) {
      s = s - s / p + a[i];
      o[i] = s;
    }
    return o;
  };
  const str = sm(tr), spd = sm(pdm), snd = sm(ndm);
  const plus = new Array(n).fill(null), minus = new Array(n).fill(null), adxOut = new Array(n).fill(null);
  let adxPrev = null;
  const dxs = [];
  for (let i = p; i < n; i++) {
    if (str[i] == null || !str[i]) continue;
    const pdi = 100 * spd[i] / str[i], ndi = 100 * snd[i] / str[i];
    plus[i] = pdi;
    minus[i] = ndi;
    const dx = pdi + ndi ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    dxs.push(dx);
    if (dxs.length === p) {
      adxPrev = dxs.reduce((x, y) => x + y, 0) / p;
      adxOut[i] = adxPrev;
    } else if (adxPrev != null) {
      adxPrev = (adxPrev * (p - 1) + dx) / p;
      adxOut[i] = adxPrev;
    }
  }
  return { plus, minus, adx: adxOut };
};
var _src = (c, i) => Array.isArray(i && i.source) ? i.source : c.close;
var EXT_REGISTRY_A = {
  // ===== §5.1 روند / میانگین‌های متحرک =====
  smma: {
    label: "SMMA / RMA (\u0648\u0627\u06CC\u0644\u062F\u0631)",
    pane: "main",
    inputs: { source: "close", period: 14 },
    color: "#84cc16",
    calc: (c, i) => ({ line: _smma(_src(c, i), i.period) })
  },
  zlema: {
    label: "ZLEMA (\u062A\u0623\u062E\u06CC\u0631\u0650 \u0635\u0641\u0631)",
    pane: "main",
    inputs: { source: "close", period: 21 },
    color: "#2dd4bf",
    calc: (c, i) => ({ line: _zlema(_src(c, i), i.period) })
  },
  kama: {
    label: "KAMA (\u062A\u0637\u0628\u06CC\u0642\u06CC \u06A9\u0627\u0641\u0645\u0646)",
    pane: "main",
    inputs: { source: "close", period: 10, fast: 2, slow: 30 },
    color: "#fb923c",
    calc: (c, i) => ({ line: _kama(_src(c, i), i.period, i.fast, i.slow) })
  },
  t3: {
    label: "T3 (\u062A\u06CC\u0644\u0633\u0648\u0646)",
    pane: "main",
    inputs: { source: "close", period: 10, volume: 0.7 },
    color: "#e879f9",
    calc: (c, i) => ({ line: _t3(_src(c, i), i.period, i.volume) })
  },
  mcginley: {
    label: "\u0645\u06A9\u200C\u06AF\u06CC\u0646\u0644\u06CC \u062F\u0627\u06CC\u0646\u0627\u0645\u06CC\u06A9",
    pane: "main",
    inputs: { source: "close", period: 14 },
    color: "#facc15",
    calc: (c, i) => ({ line: _mcginley(_src(c, i), i.period) })
  },
  linreg: {
    label: "\u0645\u0646\u062D\u0646\u06CC\u0650 \u0631\u06AF\u0631\u0633\u06CC\u0648\u0646 \u062E\u0637\u06CC",
    pane: "main",
    inputs: { source: "close", period: 100 },
    color: "#38bdf8",
    calc: (c, i) => ({ line: _linreg(_src(c, i), i.period, 0) })
  },
  lsma: {
    label: "LSMA (\u06A9\u0645\u062A\u0631\u06CC\u0646\u200C\u0645\u0631\u0628\u0639\u0627\u062A)",
    pane: "main",
    inputs: { source: "close", period: 25, offset: 0 },
    color: "#a78bfa",
    calc: (c, i) => ({ line: _linreg(_src(c, i), i.period, i.offset) })
  },
  trix: {
    label: "TRIX",
    pane: "sub",
    inputs: { source: "close", period: 18, sig: 9 },
    color: "#f472b6",
    calc: (c, i) => {
      const t = _trix(_src(c, i), i.period, i.sig);
      return { line: t.line, signal: t.signal, guides: [0] };
    }
  },
  // ===== §5.3 نوسان =====
  bbpercent: {
    label: "\u0628\u0627\u0646\u062F \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631 \u066AB",
    pane: "sub",
    inputs: { source: "close", period: 20, mult: 2 },
    color: "#22d3ee",
    calc: (c, i) => {
      const s = _src(c, i), b = _bb(s, i.period, i.mult);
      const line = b.upper.map((u, k) => u != null && b.lower[k] != null && u - b.lower[k] ? (s[k] - b.lower[k]) / (u - b.lower[k]) : null);
      return { line, guides: [0, 0.5, 1], range: [-0.5, 1.5] };
    }
  },
  bbw: {
    label: "\u067E\u0647\u0646\u0627\u06CC \u0628\u0627\u0646\u062F \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631",
    pane: "sub",
    inputs: { source: "close", period: 20, mult: 2 },
    color: "#94a3b8",
    calc: (c, i) => {
      const s = _src(c, i), b = _bb(s, i.period, i.mult);
      const line = b.upper.map((u, k) => u != null && b.basis[k] ? (u - b.lower[k]) / b.basis[k] : null);
      return { line };
    }
  },
  stddev: {
    label: "\u0627\u0646\u062D\u0631\u0627\u0641 \u0645\u0639\u06CC\u0627\u0631",
    pane: "sub",
    inputs: { source: "close", period: 20 },
    color: "#fb7185",
    calc: (c, i) => ({ line: _stdev(_src(c, i), i.period) })
  },
  envelopes: {
    label: "\u067E\u0627\u06A9\u062A\u200C\u0647\u0627 (Envelopes)",
    pane: "main",
    inputs: { source: "close", period: 20, pct: 1 },
    color: "#a78bfa",
    calc: (c, i) => {
      const b = _sma(_src(c, i), i.period);
      return {
        upper: b.map((v) => v == null ? null : v * (1 + i.pct / 100)),
        basis: b,
        lower: b.map((v) => v == null ? null : v * (1 - i.pct / 100)),
        multi: true
      };
    }
  },
  hv: {
    label: "\u0646\u0648\u0633\u0627\u0646\u0650 \u062A\u0627\u0631\u06CC\u062E\u06CC (HV)",
    pane: "sub",
    inputs: { period: 10, annual: 365 },
    color: "#f59e0b",
    calc: (c, i) => ({ line: _hv(c.close, i.period, i.annual) })
  },
  chaikinVol: {
    label: "\u0646\u0648\u0633\u0627\u0646\u0650 \u0686\u0627\u06CC\u06A9\u06CC\u0646",
    pane: "sub",
    inputs: { period: 10, roc: 10 },
    color: "#0ea5e9",
    calc: (c, i) => ({ line: _chaikinVol(c.high, c.low, i.period, i.roc), guides: [0] })
  },
  // ===== §5.2 مومنتوم / اسیلاتور =====
  dmi: {
    label: "DMI (\u062C\u0647\u062A\u200C\u062F\u0627\u0631\u0650 +DI/\u2212DI)",
    pane: "sub",
    inputs: { period: 14 },
    color: "#22c55e",
    calc: (c, i) => {
      const r = _dmi(c.high, c.low, c.close, i.period);
      return { line: r.plus, signal: r.minus, signal2: r.adx, signal2Color: "#64748b", guides: [25], range: [0, 100] };
    }
    // +DI سبز / −DI نارنجی / ADX خاکستریِ متوسط (روی هر دو تمِ روشن/تیره دیده شود) — مثلِ DMIِ TradingView
  },
  ppo: {
    label: "PPO (\u062F\u0631\u0635\u062F\u06CC\u0650 \u0642\u06CC\u0645\u062A)",
    pane: "sub",
    inputs: { source: "close", fast: 12, slow: 26, sig: 9 },
    color: "#60a5fa",
    calc: (c, i) => {
      const p = _ppo(_src(c, i), i.fast, i.slow, i.sig);
      return { line: p.line, signal: p.signal, hist: p.hist, macd: true };
    }
  }
};

// src/bazaarnama/candlePatterns.js
var body = (c) => Math.abs(c.c - c.o);
var range = (c) => c.h - c.l || 1e-9;
var upperWick = (c) => c.h - Math.max(c.o, c.c);
var lowerWick = (c) => Math.min(c.o, c.c) - c.l;
var isBull = (c) => c.c >= c.o;
var isBear = (c) => c.c < c.o;
var avgBody = (cs, i, n = 10) => {
  let s = 0, k = 0;
  for (let j = Math.max(0, i - n); j < i; j++) {
    s += body(cs[j]);
    k++;
  }
  return k ? s / k : body(cs[i]);
};
var priorTrend = (cs, i, n = 5) => {
  const a = cs[Math.max(0, i - n)], b = cs[Math.max(0, i - 1)];
  if (!a || !b) return 0;
  const d = b.c - a.c;
  const th = avgBody(cs, i) * 0.5;
  return d > th ? 1 : d < -th ? -1 : 0;
};
function detectCandlePatterns(cs) {
  if (!cs || cs.length < 3) return [];
  const out = [];
  const push = (t, dir, label) => out.push({ t, dir, label });
  for (let i = 1; i < cs.length; i++) {
    const c = cs[i], p = cs[i - 1];
    const ab = avgBody(cs, i);
    const b = body(c), r = range(c), uw = upperWick(c), lw = lowerWick(c);
    const trend = priorTrend(cs, i);
    if (b <= r * 0.1) {
      if (lw > r * 0.6 && uw < r * 0.15) push(c.t, "bull", "\u062F\u0631\u0627\u06AF\u0648\u0646\u200C\u0641\u0644\u0627\u06CC \u062F\u0648\u062C\u06CC");
      else if (uw > r * 0.6 && lw < r * 0.15) push(c.t, "bear", "\u06AF\u0650\u06CC\u0648\u0633\u062A\u0648\u0646 \u062F\u0648\u062C\u06CC");
      else push(c.t, "neutral", "\u062F\u0648\u062C\u06CC");
    } else if (b > ab * 1.3 && uw < r * 0.05 && lw < r * 0.05) {
      push(c.t, isBull(c) ? "bull" : "bear", isBull(c) ? "\u0645\u0627\u0631\u0648\u0628\u0648\u0632\u0648\u06CC \u0635\u0639\u0648\u062F\u06CC" : "\u0645\u0627\u0631\u0648\u0628\u0648\u0632\u0648\u06CC \u0646\u0632\u0648\u0644\u06CC");
    } else if (lw >= b * 2 && uw <= b * 0.6 && b <= r * 0.4) {
      if (trend < 0) push(c.t, "bull", "\u0686\u06A9\u0634 (Hammer)");
      else if (trend > 0) push(c.t, "bear", "\u0645\u0631\u062F \u0622\u0648\u06CC\u0632\u0627\u0646");
    } else if (uw >= b * 2 && lw <= b * 0.6 && b <= r * 0.4) {
      if (trend < 0) push(c.t, "bull", "\u0686\u06A9\u0634\u0650 \u0645\u0639\u06A9\u0648\u0633");
      else if (trend > 0) push(c.t, "bear", "\u0633\u062A\u0627\u0631\u0647\u0654 \u062F\u0646\u0628\u0627\u0644\u0647\u200C\u062F\u0627\u0631");
    } else if (b <= r * 0.35 && uw >= b && lw >= b && uw > r * 0.2 && lw > r * 0.2) {
      push(c.t, "neutral", "\u0641\u0631\u0641\u0631\u0647 (Spinning Top)");
    }
    if (isBull(c) && isBear(p) && c.c >= p.o && c.o <= p.c && b > body(p)) push(c.t, "bull", "\u067E\u0648\u0634\u0634\u06CC\u0650 \u0635\u0639\u0648\u062F\u06CC");
    if (isBear(c) && isBull(p) && c.o >= p.c && c.c <= p.o && b > body(p)) push(c.t, "bear", "\u067E\u0648\u0634\u0634\u06CC\u0650 \u0646\u0632\u0648\u0644\u06CC");
    if (body(p) > ab && b < body(p) * 0.6 && Math.max(c.o, c.c) <= Math.max(p.o, p.c) && Math.min(c.o, c.c) >= Math.min(p.o, p.c)) {
      if (isBear(p) && isBull(c)) push(c.t, "bull", "\u0647\u0627\u0631\u0627\u0645\u06CC\u0650 \u0635\u0639\u0648\u062F\u06CC");
      else if (isBull(p) && isBear(c)) push(c.t, "bear", "\u0647\u0627\u0631\u0627\u0645\u06CC\u0650 \u0646\u0632\u0648\u0644\u06CC");
    }
    if (isBear(p) && isBull(c) && c.o < p.l && c.c > (p.o + p.c) / 2 && c.c < p.o) push(c.t, "bull", "\u0646\u0641\u0648\u0630\u06CC (Piercing)");
    if (isBull(p) && isBear(c) && c.o > p.h && c.c < (p.o + p.c) / 2 && c.c > p.o) push(c.t, "bear", "\u0627\u0628\u0631\u0650 \u0633\u06CC\u0627\u0647");
    if (b > r * 0.2 && body(p) > range(p) * 0.2) {
      if (trend < 0 && isBear(p) && isBull(c) && Math.abs(c.l - p.l) <= r * 0.05) push(c.t, "bull", "\u0627\u0646\u0628\u0631\u06A9\u0650 \u06A9\u0641");
      if (trend > 0 && isBull(p) && isBear(c) && Math.abs(c.h - p.h) <= r * 0.05) push(c.t, "bear", "\u0627\u0646\u0628\u0631\u06A9\u0650 \u0633\u0642\u0641");
    }
    if (i >= 2) {
      const q = cs[i - 2];
      if (isBear(q) && body(q) > ab && body(p) < body(q) * 0.5 && isBull(c) && c.c > (q.o + q.c) / 2) push(c.t, "bull", "\u0633\u062A\u0627\u0631\u0647\u0654 \u0635\u0628\u062D\u200C\u06AF\u0627\u0647\u06CC");
      if (isBull(q) && body(q) > ab && body(p) < body(q) * 0.5 && isBear(c) && c.c < (q.o + q.c) / 2) push(c.t, "bear", "\u0633\u062A\u0627\u0631\u0647\u0654 \u0634\u0627\u0645\u06AF\u0627\u0647\u06CC");
      if (isBull(q) && isBull(p) && isBull(c) && p.c > q.c && c.c > p.c && body(p) > ab * 0.6 && body(c) > ab * 0.6) push(c.t, "bull", "\u0633\u0647 \u0633\u0631\u0628\u0627\u0632\u0650 \u0633\u0641\u06CC\u062F");
      if (isBear(q) && isBear(p) && isBear(c) && p.c < q.c && c.c < p.c && body(p) > ab * 0.6 && body(c) > ab * 0.6) push(c.t, "bear", "\u0633\u0647 \u06A9\u0644\u0627\u063A\u0650 \u0633\u06CC\u0627\u0647");
    }
  }
  const byTime = /* @__PURE__ */ new Map();
  out.forEach((o) => {
    const e = byTime.get(o.t);
    if (!e) byTime.set(o.t, { t: o.t, dir: o.dir, labels: [o.label] });
    else {
      e.labels.push(o.label);
      if (e.dir !== o.dir) e.dir = "neutral";
    }
  });
  return Array.from(byTime.values()).map((e) => ({ t: e.t, dir: e.dir, label: e.labels.join("\u060C ") }));
}

// src/bazaarnama/indicators_ext_b.js
var _sma2 = (src, p) => {
  const out = new Array(src.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i] == null ? 0 : src[i];
    sum += v;
    cnt++;
    if (i >= p) {
      sum -= src[i - p] == null ? 0 : src[i - p];
      cnt--;
    }
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
};
var _ema2 = (src, p) => {
  const out = new Array(src.length).fill(null);
  const k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) {
      out[i] = prev;
      continue;
    }
    prev = prev == null ? v : v * k + prev * (1 - k);
    if (i >= p - 1) out[i] = prev;
  }
  return out;
};
var _rma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let prev = null, sum = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i] == null ? 0 : src[i];
    if (i < p) {
      sum += v;
      if (i === p - 1) {
        prev = sum / p;
        out[i] = prev;
      }
      continue;
    }
    prev = (prev * (p - 1) + v) / p;
    out[i] = prev;
  }
  return out;
};
var _stdev2 = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let m = 0;
    for (let j = 0; j < p; j++) m += src[i - j];
    m /= p;
    let s = 0;
    for (let j = 0; j < p; j++) {
      const d = src[i - j] - m;
      s += d * d;
    }
    out[i] = Math.sqrt(s / p);
  }
  return out;
};
var _trArr = (highs, lows, closes) => {
  const tr = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr[i] = highs[i] - lows[i];
      continue;
    }
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  return tr;
};
var _atr = (highs, lows, closes, p) => _rma(_trArr(highs, lows, closes), p);
var _hl2 = (c) => c.high.map((h, i) => (h + c.low[i]) / 2);
var _hlc3 = (c) => c.high.map((h, i) => (h + c.low[i] + c.close[i]) / 3);
var _ohlc4 = (c) => c.high.map((h, i) => (c.open[i] + h + c.low[i] + c.close[i]) / 4);
var _hlcc4 = (c) => c.high.map((h, i) => (h + c.low[i] + 2 * c.close[i]) / 4);
var _srcOf = (c, name) => name === "open" ? c.open : name === "high" ? c.high : name === "low" ? c.low : name === "hl2" ? _hl2(c) : name === "hlc3" ? _hlc3(c) : name === "ohlc4" ? _ohlc4(c) : name === "hlcc4" ? _hlcc4(c) : c.close;
var _mfm = (h, l, c) => {
  const r = h - l;
  return r ? (c - l - (h - c)) / r : 0;
};
var _percentRank = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p; i < src.length; i++) {
    if (src[i] == null) continue;
    let cnt = 0, tot = 0;
    for (let j = 1; j <= p; j++) {
      const v = src[i - j];
      if (v == null) continue;
      tot++;
      if (v < src[i]) cnt++;
    }
    out[i] = tot ? 100 * cnt / tot : null;
  }
  return out;
};
var _streak = (closes) => {
  const out = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] > 0 ? out[i - 1] + 1 : 1;
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] < 0 ? out[i - 1] - 1 : -1;
    else out[i] = 0;
  }
  return out;
};
var _rsiSeries = (src, p) => {
  const out = new Array(src.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < src.length; i++) {
    if (src[i] == null || src[i - 1] == null) continue;
    const ch = src[i] - src[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= p) {
      ag += g;
      al += l;
      if (i === p) {
        ag /= p;
        al /= p;
        out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
      }
    } else {
      ag = (ag * (p - 1) + g) / p;
      al = (al * (p - 1) + l) / p;
      out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
    }
  }
  return out;
};
var _highest = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let hh = -Infinity, ok = 0;
    for (let j = 0; j < p; j++) {
      const v = src[i - j];
      if (v == null) continue;
      ok = 1;
      if (v > hh) hh = v;
    }
    out[i] = ok ? hh : null;
  }
  return out;
};
var _lowest = (src, p) => {
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let ll = Infinity, ok = 0;
    for (let j = 0; j < p; j++) {
      const v = src[i - j];
      if (v == null) continue;
      ok = 1;
      if (v < ll) ll = v;
    }
    out[i] = ok ? ll : null;
  }
  return out;
};
var _hasVol = (vols) => Array.isArray(vols) && vols.some((v) => v && v > 0);
var _nullLine = (n) => ({ line: new Array(n).fill(null) });
var _UP = "#089981";
var _DN = "#f23645";
var mom = (c, i) => {
  const s = _srcOf(c, i.source);
  return { line: s.map((v, k) => k >= i.period && v != null && s[k - i.period] != null ? v - s[k - i.period] : null), guides: [0] };
};
var roc = (c, i) => {
  const s = _srcOf(c, i.source);
  return { line: s.map((v, k) => k >= i.period && v != null && s[k - i.period] ? 100 * (v - s[k - i.period]) / s[k - i.period] : null), guides: [0] };
};
var accelerator = (c) => {
  const mp = _hl2(c);
  const f = _sma2(mp, 5), sl = _sma2(mp, 34);
  const aoArr = mp.map((_, k) => f[k] != null && sl[k] != null ? f[k] - sl[k] : null);
  const aoSma = _sma2(aoArr.map((v) => v == null ? 0 : v), 5).map((v, k) => {
    for (let j = 0; j < 5; j++) if (k - j < 0 || aoArr[k - j] == null) return null;
    return v;
  });
  const ac = aoArr.map((v, k) => v != null && aoSma[k] != null ? v - aoSma[k] : null);
  return { hist: ac, palette: (v, k) => k > 0 && ac[k - 1] != null && ac[k] != null ? ac[k] >= ac[k - 1] ? _UP : _DN : _UP, guides: [0] };
};
var ultimateOsc = (c, i) => {
  const n = c.close.length, bp = new Array(n).fill(null), tr = new Array(n).fill(null);
  for (let k = 1; k < n; k++) {
    const minLC = Math.min(c.low[k], c.close[k - 1]);
    const maxHC = Math.max(c.high[k], c.close[k - 1]);
    bp[k] = c.close[k] - minLC;
    tr[k] = maxHC - minLC;
  }
  const sumP = (arr, p, idx) => {
    let s = 0;
    for (let j = 0; j < p; j++) {
      const v = arr[idx - j];
      if (v == null) return null;
      s += v;
    }
    return s;
  };
  const out = new Array(n).fill(null);
  const lng = Math.max(i.long, i.mid, i.short);
  for (let k = lng; k < n; k++) {
    const bs = sumP(bp, i.short, k), ts = sumP(tr, i.short, k);
    const bm = sumP(bp, i.mid, k), tm = sumP(tr, i.mid, k);
    const bl = sumP(bp, i.long, k), tl = sumP(tr, i.long, k);
    if (bs == null || bm == null || bl == null) continue;
    const a1 = bs / (ts || 1e-9), a2 = bm / (tm || 1e-9), a3 = bl / (tl || 1e-9);
    out[k] = 100 * (4 * a1 + 2 * a2 + a3) / 7;
  }
  return { line: out, guides: [30, 70], range: [0, 100], zone: [30, 70] };
};
var fisher = (c, i) => {
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
    fish[k] = f;
    sig[k] = prevF;
  }
  return { line: fish, signal: sig, guides: [0] };
};
var connorsRsi = (c, i) => {
  const close = i.source ?? c.close, n = close.length;
  const r1 = _rsiSeries(close, i.rsiLen);
  const strk = _streak(close);
  const r2 = _rsiSeries(strk, i.streakLen);
  const roc1 = new Array(n).fill(null);
  for (let k = 1; k < n; k++) roc1[k] = close[k - 1] ? 100 * (close[k] - close[k - 1]) / close[k - 1] : 0;
  const pr = _percentRank(roc1, i.rankLen);
  const out = new Array(n).fill(null);
  for (let k = 0; k < n; k++) if (r1[k] != null && r2[k] != null && pr[k] != null) out[k] = (r1[k] + r2[k] + pr[k]) / 3;
  return { line: out, guides: [20, 80], range: [0, 100], zone: [20, 80] };
};
var smiErgodic = (c, i) => {
  const close = i.source ?? c.close, n = close.length;
  const m = new Array(n).fill(0), am = new Array(n).fill(0);
  for (let k = 1; k < n; k++) {
    m[k] = close[k] - close[k - 1];
    am[k] = Math.abs(m[k]);
  }
  const dbl = _ema2(_ema2(m, i.long), i.short), adbl = _ema2(_ema2(am, i.long), i.short);
  const smi2 = close.map((_, k) => dbl[k] != null && adbl[k] ? 100 * dbl[k] / adbl[k] : null);
  const sig = _ema2(smi2, i.sig).map((v, k) => smi2[k] == null ? null : v);
  const hist = smi2.map((v, k) => v != null && sig[k] != null ? v - sig[k] : null);
  return { line: smi2, signal: sig, hist, macd: true, guides: [0] };
};
var smi = (c, i) => {
  const n = c.close.length;
  const hh = _highest(c.high, i.period), ll = _lowest(c.low, i.period);
  const rel = new Array(n).fill(null), rng = new Array(n).fill(null);
  for (let k = 0; k < n; k++) {
    if (hh[k] == null || ll[k] == null) continue;
    const mid = (hh[k] + ll[k]) / 2;
    rel[k] = c.close[k] - mid;
    rng[k] = hh[k] - ll[k];
  }
  const relS = _ema2(_ema2(rel, i.smoothK), i.smoothD);
  const rngS = _ema2(_ema2(rng, i.smoothK), i.smoothD);
  const out = new Array(n).fill(null);
  for (let k = 0; k < n; k++) {
    if (rel[k] == null || relS[k] == null || rngS[k] == null) continue;
    const d = rngS[k] / 2 || 1e-9;
    out[k] = 100 * relS[k] / d;
  }
  return { line: out, guides: [-40, 40], range: [-100, 100], zone: [-40, 40] };
};
var bop = (c, i) => {
  const raw = c.close.map((cl, k) => {
    const r = c.high[k] - c.low[k];
    return r ? (cl - c.open[k]) / r : 0;
  });
  const line = i.smooth > 1 ? _sma2(raw, i.smooth) : raw;
  return { line, guides: [0], range: [-1, 1] };
};
var trix = (c, i) => {
  const src = _srcOf(c, i.source);
  const e3 = _ema2(_ema2(_ema2(src, i.period), i.period), i.period);
  const line = e3.map((v, k) => k > 0 && v != null && e3[k - 1] ? 1e4 * (v - e3[k - 1]) / e3[k - 1] : null);
  const sig = _ema2(line, i.sig).map((v, k) => line[k] == null ? null : v);
  return { line, signal: sig, guides: [0] };
};
var volume = (c, i) => {
  if (!_hasVol(c.volume)) return { hist: new Array(c.close.length).fill(null) };
  return {
    hist: c.volume,
    line: _sma2(c.volume.map((v) => v || 0), i.maLen),
    palette: (_, k) => c.close[k] >= c.open[k] ? _UP : _DN
  };
};
var adline = (c) => {
  if (!_hasVol(c.volume)) return _nullLine(c.close.length);
  const out = new Array(c.close.length).fill(null);
  let ad = 0;
  for (let k = 0; k < c.close.length; k++) {
    ad += _mfm(c.high[k], c.low[k], c.close[k]) * (c.volume[k] || 0);
    out[k] = ad;
  }
  return { line: out };
};
var chaikinOsc = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const ad = new Array(c.close.length).fill(0);
  let acc = 0;
  for (let k = 0; k < c.close.length; k++) {
    acc += _mfm(c.high[k], c.low[k], c.close[k]) * (c.volume[k] || 0);
    ad[k] = acc;
  }
  const ef = _ema2(ad, i.fast), es = _ema2(ad, i.slow);
  return { line: ad.map((_, k) => ef[k] != null && es[k] != null ? ef[k] - es[k] : null), guides: [0] };
};
var eom = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, emv = new Array(n).fill(null);
  const scale = i.scale || 1e8;
  for (let k = 1; k < n; k++) {
    const dm = (c.high[k] + c.low[k]) / 2 - (c.high[k - 1] + c.low[k - 1]) / 2;
    const rng = c.high[k] - c.low[k];
    const vol = c.volume[k] || 0;
    const br = vol ? vol / scale / (rng || 1e-9) : 0;
    emv[k] = br ? dm / br : 0;
  }
  const line = _sma2(emv.map((v) => v == null ? 0 : v), i.period).map((v, k) => k < i.period ? null : v);
  return { line, guides: [0] };
};
var forceIndex = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, raw = new Array(n).fill(null);
  for (let k = 1; k < n; k++) raw[k] = (c.close[k] - c.close[k - 1]) * (c.volume[k] || 0);
  const line = _ema2(raw, i.period).map((v, k) => k < 1 ? null : v);
  return { line, guides: [0] };
};
var klinger = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, vf = new Array(n).fill(0);
  let trend = 1, cm = 0, prevDm = 0, prevTrend = 1;
  for (let k = 1; k < n; k++) {
    const hlc = c.high[k] + c.low[k] + c.close[k];
    const hlcPrev = c.high[k - 1] + c.low[k - 1] + c.close[k - 1];
    const dm = c.high[k] - c.low[k];
    trend = hlc > hlcPrev ? 1 : -1;
    if (trend === prevTrend) cm = cm + dm;
    else cm = prevDm + dm;
    const vol = c.volume[k] || 0;
    const ratio = cm ? Math.abs(2 * (dm / cm) - 1) : 0;
    vf[k] = vol * ratio * trend * 100;
    prevTrend = trend;
    prevDm = dm;
  }
  const ef = _ema2(vf, i.fast), es = _ema2(vf, i.slow);
  const kvo = vf.map((_, k) => ef[k] != null && es[k] != null ? ef[k] - es[k] : null);
  const sig = _ema2(kvo, i.sig).map((v, k) => kvo[k] == null ? null : v);
  return { line: kvo, signal: sig, guides: [0] };
};
var pvt = (c) => {
  if (!_hasVol(c.volume)) return _nullLine(c.close.length);
  const out = new Array(c.close.length).fill(null);
  let acc = 0;
  out[0] = 0;
  for (let k = 1; k < c.close.length; k++) {
    const r = c.close[k - 1] ? (c.close[k] - c.close[k - 1]) / c.close[k - 1] : 0;
    acc += r * (c.volume[k] || 0);
    out[k] = acc;
  }
  return { line: out };
};
var _bollinger = (src, p, mult) => {
  const basis = _sma2(src, p), sd = _stdev2(src, p);
  const upper = src.map((_, k) => basis[k] != null && sd[k] != null ? basis[k] + mult * sd[k] : null);
  const lower = src.map((_, k) => basis[k] != null && sd[k] != null ? basis[k] - mult * sd[k] : null);
  return { basis, upper, lower };
};
var bbpercent = (c, i) => {
  const s = _srcOf(c, i.source);
  const b = _bollinger(s, i.period, i.mult);
  return { line: b.upper.map((u, k) => u != null ? (s[k] - b.lower[k]) / (u - b.lower[k] || 1e-9) : null), guides: [0, 0.5, 1], range: [-0.5, 1.5] };
};
var bbw = (c, i) => {
  const s = _srcOf(c, i.source);
  const b = _bollinger(s, i.period, i.mult);
  return { line: b.upper.map((u, k) => u != null && b.basis[k] ? (u - b.lower[k]) / b.basis[k] : null) };
};
var _pivotLevels = (h, l, cl, prevClose, type) => {
  const rng = h - l;
  let P, r1, r2, r3, s1, s2, s3;
  if (type === "Fibonacci") {
    P = (h + l + cl) / 3;
    r1 = P + 0.382 * rng;
    r2 = P + 0.618 * rng;
    r3 = P + 1 * rng;
    s1 = P - 0.382 * rng;
    s2 = P - 0.618 * rng;
    s3 = P - 1 * rng;
  } else if (type === "Camarilla") {
    P = (h + l + cl) / 3;
    r1 = cl + 1.1 * rng / 12;
    r2 = cl + 1.1 * rng / 6;
    r3 = cl + 1.1 * rng / 4;
    s1 = cl - 1.1 * rng / 12;
    s2 = cl - 1.1 * rng / 6;
    s3 = cl - 1.1 * rng / 4;
  } else if (type === "Woodie") {
    P = (h + l + 2 * cl) / 4;
    r1 = 2 * P - l;
    s1 = 2 * P - h;
    r2 = P + rng;
    s2 = P - rng;
    r3 = h + 2 * (P - l);
    s3 = l - 2 * (h - P);
  } else if (type === "DM") {
    let X;
    if (cl < (prevClose ?? cl)) X = h + 2 * l + cl;
    else if (cl > (prevClose ?? cl)) X = 2 * h + l + cl;
    else X = h + l + 2 * cl;
    P = X / 4;
    r1 = X / 2 - l;
    s1 = X / 2 - h;
    r2 = null;
    r3 = null;
    s2 = null;
    s3 = null;
  } else {
    P = (h + l + cl) / 3;
    r1 = 2 * P - l;
    s1 = 2 * P - h;
    r2 = P + rng;
    s2 = P - rng;
    r3 = h + 2 * (P - l);
    s3 = l - 2 * (h - P);
  }
  return { P, r1, r2, r3, s1, s2, s3 };
};
var pivotsMulti = (c, i) => {
  const n = c.close.length, type = i.pivotType || "Classic";
  const P = new Array(n).fill(null), R1 = new Array(n).fill(null), R2 = new Array(n).fill(null), R3 = new Array(n).fill(null), S1 = new Array(n).fill(null), S2 = new Array(n).fill(null), S3 = new Array(n).fill(null);
  const set = (k, pv) => {
    if (!pv) return;
    const lv = _pivotLevels(pv.H, pv.L, pv.C, pv.PC, type);
    P[k] = lv.P;
    R1[k] = lv.r1;
    R2[k] = lv.r2;
    R3[k] = lv.r3;
    S1[k] = lv.s1;
    S2[k] = lv.s2;
    S3[k] = lv.s3;
  };
  const times = c.time;
  if (!times || !times.length) {
    for (let k = 1; k < n; k++) set(k, { H: c.high[k - 1], L: c.low[k - 1], C: c.close[k - 1], PC: k > 1 ? c.close[k - 2] : null });
  } else {
    const dayOf = (t) => Math.floor((t || 0) / 86400);
    let curDay = null, dH = -Infinity, dL = Infinity, dC = null, prev = null;
    for (let k = 0; k < n; k++) {
      const d = dayOf(times[k]);
      if (curDay === null) {
        curDay = d;
        dH = c.high[k];
        dL = c.low[k];
        dC = c.close[k];
      } else if (d !== curDay) {
        prev = { H: dH, L: dL, C: dC, PC: prev ? prev.C : null };
        curDay = d;
        dH = c.high[k];
        dL = c.low[k];
        dC = c.close[k];
      } else {
        dH = Math.max(dH, c.high[k]);
        dL = Math.min(dL, c.low[k]);
        dC = c.close[k];
      }
      set(k, prev);
    }
  }
  return {
    lines: [
      { data: R3, color: "#dc2626", dashed: true, gaps: true, name: "R3" },
      { data: R2, color: "#ef4444", dashed: true, gaps: true, name: "R2" },
      { data: R1, color: "#f87171", dashed: true, gaps: true, name: "R1" },
      { data: P, color: "#94a3b8", gaps: true, name: "P" },
      { data: S1, color: "#4ade80", dashed: true, gaps: true, name: "S1" },
      { data: S2, color: "#22c55e", dashed: true, gaps: true, name: "S2" },
      { data: S3, color: "#16a34a", dashed: true, gaps: true, name: "S3" }
    ]
  };
};
var pivotHL = (c, i) => {
  const m = [];
  for (let k = i.left; k < c.high.length - i.right; k++) {
    let ph = true, pl = true;
    for (let j = 1; j <= i.left; j++) {
      if (c.high[k - j] >= c.high[k]) ph = false;
      if (c.low[k - j] <= c.low[k]) pl = false;
    }
    for (let j = 1; j <= i.right; j++) {
      if (c.high[k + j] >= c.high[k]) ph = false;
      if (c.low[k + j] <= c.low[k]) pl = false;
    }
    if (ph) m.push({ time: c.time[k], position: "aboveBar", shape: "arrowDown", color: _DN, text: "H" });
    if (pl) m.push({ time: c.time[k], position: "belowBar", shape: "arrowUp", color: _UP, text: "L" });
  }
  return { markers: m };
};
var fractals = (c, i) => {
  const n2 = i.n || 2, m = [];
  for (let k = n2; k < c.high.length - n2; k++) {
    let up = true, dn = true;
    for (let j = 1; j <= n2; j++) {
      if (c.high[k - j] >= c.high[k] || c.high[k + j] >= c.high[k]) up = false;
      if (c.low[k - j] <= c.low[k] || c.low[k + j] <= c.low[k]) dn = false;
    }
    if (up) m.push({ time: c.time[k], position: "aboveBar", shape: "arrowDown", color: "#f59e0b", text: "\u25B2" });
    if (dn) m.push({ time: c.time[k], position: "belowBar", shape: "arrowUp", color: "#3b82f6", text: "\u25BC" });
  }
  return { markers: m };
};
var candlePatterns = (c, i) => {
  const T = c.time || [];
  const cs = T.map((t, k) => ({ t, o: c.open[k], h: c.high[k], l: c.low[k], c: c.close[k] }));
  const m = detectCandlePatterns(cs).map((d) => ({
    time: d.t,
    position: d.dir === "bear" ? "aboveBar" : "belowBar",
    shape: d.dir === "bull" ? "arrowUp" : d.dir === "bear" ? "arrowDown" : "circle",
    color: d.dir === "bull" ? _UP : d.dir === "bear" ? _DN : "#9598a1",
    text: (d.label || "").split("\u060C ")[0]
    // فقط الگوی اصلی (برچسبِ کوتاه) تا شلوغ نشود
  }));
  const n = i && i.count ? Math.max(1, i.count | 0) : 10;
  return { markers: m.slice(-n) };
};
var _zigzagPivots = (highs, lows, devPct) => {
  const n = highs.length;
  if (n < 2) return [];
  const piv = [];
  let lastIdx = 0, lastHigh = highs[0], lastLow = lows[0], dir = 0;
  const th = devPct / 100;
  for (let k = 1; k < n; k++) {
    if (dir >= 0) {
      if (highs[k] > lastHigh) {
        lastHigh = highs[k];
        lastIdx = k;
      }
      if (lows[k] < lastHigh * (1 - th)) {
        piv.push({ idx: lastIdx, price: lastHigh, dir: 1 });
        dir = -1;
        lastLow = lows[k];
        lastIdx = k;
      }
    }
    if (dir <= 0) {
      if (lows[k] < lastLow) {
        lastLow = lows[k];
        lastIdx = k;
      }
      if (highs[k] > lastLow * (1 + th)) {
        piv.push({ idx: lastIdx, price: lastLow, dir: -1 });
        dir = 1;
        lastHigh = highs[k];
        lastIdx = k;
      }
    }
  }
  piv.push({ idx: lastIdx, price: dir >= 0 ? lastHigh : lastLow, dir: dir >= 0 ? 1 : -1 });
  return piv;
};
var zigzag = (c, i) => {
  const piv = _zigzagPivots(c.high, c.low, i.dev);
  const line = new Array(c.close.length).fill(null);
  const m = [];
  for (const pv of piv) {
    line[pv.idx] = pv.price;
    m.push({ time: c.time[pv.idx], position: pv.dir === 1 ? "aboveBar" : "belowBar", shape: "circle", color: pv.dir === 1 ? _DN : _UP });
  }
  return { lines: [{ data: line, color: i.color || "#f59e0b", connectNulls: true, name: "ZigZag" }], markers: m };
};
var autoFib = (c, i) => {
  const piv = _zigzagPivots(c.high, c.low, i.dev);
  if (piv.length < 2) return { levels: [] };
  const b = piv[piv.length - 1], a = piv[piv.length - 2];
  const lo = Math.min(a.price, b.price), hi = Math.max(a.price, b.price), rng = hi - lo;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const palette = ["#94a3b8", "#f87171", "#fb923c", "#facc15", "#4ade80", "#22d3ee", "#94a3b8"];
  const up = b.price >= a.price;
  const levels = ratios.map((r, idx) => ({
    price: up ? hi - rng * r : lo + rng * r,
    color: palette[idx],
    label: (r * 100).toFixed(1) + "\u066A",
    extendRight: true
  }));
  return { levels };
};
var srLevels = (c, i) => {
  const lb = i.lookback || 15, tolPct = (i.tol || 0.1) / 100;
  const piv = [];
  for (let k = lb; k < c.high.length - lb; k++) {
    let ph = true, pl = true;
    for (let j = 1; j <= lb; j++) {
      if (c.high[k - j] >= c.high[k] || c.high[k + j] >= c.high[k]) ph = false;
      if (c.low[k - j] <= c.low[k] || c.low[k + j] <= c.low[k]) pl = false;
    }
    if (ph) piv.push(c.high[k]);
    if (pl) piv.push(c.low[k]);
  }
  piv.sort((a, b) => a - b);
  const clusters = [];
  for (const p of piv) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p - last.sum / last.count) <= last.sum / last.count * tolPct) {
      last.sum += p;
      last.count++;
    } else clusters.push({ sum: p, count: 1 });
  }
  const levels = clusters.filter((cl) => cl.count >= 2).map((cl) => {
    const price = cl.sum / cl.count;
    return { price, color: cl.count >= 4 ? "#f59e0b" : cl.count >= 3 ? "#fbbf24" : "#94a3b8", label: "S/R \xD7" + cl.count, extendRight: true };
  });
  return { levels };
};
var supplyDemand = (c, i) => {
  const a = _atr(c.high, c.low, c.close, i.atrLen || 14);
  const mult = i.impulse || 2;
  const levels = [];
  for (let k = 1; k < c.close.length - 1; k++) {
    if (a[k] == null) continue;
    const move = Math.abs(c.close[k + 1] - c.open[k + 1]);
    if (move >= mult * a[k]) {
      const up = c.close[k + 1] >= c.open[k + 1];
      levels.push({ price: c.high[k], color: up ? "#22c55e" : "#ef4444", label: up ? "\u062A\u0642\u0627\u0636\u0627" : "\u0639\u0631\u0636\u0647", extendRight: true });
      levels.push({ price: c.low[k], color: up ? "#22c55e" : "#ef4444", label: "", extendRight: true });
    }
  }
  return { levels: levels.slice(-Math.max(2, (i.maxZones || 5) * 2)) };
};
var chandelierExit = (c, i) => {
  const p = i.period || 22, mult = i.mult || 3;
  const atrV = _atr(c.high, c.low, c.close, p);
  const hh = _highest(c.close, p), ll = _lowest(c.close, p);
  const n = c.close.length;
  const green = new Array(n).fill(null), red = new Array(n).fill(null);
  let dir = 1, prevLong = null, prevShort = null;
  for (let k = 0; k < n; k++) {
    if (atrV[k] == null || hh[k] == null || ll[k] == null) continue;
    let ls = hh[k] - mult * atrV[k];
    let ss = ll[k] + mult * atrV[k];
    if (prevLong != null && c.close[k - 1] != null && c.close[k - 1] > prevLong) ls = Math.max(ls, prevLong);
    if (prevShort != null && c.close[k - 1] != null && c.close[k - 1] < prevShort) ss = Math.min(ss, prevShort);
    if (dir === -1 && prevShort != null && c.close[k] > prevShort) dir = 1;
    else if (dir === 1 && prevLong != null && c.close[k] < prevLong) dir = -1;
    if (dir === 1) green[k] = ls;
    else red[k] = ss;
    prevLong = ls;
    prevShort = ss;
  }
  return { lines: [{ data: green, color: "#22c55e", gaps: true }, { data: red, color: "#ef4444", gaps: true }] };
};
var ulcerIndex = (c, i) => {
  const p = i.period || 14, close = c.close, n = close.length;
  const hc = _highest(close, p);
  const dd2 = new Array(n).fill(null);
  for (let k = 0; k < n; k++) {
    if (hc[k] == null || hc[k] === 0) continue;
    const pct = 100 * (close[k] - hc[k]) / hc[k];
    dd2[k] = pct * pct;
  }
  const out = new Array(n).fill(null);
  for (let k = p - 1; k < n; k++) {
    let sum = 0, cnt = 0;
    for (let j = 0; j < p; j++) {
      const v = dd2[k - j];
      if (v == null) {
        cnt = -1;
        break;
      }
      sum += v;
      cnt++;
    }
    if (cnt === p) out[k] = Math.sqrt(sum / p);
  }
  return { line: out, guides: [5] };
};
var _aroonUpDown = (highs, lows, p) => {
  const up = new Array(highs.length).fill(null), down = new Array(highs.length).fill(null);
  for (let i = p; i < highs.length; i++) {
    let hi = -Infinity, lo = Infinity, hb = 0, lb = 0;
    for (let j = 0; j <= p; j++) {
      if (highs[i - j] > hi) {
        hi = highs[i - j];
        hb = j;
      }
      if (lows[i - j] < lo) {
        lo = lows[i - j];
        lb = j;
      }
    }
    up[i] = 100 * (p - hb) / p;
    down[i] = 100 * (p - lb) / p;
  }
  return { up, down };
};
var aroonOsc = (c, i) => {
  const a = _aroonUpDown(c.high, c.low, i.period);
  const line = a.up.map((u, k) => u == null || a.down[k] == null ? null : u - a.down[k]);
  return { line, guides: [0], range: [-100, 100] };
};
var pvo = (c, i) => {
  const vol = _hasVol(c.volume) ? c.volume : c.close.map(() => 1);
  const fast = _ema2(vol, i.fast), slow = _ema2(vol, i.slow);
  const line = fast.map((f, k) => f == null || slow[k] == null || !slow[k] ? null : (f - slow[k]) / slow[k] * 100);
  const signal = _ema2(line, i.sig);
  const hist = line.map((v, k) => v == null || signal[k] == null ? null : v - signal[k]);
  return { line, signal, hist, macd: true, guides: [0] };
};
var adr = (c, i) => {
  const rng = c.high.map((h, k) => h == null || c.low[k] == null ? null : h - c.low[k]);
  return { line: _sma2(rng, i.period), guides: [] };
};
var medianInd = (c, i) => {
  const src = _srcOf(c, i.source), n = src.length, out = new Array(n).fill(null), p = i.period;
  for (let k = p - 1; k < n; k++) {
    const w = [];
    let ok = true;
    for (let j = 0; j < p; j++) {
      const v = src[k - j];
      if (v == null) {
        ok = false;
        break;
      }
      w.push(v);
    }
    if (!ok) continue;
    w.sort((a, b) => a - b);
    const m = w.length;
    out[k] = m % 2 ? w[(m - 1) / 2] : (w[m / 2 - 1] + w[m / 2]) / 2;
  }
  return { line: out };
};
var _cciSeries = (c, p) => {
  const n = c.close.length, tp = new Array(n);
  for (let k = 0; k < n; k++) tp[k] = (c.high[k] + c.low[k] + c.close[k]) / 3;
  const ma = _sma2(tp, p), out = new Array(n).fill(null);
  for (let k = p - 1; k < n; k++) {
    let md = 0;
    for (let j = 0; j < p; j++) md += Math.abs(tp[k - j] - ma[k]);
    md /= p;
    out[k] = md ? (tp[k] - ma[k]) / (0.015 * md) : 0;
  }
  return out;
};
var woodiesCci = (c, i) => ({ line: _cciSeries(c, i.slow), signal: _cciSeries(c, i.fast), guides: [100, 0, -100] });
var _emaAlpha = (src, period) => {
  const out = new Array(src.length).fill(null), a = 2 / period;
  let prev = null;
  for (let k = 0; k < src.length; k++) {
    const v = src[k];
    if (v == null) {
      out[k] = prev;
      continue;
    }
    prev = prev == null ? v : prev + a * (v - prev);
    out[k] = prev;
  }
  return out;
};
var pmo = (c, i) => {
  const cl = c.close, n = cl.length, roc2 = new Array(n).fill(null);
  for (let k = 1; k < n; k++) if (cl[k - 1]) roc2[k] = (cl[k] / cl[k - 1] - 1) * 100 * 10;
  const s1 = _emaAlpha(roc2, i.len1), line = _emaAlpha(s1, i.len2), signal = _ema2(line, i.sig);
  return { line, signal, guides: [0] };
};
var _volIndex = (c, positive) => {
  const cl = c.close, vol = _hasVol(c.volume) ? c.volume : cl.map(() => 1), n = cl.length, out = new Array(n).fill(null);
  let idx = 1e3;
  if (n) out[0] = 1e3;
  for (let k = 1; k < n; k++) {
    const up = vol[k] > vol[k - 1], dn = vol[k] < vol[k - 1];
    if ((positive && up || !positive && dn) && cl[k - 1]) idx += (cl[k] - cl[k - 1]) / cl[k - 1] * idx;
    out[k] = idx;
  }
  return out;
};
var pvi = (c) => ({ line: _volIndex(c, true) });
var nvi = (c) => ({ line: _volIndex(c, false) });
var rviVol = (c, i) => {
  const src = _srcOf(c, i.source), n = src.length, sd = _stdev2(src, i.stdevLen);
  const up = new Array(n).fill(null), dn = new Array(n).fill(null);
  for (let k = 1; k < n; k++) {
    if (sd[k] == null) continue;
    if (src[k] > src[k - 1]) {
      up[k] = sd[k];
      dn[k] = 0;
    } else if (src[k] < src[k - 1]) {
      up[k] = 0;
      dn[k] = sd[k];
    } else {
      up[k] = 0;
      dn[k] = 0;
    }
  }
  const ua = _ema2(up, i.length), da = _ema2(dn, i.length), out = new Array(n).fill(null);
  for (let k = 0; k < n; k++) if (ua[k] != null && da[k] != null) {
    const s = ua[k] + da[k];
    out[k] = s ? 100 * ua[k] / s : 0;
  }
  return { line: out, guides: [20, 50, 80], range: [0, 100] };
};
var linRegChannel = (c, i) => {
  const src = _srcOf(c, i.source);
  const n = src.length, len = Math.max(2, Math.round(i.length || 100)), mult = i.mult || 2;
  const basis = new Array(n).fill(null), upper = new Array(n).fill(null), lower = new Array(n).fill(null);
  const sx = (len - 1) * len / 2;
  const sxx = (len - 1) * len * (2 * len - 1) / 6;
  const denom = len * sxx - sx * sx || 1e-9;
  for (let k = len - 1; k < n; k++) {
    let sy = 0, sxy = 0;
    for (let j = 0; j < len; j++) {
      const y = src[k - len + 1 + j];
      sy += y;
      sxy += j * y;
    }
    const slope = (len * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / len;
    const b = intercept + slope * (len - 1);
    let ss = 0;
    for (let j = 0; j < len; j++) {
      const e = src[k - len + 1 + j] - (intercept + slope * j);
      ss += e * e;
    }
    const sd = Math.sqrt(ss / len);
    basis[k] = b;
    upper[k] = b + mult * sd;
    lower[k] = b - mult * sd;
  }
  return { upper, basis, lower, multi: true };
};
var volumeOsc = (c, i) => {
  if (!_hasVol(c.volume)) return _nullLine(c.close.length);
  const vol = c.volume.map((v) => v || 0);
  const short = _ema2(vol, Math.max(1, Math.round(i.shortLen || 5)));
  const long = _ema2(vol, Math.max(2, Math.round(i.longLen || 10)));
  const line = short.map((s, k) => s == null || long[k] == null || !long[k] ? null : (s - long[k]) / long[k] * 100);
  return { line, guides: [0] };
};
var volatilityStop = (c, i) => {
  const src = c.close, n = src.length;
  const period = Math.max(1, Math.round(i.period || 20)), mult = i.mult || 2;
  const atr2 = _atr(c.high, c.low, c.close, period);
  const up = new Array(n).fill(null), dn = new Array(n).fill(null);
  let uptrend = true, stop = null, max = src[0], min = src[0];
  for (let k = 0; k < n; k++) {
    if (atr2[k] == null) {
      max = src[k];
      min = src[k];
      continue;
    }
    const atrM = mult * atr2[k];
    max = Math.max(max, src[k]);
    min = Math.min(min, src[k]);
    stop = stop == null ? uptrend ? max - atrM : min + atrM : uptrend ? Math.max(stop, max - atrM) : Math.min(stop, min + atrM);
    const nu = src[k] - stop >= 0;
    if (nu !== uptrend) {
      uptrend = nu;
      max = src[k];
      min = src[k];
      stop = uptrend ? max - atrM : min + atrM;
    }
    if (uptrend) up[k] = stop;
    else dn[k] = stop;
  }
  return { lines: [{ data: up, color: "#22c55e", gaps: true }, { data: dn, color: "#ef4444", gaps: true }] };
};
var typicalPrice = (c) => ({ line: _hlc3(c) });
var weightedClose = (c) => ({ line: _hlcc4(c) });
var EXT_REGISTRY_B = {
  // — اندیکاتورهای غایبِ TV (batch ۱) —
  aroonOsc: { label: "\u0627\u0633\u06CC\u0644\u0627\u062A\u0648\u0631\u0650 \u0622\u0631\u0648\u0646 (Aroon Oscillator)", pane: "sub", inputs: { period: 14 }, color: "#22c55e", calc: aroonOsc },
  pvo: { label: "\u0646\u0648\u0633\u0627\u0646\u200C\u06AF\u0631\u0650 \u062D\u062C\u0645\u06CC\u0650 \u062F\u0631\u0635\u062F\u06CC (PVO)", pane: "sub", inputs: { fast: 12, slow: 26, sig: 9 }, color: "#60a5fa", calc: pvo },
  adr: { label: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646\u0650 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0631\u0648\u0632\u0627\u0646\u0647 (ADR)", pane: "sub", inputs: { period: 14 }, color: "#f59e0b", calc: adr },
  median: { label: "\u0642\u06CC\u0645\u062A\u0650 \u0645\u06CC\u0627\u0646\u0647 (Median)", pane: "main", inputs: { period: 3, source: "hl2" }, color: "#a78bfa", calc: medianInd },
  typicalPrice: { label: "\u0642\u06CC\u0645\u062A\u0650 \u062A\u06CC\u067E\u06CC\u06A9 (Typical Price)", pane: "main", inputs: {}, color: "#a78bfa", calc: typicalPrice },
  weightedClose: { label: "\u0642\u06CC\u0645\u062A\u0650 \u0648\u0632\u0646\u06CC\u0650 \u0628\u0633\u062A\u0647 (Weighted Close)", pane: "main", inputs: {}, color: "#fb923c", calc: weightedClose },
  // — اندیکاتورهای غایبِ TV (batch ۲) —
  woodiesCci: { label: "CCI\u0650 \u0648\u0648\u062F\u06CC (Woodies CCI)", pane: "sub", inputs: { slow: 14, fast: 6 }, color: "#f59e0b", calc: woodiesCci },
  pmo: { label: "\u0646\u0648\u0633\u0627\u0646\u200C\u06AF\u0631\u0650 \u0645\u0648\u0645\u0646\u062A\u0648\u0645\u0650 \u0642\u06CC\u0645\u062A (PMO)", pane: "sub", inputs: { len1: 35, len2: 20, sig: 10 }, color: "#60a5fa", calc: pmo },
  pvi: { label: "\u0634\u0627\u062E\u0635\u0650 \u062D\u062C\u0645\u0650 \u0645\u062B\u0628\u062A (PVI)", pane: "sub", inputs: {}, color: "#22c55e", calc: pvi },
  nvi: { label: "\u0634\u0627\u062E\u0635\u0650 \u062D\u062C\u0645\u0650 \u0645\u0646\u0641\u06CC (NVI)", pane: "sub", inputs: {}, color: "#ef4444", calc: nvi },
  rviVol: { label: "\u0634\u0627\u062E\u0635\u0650 \u0646\u0648\u0633\u0627\u0646\u200C\u067E\u0630\u06CC\u0631\u06CC\u0650 \u0646\u0633\u0628\u06CC (RVI)", pane: "sub", inputs: { length: 14, stdevLen: 10, source: "close" }, color: "#a78bfa", calc: rviVol },
  // — §5.2 مومنتوم / اسیلاتورها —
  mom: { label: "\u0645\u0648\u0645\u0646\u062A\u0648\u0645", pane: "sub", inputs: { period: 10, source: "close" }, color: "#60a5fa", calc: mom },
  // — استاپ‌های نوسانی / ریسک (افزودهٔ پانچ‌لیست #۴۶۱) —
  chandelier: { label: "\u062E\u0631\u0648\u062C\u0650 \u0686\u0627\u0646\u062F\u0644\u06CC\u0631 (Chandelier Exit)", pane: "main", inputs: { period: 22, mult: 3 }, color: "#22c55e", calc: chandelierExit },
  volatilityStop: { label: "\u0627\u0633\u062A\u0627\u067E\u0650 \u0646\u0648\u0633\u0627\u0646\u06CC (Volatility Stop)", pane: "main", inputs: { period: 20, mult: 2 }, color: "#f59e0b", calc: volatilityStop },
  ulcer: { label: "\u0634\u0627\u062E\u0635\u0650 \u0622\u0644\u0633\u0631 (Ulcer Index)", pane: "sub", inputs: { period: 14 }, color: "#f59e0b", calc: ulcerIndex },
  roc: { label: "ROC (\u0646\u0631\u062E\u0650 \u062A\u063A\u06CC\u06CC\u0631)", pane: "sub", inputs: { period: 9, source: "close" }, color: "#f472b6", calc: roc },
  trix: { label: "TRIX", pane: "sub", inputs: { period: 18, sig: 9, source: "close" }, color: "#34d399", calc: trix },
  ac: { label: "\u0634\u062A\u0627\u0628\u200C\u062F\u0647\u0646\u062F\u0647 (AC)", pane: "sub", inputs: {}, color: "#22d3ee", calc: accelerator },
  uo: { label: "\u0627\u0633\u06CC\u0644\u0627\u062A\u0648\u0631\u0650 \u063A\u0627\u06CC\u06CC (UO)", pane: "sub", inputs: { short: 7, mid: 14, long: 28 }, color: "#a78bfa", calc: ultimateOsc },
  fisher: { label: "\u062A\u0628\u062F\u06CC\u0644\u0650 \u0641\u06CC\u0634\u0631", pane: "sub", inputs: { period: 9 }, color: "#fb923c", calc: fisher },
  crsi: { label: "Connors RSI", pane: "sub", inputs: { rsiLen: 3, streakLen: 2, rankLen: 100 }, color: "#e879f9", calc: connorsRsi },
  smiErgodic: { label: "SMI \u0627\u0631\u06AF\u0648\u062F\u06CC\u06A9", pane: "sub", inputs: { long: 20, short: 5, sig: 5 }, color: "#38bdf8", calc: smiErgodic },
  smi: { label: "\u0634\u0627\u062E\u0635\u0650 \u0645\u0648\u0645\u0646\u062A\u0648\u0645\u0650 \u0627\u0633\u062A\u0648\u06A9\u0627\u0633\u062A\u06CC\u06A9", pane: "sub", inputs: { period: 10, smoothK: 3, smoothD: 3 }, color: "#facc15", calc: smi },
  bop: { label: "\u062A\u0648\u0627\u0632\u0646\u0650 \u0642\u062F\u0631\u062A (BOP)", pane: "sub", inputs: { smooth: 1 }, color: "#c084fc", calc: bop },
  // — §5.3 (مشتقاتِ بولینگر؛ بخشی از بستهٔ B) —
  bbpercent: { label: "\u0628\u0627\u0646\u062F\u0650 \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631 \u066AB", pane: "sub", inputs: { period: 20, mult: 2, source: "close" }, color: "#22d3ee", calc: bbpercent },
  bbw: { label: "\u067E\u0647\u0646\u0627\u06CC \u0628\u0627\u0646\u062F\u0650 \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631", pane: "sub", inputs: { period: 20, mult: 2, source: "close" }, color: "#94a3b8", calc: bbw },
  // — §5.4 حجم —
  volume: { label: "\u062D\u062C\u0645", pane: "sub", inputs: { maLen: 20 }, color: "#089981", calc: volume },
  adline: { label: "\u062A\u062C\u0645\u0639/\u062A\u0648\u0632\u06CC\u0639 (A/D)", pane: "sub", inputs: {}, color: "#0ea5e9", calc: adline },
  chaikinOsc: { label: "\u0627\u0633\u06CC\u0644\u0627\u062A\u0648\u0631\u0650 \u0686\u0627\u06CC\u06A9\u06CC\u0646", pane: "sub", inputs: { fast: 3, slow: 10 }, color: "#f97316", calc: chaikinOsc },
  eom: { label: "\u0633\u0647\u0648\u0644\u062A\u0650 \u062D\u0631\u06A9\u062A (EoM)", pane: "sub", inputs: { period: 14, scale: 1e8 }, color: "#84cc16", calc: eom },
  forceIndex: { label: "\u0634\u0627\u062E\u0635\u0650 \u0646\u06CC\u0631\u0648 (Force Index)", pane: "sub", inputs: { period: 13 }, color: "#fb7185", calc: forceIndex },
  klinger: { label: "\u0627\u0633\u06CC\u0644\u0627\u062A\u0648\u0631\u0650 \u06A9\u0644\u06CC\u0646\u06AF\u0631", pane: "sub", inputs: { fast: 34, slow: 55, sig: 13 }, color: "#a855f7", calc: klinger },
  pvt: { label: "\u0631\u0648\u0646\u062F\u0650 \u0642\u06CC\u0645\u062A-\u062D\u062C\u0645 (PVT)", pane: "sub", inputs: {}, color: "#10b981", calc: pvt },
  volumeOsc: { label: "\u0646\u0648\u0633\u0627\u0646\u200C\u06AF\u0631\u0650 \u062D\u062C\u0645 (Volume Oscillator)", pane: "sub", inputs: { shortLen: 5, longLen: 10 }, color: "#22c55e", calc: volumeOsc },
  // — §5.5 پیووت / ساختار —
  pivotsMulti: { label: "\u067E\u06CC\u0648\u0648\u062A (\u0686\u0646\u062F\u0646\u0648\u0639\u0647)", pane: "main", inputs: { pivotType: "Classic" }, color: "#94a3b8", calc: pivotsMulti },
  pivotHL: { label: "\u0646\u0642\u0627\u0637\u0650 \u0686\u0631\u062E\u0634 \u0628\u0627\u0644\u0627/\u067E\u0627\u06CC\u06CC\u0646", pane: "main", inputs: { left: 5, right: 5 }, color: "#f59e0b", calc: pivotHL },
  fractals: { label: "\u0641\u0631\u06A9\u062A\u0627\u0644\u0650 \u0648\u06CC\u0644\u06CC\u0627\u0645\u0632", pane: "main", inputs: { n: 2 }, color: "#f59e0b", calc: fractals },
  candlePatterns: { label: "\u0627\u0644\u06AF\u0648\u0647\u0627\u06CC \u0634\u0645\u0639\u06CC (Candlestick)", pane: "main", inputs: { count: 10 }, color: "#9598a1", calc: candlePatterns },
  zigzag: { label: "\u0632\u06CC\u06AF\u0632\u0627\u06AF (ZigZag)", pane: "main", inputs: { dev: 5 }, color: "#f59e0b", calc: zigzag },
  autoFib: { label: "\u0641\u06CC\u0628\u0648\u0646\u0627\u0686\u06CC\u0650 \u062E\u0648\u062F\u06A9\u0627\u0631", pane: "main", inputs: { dev: 5 }, color: "#22d3ee", calc: autoFib },
  srLevels: { label: "\u062D\u0645\u0627\u06CC\u062A/\u0645\u0642\u0627\u0648\u0645\u062A", pane: "main", inputs: { lookback: 15, tol: 0.1 }, color: "#f59e0b", calc: srLevels },
  supplyDemand: { label: "\u0646\u0648\u0627\u062D\u06CC\u0650 \u0639\u0631\u0636\u0647/\u062A\u0642\u0627\u0636\u0627", pane: "main", inputs: { impulse: 2, atrLen: 14, maxZones: 5 }, color: "#22c55e", calc: supplyDemand },
  // — کانالِ رگرسیونِ خطیِ TV (افزودهٔ Loop #39) —
  linRegChannel: { label: "\u06A9\u0627\u0646\u0627\u0644\u0650 \u0631\u06AF\u0631\u0633\u06CC\u0648\u0646\u0650 \u062E\u0637\u06CC (Linear Regression)", pane: "main", inputs: { length: 100, mult: 2, source: "close" }, color: "#22d3ee", calc: linRegChannel }
};

// src/bazaarnama/indicators.js
var sma = (src, p) => {
  const out = new Array(src.length).fill(null);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= p) sum -= src[i - p];
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
};
var smaNull = (arr, p) => {
  const out = new Array(arr.length).fill(null);
  let sum = 0, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) {
      sum += v;
      cnt++;
    }
    const j = i - p;
    if (j >= 0) {
      const w = arr[j];
      if (w != null && Number.isFinite(w)) {
        sum -= w;
        cnt--;
      }
    }
    if (cnt === p) out[i] = sum / p;
  }
  return out;
};
var ema = (src, p) => {
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
var wma = (src, p) => {
  const out = new Array(src.length).fill(null);
  const denom = p * (p + 1) / 2;
  for (let i = p - 1; i < src.length; i++) {
    let s = 0;
    for (let j = 0; j < p; j++) s += src[i - j] * (p - j);
    out[i] = s / denom;
  }
  return out;
};
var hma = (src, p) => {
  const half = Math.max(1, Math.floor(p / 2));
  const sq = Math.max(1, Math.round(Math.sqrt(p)));
  const w1 = wma(src, half);
  const w2 = wma(src, p);
  const diff = src.map((_, i) => w1[i] != null && w2[i] != null ? 2 * w1[i] - w2[i] : null);
  const filled = diff.map((v) => v == null ? 0 : v);
  const h = wma(filled, sq);
  return h.map((v, i) => {
    for (let j = 0; j < sq; j++) if (i - j < 0 || diff[i - j] == null) return null;
    return v;
  });
};
var rsi = (closes, p = 14) => {
  const out = new Array(closes.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= p) {
      ag += g;
      al += l;
      if (i === p) {
        ag /= p;
        al /= p;
        out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
      }
    } else {
      ag = (ag * (p - 1) + g) / p;
      al = (al * (p - 1) + l) / p;
      out[i] = 100 - 100 / (1 + ag / (al || 1e-9));
    }
  }
  return out;
};
var macd = (closes, fast = 12, slow = 26, sig = 9) => {
  const ef = ema(closes, fast), es = ema(closes, slow);
  const line = closes.map((_, i) => ef[i] != null && es[i] != null ? ef[i] - es[i] : null);
  const signal = ema(line, sig).map((v, i) => line[i] == null ? null : v);
  const hist = line.map((v, i) => v != null && signal[i] != null ? v - signal[i] : null);
  return { macd: line, signal, hist };
};
var bollinger = (closes, p = 20, mult = 2) => {
  const basis = sma(closes, p);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = 0; j < p; j++) {
      const d = closes[i - j] - basis[i];
      s += d * d;
    }
    const sd = Math.sqrt(s / p);
    upper[i] = basis[i] + mult * sd;
    lower[i] = basis[i] - mult * sd;
  }
  return { basis, upper, lower };
};
var atr = (highs, lows, closes, p = 14) => {
  const tr = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr[i] = highs[i] - lows[i];
      continue;
    }
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const out = new Array(closes.length).fill(null);
  let prev = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < p) {
      if (i === p - 1) {
        let s = 0;
        for (let j = 0; j < p; j++) s += tr[j];
        prev = s / p;
        out[i] = prev;
      }
      continue;
    }
    prev = (prev * (p - 1) + tr[i]) / p;
    out[i] = prev;
  }
  return out;
};
var stoch = (highs, lows, closes, p = 14, d = 3) => {
  const k = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) {
      hh = Math.max(hh, highs[i - j]);
      ll = Math.min(ll, lows[i - j]);
    }
    k[i] = hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100;
  }
  const dd = smaNull(k, d);
  return { k, d: dd };
};
var vwap = (highs, lows, closes, vols, times) => {
  const out = new Array(closes.length).fill(null);
  let pv = 0, vv = 0, prevDay = null;
  for (let i = 0; i < closes.length; i++) {
    if (times && times[i] != null) {
      const day = Math.floor(times[i] / 86400);
      if (prevDay !== null && day !== prevDay) {
        pv = 0;
        vv = 0;
      }
      prevDay = day;
    }
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    pv += tp * (vols[i] || 0);
    vv += vols[i] || 0;
    out[i] = vv ? pv / vv : closes[i];
  }
  return out;
};
var avwap = (highs, lows, closes, vols, anchorBars = 100, mult = 1) => {
  const n = closes.length;
  const out = new Array(n).fill(null), up = new Array(n).fill(null), dn = new Array(n).fill(null);
  const start = Math.max(0, n - (anchorBars || n));
  let pv = 0, vv = 0, pv2 = 0;
  for (let i = start; i < n; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const v = vols[i] || 0;
    pv += tp * v;
    vv += v;
    pv2 += tp * tp * v;
    const vw = vv ? pv / vv : closes[i];
    out[i] = vw;
    const variance = vv ? Math.max(0, pv2 / vv - vw * vw) : 0;
    const sd = Math.sqrt(variance);
    up[i] = vw + (mult || 1) * sd;
    dn[i] = vw - (mult || 1) * sd;
  }
  return { vwap: out, upper: up, lower: dn };
};
var _trueRange = (h, l, c) => {
  const n = c.length, tr = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr[i] = h[i] - l[i];
      continue;
    }
    tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  }
  return tr;
};
var _sma3 = (arr, p) => {
  const n = arr.length, out = new Array(n).fill(null);
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += arr[i] || 0;
    if (i >= p) s -= arr[i - p] || 0;
    if (i >= p - 1) out[i] = s / p;
  }
  return out;
};
var choppiness = (h, l, c, p = 14) => {
  const n = c.length, tr = _trueRange(h, l, c), out = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let atrSum = 0, hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      atrSum += tr[j] || 0;
      hh = Math.max(hh, h[j]);
      ll = Math.min(ll, l[j]);
    }
    const rng = hh - ll;
    out[i] = rng > 0 ? 100 * Math.log10(atrSum / rng) / Math.log10(p) : null;
  }
  return out;
};
var vortex = (h, l, c, p = 14) => {
  const n = c.length, tr = _trueRange(h, l, c), vmP = new Array(n).fill(0), vmM = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    vmP[i] = Math.abs(h[i] - l[i - 1]);
    vmM[i] = Math.abs(l[i] - h[i - 1]);
  }
  const plus = new Array(n).fill(null), minus = new Array(n).fill(null);
  for (let i = p; i < n; i++) {
    let sTR = 0, sP = 0, sM = 0;
    for (let j = i - p + 1; j <= i; j++) {
      sTR += tr[j] || 0;
      sP += vmP[j];
      sM += vmM[j];
    }
    if (sTR > 0) {
      plus[i] = sP / sTR;
      minus[i] = sM / sTR;
    }
  }
  return { plus, minus };
};
var dpo = (c, p = 20) => {
  const sma2 = _sma3(c, p), n = c.length, out = new Array(n).fill(null), k = Math.floor(p / 2) + 1;
  for (let i = 0; i < n; i++) {
    if (sma2[i] != null && i - k >= 0) out[i] = c[i] - sma2[i];
  }
  return out;
};
var bop2 = (o, h, l, c) => c.map((cl, i) => {
  const rng = h[i] - l[i];
  return rng > 0 ? (cl - o[i]) / rng : 0;
});
var eom2 = (h, l, vol, p = 14) => {
  const n = h.length, raw = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const dm = (h[i] + l[i]) / 2 - (h[i - 1] + l[i - 1]) / 2;
    const br = (vol[i] || 1) / 1e8 / Math.max(h[i] - l[i], 1e-9);
    raw[i] = br > 0 ? dm / br : 0;
  }
  return _sma3(raw.map((x) => x == null ? 0 : x), p);
};
var _ema22 = (arr, p) => {
  const n = arr.length, out = new Array(n).fill(null), k = 2 / (p + 1);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v == null) {
      out[i] = prev;
      continue;
    }
    prev = prev == null ? v : v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
};
var _wma2 = (arr, p) => {
  const n = arr.length, out = new Array(n).fill(null), dw = p * (p + 1) / 2;
  for (let i = p - 1; i < n; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < p; j++) {
      const v = arr[i - j];
      if (v == null) {
        ok = false;
        break;
      }
      s += v * (p - j);
    }
    if (ok) out[i] = s / dw;
  }
  return out;
};
var _roc2 = (arr, p) => arr.map((v, i) => i >= p && arr[i - p] ? (v - arr[i - p]) / arr[i - p] * 100 : null);
var _smma2 = (arr, p) => {
  const n = arr.length, out = new Array(n).fill(null);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v == null) {
      out[i] = prev;
      continue;
    }
    if (prev == null) {
      if (i >= p - 1) {
        let s = 0;
        for (let j = 0; j < p; j++) s += arr[i - j];
        prev = s / p;
        out[i] = prev;
      }
    } else {
      prev = (prev * (p - 1) + v) / p;
      out[i] = prev;
    }
  }
  return out;
};
var elderRay = (h, l, c, p = 13) => {
  const e = _ema22(c, p);
  return { bull: h.map((x, i) => e[i] == null ? null : x - e[i]), bear: l.map((x, i) => e[i] == null ? null : x - e[i]) };
};
var chandeKroll = (h, l, c, p = 10, x = 1, q = 9) => {
  const atrv = _sma3(_trueRange(h, l, c), p);
  const n = c.length, hs = new Array(n).fill(null), ls = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      hh = Math.max(hh, h[j]);
      ll = Math.min(ll, l[j]);
    }
    hs[i] = hh - x * (atrv[i] || 0);
    ls[i] = ll + x * (atrv[i] || 0);
  }
  const hf = new Array(n).fill(null), lf = new Array(n).fill(null);
  for (let i = q - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - q + 1; j <= i; j++) {
      if (hs[j] != null) hh = Math.max(hh, hs[j]);
      if (ls[j] != null) ll = Math.min(ll, ls[j]);
    }
    hf[i] = hh === -Infinity ? null : hh;
    lf[i] = ll === Infinity ? null : ll;
  }
  return { high: hf, low: lf };
};
var massIndex = (h, l, p = 9, sum = 25) => {
  const n = h.length, range2 = h.map((x, i) => x - l[i]);
  const e1 = _ema22(range2, p), e2 = _ema22(e1, p);
  const ratio = e1.map((x, i) => x != null && e2[i] ? x / e2[i] : null);
  const out = new Array(n).fill(null);
  for (let i = sum - 1; i < n; i++) {
    let s = 0, ok = true;
    for (let j = 0; j < sum; j++) {
      const v = ratio[i - j];
      if (v == null) {
        ok = false;
        break;
      }
      s += v;
    }
    if (ok) out[i] = s;
  }
  return out;
};
var coppock = (c, a = 14, b = 11, w = 10) => {
  const r = _roc2(c, a), r2 = _roc2(c, b);
  const sum = r.map((x, i) => x != null && r2[i] != null ? x + r2[i] : null);
  return _wma2(sum, w);
};
var kst = (c) => {
  const r1 = _sma3(_roc2(c, 10), 10), r2 = _sma3(_roc2(c, 15), 10), r3 = _sma3(_roc2(c, 20), 10), r4 = _sma3(_roc2(c, 30), 15);
  const n = c.length, line = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (r1[i] != null && r2[i] != null && r3[i] != null && r4[i] != null) line[i] = r1[i] + 2 * r2[i] + 3 * r3[i] + 4 * r4[i];
  }
  return { line, signal: _sma3(line.map((x) => x == null ? 0 : x), 9) };
};
var alligator = (h, l) => {
  const med = h.map((x, i) => (x + l[i]) / 2);
  return { jaw: _smma2(med, 13), teeth: _smma2(med, 8), lips: _smma2(med, 5) };
};
var rvi = (o, h, l, c) => {
  const n = c.length, co = c.map((x, i) => x - o[i]), hl = h.map((x, i) => x - l[i]);
  const swma = (a) => {
    const out = new Array(n).fill(null);
    for (let i = 3; i < n; i++) {
      if ([a[i], a[i - 1], a[i - 2], a[i - 3]].some((v) => v == null)) continue;
      out[i] = (a[i] + 2 * a[i - 1] + 2 * a[i - 2] + a[i - 3]) / 6;
    }
    return out;
  };
  const num = swma(co), den = swma(hl);
  const line = num.map((x, i) => x != null && den[i] ? x / den[i] : null);
  const sig = new Array(n).fill(null);
  for (let i = 3; i < n; i++) {
    if ([line[i], line[i - 1], line[i - 2], line[i - 3]].some((v) => v == null)) continue;
    sig[i] = (line[i] + 2 * line[i - 1] + 2 * line[i - 2] + line[i - 3]) / 6;
  }
  return { line, signal: sig };
};
var bbWidth = (c, p = 20, mult = 2) => {
  const ma = _sma3(c, p), n = c.length, out = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let s = 0;
    for (let j = 0; j < p; j++) {
      const d = c[i - j] - ma[i];
      s += d * d;
    }
    const sd = Math.sqrt(s / p);
    out[i] = ma[i] ? 2 * mult * sd / ma[i] * 100 : null;
  }
  return out;
};
var stc = (c, fast = 23, slow = 50, cycle = 10) => {
  const ef = _ema22(c, fast), es = _ema22(c, slow);
  const macd2 = ef.map((x, i) => x != null && es[i] != null ? x - es[i] : null);
  const n = c.length;
  const stoch2 = (src, p) => {
    const out = new Array(n).fill(null);
    for (let i = p - 1; i < n; i++) {
      let hh = -Infinity, ll = Infinity, ok = true;
      for (let j = 0; j < p; j++) {
        const v = src[i - j];
        if (v == null) {
          ok = false;
          break;
        }
        hh = Math.max(hh, v);
        ll = Math.min(ll, v);
      }
      if (ok) out[i] = hh > ll ? (src[i] - ll) / (hh - ll) * 100 : 0;
    }
    return out;
  };
  const d1 = _ema22(stoch2(macd2, cycle), 3);
  const d2 = _ema22(stoch2(d1, cycle), 3);
  return d2;
};
var netVolume = (o, c, v) => c.map((cl, i) => (v[i] || 0) * (cl >= o[i] ? 1 : -1));
var stdErrBands = (c, p = 21, mult = 2) => {
  const n = c.length, mid = new Array(n).fill(null), up = new Array(n).fill(null), dn = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let j = 0; j < p; j++) {
      const x = j, y = c[i - p + 1 + j];
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const b = (p * sxy - sx * sy) / (p * sxx - sx * sx || 1);
    const a = (sy - b * sx) / p;
    const yhat = a + b * (p - 1);
    let se = 0;
    for (let j = 0; j < p; j++) {
      const x = j, y = c[i - p + 1 + j];
      const e = y - (a + b * x);
      se += e * e;
    }
    const stderr = Math.sqrt(se / Math.max(1, p - 2));
    mid[i] = yhat;
    up[i] = yhat + mult * stderr;
    dn[i] = yhat - mult * stderr;
  }
  return { mid, up, dn };
};
var accelerator2 = (h, l) => {
  const med = h.map((x, i) => (x + l[i]) / 2);
  const ao2 = _sma3(med, 5).map((v, i) => v != null && _sma3(med, 34)[i] != null ? v - _sma3(med, 34)[i] : null);
  return ao2.map((v, i) => v != null && _sma3(ao2.map((x) => x == null ? 0 : x), 5)[i] != null ? v - _sma3(ao2.map((x) => x == null ? 0 : x), 5)[i] : null);
};
var chaikinVol = (h, l, p = 10) => {
  const hl = h.map((x, i) => x - l[i]);
  const e = _ema22(hl, p);
  return e.map((v, i) => v != null && e[i - p] != null && e[i - p] !== 0 ? (v - e[i - p]) / e[i - p] * 100 : null);
};
var _resampleC = (c, f) => {
  f = Math.max(1, f | 0);
  const o = [], h = [], l = [], cl = [], v = [];
  for (let i = 0; i < c.close.length; i += f) {
    const end = Math.min(i + f, c.close.length);
    let mh = -Infinity, ml = Infinity, sv = 0;
    for (let j = i; j < end; j++) {
      if (c.high[j] > mh) mh = c.high[j];
      if (c.low[j] < ml) ml = c.low[j];
      sv += c.volume[j] || 0;
    }
    o.push(c.open[i]);
    h.push(mh);
    l.push(ml);
    cl.push(c.close[end - 1]);
    v.push(sv);
  }
  return { open: o, high: h, low: l, close: cl, volume: v };
};
var _expandA = (arr, f, len) => {
  f = Math.max(1, f | 0);
  const out = new Array(len).fill(null);
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < f; j++) {
      const idx = i * f + j;
      if (idx < len) out[idx] = arr[i];
    }
  }
  return out;
};
var supertrend = (highs, lows, closes, p = 10, mult = 3) => {
  const a = atr(highs, lows, closes, p);
  const line = new Array(closes.length).fill(null);
  const trend = new Array(closes.length).fill(null);
  let up = null, dn = null, dir = 1;
  for (let i = 0; i < closes.length; i++) {
    if (a[i] == null) continue;
    const mid = (highs[i] + lows[i]) / 2;
    let ub = mid + mult * a[i], lb = mid - mult * a[i];
    if (up != null) ub = ub < up || closes[i - 1] > up ? ub : up;
    if (dn != null) lb = lb > dn || closes[i - 1] < dn ? lb : dn;
    if (dir === 1 && closes[i] < (dn ?? lb)) dir = -1;
    else if (dir === -1 && closes[i] > (up ?? ub)) dir = 1;
    up = ub;
    dn = lb;
    trend[i] = dir;
    line[i] = dir === 1 ? lb : ub;
  }
  return { trend, line };
};
var _cciCore = (src, p) => {
  const m = sma(src, p);
  const out = new Array(src.length).fill(null);
  for (let i = p - 1; i < src.length; i++) {
    let md = 0;
    for (let j = 0; j < p; j++) md += Math.abs(src[i - j] - m[i]);
    md /= p;
    out[i] = md ? (src[i] - m[i]) / (0.015 * md) : 0;
  }
  return out;
};
var cci = (highs, lows, closes, p = 20) => _cciCore(closes.map((_, i) => (highs[i] + lows[i] + closes[i]) / 3), p);
var williamsR = (highs, lows, closes, p = 14) => {
  const out = new Array(closes.length).fill(null);
  for (let i = p - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) {
      hh = Math.max(hh, highs[i - j]);
      ll = Math.min(ll, lows[i - j]);
    }
    out[i] = hh === ll ? -50 : (hh - closes[i]) / (hh - ll) * -100;
  }
  return out;
};
var obv = (closes, vols) => {
  const out = new Array(closes.length).fill(null);
  let v = 0;
  out[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    v += closes[i] > closes[i - 1] ? vols[i] || 0 : closes[i] < closes[i - 1] ? -(vols[i] || 0) : 0;
    out[i] = v;
  }
  return out;
};
var ichimoku = (highs, lows, closes, t = 9, k = 26, b = 52) => {
  const mid = (p) => highs.map((_, i) => {
    if (i < p - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) {
      hh = Math.max(hh, highs[i - j]);
      ll = Math.min(ll, lows[i - j]);
    }
    return (hh + ll) / 2;
  });
  const tenkan = mid(t), kijun = mid(k), b52 = mid(b);
  const spanA = tenkan.map((v, i) => v != null && kijun[i] != null ? (v + kijun[i]) / 2 : null);
  return { tenkan, kijun, spanA, spanB: b52 };
};
var donchian = (highs, lows, p = 20) => {
  const up = new Array(highs.length).fill(null), lo = new Array(highs.length).fill(null), mid = new Array(highs.length).fill(null);
  for (let i = p - 1; i < highs.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < p; j++) {
      hh = Math.max(hh, highs[i - j]);
      ll = Math.min(ll, lows[i - j]);
    }
    up[i] = hh;
    lo[i] = ll;
    mid[i] = (hh + ll) / 2;
  }
  return { upper: up, basis: mid, lower: lo };
};
var keltner = (highs, lows, closes, p = 20, mult = 2) => {
  const basis = ema(closes, p), a = atr(highs, lows, closes, 10);
  return { basis, upper: basis.map((v, i) => v != null && a[i] != null ? v + mult * a[i] : null), lower: basis.map((v, i) => v != null && a[i] != null ? v - mult * a[i] : null) };
};
var adx = (highs, lows, closes, p = 14) => {
  const n = closes.length, tr = new Array(n).fill(0), pdm = new Array(n).fill(0), ndm = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    pdm[i] = up > dn && up > 0 ? up : 0;
    ndm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const sm = (a) => {
    const o = new Array(n).fill(null);
    let s = 0;
    for (let i = 1; i <= p; i++) s += a[i];
    o[p] = s;
    for (let i = p + 1; i < n; i++) {
      s = s - s / p + a[i];
      o[i] = s;
    }
    return o;
  };
  const str = sm(tr), spd = sm(pdm), snd = sm(ndm), out = new Array(n).fill(null);
  let adxPrev = null, dxs = [];
  for (let i = p; i < n; i++) {
    if (str[i] == null || !str[i]) continue;
    const pdi = 100 * spd[i] / str[i], ndi = 100 * snd[i] / str[i];
    const dx = pdi + ndi ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    dxs.push(dx);
    if (dxs.length === p) {
      adxPrev = dxs.reduce((x, y) => x + y, 0) / p;
      out[i] = adxPrev;
    } else if (adxPrev != null) {
      adxPrev = (adxPrev * (p - 1) + dx) / p;
      out[i] = adxPrev;
    }
  }
  return out;
};
var adxDI = (highs, lows, closes, p = 14) => {
  const n = closes.length;
  if (n < p + 2) return null;
  const tr = new Array(n).fill(0), pdm = new Array(n).fill(0), ndm = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
    pdm[i] = up > dn && up > 0 ? up : 0;
    ndm[i] = dn > up && dn > 0 ? dn : 0;
  }
  const sm = (a) => {
    const o = new Array(n).fill(null);
    let s = 0;
    for (let i = 1; i <= p; i++) s += a[i];
    o[p] = s;
    for (let i = p + 1; i < n; i++) {
      s = s - s / p + a[i];
      o[i] = s;
    }
    return o;
  };
  const str = sm(tr), spd = sm(pdm), snd = sm(ndm);
  const plusDI = new Array(n).fill(null), minusDI = new Array(n).fill(null), adxArr = new Array(n).fill(null);
  let adxPrev = null, dxs = [];
  for (let i = p; i < n; i++) {
    if (str[i] == null || !str[i]) continue;
    const pdi = 100 * spd[i] / str[i], ndi = 100 * snd[i] / str[i];
    plusDI[i] = pdi;
    minusDI[i] = ndi;
    const dx = pdi + ndi ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    dxs.push(dx);
    if (dxs.length === p) {
      adxPrev = dxs.reduce((x, y) => x + y, 0) / p;
      adxArr[i] = adxPrev;
    } else if (adxPrev != null) {
      adxPrev = (adxPrev * (p - 1) + dx) / p;
      adxArr[i] = adxPrev;
    }
  }
  return { adx: adxArr, plusDI, minusDI };
};
var dema = (closes, p = 20) => {
  const e = ema(closes, p), e2 = ema(e, p);
  return closes.map((_, i) => e[i] != null && e2[i] != null ? 2 * e[i] - e2[i] : null);
};
var tema = (closes, p = 20) => {
  const e1 = ema(closes, p), e2 = ema(e1, p), e3 = ema(e2, p);
  return closes.map((_, i) => e1[i] != null && e2[i] != null && e3[i] != null ? 3 * e1[i] - 3 * e2[i] + e3[i] : null);
};
var vwma = (closes, vols, p = 20) => {
  const pv = closes.map((c, i) => c * (vols[i] || 0));
  const spv = sma(pv, p), sv = sma(vols.map((v) => v || 0), p);
  return closes.map((_, i) => spv[i] != null && sv[i] ? spv[i] / sv[i] : null);
};
var psar = (highs, lows, start = 0.02, inc = 0.02, max = 0.2) => {
  const n = highs.length, out = new Array(n).fill(null);
  let trend = 1, af = start, ep = highs[0], sar = lows[0];
  for (let i = 1; i < n; i++) {
    sar = sar + af * (ep - sar);
    if (trend > 0) {
      if (lows[i] < sar) {
        trend = -1;
        sar = ep;
        ep = lows[i];
        af = start;
      } else if (highs[i] > ep) {
        ep = highs[i];
        af = Math.min(max, af + inc);
      }
    } else {
      if (highs[i] > sar) {
        trend = 1;
        sar = ep;
        ep = highs[i];
        af = start;
      } else if (lows[i] < ep) {
        ep = lows[i];
        af = Math.min(max, af + inc);
      }
    }
    out[i] = sar;
  }
  return out;
};
var aroon = (highs, lows, p = 14) => {
  const up = new Array(highs.length).fill(null), down = new Array(highs.length).fill(null);
  for (let i = p; i < highs.length; i++) {
    let hi = -Infinity, lo = Infinity, hb = 0, lb = 0;
    for (let j = 0; j <= p; j++) {
      if (highs[i - j] > hi) {
        hi = highs[i - j];
        hb = j;
      }
      if (lows[i - j] < lo) {
        lo = lows[i - j];
        lb = j;
      }
    }
    up[i] = 100 * (p - hb) / p;
    down[i] = 100 * (p - lb) / p;
  }
  return { up, down };
};
var mfi = (highs, lows, closes, vols, p = 14) => {
  const n = closes.length, tp = new Array(n), pos = new Array(n).fill(0), neg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    tp[i] = (highs[i] + lows[i] + closes[i]) / 3;
    const rmf = tp[i] * (vols[i] || 0);
    if (i > 0) {
      if (tp[i] > tp[i - 1]) pos[i] = rmf;
      else if (tp[i] < tp[i - 1]) neg[i] = rmf;
    }
  }
  const sp = sma(pos, p).map((v) => v == null ? null : v * p), sn = sma(neg, p).map((v) => v == null ? null : v * p);
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (sp[i] != null) out[i] = sn[i] ? 100 - 100 / (1 + sp[i] / sn[i]) : 100;
  return out;
};
var cmf = (highs, lows, closes, vols, p = 20) => {
  const n = closes.length, mfv = new Array(n);
  for (let i = 0; i < n; i++) {
    const rng = highs[i] - lows[i];
    mfv[i] = (rng ? (closes[i] - lows[i] - (highs[i] - closes[i])) / rng : 0) * (vols[i] || 0);
  }
  const sm = sma(mfv, p).map((v) => v == null ? null : v * p), sv = sma(vols.map((v) => v || 0), p).map((v) => v == null ? null : v * p);
  return closes.map((_, i) => sm[i] != null && sv[i] ? sm[i] / sv[i] : null);
};
var stochRsi = (closes, p = 14, k = 3, d = 3) => {
  const r = rsi(closes, p), n = closes.length, raw = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity, ok = 0;
    for (let j = 0; j < p; j++) {
      const v = r[i - j];
      if (v == null) continue;
      ok = 1;
      hh = Math.max(hh, v);
      ll = Math.min(ll, v);
    }
    if (ok && r[i] != null) raw[i] = hh === ll ? 0 : 100 * (r[i] - ll) / (hh - ll);
  }
  const ks = smaNull(raw, k);
  const ds = smaNull(ks, d);
  return { k: ks, d: ds };
};
var ao = (highs, lows) => {
  const mp = highs.map((_, i) => (highs[i] + lows[i]) / 2);
  const f = sma(mp, 5), s = sma(mp, 34);
  return mp.map((_, i) => f[i] != null && s[i] != null ? f[i] - s[i] : null);
};
var tsi = (closes, short = 13, long = 25) => {
  const n = closes.length, m = new Array(n).fill(0), am = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    m[i] = closes[i] - closes[i - 1];
    am[i] = Math.abs(m[i]);
  }
  const dbl = ema(ema(m, long), short), adbl = ema(ema(am, long), short);
  return closes.map((_, i) => dbl[i] != null && adbl[i] ? 100 * dbl[i] / adbl[i] : null);
};
var cmo = (closes, p = 9) => {
  const n = closes.length, up = new Array(n).fill(0), dn = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) up[i] = ch;
    else dn[i] = -ch;
  }
  const su = sma(up, p).map((v) => v == null ? null : v * p), sd = sma(dn, p).map((v) => v == null ? null : v * p);
  return closes.map((_, i) => {
    if (su[i] == null) return null;
    const t = su[i] + sd[i];
    return t ? 100 * (su[i] - sd[i]) / t : 0;
  });
};
var pivots = (highs, lows, closes, times) => {
  const n = closes.length, p = new Array(n).fill(null), r1 = new Array(n).fill(null), r2 = new Array(n).fill(null), s1 = new Array(n).fill(null), s2 = new Array(n).fill(null);
  const setLevels = (i, pv) => {
    if (!pv) return;
    const pp = (pv.H + pv.L + pv.C) / 3;
    p[i] = pp;
    r1[i] = 2 * pp - pv.L;
    s1[i] = 2 * pp - pv.H;
    r2[i] = pp + (pv.H - pv.L);
    s2[i] = pp - (pv.H - pv.L);
  };
  if (!times || !times.length) {
    for (let i = 1; i < n; i++) setLevels(i, { H: highs[i - 1], L: lows[i - 1], C: closes[i - 1] });
    return { p, r1, r2, s1, s2 };
  }
  const dayOf = (t) => Math.floor((t || 0) / 86400);
  let curDay = null, dH = -Infinity, dL = Infinity, dC = null, prev = null;
  for (let i = 0; i < n; i++) {
    const d = dayOf(times[i]);
    if (curDay === null) {
      curDay = d;
      dH = highs[i];
      dL = lows[i];
      dC = closes[i];
    } else if (d !== curDay) {
      prev = { H: dH, L: dL, C: dC };
      curDay = d;
      dH = highs[i];
      dL = lows[i];
      dC = closes[i];
    } else {
      dH = Math.max(dH, highs[i]);
      dL = Math.min(dL, lows[i]);
      dC = closes[i];
    }
    setLevels(i, prev);
  }
  return { p, r1, r2, s1, s2 };
};
var alma = (src, p = 9, offset = 0.85, sigma = 6) => {
  const n = src.length, out = new Array(n).fill(null);
  const m = offset * (p - 1), s = p / sigma || 1e-9;
  const w = new Array(p);
  let wsum = 0;
  for (let j = 0; j < p; j++) {
    w[j] = Math.exp(-((j - m) * (j - m)) / (2 * s * s));
    wsum += w[j];
  }
  for (let i = p - 1; i < n; i++) {
    let acc = 0, ok = true;
    for (let j = 0; j < p; j++) {
      const v = src[i - (p - 1) + j];
      if (v == null) {
        ok = false;
        break;
      }
      acc += v * w[j];
    }
    out[i] = ok && wsum ? acc / wsum : null;
  }
  return out;
};
var maRibbon = (src, base = 20, step = 10, count = 6, type = "sma") => {
  const fn = type === "ema" ? ema : sma;
  const out = [];
  for (let k = 0; k < count; k++) out.push(fn(src, Math.max(1, base + k * step)));
  return out;
};
var gmma = (src) => {
  const shortL = [3, 5, 8, 10, 12, 15], longL = [30, 35, 40, 45, 50, 60];
  return { short: shortL.map((p) => ema(src, p)), long: longL.map((p) => ema(src, p)) };
};
var SOURCE_OPTS = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4", "hlcc4"];
var resolveSrc = (c, name) => {
  switch (name) {
    case "open":
      return c.open;
    case "high":
      return c.high;
    case "low":
      return c.low;
    case "hl2":
      return c.high.map((h, i) => (h + c.low[i]) / 2);
    case "hlc3":
      return c.high.map((h, i) => (h + c.low[i] + c.close[i]) / 3);
    case "ohlc4":
      return c.high.map((h, i) => (c.open[i] + h + c.low[i] + c.close[i]) / 4);
    // HLCC4 = (H + L + 2×C)/4 — منبعِ هشتمِ TV (وزنِ دوبرابرِ close). #262
    case "hlcc4":
      return c.high.map((h, i) => (h + c.low[i] + 2 * c.close[i]) / 4);
    default:
      return c.close;
  }
};
var REGISTRY = {
  ma: { label: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0645\u062A\u062D\u0631\u06A9 (MA)", pane: "main", inputs: { period: 20, source: "close" }, color: "#60a5fa", calc: (c, i) => ({ line: sma(resolveSrc(c, i.source), i.period) }) },
  ema: { label: "EMA", pane: "main", inputs: { period: 20, source: "close" }, color: "#f59e0b", calc: (c, i) => ({ line: ema(resolveSrc(c, i.source), i.period) }) },
  wma: { label: "WMA", pane: "main", inputs: { period: 20, source: "close" }, color: "#a78bfa", calc: (c, i) => ({ line: wma(resolveSrc(c, i.source), i.period) }) },
  hma: { label: "HMA (\u0647\u0627\u0644)", pane: "main", inputs: { period: 21, source: "close" }, color: "#22d3ee", calc: (c, i) => ({ line: hma(resolveSrc(c, i.source), i.period) }) },
  vwap: { label: "VWAP (\u0633\u0634\u0646\u200C\u0645\u062D\u0648\u0631)", pane: "main", inputs: {}, color: "#e879f9", calc: (c) => ({ line: vwap(c.high, c.low, c.close, c.volume, c.time) }) },
  avwap: { label: "VWAP \u0644\u0646\u06AF\u0631\u0627\u0646\u062F\u0627\u062E\u062A\u0647 (\xB1\u03C3)", pane: "main", inputs: { anchorBars: 100, mult: 1 }, color: "#e879f9", calc: (c, i) => {
    const r = avwap(c.high, c.low, c.close, c.volume, i.anchorBars, i.mult);
    return { lines: [{ data: r.vwap, color: "#e879f9" }, { data: r.upper, color: "#a855f7" }, { data: r.lower, color: "#a855f7" }], cloud: [1, 2], cloudColors: ["rgba(168,85,247,0.09)"] };
  } },
  // باندهای ±σ توپر + پُرشدگیِ بنفشِ کم‌رنگِ بینشان
  choppiness: { label: "\u0634\u0627\u062E\u0635\u0650 \u0686\u0627\u067E\u06CC\u0646\u0633", pane: "sub", inputs: { period: 14 }, color: "#94a3b8", calc: (c, i) => ({ line: choppiness(c.high, c.low, c.close, i.period), guides: [61.8, 38.2] }) },
  vortex: { label: "\u0648\u064F\u0631\u062A\u06A9\u0633 (VI\xB1)", pane: "sub", inputs: { period: 14 }, color: "#22c55e", calc: (c, i) => {
    const r = vortex(c.high, c.low, c.close, i.period);
    return { line: r.plus, signal: r.minus };
  } },
  dpo: { label: "DPO", pane: "sub", inputs: { period: 20, source: "close" }, color: "#f59e0b", calc: (c, i) => ({ line: dpo(resolveSrc(c, i.source), i.period), guides: [0] }) },
  bop: { label: "\u0645\u0648\u0627\u0632\u0646\u0647\u0654 \u0642\u062F\u0631\u062A (BOP)", pane: "sub", inputs: {}, color: "#8b5cf6", calc: (c) => ({ line: bop2(c.open, c.high, c.low, c.close), guides: [0] }) },
  eom: { label: "\u0633\u0647\u0648\u0644\u062A\u0650 \u062D\u0631\u06A9\u062A (EOM)", pane: "sub", inputs: { period: 14 }, color: "#06b6d4", calc: (c, i) => ({ line: eom2(c.high, c.low, c.volume, i.period), guides: [0] }) },
  elderRay: { label: "\u0627\u0650\u0644\u062F\u0631 \u0631\u06CC (\u0642\u062F\u0631\u062A\u0650 \u06AF\u0627\u0648/\u062E\u0631\u0633)", pane: "sub", inputs: { period: 13 }, color: "#22c55e", calc: (c, i) => {
    const r = elderRay(c.high, c.low, c.close, i.period);
    return { hists: [{ data: r.bull, color: "#22c55e" }, { data: r.bear, color: "#ef4444" }], guides: [0] };
  } },
  // دو هیستوگرام: قدرتِ گاو سبز + قدرتِ خرس قرمز مثلِ TV
  chandeKroll: { label: "\u0627\u0633\u062A\u0627\u067E\u0650 \u0686\u0627\u0646\u062F \u06A9\u0631\u0648\u0644", pane: "main", inputs: { p: 10, x: 1, q: 9 }, color: "#ef4444", calc: (c, i) => {
    const r = chandeKroll(c.high, c.low, c.close, i.p, i.x, i.q);
    return { lines: [{ data: r.high, color: "#ef4444" }, { data: r.low, color: "#22c55e" }] };
  } },
  massIndex: { label: "\u0634\u0627\u062E\u0635\u0650 \u062A\u0648\u062F\u0647", pane: "sub", inputs: { period: 9, sum: 25 }, color: "#f59e0b", calc: (c, i) => ({ line: massIndex(c.high, c.low, i.period, i.sum), guides: [27, 26.5] }) },
  coppock: { label: "\u0645\u0646\u062D\u0646\u06CC\u0650 \u06A9\u0627\u067E\u0627\u06A9", pane: "sub", inputs: { source: "close" }, color: "#8b5cf6", calc: (c, i) => ({ line: coppock(resolveSrc(c, i.source)), guides: [0] }) },
  kst: { label: "KST", pane: "sub", inputs: { source: "close" }, color: "#06b6d4", calc: (c, i) => {
    const r = kst(resolveSrc(c, i.source));
    return { line: r.line, signal: r.signal, guides: [0] };
  } },
  alligator: { label: "\u062A\u0645\u0633\u0627\u062D\u0650 \u0648\u06CC\u0644\u06CC\u0627\u0645\u0632", pane: "main", inputs: {}, color: "#3b82f6", calc: (c) => {
    const r = alligator(c.high, c.low);
    return { lines: [{ data: r.jaw, color: "#3b82f6" }, { data: r.teeth, color: "#ef4444" }, { data: r.lips, color: "#22c55e" }] };
  } },
  rvi: { label: "\u0633\u0631\u0632\u0646\u062F\u06AF\u06CC\u0650 \u0646\u0633\u0628\u06CC (RVI)", pane: "sub", inputs: {}, color: "#22c55e", calc: (c) => {
    const r = rvi(c.open, c.high, c.low, c.close);
    return { line: r.line, signal: r.signal, guides: [0] };
  } },
  bbWidth: { label: "\u067E\u0647\u0646\u0627\u06CC \u0628\u0627\u0646\u062F\u0650 \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631", pane: "sub", inputs: { period: 20, mult: 2, source: "close" }, color: "#f59e0b", calc: (c, i) => ({ line: bbWidth(resolveSrc(c, i.source), i.period, i.mult) }) },
  stc: { label: "\u0686\u0631\u062E\u0647\u0654 \u0631\u0648\u0646\u062F\u0650 \u0634\u0627\u0641 (STC)", pane: "sub", inputs: { fast: 23, slow: 50, cycle: 10, source: "close" }, color: "#8b5cf6", calc: (c, i) => ({ line: stc(resolveSrc(c, i.source), i.fast, i.slow, i.cycle), guides: [75, 25] }) },
  netVolume: { label: "\u062D\u062C\u0645\u0650 \u062E\u0627\u0644\u0635", pane: "sub", inputs: {}, color: "#089981", calc: (c) => ({ hist: netVolume(c.open, c.close, c.volume), histMode: "sign", guides: [0] }) },
  // هیستوگرامِ سبز/قرمز بر اساسِ علامت مثلِ TV
  stdErrBands: { label: "\u0628\u0627\u0646\u062F\u0647\u0627\u06CC \u062E\u0637\u0627\u06CC \u0645\u0639\u06CC\u0627\u0631", pane: "main", inputs: { period: 21, mult: 2 }, color: "#3b82f6", calc: (c, i) => {
    const r = stdErrBands(c.close, i.period, i.mult);
    return { lines: [{ data: r.mid, color: "#3b82f6" }, { data: r.up, color: "#60a5fa" }, { data: r.dn, color: "#60a5fa" }], cloud: [1, 2], cloudColors: ["rgba(96,165,250,0.07)"] };
  } },
  // باندهای توپر + پُرشدگیِ آبیِ کم‌رنگ مثلِ TV
  accelerator: { label: "\u0646\u0648\u0633\u0627\u0646\u200C\u0633\u0627\u0632\u0650 \u0634\u062A\u0627\u0628 (AC)", pane: "sub", inputs: {}, color: "#089981", calc: (c) => ({ hist: accelerator2(c.high, c.low), guides: [0] }) },
  // هیستوگرامِ دورنگِ مومنتوم مثلِ TV
  chaikinVol: { label: "\u0646\u0648\u0633\u0627\u0646\u0650 \u0686\u0627\u06CC\u06A9\u06CC\u0646", pane: "sub", inputs: { period: 10 }, color: "#f59e0b", calc: (c, i) => ({ line: chaikinVol(c.high, c.low, i.period), guides: [0] }) },
  mtfEma: { label: "EMA \u0686\u0646\u062F\u062A\u0627\u06CC\u0645\u200C\u0641\u0631\u06CC\u0645\u06CC (\xD7factor)", pane: "main", inputs: { period: 50, factor: 4 }, color: "#22d3ee", calc: (c, i) => ({ line: _expandA(ema(_resampleC(c, i.factor).close, i.period), i.factor, c.close.length) }) },
  mtfRsi: { label: "RSI \u0686\u0646\u062F\u062A\u0627\u06CC\u0645\u200C\u0641\u0631\u06CC\u0645\u06CC (\xD7factor)", pane: "sub", inputs: { period: 14, factor: 4 }, color: "#f59e0b", calc: (c, i) => ({ line: _expandA(rsi(_resampleC(c, i.factor).close, i.period), i.factor, c.close.length), guides: [70, 30] }) },
  bb: { label: "\u0628\u0627\u0646\u062F \u0628\u0648\u0644\u06CC\u0646\u06AF\u0631", pane: "main", inputs: { period: 20, mult: 2, source: "close" }, color: "#94a3b8", calc: (c, i) => {
    const b = bollinger(resolveSrc(c, i.source), i.period, i.mult);
    return { upper: b.upper, basis: b.basis, lower: b.lower, multi: true };
  } },
  supertrend: { label: "\u0633\u0648\u067E\u0631\u062A\u0631\u0646\u062F", pane: "main", inputs: { period: 10, mult: 3 }, color: "#10b981", calc: (c, i) => {
    const r = supertrend(c.high, c.low, c.close, i.period, i.mult);
    const up = r.line.map((v, k) => r.trend[k] === 1 ? v : null);
    const dn = r.line.map((v, k) => r.trend[k] === -1 ? v : null);
    return { lines: [{ data: up, color: "#10b981", gaps: true }, { data: dn, color: "#ef4444", gaps: true }] };
  } },
  // خطِ دورنگِ سوپرترند: سبز صعودی / قرمز نزولی (مثلِ TV)
  rsi: { label: "RSI", pane: "sub", inputs: { period: 14, source: "close", maLength: 14 }, color: "#a78bfa", calc: (c, i) => {
    const r = rsi(resolveSrc(c, i.source), i.period);
    return { line: r, signal: i.maLength > 0 ? smaNull(r, i.maLength) : null, guides: [30, 70], range: [0, 100], zone: [30, 70] };
  } },
  // «RSI-based MA»ِ پیش‌فرضِ TV (خطِ دومِ نارنجی؛ maLength=0 خاموشش می‌کند). #330
  macd: { label: "MACD", pane: "sub", inputs: { fast: 12, slow: 26, sig: 9, source: "close" }, color: "#60a5fa", calc: (c, i) => {
    const m = macd(resolveSrc(c, i.source), i.fast, i.slow, i.sig);
    return { line: m.macd, signal: m.signal, hist: m.hist, macd: true };
  } },
  stoch: { label: "\u0627\u0633\u062A\u0648\u06A9\u0627\u0633\u062A\u06CC\u06A9", pane: "sub", inputs: { period: 14, d: 3 }, color: "#34d399", calc: (c, i) => {
    const s = stoch(c.high, c.low, c.close, i.period, i.d);
    return { line: s.k, signal: s.d, guides: [20, 80], range: [0, 100], zone: [20, 80] };
  } },
  atr: { label: "ATR", pane: "sub", inputs: { period: 14 }, color: "#fb7185", calc: (c, i) => ({ line: atr(c.high, c.low, c.close, i.period) }) },
  cci: { label: "CCI", pane: "sub", inputs: { period: 20, source: "hlc3" }, color: "#f472b6", calc: (c, i) => ({ line: _cciCore(resolveSrc(c, i.source), i.period), guides: [-100, 100], zone: [-100, 100] }) },
  willr: { label: "\u0648\u06CC\u0644\u06CC\u0627\u0645\u0632 %R", pane: "sub", inputs: { period: 14 }, color: "#facc15", calc: (c, i) => ({ line: williamsR(c.high, c.low, c.close, i.period), guides: [-20, -80], range: [-100, 0], zone: [-80, -20] }) },
  obv: { label: "OBV", pane: "sub", inputs: {}, color: "#38bdf8", calc: (c) => ({ line: obv(c.close, c.volume) }) },
  adx: { label: "ADX", pane: "sub", inputs: { period: 14 }, color: "#f97316", calc: (c, i) => ({ line: adx(c.high, c.low, c.close, i.period), guides: [25] }) },
  donchian: { label: "\u06A9\u0627\u0646\u0627\u0644 \u062F\u0648\u0646\u0686\u06CC\u0627\u0646", pane: "main", inputs: { period: 20 }, color: "#94a3b8", calc: (c, i) => {
    const d = donchian(c.high, c.low, i.period);
    return { lines: [{ data: d.upper, color: "#60a5fa" }, { data: d.basis, color: "#94a3b8" }, { data: d.lower, color: "#60a5fa" }], cloud: [0, 2], cloudColors: ["rgba(96,165,250,0.07)"] };
  } },
  // باندهای توپر + پُرشدگیِ آبیِ کم‌رنگ مثلِ دونچیانِ TV
  keltner: { label: "\u06A9\u0627\u0646\u0627\u0644 \u06A9\u0644\u062A\u0646\u0631", pane: "main", inputs: { period: 20, mult: 2 }, color: "#f472b6", calc: (c, i) => {
    const k = keltner(c.high, c.low, c.close, i.period, i.mult);
    return { lines: [{ data: k.upper, color: "#f472b6" }, { data: k.basis, color: "#f472b6" }, { data: k.lower, color: "#f472b6" }], cloud: [0, 2], cloudColors: ["rgba(244,114,182,0.08)"] };
  } },
  // باندهای توپر + پُرشدگیِ صورتیِ کم‌رنگ بینِ بالا/پایین مثلِ کلتنرِ TV
  ichimoku: { label: "\u0627\u06CC\u0686\u06CC\u0645\u0648\u06A9\u0648", pane: "main", inputs: { tenkan: 9, kijun: 26, span: 52 }, color: "#22d3ee", calc: (c, i) => {
    const k = ichimoku(c.high, c.low, c.close, i.tenkan, i.kijun, i.span);
    return { lines: [{ data: k.tenkan, color: "#3b82f6" }, { data: k.kijun, color: "#ef4444" }, { data: k.spanA, color: "#22c55e" }, { data: k.spanB, color: "#f59e0b" }], cloud: [2, 3] };
  } },
  // Senkou A/B توپر + ابرِ سبز/قرمزِ بینِ آن‌ها (indexِ 2/3) مثلِ TV
  dema: { label: "DEMA (\u0646\u0645\u0627\u06CC\u06CC \u062F\u0648\u06AF\u0627\u0646\u0647)", pane: "main", inputs: { period: 20, source: "close" }, color: "#38bdf8", calc: (c, i) => ({ line: dema(resolveSrc(c, i.source), i.period) }) },
  tema: { label: "TEMA (\u0646\u0645\u0627\u06CC\u06CC \u0633\u0647\u200C\u06AF\u0627\u0646\u0647)", pane: "main", inputs: { period: 20, source: "close" }, color: "#fb923c", calc: (c, i) => ({ line: tema(resolveSrc(c, i.source), i.period) }) },
  vwma: { label: "VWMA (\u0648\u0632\u0646\u06CC\u0650 \u062D\u062C\u0645\u06CC)", pane: "main", inputs: { period: 20 }, color: "#c084fc", calc: (c, i) => ({ line: vwma(c.close, c.volume, i.period) }) },
  psar: { label: "\u067E\u0627\u0631\u0627\u0628\u0648\u0644\u06CC\u06A9 SAR", pane: "main", inputs: { start: 0.02, inc: 0.02, max: 0.2 }, color: "#a855f7", calc: (c, i) => {
    const s = psar(c.high, c.low, i.start, i.inc, i.max);
    const below = s.map((v, k) => v == null ? null : v <= c.close[k] ? v : null);
    const above = s.map((v, k) => v == null ? null : v > c.close[k] ? v : null);
    return { lines: [{ data: below, color: "#a855f7", dashed: true, gaps: true }, { data: above, color: "#a855f7", dashed: true, gaps: true }] };
  } },
  // شکستِ خط در چرخشِ SAR (بدونِ خطِ اتصالِ اریب از رویِ قیمت) مثلِ TV
  pivots: { label: "\u0646\u0642\u0627\u0637\u0650 \u067E\u06CC\u0648\u0648\u062A (\u06A9\u0644\u0627\u0633\u06CC\u06A9)", pane: "main", inputs: {}, color: "#94a3b8", calc: (c) => {
    const v = pivots(c.high, c.low, c.close, c.time);
    return { lines: [{ data: v.r2, color: "#ef4444", dashed: true, gaps: true }, { data: v.r1, color: "#f87171", dashed: true, gaps: true }, { data: v.p, color: "#94a3b8", gaps: true }, { data: v.s1, color: "#4ade80", dashed: true, gaps: true }, { data: v.s2, color: "#22c55e", dashed: true, gaps: true }] };
  } },
  aroon: { label: "\u0622\u0631\u0648\u0646 (Aroon)", pane: "sub", inputs: { period: 14 }, color: "#22c55e", calc: (c, i) => {
    const a = aroon(c.high, c.low, i.period);
    return { line: a.up, signal: a.down, guides: [30, 70], range: [0, 100] };
  } },
  mfi: { label: "MFI (\u062C\u0631\u06CC\u0627\u0646\u0650 \u0646\u0642\u062F\u06CC\u0646\u06AF\u06CC)", pane: "sub", inputs: { period: 14 }, color: "#10b981", calc: (c, i) => ({ line: mfi(c.high, c.low, c.close, c.volume, i.period), guides: [20, 80], range: [0, 100], zone: [20, 80] }) },
  cmf: { label: "CMF (\u067E\u0648\u0644\u0650 \u0686\u0627\u06CC\u06A9\u06CC\u0646)", pane: "sub", inputs: { period: 20 }, color: "#0ea5e9", calc: (c, i) => ({ line: cmf(c.high, c.low, c.close, c.volume, i.period), guides: [0] }) },
  stochrsi: { label: "\u0627\u0633\u062A\u0648\u06A9\u0627\u0633\u062A\u06CC\u06A9 RSI", pane: "sub", inputs: { period: 14, k: 3, d: 3, source: "close" }, color: "#34d399", calc: (c, i) => {
    const s = stochRsi(resolveSrc(c, i.source), i.period, i.k, i.d);
    return { line: s.k, signal: s.d, guides: [20, 80], range: [0, 100], zone: [20, 80] };
  } },
  ao: { label: "\u0627\u0633\u06CC\u0644\u0627\u062A\u0648\u0631\u0650 \u0634\u06AF\u0641\u062A\u200C\u0627\u0646\u06AF\u06CC\u0632 (AO)", pane: "sub", inputs: {}, color: "#60a5fa", calc: (c) => ({ hist: ao(c.high, c.low), guides: [0] }) },
  // هیستوگرامِ دورنگِ مومنتوم مثلِ TV
  tsi: { label: "TSI (\u0642\u062F\u0631\u062A\u0650 \u0648\u0627\u0642\u0639\u06CC)", pane: "sub", inputs: { short: 13, long: 25, source: "close" }, color: "#f472b6", calc: (c, i) => ({ line: tsi(resolveSrc(c, i.source), i.short, i.long), guides: [0] }) },
  cmo: { label: "CMO (\u0645\u0648\u0645\u0646\u062A\u0648\u0645\u0650 \u0686\u0627\u0646\u062F)", pane: "sub", inputs: { period: 9, source: "close" }, color: "#fbbf24", calc: (c, i) => ({ line: cmo(resolveSrc(c, i.source), i.period), guides: [-50, 50], zone: [-50, 50] }) },
  alma: { label: "ALMA (\u0622\u0631\u0646\u0648 \u0644\u0650\u06AF\u0648)", pane: "main", inputs: { period: 9, offset: 0.85, sigma: 6, source: "close" }, color: "#2dd4bf", calc: (c, i) => ({ line: alma(resolveSrc(c, i.source), i.period, i.offset, i.sigma) }) },
  maRibbon: { label: "\u0646\u0648\u0627\u0631\u0650 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646\u200C\u0647\u0627 (MA Ribbon)", pane: "main", inputs: { base: 20, step: 10, count: 6 }, color: "#60a5fa", calc: (c, i) => {
    const rs = maRibbon(c.close, i.base, i.step, i.count, "sma");
    const pal = ["#60a5fa", "#38bdf8", "#22d3ee", "#2dd4bf", "#34d399", "#4ade80", "#a3e635", "#facc15"];
    return { lines: rs.map((data, k) => ({ data, color: pal[k % pal.length] })) };
  } },
  gmma: { label: "\u06AF\u0627\u067E\u06CC (GMMA)", pane: "main", inputs: {}, color: "#3b82f6", calc: (c) => {
    const g = gmma(c.close);
    return { lines: [...g.short.map((data) => ({ data, color: "#3b82f6" })), ...g.long.map((data) => ({ data, color: "#ef4444" }))] };
  } },
  maCross: { label: "\u062A\u0642\u0627\u0637\u0639\u0650 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646\u200C\u0647\u0627 (MA Cross)", pane: "main", inputs: { fast: 10, slow: 30 }, color: "#22c55e", calc: (c, i) => ({ lines: [{ data: sma(c.close, i.fast), color: "#22c55e" }, { data: sma(c.close, i.slow), color: "#ef4444" }] }) }
};
Object.assign(REGISTRY, EXT_REGISTRY_A, EXT_REGISTRY_B);
export {
  REGISTRY,
  SOURCE_OPTS,
  accelerator2 as accelerator,
  adx,
  adxDI,
  alligator,
  alma,
  ao,
  aroon,
  atr,
  avwap,
  bbWidth,
  bollinger,
  bop2 as bop,
  cci,
  chaikinVol,
  chandeKroll,
  choppiness,
  cmf,
  cmo,
  coppock,
  dema,
  donchian,
  dpo,
  elderRay,
  ema,
  eom2 as eom,
  gmma,
  hma,
  ichimoku,
  keltner,
  kst,
  maRibbon,
  macd,
  massIndex,
  mfi,
  netVolume,
  obv,
  pivots,
  psar,
  resolveSrc,
  rsi,
  rvi,
  sma,
  smaNull,
  stc,
  stdErrBands,
  stoch,
  stochRsi,
  supertrend,
  tema,
  tsi,
  vortex,
  vwap,
  vwma,
  williamsR,
  wma
};
