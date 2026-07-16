// Offline numerical-correctness tests for hand-written indicator calc functions.
//
// WHY: Playwright "does it render" only catches crashes, NOT wrong numbers. Any hand-written
// math (indicators, spread/symbol-math, aggregations, precision) must be validated against an
// independent reference + invariants + exact hand-computed values. This suite is that gate.
//
// HOW TO RUN (the calc modules import extensionless './candlePatterns' which raw Node ESM can't
// resolve, so bundle first with the already-present esbuild, then run):
//   cd frontend/prochart
//   npx --no-install esbuild src/bazaarnama/indicators_ext_b.js --bundle --format=esm --outfile=test/.ext_b.bundle.mjs
//   node test/indicators.test.mjs
// (.ext_b.bundle.mjs is a generated artifact — safe to gitignore.)
//
// Add a new block per indicator: write an INDEPENDENT reference impl from the textbook formula,
// compare elementwise to the real calc, then assert invariants + a couple exact values.

import REG from './.ext_b.bundle.mjs';

let pass = 0, fail = 0;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const ck = (name, cond, got, exp) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, 'got', JSON.stringify(got), 'exp', JSON.stringify(exp)); } };

// ───────── Ulcer Index ─────────
// Reference: R_i = 100*(C_i − max(C, last N))/max(C, last N); UI = sqrt(mean(R^2, last N)); na until full window.
const refUlcer = (close, p) => {
  const n = close.length, R = new Array(n).fill(null), out = new Array(n).fill(null);
  for (let k = p - 1; k < n; k++) { let m = -Infinity; for (let j = 0; j < p; j++) m = Math.max(m, close[k - j]); if (m !== 0) R[k] = 100 * (close[k] - m) / m; }
  for (let k = 0; k < n; k++) { let s = 0, ok = true; for (let j = 0; j < p; j++) { const v = R[k - j]; if (v == null) { ok = false; break; } s += v * v; } if (ok) out[k] = Math.sqrt(s / p); }
  return out;
};
{
  const ulcer = REG.ulcer.calc;
  const cl = []; let x = 100; const seed = [3, -2, 5, -7, 1, 4, -6, 2, -3, 8, -1, -4, 6, -2, 3, -9, 5, 1, -2, 7, -5, 2, 4, -8, 3, -1, 6, -3, 2, 5, -7, 4, -2, 1, -6, 3, 8, -4, 2, -5];
  for (const d of seed) { x += d; cl.push(x); }
  const got = ulcer({ close: cl }, { period: 14 }).line, ref = refUlcer(cl, 14);
  let match = true, bad = -1; for (let k = 0; k < cl.length; k++) { const a = got[k], b = ref[k]; if ((a == null) !== (b == null) || (a != null && !near(a, b))) { match = false; bad = k; break; } }
  ck('ulcer == independent reference (elementwise)', match, bad < 0 ? 'ok' : { k: bad, got: got[bad], ref: ref[bad] }, 'match');
  ck('ulcer >= 0', got.filter(v => v != null).every(v => v >= 0), 'ok', '>=0');
  const rise = Array.from({ length: 30 }, (_, k) => 100 + k);
  const u = ulcer({ close: rise }, { period: 14 }).line.filter(v => v != null);
  ck('ulcer = 0 on monotonic rise', u.length > 0 && u.every(v => near(v, 0)), u.slice(0, 3), 'all 0');
}

