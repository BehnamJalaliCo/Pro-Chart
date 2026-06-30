import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Vazirmatn";
const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["arabic", "latin"] });

// ─── ترمینالِ واقعی: کندلِ واقعی + رسمِ دستیِ مارکر که به‌مرور اضافه می‌شود (سبکِ پیجِ کاربر) ───
const UPC = "#26de81", DNC = "#ff4d4d", MARK = "#ffffff", OR = "#ff7a00", GOLD = "#ffd000";
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function smooth(P: [number, number][]) {
  if (P.length < 2) return "";
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export type Candle = { o: number; h: number; l: number; c: number };
// تولیدِ کندلِ واقع‌نما با روند/اصلاح/نوسان (هر seed متفاوت ⇒ غیرتکراری)
export function genCandles(seed: number, n: number): Candle[] {
  const r = rng(seed);
  let price = 100 + r() * 30, trend = (r() - 0.5) * 1.0, out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    if (i % Math.floor(7 + r() * 9) === 0) trend = (r() - 0.5) * 1.3;
    const o = price, c = o + trend + (r() - 0.5) * 1.7;
    out.push({ o, c, h: Math.max(o, c) + r() * 1.0, l: Math.min(o, c) - r() * 1.0 });
    price = c;
  }
  return out;
}

// ─── ژنراتورِ دیتای الگو-دار: الگو روی چارتِ واقعی ظاهر می‌شود (نه شماتیک) ───
const PCHART: Record<string, any> = {
  head_shoulders: { sk: [[0, 30], [0.18, 55], [0.3, 42], [0.5, 68], [0.66, 42], [0.8, 55], [0.92, 42], [1, 26]], tags: [[0.18, "شانه"], [0.5, "سر"], [0.8, "شانه"]], neck: 42, down: true },
  double_top: { sk: [[0, 26], [0.22, 65], [0.42, 46], [0.64, 65], [0.82, 40], [1, 26]], tags: [[0.22, "سقف ۱"], [0.64, "سقف ۲"]], neck: 46, down: true },
  double_bottom: { sk: [[0, 76], [0.22, 38], [0.42, 58], [0.64, 38], [0.82, 62], [1, 82]], tags: [[0.22, "کف ۱"], [0.64, "کف ۲"]], neck: 58, down: false },
  ascending_triangle: { sk: [[0, 32], [0.16, 66], [0.3, 46], [0.46, 66], [0.6, 54], [0.74, 66], [0.86, 60], [1, 84]], res: 66, down: false },
  bull_flag: { sk: [[0, 20], [0.22, 72], [0.34, 62], [0.5, 66], [0.62, 58], [0.74, 63], [1, 92]], tags: [[0.12, "میله"], [0.52, "پرچم"]], down: false },
  rising_wedge: { sk: [[0, 30], [0.16, 52], [0.3, 42], [0.46, 60], [0.6, 52], [0.74, 66], [0.84, 58], [1, 30]], down: true },
};
const PCANDLE: Record<string, any> = {
  doji: { dir: "up", seq: [[42, 49, 35, 42.3]], label: "دوجی (Doji)" },
  hammer: { dir: "down", seq: [[46, 47, 36, 45.5]], label: "چکش (Hammer)" },
  shooting_star: { dir: "up", seq: [[52, 62, 51, 52.5]], label: "ستارهٔ دنباله‌دار" },
  bullish_engulfing: { dir: "down", seq: [[43, 45, 40, 41.5], [40.5, 57, 39, 56]], label: "پوشای صعودی" },
  bearish_engulfing: { dir: "up", seq: [[56, 59, 54, 57.5], [58, 60, 42, 43]], label: "پوشای نزولی" },
  morning_star: { dir: "down", seq: [[55, 57, 44, 45], [43, 45, 40, 42], [44, 58, 43, 57]], label: "ستارهٔ صبحگاهی" },
  evening_star: { dir: "up", seq: [[45, 57, 44, 56], [57, 59, 55, 57.5], [56, 57, 43, 44]], label: "ستارهٔ شامگاهی" },
  pin_bar: { dir: "up", seq: [[49, 51, 38, 50]], label: "پین‌بار (Pin Bar)" },
};
function pathClose(pts: number[][], N: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); let a = pts[0], b = pts[pts.length - 1];
    for (let k = 0; k < pts.length - 1; k++) if (t >= pts[k][0] && t <= pts[k + 1][0]) { a = pts[k]; b = pts[k + 1]; break; }
    out.push(a[1] + (b[1] - a[1]) * ((t - a[0]) / ((b[0] - a[0]) || 1)));
  }
  return out;
}
function closesToCandles(cl: number[], r: () => number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < cl.length; i++) { const o = i ? out[i - 1].c : cl[i] - (r() - 0.5); const c = cl[i] + (r() - 0.5) * 1.1; out.push({ o, c, h: Math.max(o, c) + r() * 1.0, l: Math.min(o, c) - r() * 1.0 }); }
  return out;
}
export function genShaped(key: string, seed: number, N: number): Candle[] {
  const r = rng(seed + 71);
  if (PCHART[key]) return closesToCandles(pathClose(PCHART[key].sk, N).map((v) => v + (r() - 0.5) * 2.3), r);
  const pc = PCANDLE[key];
  if (pc) {
    const seq = pc.seq, k = seq.length, tail = 5, baseN = N - k - tail;
    const start = pc.dir === "down" ? seq[0][0] + 26 : seq[0][0] - 26;
    const cl: number[] = []; for (let i = 0; i < baseN; i++) cl.push(start + (seq[0][0] - start) * (i / (baseN - 1)) + (r() - 0.5) * 2.2);
    const cand = closesToCandles(cl, r);
    for (const s of seq) cand.push({ o: s[0], h: s[1], l: s[2], c: s[3] });
    let last = seq[k - 1][3]; const revUp = seq[k - 1][3] >= seq[k - 1][0];
    for (let i = 0; i < tail; i++) { const o = last, c = o + (revUp ? 1 : -1) * (2 + r() * 2.5); cand.push({ o, c, h: Math.max(o, c) + r() * 1, l: Math.min(o, c) - r() * 1 }); last = c; }
    return cand;
  }
  return genCandles(seed, N);
}
export function patternAnnos(key: string, N: number): Anno[] {
  const P = PCHART[key];
  if (P) {
    const a: Anno[] = [];
    (P.tags || []).forEach(([at, tx]: [number, string], n: number) => a.push({ t: "tag", i: Math.round(at * (N - 1)), text: tx, at: 0.4 + n * 0.05 } as any));
    if (P.neck != null) a.push({ t: "hline", price: P.neck, label: "خطِ گردن (Neckline)", c: OR, at: 0.5 } as any);
    if (P.res != null) a.push({ t: "hline", price: P.res, label: "مقاومت", c: DNC, at: 0.4 } as any);
    a.push({ t: "arrow", i: N - 2, up: !P.down, at: 0.64 } as any);
    return a;
  }
  const pc = PCANDLE[key];
  if (pc) { const k = pc.seq.length, base = N - k - 5; return [{ t: "circle", i: base, j: base + k - 1, at: 0.42 } as any, { t: "tag", i: base + Math.floor(k / 2), text: pc.label, at: 0.52 } as any]; }
  return [];
}

