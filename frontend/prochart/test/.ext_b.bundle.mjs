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
var _sma = (src, p) => {
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
var _ema = (src, p) => {
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
var _stdev = (src, p) => {
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
  const f = _sma(mp, 5), sl = _sma(mp, 34);
  const aoArr = mp.map((_, k) => f[k] != null && sl[k] != null ? f[k] - sl[k] : null);
  const aoSma = _sma(aoArr.map((v) => v == null ? 0 : v), 5).map((v, k) => {
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
  const dbl = _ema(_ema(m, i.long), i.short), adbl = _ema(_ema(am, i.long), i.short);
  const smi2 = close.map((_, k) => dbl[k] != null && adbl[k] ? 100 * dbl[k] / adbl[k] : null);
  const sig = _ema(smi2, i.sig).map((v, k) => smi2[k] == null ? null : v);
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
  const relS = _ema(_ema(rel, i.smoothK), i.smoothD);
  const rngS = _ema(_ema(rng, i.smoothK), i.smoothD);
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
  const line = i.smooth > 1 ? _sma(raw, i.smooth) : raw;
  return { line, guides: [0], range: [-1, 1] };
};
var trix = (c, i) => {
  const src = _srcOf(c, i.source);
  const e3 = _ema(_ema(_ema(src, i.period), i.period), i.period);
  const line = e3.map((v, k) => k > 0 && v != null && e3[k - 1] ? 1e4 * (v - e3[k - 1]) / e3[k - 1] : null);
  const sig = _ema(line, i.sig).map((v, k) => line[k] == null ? null : v);
  return { line, signal: sig, guides: [0] };
};
var volume = (c, i) => {
  if (!_hasVol(c.volume)) return { hist: new Array(c.close.length).fill(null) };
  return {
    hist: c.volume,
    line: _sma(c.volume.map((v) => v || 0), i.maLen),
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
  const ef = _ema(ad, i.fast), es = _ema(ad, i.slow);
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
  const line = _sma(emv.map((v) => v == null ? 0 : v), i.period).map((v, k) => k < i.period ? null : v);
  return { line, guides: [0] };
};
var forceIndex = (c, i) => {
  if (!_hasVol(c.volume)) return { ..._nullLine(c.close.length), guides: [0] };
  const n = c.close.length, raw = new Array(n).fill(null);
  for (let k = 1; k < n; k++) raw[k] = (c.close[k] - c.close[k - 1]) * (c.volume[k] || 0);
  const line = _ema(raw, i.period).map((v, k) => k < 1 ? null : v);
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
  const ef = _ema(vf, i.fast), es = _ema(vf, i.slow);
  const kvo = vf.map((_, k) => ef[k] != null && es[k] != null ? ef[k] - es[k] : null);
  const sig = _ema(kvo, i.sig).map((v, k) => kvo[k] == null ? null : v);
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
  const basis = _sma(src, p), sd = _stdev(src, p);
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
  const fast = _ema(vol, i.fast), slow = _ema(vol, i.slow);
  const line = fast.map((f, k) => f == null || slow[k] == null || !slow[k] ? null : (f - slow[k]) / slow[k] * 100);
  const signal = _ema(line, i.sig);
  const hist = line.map((v, k) => v == null || signal[k] == null ? null : v - signal[k]);
  return { line, signal, hist, macd: true, guides: [0] };
};
var adr = (c, i) => {
  const rng = c.high.map((h, k) => h == null || c.low[k] == null ? null : h - c.low[k]);
  return { line: _sma(rng, i.period), guides: [] };
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
  const ma = _sma(tp, p), out = new Array(n).fill(null);
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
  const s1 = _emaAlpha(roc2, i.len1), line = _emaAlpha(s1, i.len2), signal = _ema(line, i.sig);
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
  const src = _srcOf(c, i.source), n = src.length, sd = _stdev(src, i.stdevLen);
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
  const ua = _ema(up, i.length), da = _ema(dn, i.length), out = new Array(n).fill(null);
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
  const short = _ema(vol, Math.max(1, Math.round(i.shortLen || 5)));
  const long = _ema(vol, Math.max(2, Math.round(i.longLen || 10)));
  const line = short.map((s, k) => s == null || long[k] == null || !long[k] ? null : (s - long[k]) / long[k] * 100);
  return { line, guides: [0] };
};
var volatilityStop = (c, i) => {
  const src = c.close, n = src.length;
  const period = Math.max(1, Math.round(i.period || 20)), mult = i.mult || 2;
  const atr = _atr(c.high, c.low, c.close, period);
  const up = new Array(n).fill(null), dn = new Array(n).fill(null);
  let uptrend = true, stop = null, max = src[0], min = src[0];
  for (let k = 0; k < n; k++) {
    if (atr[k] == null) {
      max = src[k];
      min = src[k];
      continue;
    }
    const atrM = mult * atr[k];
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
var indicators_ext_b_default = EXT_REGISTRY_B;
export {
  EXT_REGISTRY_B,
  indicators_ext_b_default as default,
  ultimateOsc
};