// ───────── Chandelier Exit ─────────
{
  const chan = REG.chandelier.calc;
  const n = 40, close = [], high = [], low = [];
  for (let k = 0; k < n; k++) { const b = 100 + k; close.push(b); high.push(b + 0.5); low.push(b - 0.5); }
  const p = 5, mult = 3, tr = [];
  for (let k = 0; k < n; k++) tr.push(k === 0 ? high[k] - low[k] : Math.max(high[k] - low[k], Math.abs(high[k] - close[k - 1]), Math.abs(low[k] - close[k - 1])));
  const rma = (a, pp) => { const o = new Array(a.length).fill(null); let s = 0; for (let k = 0; k < a.length; k++) { if (k < pp) { s += a[k]; if (k === pp - 1) o[k] = s / pp; } else o[k] = (o[k - 1] * (pp - 1) + a[k]) / pp; } return o; };
  const atr = rma(tr, p);
  const hh = new Array(n).fill(null); for (let k = p - 1; k < n; k++) { let h = -Infinity; for (let j = 0; j < p; j++) h = Math.max(h, close[k - j]); hh[k] = h; }
  const r = chan({ high, low, close }, { period: p, mult }), last = n - 1;
  ck('chandelier long = HH(close) - mult*ATR', near(r.lines[0].data[last], hh[last] - mult * atr[last]), r.lines[0].data[last], hh[last] - mult * atr[last]);
  ck('chandelier green below close (uptrend)', r.lines[0].data[last] < close[last], r.lines[0].data[last], '<' + close[last]);
  ck('chandelier red null (uptrend)', r.lines[1].data[last] == null, r.lines[1].data[last], null);
  ck('chandelier finite', r.lines[0].data.concat(r.lines[1].data).every(v => v == null || Number.isFinite(v)), 'ok', 'finite');
  // crash → flip to short (red) above price
  const c2 = [], h2 = [], l2 = [];
  for (let k = 0; k < 25; k++) { const b = 100 + k; c2.push(b); h2.push(b + .5); l2.push(b - .5); }
  for (let k = 0; k < 5; k++) { const b = 124 - 8 * (k + 1); c2.push(b); h2.push(b + .5); l2.push(b - .5); }
  const r2 = chan({ high: h2, low: l2, close: c2 }, { period: 5, mult: 3 }), lz = c2.length - 1;
  ck('chandelier flips to red-above on crash', r2.lines[1].data[lz] != null && r2.lines[1].data[lz] > c2[lz], r2.lines[1].data[lz], '>' + c2[lz]);
}

// ═════════ اندیکاتورهای غایبِ TradingView — batch ۱ ═════════
// reference helperهای مستقل (منطبق با کنوانسیونِ ext_b: _ema از اولین مقدار seed، خروجی از p-1).
const _refEma = (src, p) => { const out = new Array(src.length).fill(null); const k = 2 / (p + 1); let prev = null; for (let i = 0; i < src.length; i++) { const v = src[i]; if (v == null) { out[i] = prev; continue; } prev = prev == null ? v : v * k + prev * (1 - k); if (i >= p - 1) out[i] = prev; } return out; };
const _refSma = (src, p) => { const out = new Array(src.length).fill(null); let s = 0; for (let i = 0; i < src.length; i++) { const v = src[i] == null ? 0 : src[i]; s += v; if (i >= p) s -= (src[i - p] == null ? 0 : src[i - p]); if (i >= p - 1) out[i] = s / p; } return out; };
const elem = (name, got, ref) => { let ok = true, bad = -1; for (let k = 0; k < ref.length; k++) { const a = got[k], b = ref[k]; if ((a == null) !== (b == null) || (a != null && !near(a, b))) { ok = false; bad = k; break; } } ck(name, ok, bad < 0 ? 'ok' : { k: bad, got: got[bad], ref: ref[bad] }, 'match'); };

// ───────── Aroon Oscillator ─────────
{
  const osc = REG.aroonOsc.calc;
  const high = [], low = []; const hs = [5, 7, 6, 9, 8, 11, 10, 13, 12, 15, 14, 17, 16, 19, 18, 21, 20, 23, 22, 25];
  for (const h of hs) { high.push(h); low.push(h - 2); }
  const p = 14;
  const ref = (() => { const up = new Array(high.length).fill(null), dn = new Array(high.length).fill(null); for (let i = p; i < high.length; i++) { let hi = -Infinity, lo = Infinity, hb = 0, lb = 0; for (let j = 0; j <= p; j++) { if (high[i - j] > hi) { hi = high[i - j]; hb = j; } if (low[i - j] < lo) { lo = low[i - j]; lb = j; } } up[i] = 100 * (p - hb) / p; dn[i] = 100 * (p - lb) / p; } return up.map((u, k) => u == null ? null : u - dn[k]); })();
  const got = osc({ high, low }, { period: p }).line;
  elem('aroonOsc == independent reference', got, ref);
  ck('aroonOsc within [-100,100]', got.filter(v => v != null).every(v => v >= -100 && v <= 100), 'ok', 'bounded');
  // strictly-increasing ⇒ highest = current bar (up=100), lowest = oldest bar (down=0) ⇒ osc=100
  const hi2 = Array.from({ length: 20 }, (_, k) => 100 + k), lo2 = hi2.map(h => h - 1);
  const g2 = osc({ high: hi2, low: lo2 }, { period: 14 }).line;
  ck('aroonOsc = +100 on strictly rising', near(g2[g2.length - 1], 100), g2[g2.length - 1], 100);
}