// RSI واقعی از روی close ها
function computeRSI(cl: number[], p = 14): number[] {
  const out: number[] = []; let g = 0, l = 0;
  for (let i = 1; i < cl.length; i++) {
    const ch = cl[i] - cl[i - 1];
    if (i <= p) { g += Math.max(ch, 0); l += Math.max(-ch, 0); if (i === p) out[i] = 100 - 100 / (1 + (g / p) / ((l / p) || 1e-9)); else out[i] = 50; }
    else { g = (g * (p - 1) + Math.max(ch, 0)) / p; l = (l * (p - 1) + Math.max(-ch, 0)) / p; out[i] = 100 - 100 / (1 + g / (l || 1e-9)); }
  }
  out[0] = out[1] || 50; return out;
}
const ema = (a: number[], p: number) => { const k = 2 / (p + 1); const o: number[] = []; a.forEach((v, i) => o.push(i ? v * k + o[i - 1] * (1 - k) : v)); return o; };
function computeMACD(cl: number[]) { const m = ema(cl, 12).map((v, i) => v - ema(cl, 26)[i]); const s = ema(m, 9); return { macd: m, signal: s, hist: m.map((v, i) => v - s[i]) }; }

export type Anno =
  | { t: "circle"; i: number; j: number; at: number }      // دایرهٔ مارکر دورِ کندل‌های i..j
  | { t: "channel"; i: number; j: number; at: number }     // دو خطِ کانالِ موازی
  | { t: "trend"; i: number; j: number; at: number }       // خطِ روند
  | { t: "hline"; price: number; label: string; c?: string; at: number } // حمایت/مقاومت
  | { t: "auto_res" | "auto_sup"; at: number }             // حمایت/مقاومتِ خودکار از روی دیتا
  | { t: "tag"; i: number; text: string; at: number }      // برچسبِ نقطه‌ایِ الگو (شانه/سر/سقف…)
  | { t: "arrow"; i: number; up: boolean; at: number };