// ───────── PVO (Percentage Volume Oscillator) ─────────
{
  const pvo = REG.pvo.calc;
  const close = [], volume = []; const vseed = [100, 120, 90, 140, 160, 110, 130, 170, 150, 180, 200, 160, 140, 190, 210, 175, 220, 205, 230, 195, 240, 260, 210, 250, 270, 230, 280, 255, 300, 275];
  for (let k = 0; k < vseed.length; k++) { close.push(50 + k); volume.push(vseed[k]); }
  const inp = { fast: 12, slow: 26, sig: 9 };
  const fast = _refEma(volume, inp.fast), slow = _refEma(volume, inp.slow);
  const refLine = fast.map((f, k) => (f == null || slow[k] == null || !slow[k] ? null : (f - slow[k]) / slow[k] * 100));
  const refSig = _refEma(refLine, inp.sig);
  const refHist = refLine.map((v, k) => (v == null || refSig[k] == null ? null : v - refSig[k]));
  const r = pvo({ close, volume }, inp);
  elem('pvo line == independent reference', r.line, refLine);
  elem('pvo signal == reference', r.signal, refSig);
  ck('pvo hist == line - signal (invariant)', r.hist.every((v, k) => (v == null && refHist[k] == null) || near(v, refHist[k])), 'ok', 'match');
  ck('pvo finite', r.line.concat(r.signal, r.hist).every(v => v == null || Number.isFinite(v)), 'ok', 'finite');
}

// ───────── ADR (Average Daily Range) ─────────
{
  const adr = REG.adr.calc;
  const high = [], low = []; for (let k = 0; k < 20; k++) { const b = 100 + k; high.push(b + 3); low.push(b - 1); } // range ثابت = ۴
  const ref = _refSma(high.map((h, k) => h - low[k]), 14);
  const got = adr({ high, low }, { period: 14 }).line;
  elem('adr == SMA(high-low) reference', got, ref);
  ck('adr = 4 on constant range', near(got[got.length - 1], 4), got[got.length - 1], 4);
  ck('adr >= 0', got.filter(v => v != null).every(v => v >= 0), 'ok', '>=0');
}

// ───────── Median price ─────────
{
  const med = REG.median.calc;
  const close = [7, 3, 5, 9, 1, 8, 2, 6, 4, 10];
  const p = 3;
  const ref = new Array(close.length).fill(null);
  for (let k = p - 1; k < close.length; k++) { const w = [close[k], close[k - 1], close[k - 2]].sort((a, b) => a - b); ref[k] = w[1]; }
  const got = med({ close, open: close, high: close, low: close, volume: close }, { period: p, source: 'close' }).line;
  elem('median(3) == independent reference', got, ref);
  ck('median[2] of [7,3,5]=5', near(got[2], 5), got[2], 5);
  ck('median[4] of [5,9,1]=5', near(got[4], 5), got[4], 5);
  const g4 = med({ close: [4, 8, 2, 6], open: [], high: [], low: [], volume: [] }, { period: 4, source: 'close' }).line;
  ck('median(4) of [4,8,2,6] = (4+6)/2 = 5', near(g4[3], 5), g4[3], 5);
}

// ═════════ اندیکاتورهای غایبِ TradingView — batch ۲ ═════════
const _refEmaAlpha = (src, period) => { const out = new Array(src.length).fill(null), a = 2 / period; let prev = null; for (let k = 0; k < src.length; k++) { const v = src[k]; if (v == null) { out[k] = prev; continue; } prev = prev == null ? v : prev + a * (v - prev); out[k] = prev; } return out; };
const _refStdev = (src, p) => { const out = new Array(src.length).fill(null); for (let i = p - 1; i < src.length; i++) { let m = 0; for (let j = 0; j < p; j++) m += src[i - j]; m /= p; let s = 0; for (let j = 0; j < p; j++) { const d = src[i - j] - m; s += d * d; } out[i] = Math.sqrt(s / p); } return out; };
const _refCci = (high, low, close, p) => { const n = close.length, tp = new Array(n); for (let k = 0; k < n; k++) tp[k] = (high[k] + low[k] + close[k]) / 3; const ma = _refSma(tp, p), out = new Array(n).fill(null); for (let k = p - 1; k < n; k++) { let md = 0; for (let j = 0; j < p; j++) md += Math.abs(tp[k - j] - ma[k]); md /= p; out[k] = md ? (tp[k] - ma[k]) / (0.015 * md) : 0; } return out; };

// بارهای مصنوعی مشترک
const _bars = (n) => { const high = [], low = [], close = [], volume = []; let x = 100; const seed = [3, -2, 5, -7, 1, 4, -6, 2, -3, 8, -1, -4, 6, -2, 3, -9, 5, 1, -2, 7, -5, 2, 4, -8, 3, -1, 6, -3, 2, 5, -7, 4, -2, 1, -6, 3, 8, -4, 2, -5]; for (let k = 0; k < n; k++) { x += seed[k % seed.length]; close.push(x); high.push(x + 2); low.push(x - 2); volume.push(100 + ((k * 37) % 90)); } return { high, low, close, volume }; };

// ───────── Woodies CCI ─────────
{
  const w = REG.woodiesCci.calc, b = _bars(40);
  const r = w(b, { slow: 14, fast: 6 });
  elem('woodiesCci line == CCI(14) reference', r.line, _refCci(b.high, b.low, b.close, 14));
  elem('woodiesCci signal == CCI(6) reference', r.signal, _refCci(b.high, b.low, b.close, 6));
  ck('woodiesCci finite', r.line.concat(r.signal).every(v => v == null || Number.isFinite(v)), 'ok', 'finite');
}

// ───────── PMO ─────────
{
  const pmo = REG.pmo.calc, b = _bars(60), cl = b.close, n = cl.length;
  const roc = new Array(n).fill(null); for (let k = 1; k < n; k++) if (cl[k - 1]) roc[k] = (cl[k] / cl[k - 1] - 1) * 100 * 10;
  const refLine = _refEmaAlpha(_refEmaAlpha(roc, 35), 20), refSig = _refEma(refLine, 10);
  const r = pmo(b, { len1: 35, len2: 20, sig: 10 });
  elem('pmo line == independent reference', r.line, refLine);
  elem('pmo signal == EMA(pmo,10) reference', r.signal, refSig);
}

// ───────── PVI / NVI ─────────
{
  const pvi = REG.pvi.calc, nvi = REG.nvi.calc;
  const close = [100, 102, 101, 105, 103, 108], volume = [10, 20, 15, 25, 12, 30]; // up/down volume pattern
  // reference PVI: changes only when volume[k] > volume[k-1]
  const refPVI = [1000]; for (let k = 1; k < close.length; k++) { let v = refPVI[k - 1]; if (volume[k] > volume[k - 1]) v += (close[k] - close[k - 1]) / close[k - 1] * v; refPVI.push(v); }
  const refNVI = [1000]; for (let k = 1; k < close.length; k++) { let v = refNVI[k - 1]; if (volume[k] < volume[k - 1]) v += (close[k] - close[k - 1]) / close[k - 1] * v; refNVI.push(v); }
  elem('pvi == cumulative reference (up-volume days)', pvi({ close, volume }).line, refPVI);
  elem('nvi == cumulative reference (down-volume days)', nvi({ close, volume }).line, refNVI);
  ck('pvi seed = 1000', near(pvi({ close, volume }).line[0], 1000), pvi({ close, volume }).line[0], 1000);
}

// ───────── RVI (Relative Volatility Index) ─────────
{
  const rvi = REG.rviVol.calc, b = _bars(40), src = b.close, n = src.length;
  const sd = _refStdev(src, 10), up = new Array(n).fill(null), dn = new Array(n).fill(null);
  for (let k = 1; k < n; k++) { if (sd[k] == null) continue; if (src[k] > src[k - 1]) { up[k] = sd[k]; dn[k] = 0; } else if (src[k] < src[k - 1]) { up[k] = 0; dn[k] = sd[k]; } else { up[k] = 0; dn[k] = 0; } }
  const ua = _refEma(up, 14), da = _refEma(dn, 14), ref = new Array(n).fill(null);
  for (let k = 0; k < n; k++) if (ua[k] != null && da[k] != null) { const s = ua[k] + da[k]; ref[k] = s ? 100 * ua[k] / s : 0; }
  const got = rvi(b, { length: 14, stdevLen: 10, source: 'close' }).line;
  elem('rviVol == independent reference', got, ref);
  ck('rviVol within [0,100]', got.filter(v => v != null).every(v => v >= 0 && v <= 100), 'ok', 'bounded');
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail) process.exit(1);