// نمودارِ واقعی + لایهٔ رسمِ دستی (با دوربینِ زوم) — قابلِ‌استفاده در صحنه‌ها
export const RealChart: React.FC<{ seed: number; frames: number; annos?: Anno[]; sub?: "rsi" | "macd" | null; overlay?: "ma" | "bands" | null; pattern?: string; data?: Candle[]; focus?: [number, number] }> = ({ seed, frames, annos = [], sub = null, overlay = null, pattern, data, focus }) => {
  const frame = useCurrentFrame();
  const N = 64;
  const candles = pattern ? genShaped(pattern, seed, N) : (data && data.length >= 60 ? data.slice(-N) : genCandles(seed, N));
  const eff = pattern ? patternAnnos(pattern, N) : annos;
  const closes = candles.map((c) => c.c);
  const W = 1920, H = 1080;
  const padR = 120, padL = 40, top = sub ? 116 : 150;
  const chartH = sub ? 470 : 760;
  const lo = Math.min(...candles.map((c) => c.l)), hi = Math.max(...candles.map((c) => c.h)), pad = (hi - lo) * 0.08;
  const x = (i: number) => padL + ((W - padL - padR) * (i + 0.5)) / N;
  const y = (v: number) => top + chartH * (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)));
  const cw = (W - padL - padR) / N, bw = cw * 0.62;

  // دوربین: زومِ نرم به ناحیهٔ focus (حرکتِ غیرتکراری)
  const r = rng(seed + 5);
  const fc = focus || [N * (0.45 + r() * 0.2), N * 0.85];
  const cxFocus = x((fc[0] + fc[1]) / 2), cyFocus = (y(hi) + y(lo)) / 2;
  const staticCam = !!sub || overlay === "ma";              // برای هم‌ترازیِ مارکرِ سیگنال، دوربین ثابت
  const zoom = staticCam ? 1 : interpolate(frame, [0, frames], [1.03, 1.15]);
  const panX = staticCam ? 0 : interpolate(frame, [0, frames], [0, (W / 2 - cxFocus) * 0.16]);
  const reveal = interpolate(frame, [0, frames * 0.4], [0, N], clamp);
  void cyFocus;
  // تشخیصِ نقطهٔ سیگنال (همان کندلی که اتفاق افتاد) تا کاربر بفهمد چه خبر است
  let sigIdx = -1, sigLabel = "";
  if (sub === "rsi") { const rA = computeRSI(closes); let mi = Math.floor(N * 0.4); for (let t = mi; t < N - 1; t++) if (rA[t] > rA[mi]) mi = t; sigIdx = mi; sigLabel = rA[mi] >= 65 ? "RSI به اشباعِ خرید رسید" : "سقفِ RSI"; }
  else if (sub === "macd") { const { macd, signal } = computeMACD(closes); for (let t = Math.floor(N * 0.4) + 1; t < N - 1 && sigIdx < 0; t++) if ((macd[t - 1] - signal[t - 1]) * (macd[t] - signal[t]) < 0) { sigIdx = t; sigLabel = macd[t] >= signal[t] ? "تقاطعِ صعودیِ MACD" : "تقاطعِ نزولیِ MACD"; } }
  else if (overlay === "ma") { const f = ema(closes, 9), s = ema(closes, 21); for (let t = Math.floor(N * 0.3) + 1; t < N - 1 && sigIdx < 0; t++) if ((f[t - 1] - s[t - 1]) * (f[t] - s[t]) < 0) { sigIdx = t; sigLabel = f[t] >= s[t] ? "تقاطعِ طلایی (Golden Cross)" : "تقاطعِ مرگ (Death Cross)"; } }
  const sigP = interpolate(frame, [frames * 0.55, frames * 0.74], [0, 1], clamp);

  const drawn = (at: number, dur = 18) => interpolate(frame, [frames * at, frames * at + dur], [0, 1], clamp);

  // بهترین ناحیهٔ روندی را خودش پیدا می‌کند (قوی‌ترین شیبِ کف‌های صعودی)
  const bestWin = (useHighs: boolean) => {
    const w = 22; let best = { s: -1e9, i: 2, j: 24 };
    for (let i = 2; i + w < N - 1; i++) { const j = i + w; let s = 0; for (let t = i; t < j; t++) { const d = useHighs ? candles[t + 1].h - candles[t].h : candles[t + 1].l - candles[t].l; s += useHighs ? -d : d; } if (s > best.s) best = { s, i, j }; }
    return best;
  };
  // خطِ روندِ دقیق و مماس: لنگرگاهِ اول کفِ مطلق، لنگرِ دوم کفِ بعد از آن (سقف برای نزولی)
  const anchors = (i: number, j: number, useHighs: boolean) => {
    const key = (t: number) => (useHighs ? candles[t].h : candles[t].l);
    let a = i; for (let t = i; t <= j; t++) if (useHighs ? key(t) > key(a) : key(t) < key(a)) a = t;
    let b = Math.min(j, a + 3); for (let t = a + 3; t <= j; t++) if (useHighs ? key(t) > key(b) : key(t) < key(b)) b = t;
    if (b <= a) b = j;
    const xa = x(a), xb = x(b), ya = y(key(a)), yb = y(key(b)), m = (yb - ya) / ((xb - xa) || 1);
    const pad2 = (useHighs ? -1 : 1) * 7;
    return { i, j, y1: ya + m * (x(i) - xa) + pad2, y2: ya + m * (x(j) - xa) + pad2, ta: a, tb: b };
  };
  const mkLine = (arr: number[]) => smooth(arr.map((v, i) => [x(i), y(v)] as [number, number]));
  const ovP = interpolate(frame, [frames * 0.2, frames * 0.55], [0, 1], clamp);
  let overlayEl: React.ReactNode = null;
  if (overlay === "ma") {
    overlayEl = <g><path d={mkLine(ema(closes, 9))} fill="none" stroke="#ffd000" strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ovP} /><path d={mkLine(ema(closes, 21))} fill="none" stroke={OR} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ovP} /></g>;
  } else if (overlay === "bands") {
    const w = 20, mid = closes.map((_, i) => { const a = closes.slice(Math.max(0, i - w + 1), i + 1); return a.reduce((s, v) => s + v, 0) / a.length; });
    const sd = closes.map((_, i) => { const a = closes.slice(Math.max(0, i - w + 1), i + 1); return Math.sqrt(a.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / a.length); });
    overlayEl = <g opacity={ovP}><path d={mkLine(mid.map((m, i) => m + 2 * sd[i]))} fill="none" stroke="#ffd000" strokeWidth={2} /><path d={mkLine(mid)} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="6 5" opacity={0.6} /><path d={mkLine(mid.map((m, i) => m - 2 * sd[i]))} fill="none" stroke="#ffd000" strokeWidth={2} /></g>;
  }

  return (
    <AbsoluteFill style={{ background: "radial-gradient(130% 100% at 50% 0%, #121826 0%, #070a11 75%)", fontFamily }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {/* محورِ قیمتِ راست (حسِ ترمینالِ واقعی) */}
        {[0, 1, 2, 3, 4, 5].map((g) => { const yy = top + (chartH * g) / 5; const pv = (hi + pad) - (((hi + pad) - (lo - pad)) * g) / 5; return <g key={g}><line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="rgba(255,255,255,.06)" /><text x={W - padR + 12} y={yy + 7} fill="#7c8696" fontSize={22} fontFamily="monospace">{pv.toFixed(1)}</text></g>; })}
        <g transform={`translate(${W / 2} ${H / 2}) scale(${zoom}) translate(${-W / 2 + panX} ${-H / 2})`}>
          {candles.map((d, i) => {
            const g = interpolate(reveal, [i - 0.6, i], [0, 1], clamp); if (g <= 0) return null;
            const up = d.c >= d.o, col = up ? UPC : DNC, cx = x(i);
            const bt = y(Math.max(d.o, d.c)), bh = Math.max(2, Math.abs(y(d.o) - y(d.c)));
            return <g key={i} opacity={g}><line x1={cx} x2={cx} y1={y(d.h)} y2={y(d.l)} stroke={col} strokeWidth={2.4} /><rect x={cx - bw / 2} y={bt} width={bw} height={bh} fill={col} rx={1.5} /></g>;
          })}
          {overlayEl}
          {/* لایهٔ رسمِ دستیِ مارکر */}
          {eff.map((a, k) => {
            const p = drawn(a.at);
            if (a.t === "circle") {
              const xs = [a.i, a.j].map(x), ys = candles.slice(a.i, a.j + 1);
              const cx0 = (xs[0] + xs[1]) / 2, rx = Math.abs(xs[1] - xs[0]) / 2 + 46;
              const yhi = y(Math.max(...ys.map((c) => c.h))) - 26, ylo = y(Math.min(...ys.map((c) => c.l))) + 26;
              const cy0 = (yhi + ylo) / 2, ry = Math.abs(ylo - yhi) / 2 + 16;
              const rr = rng(seed + k + 1), pts: [number, number][] = [];
              for (let t = 0; t <= 26; t++) { const ang = (t / 24) * Math.PI * 2 - 0.35; const j = 1 + (rr() - 0.5) * 0.09; pts.push([cx0 + Math.cos(ang) * rx * j, cy0 + Math.sin(ang) * ry * j]); }
              return <path key={k} d={smooth(pts)} fill="none" stroke={MARK} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.5))" }} />;
            }
            if (a.t === "channel" || a.t === "trend") {
              const upTrend = closes[N - 1] >= closes[Math.floor(N * 0.25)];
              const useH = !upTrend;                            // نزولی → خط روی سقف‌ها، صعودی → روی کف‌ها
              const win = bestWin(useH);
              const main = anchors(win.i, win.j, useH), other = anchors(win.i, win.j, !useH);
              const xi = x(win.i), xj = x(win.j);
              const mk = (an: any, hi: boolean) => [<circle key="a" cx={x(an.ta)} cy={y(hi ? candles[an.ta].h : candles[an.ta].l) + (hi ? -7 : 7)} r={6} fill="none" stroke={MARK} strokeWidth={2.5} opacity={p} />, <circle key="b" cx={x(an.tb)} cy={y(hi ? candles[an.tb].h : candles[an.tb].l) + (hi ? -7 : 7)} r={6} fill="none" stroke={MARK} strokeWidth={2.5} opacity={p} />];
              return <g key={k}>
                <line x1={xi} y1={main.y1} x2={xj} y2={main.y2} stroke={MARK} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
                {mk(main, useH)}
                {a.t === "channel" && <line x1={xi} y1={other.y1} x2={xj} y2={other.y2} stroke={MARK} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />}
              </g>;
            }
            if (a.t === "auto_res" || a.t === "auto_sup") {
              const s = Math.floor(N * 0.35), reg = candles.slice(s);
              const pr = a.t === "auto_res" ? Math.max(...reg.map((c) => c.h)) : Math.min(...reg.map((c) => c.l));
              const col = a.t === "auto_res" ? DNC : UPC, lbl = a.t === "auto_res" ? "مقاومت" : "حمایت";
              return <g key={k} opacity={drawn(a.at)}><line x1={x(s)} x2={x(N - 1)} y1={y(pr)} y2={y(pr)} stroke={col} strokeWidth={3} strokeDasharray="12 7" /><text x={x(s) + 10} y={y(pr) - 12} fill={col} fontWeight={800} fontSize={28}>{lbl}</text></g>;
            }
            if (a.t === "hline") return <g key={k} opacity={p}><line x1={padL} x2={W - padR} y1={y(a.price)} y2={y(a.price)} stroke={a.c || OR} strokeWidth={3} strokeDasharray="12 7" /><text x={padL + 14} y={y(a.price) - 12} fill={a.c || OR} fontWeight={800} fontSize={28}>{a.label}</text></g>;
            if (a.t === "arrow") { const cx = x(a.i), y0 = a.up ? y(candles[a.i].l) + 70 : y(candles[a.i].h) - 70, y1 = a.up ? y(candles[a.i].l) + 14 : y(candles[a.i].h) - 14; return <g key={k} opacity={p}><line x1={cx} y1={y0} x2={cx} y2={y1} stroke={a.up ? UPC : DNC} strokeWidth={6} strokeLinecap="round" /><polygon points={`${cx},${y1} ${cx - 14},${y1 + (a.up ? 22 : -22)} ${cx + 14},${y1 + (a.up ? 22 : -22)}`} fill={a.up ? UPC : DNC} /></g>; }
            if (a.t === "tag") { const cy = y(candles[a.i].h) - 34; return <foreignObject key={k} x={Math.max(8, x(a.i) - 95)} y={cy - 44} width={190} height={46} opacity={p}><div style={{ fontFamily, fontWeight: 800, fontSize: 24, color: "#0b0d12", background: GOLD, borderRadius: 9, padding: "5px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{a.text}</div></foreignObject>; }
            return null;
          })}
        </g>
        {/* پنلِ اندیکاتورِ واقعی (محاسبه‌شده از همین دیتا) */}
        {sub && <RealSub kind={sub} candles={candles} closes={closes} x={x} top={top + chartH + 30} h={200} W={W} padR={padR} padL={padL} frame={frame} frames={frames} />}
        {/* مارکرِ سیگنال: همان کندلی که اتفاق افتاد، با خطِ راهنما به پنلِ اندیکاتور */}
        {sigIdx >= 0 && <g opacity={sigP}>
          <line x1={x(sigIdx)} x2={x(sigIdx)} y1={top} y2={top + chartH + (sub ? 230 : 0)} stroke="#fff" strokeWidth={2} strokeDasharray="7 6" opacity={0.6} />
          <circle cx={x(sigIdx)} cy={y(candles[sigIdx].h) - 24} r={19} fill="none" stroke="#fff" strokeWidth={3.5} style={{ filter: "drop-shadow(0 0 9px rgba(255,255,255,.75))" }} />
          <foreignObject x={Math.min(W - 360, Math.max(20, x(sigIdx) - 170))} y={top + 4} width={340} height={54}><div style={{ fontFamily, fontWeight: 800, fontSize: 26, color: "#0b0d12", background: "#fff", borderRadius: 10, padding: "7px 12px", textAlign: "center" }}>{sigLabel}</div></foreignObject>
        </g>}
      </svg>
    </AbsoluteFill>
  );
};

const RealSub: React.FC<any> = ({ kind, closes, x, top, h, W, padR, padL, frame, frames }) => {
  const reveal = interpolate(frame, [frames * 0.35, frames * 0.7], [0, closes.length], clamp);
  if (kind === "rsi") {
    const rsi = computeRSI(closes);
    const yy = (v: number) => top + h * (1 - v / 100);
    const pts = rsi.map((v, i) => [x(i), yy(v)] as [number, number]).filter((_, i) => i <= reveal);
    return <g>
      <rect x={padL} y={top - 8} width={W - padL - padR} height={h + 16} fill="rgba(255,255,255,.02)" rx={10} />
      <line x1={padL} x2={W - padR} y1={yy(70)} y2={yy(70)} stroke={DNC} strokeWidth={1.5} strokeDasharray="8 5" opacity={0.7} />
      <line x1={padL} x2={W - padR} y1={yy(30)} y2={yy(30)} stroke={UPC} strokeWidth={1.5} strokeDasharray="8 5" opacity={0.7} />
      <text x={padL + 8} y={yy(70) - 6} fill={DNC} fontSize={20} fontFamily="monospace">70</text>
      <text x={padL + 8} y={yy(30) + 24} fill={UPC} fontSize={20} fontFamily="monospace">30</text>
      <text x={W - padR - 80} y={top + 26} fill="#8a93a3" fontWeight={700} fontSize={24} fontFamily={fontFamily}>RSI</text>
      <path d={smooth(pts)} fill="none" stroke="#ffd000" strokeWidth={3} strokeLinecap="round" />
    </g>;
  }
  const { macd, signal, hist } = computeMACD(closes);
  const mx = Math.max(...macd.map(Math.abs), ...signal.map(Math.abs)) || 1;
  const yy = (v: number) => top + h / 2 - (v / mx) * (h / 2 - 10);
  const mp = macd.map((v, i) => [x(i), yy(v)] as [number, number]).filter((_, i) => i <= reveal);
  const sp = signal.map((v, i) => [x(i), yy(v)] as [number, number]).filter((_, i) => i <= reveal);
  return <g>
    <rect x={padL} y={top - 8} width={W - padL - padR} height={h + 16} fill="rgba(255,255,255,.02)" rx={10} />
    <line x1={padL} x2={W - padR} y1={yy(0)} y2={yy(0)} stroke="rgba(255,255,255,.12)" />
    {hist.map((v, i) => i <= reveal ? <rect key={i} x={x(i) - (W - padL - padR) / closes.length * 0.3} y={Math.min(yy(0), yy(v))} width={(W - padL - padR) / closes.length * 0.6} height={Math.abs(yy(0) - yy(v))} fill={v >= 0 ? UPC : DNC} opacity={0.6} /> : null)}
    <text x={W - padR - 110} y={top + 26} fill="#8a93a3" fontWeight={700} fontSize={24} fontFamily={fontFamily}>MACD</text>
    <path d={smooth(mp)} fill="none" stroke="#ffd000" strokeWidth={2.6} strokeLinecap="round" />
    <path d={smooth(sp)} fill="none" stroke={OR} strokeWidth={2.6} strokeLinecap="round" />
  </g>;
};

// نگاشتِ «کلیدِ مفهوم → چارتِ واقعی»: کدام رسم/اندیکاتور روی ترمینالِ واقعی بیاید
type RealCfg = { annos: Anno[]; sub?: "rsi" | "macd" | null; overlay?: "ma" | "bands" | null; pattern?: string };
export const REAL_CFG: Record<string, RealCfg> = {
  trendline: { annos: [{ t: "trend", i: 0, j: 0, at: 0.3 }] },          // ناحیه را خودش پیدا می‌کند
  pullback: { annos: [{ t: "trend", i: 0, j: 0, at: 0.3 }] },
  channel: { annos: [{ t: "channel", i: 0, j: 0, at: 0.3 }] },
  support_resistance: { annos: [{ t: "auto_res", at: 0.28 }, { t: "auto_sup", at: 0.42 }] },
  breakout: { annos: [{ t: "auto_res", at: 0.3 }] },
  rsi: { sub: "rsi", annos: [] },
  macd: { sub: "macd", annos: [] },
  ma_cross: { overlay: "ma", annos: [] },
  bollinger: { overlay: "bands", annos: [] },
  // الگوها روی چارتِ واقعی (دیتای الگو-دار + برچسب‌گذاری)
  head_shoulders: { pattern: "head_shoulders", annos: [] },
  double_top: { pattern: "double_top", annos: [] },
  double_bottom: { pattern: "double_bottom", annos: [] },
  ascending_triangle: { pattern: "ascending_triangle", annos: [] },
  bull_flag: { pattern: "bull_flag", annos: [] },
  rising_wedge: { pattern: "rising_wedge", annos: [] },
  doji: { pattern: "doji", annos: [] },
  hammer: { pattern: "hammer", annos: [] },
  shooting_star: { pattern: "shooting_star", annos: [] },
  bullish_engulfing: { pattern: "bullish_engulfing", annos: [] },
  bearish_engulfing: { pattern: "bearish_engulfing", annos: [] },
  morning_star: { pattern: "morning_star", annos: [] },
  evening_star: { pattern: "evening_star", annos: [] },
  pin_bar: { pattern: "pin_bar", annos: [] },
};
export const isReal = (k?: string) => !!k && !!REAL_CFG[k];

// دموی تستِ ظاهر (مشابهِ قاب‌های مرجع)
export const RealChartDemo: React.FC<{ variant?: number }> = ({ variant = 0 }) => {
  const cfgs: { annos: Anno[]; sub?: "rsi" | "macd" | null; overlay?: "ma" | "bands" | null; cap: string; kw: string }[] = [
    { annos: [{ t: "trend", i: 36, j: 60, at: 0.32 }], cap: "این همون", kw: "خطِ روند" },
    { annos: [{ t: "channel", i: 38, j: 60, at: 0.32 }], cap: "قیمت داخلِ", kw: "کانال" },
    { annos: [{ t: "auto_res", at: 0.3 }, { t: "auto_sup", at: 0.42 }], cap: "سقف و کفِ", kw: "حمایت مقاومت" },
    { annos: [{ t: "circle", i: 44, j: 54, at: 0.4 }], overlay: "ma", cap: "تقاطعِ", kw: "میانگین متحرک" },
    { annos: [{ t: "circle", i: 28, j: 38, at: 0.4 }], sub: "rsi", cap: "وقتی RSI رفت اشباع،", kw: "برگشت" },
  ];
  const c = cfgs[variant % cfgs.length];
  return (
    <AbsoluteFill>
      <RealChart seed={variant * 37 + 11} frames={130} annos={c.annos} sub={c.sub || null} overlay={c.overlay || null} />
      <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, textAlign: "center", fontFamily, direction: "rtl" }}>
        <span style={{ color: "#fff", fontWeight: 900, fontSize: 60, textShadow: "0 4px 18px rgba(0,0,0,.8)" }}>{c.cap} </span>
        <span style={{ color: "#15100a", fontWeight: 900, fontSize: 60, background: OR, padding: "4px 20px", borderRadius: 12 }}>{c.kw}</span>
      </div>
    </AbsoluteFill>
  );
};
