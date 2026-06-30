import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Vazirmatn";
const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["arabic", "latin"] });

// ─── دیاگرام‌های آموزشیِ فارکس (کیفیتِ فتوشاپ): گرادیان، گلو، منحنیِ نرم، سایه ───
const UP = "#16c784", DN = "#ea3943", GOLD = "#ffd000", OR = "#ff7a00", TX = "#f1f5fb", GRID = "rgba(255,255,255,.06)";
const VB_W = 1600, X0 = 72, PW = 1456;
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// defs مشترک: فیلترِ گلو/سایه + گرادیان‌ها (عمق و درخششِ حرفه‌ای)
const Defs: React.FC = () => (
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="sglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.55" /></filter>
    <linearGradient id="upG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2ef0a8" /><stop offset="1" stopColor="#0c9a5f" /></linearGradient>
    <linearGradient id="dnG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6b76" /><stop offset="1" stopColor="#bf1f2c" /></linearGradient>
    <linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff7a00" /><stop offset="0.5" stopColor="#ffb03a" /><stop offset="1" stopColor="#ffd000" /></linearGradient>
    <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(255,176,58,.30)" /><stop offset="1" stopColor="rgba(255,176,58,0)" /></linearGradient>
    <radialGradient id="vig" cx="50%" cy="42%" r="75%"><stop offset="55%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,.42)" /></radialGradient>
  </defs>
);
const Vignette: React.FC = () => <rect x="0" y="0" width={VB_W} height={800} fill="url(#vig)" pointerEvents="none" />;

// منحنیِ نرمِ Catmull-Rom → بزیر (خطوطِ صافِ حرفه‌ای به‌جای شکسته)
function smooth(P: [number, number][]) {
  if (P.length < 2) return "";
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// چیپِ عنوانِ مفهوم (شیشه‌ای، بالا-وسط)
const TitleChip: React.FC<{ t: string }> = ({ t }) => (
  <div style={{ position: "absolute", top: 116, left: 0, right: 0, textAlign: "center" }}>
    <div style={{ display: "inline-block", background: "linear-gradient(180deg,rgba(255,138,20,.26),rgba(255,122,0,.12))", border: `1.5px solid rgba(255,160,60,.7)`, color: "#fff", fontFamily, fontWeight: 900, fontSize: 40, padding: "9px 32px", borderRadius: 16, boxShadow: "0 10px 34px rgba(255,122,0,.28), inset 0 1px 0 rgba(255,255,255,.18)", backdropFilter: "blur(6px)" }}>{t}</div>
  </div>
);

// برچسبِ کالاوت با خطِ اشاره (با سایه و موقعیتِ امن)
const Callout: React.FC<{ x: number; y: number; tx: number; ty: number; text: string; show: number; color?: string }> = ({ x, y, tx, ty, text, show, color }) => {
  const cx = Math.max(X0 + 170, Math.min(X0 + PW - 170, tx));
  return (
    <g opacity={show} filter="url(#sh)">
      <line x1={x} y1={y} x2={cx} y2={ty < 400 ? ty - 30 : ty + 30} stroke={color || GOLD} strokeWidth={2.5} strokeDasharray="5 4" />
      <circle cx={x} cy={y} r={6} fill={color || GOLD} filter="url(#glow)" />
      <foreignObject x={cx - 165} y={ty < 400 ? Math.max(198, ty - 96) : ty + 30} width={330} height={88}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 27, color: "#0b0d12", background: `linear-gradient(180deg,${color || GOLD},${color ? color : "#f0b400"})`, borderRadius: 12, padding: "9px 14px", textAlign: "center", lineHeight: 1.28 }}>{text}</div>
      </foreignObject>
    </g>
  );
};

function arrow(x1: number, y1: number, x2: number, y2: number, color: string, op: number, key?: string) {
  const ang = Math.atan2(y2 - y1, x2 - x1); const h = 16;
  const a1x = x2 - h * Math.cos(ang - 0.4), a1y = y2 - h * Math.sin(ang - 0.4);
  const a2x = x2 - h * Math.cos(ang + 0.4), a2y = y2 - h * Math.sin(ang + 0.4);
  return <g key={key} opacity={op}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={4} /><polygon points={`${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} /></g>;
}

// ───────────────────────── موتورِ کندل (همهٔ الگوهای شمعی) ─────────────────────────
type C = [number, number, number, number]; // o,h,l,c روی مقیاسِ 0..100
const Candles: React.FC<{ data: C[]; highlight: number[]; label: string; lbi: number; frames: number }> = ({ data, highlight, label, lbi, frames }) => {
  const frame = useCurrentFrame();
  const N = data.length;
  const mn = Math.min(...data.map((d) => d[2])) - 6, mx = Math.max(...data.map((d) => d[1])) + 6;
  const Y0 = 200, PH = 470;
  const x = (i: number) => X0 + (PW * (i + 0.5)) / N;
  const y = (v: number) => Y0 + PH * (1 - (v - mn) / (mx - mn));
  const bw = Math.min(64, (PW / N) * 0.52);
  const reveal = interpolate(frame, [6, frames * 0.5], [0, N], clamp);
  const hlP = interpolate(frame, [frames * 0.52, frames * 0.66], [0, 1], clamp);
  const lbP = interpolate(frame, [frames * 0.68, frames * 0.82], [0, 1], clamp);
  const hx = highlight.map((i) => x(i)); const hxMin = Math.min(...hx) - bw, hxMax = Math.max(...hx) + bw;
  const hyMin = Math.min(...highlight.map((i) => y(data[i][1]))) - 14, hyMax = Math.max(...highlight.map((i) => y(data[i][2]))) + 14;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} 800`} preserveAspectRatio="xMidYMid meet">
      <Defs />
      {[0, 1, 2, 3, 4].map((g) => <line key={g} x1={X0} x2={X0 + PW} y1={Y0 + (PH * g) / 4} y2={Y0 + (PH * g) / 4} stroke={GRID} strokeWidth={1} />)}
      <rect x={hxMin} y={hyMin} width={hxMax - hxMin} height={hyMax - hyMin} rx={14} fill="rgba(255,122,0,.07)" stroke={OR} strokeWidth={3} opacity={hlP} filter="url(#glow)" />
      {data.map((d, i) => {
        const g = interpolate(reveal, [i, i + 0.7], [0, 1], clamp); if (g <= 0) return null;
        const cx = x(i), green = d[3] >= d[0], col = green ? UP : DN, on = highlight.includes(i);
        const top = y(Math.max(d[0], d[3])), bh = Math.abs(y(d[0]) - y(d[3])) * g;
        return <g key={i} opacity={g} filter={on ? "url(#glow)" : undefined}>
          <line x1={cx} x2={cx} y1={y(d[1])} y2={y(d[2])} stroke={col} strokeWidth={3} strokeLinecap="round" />
          <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(2, bh)} rx={3} fill={green ? "url(#upG)" : "url(#dnG)"} stroke={col} strokeWidth={1} />
          <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(2, bh)} rx={3} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1} />
        </g>;
      })}
      <Callout x={x(lbi)} y={y(data[lbi][1]) - 16} tx={x(lbi)} ty={y(data[lbi][1]) - 70} text={label} show={lbP} color={OR} />
      <Vignette />
    </svg>
  );
};

// ───────────────────────── موتورِ مسیرِ قیمت (الگوها/مفاهیم) ─────────────────────────
type Anno =
  | { t: "hline"; y: number; c: string; label: string }
  | { t: "zone"; y1: number; y2: number; c: string; label: string }
  | { t: "trend"; x1: number; y1: number; x2: number; y2: number; c: string; label?: string }
  | { t: "arrow"; x1: number; y1: number; x2: number; y2: number; c: string }
  | { t: "label"; x: number; y: number; text: string; c: string }
  | { t: "fib"; lo: number; hi: number }
  | { t: "rr"; entry: number; sl: number; tp: number };

const PricePath: React.FC<{ pts: number[]; annos: Anno[]; frames: number; split?: boolean }> = ({ pts, annos, frames, split }) => {
  const frame = useCurrentFrame();
  const Y0 = 190, PH = split ? 300 : 480;
  const x = (t: number) => X0 + PW * t;
  const y = (v: number) => Y0 + PH * (1 - v / 100);
  const n = pts.length;
  const coords = pts.map((v, i) => [x(i / (n - 1)), y(v)] as [number, number]);
  const d = smooth(coords);
  const areaD = d + ` L${x(1)},${Y0 + PH} L${x(0)},${Y0 + PH} Z`;
  const draw = interpolate(frame, [6, frames * 0.5], [0, 1], clamp);
  const aP = interpolate(frame, [frames * 0.52, frames * 0.82], [0, 1], clamp);
  const fibR = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} 800`} preserveAspectRatio="xMidYMid meet">
      <Defs />
      {[0, 1, 2, 3, 4].map((g) => <line key={g} x1={X0} x2={X0 + PW} y1={Y0 + (PH * g) / 4} y2={Y0 + (PH * g) / 4} stroke={GRID} strokeWidth={1} />)}
      {annos.map((a, i) => {
        if (a.t === "zone") return <g key={i} opacity={aP}><rect x={X0} y={y(a.y2)} width={PW} height={y(a.y1) - y(a.y2)} fill={a.c} opacity={0.16} /><line x1={X0} x2={X0 + PW} y1={y(a.y2)} y2={y(a.y2)} stroke={a.c} strokeWidth={1.5} strokeDasharray="6 5" /><text x={X0 + 14} y={y(a.y2) + 30} fill={a.c} fontFamily={fontFamily} fontWeight={800} fontSize={26}>{a.label}</text></g>;
        if (a.t === "hline") return <g key={i} opacity={aP}><line x1={X0} x2={X0 + PW} y1={y(a.y)} y2={y(a.y)} stroke={a.c} strokeWidth={2.5} strokeDasharray="9 6" /><text x={X0 + 14} y={y(a.y) - 10} fill={a.c} fontFamily={fontFamily} fontWeight={800} fontSize={26}>{a.label}</text></g>;
        if (a.t === "trend") return <g key={i} opacity={aP}><line x1={x(a.x1)} y1={y(a.y1)} x2={x(a.x2)} y2={y(a.y2)} stroke={a.c} strokeWidth={3} />{a.label ? <text x={x(a.x1) + 10} y={y(a.y1) - 10} fill={a.c} fontFamily={fontFamily} fontWeight={800} fontSize={25}>{a.label}</text> : null}</g>;
        if (a.t === "arrow") return arrow(x(a.x1), y(a.y1), x(a.x2), y(a.y2), a.c, aP, "a" + i);
        if (a.t === "label") return <foreignObject key={i} x={x(a.x) - 90} y={y(a.y) - 28} width={180} height={56} opacity={aP}><div style={{ fontFamily, fontWeight: 800, fontSize: 25, color: "#0b0d12", background: a.c, borderRadius: 9, padding: "5px 10px", textAlign: "center" }}>{a.text}</div></foreignObject>;
        if (a.t === "fib") return <g key={i} opacity={aP}>{fibR.map((r, k) => { const yy = y(a.lo + (a.hi - a.lo) * r); return <g key={k}><line x1={X0} x2={X0 + PW} y1={yy} y2={yy} stroke={k === 4 ? OR : GOLD} strokeWidth={k === 4 ? 2.5 : 1.5} opacity={k === 4 ? 1 : 0.6} /><text x={X0 + PW - 96} y={yy - 6} fill={k === 4 ? OR : GOLD} fontFamily="monospace" fontWeight={700} fontSize={22}>{r.toFixed(3)}</text></g>; })}</g>;
        if (a.t === "rr") return <g key={i} opacity={aP}><rect x={X0} y={y(a.entry)} width={PW} height={y(a.sl) - y(a.entry)} fill={DN} opacity={0.16} /><rect x={X0} y={y(a.tp)} width={PW} height={y(a.entry) - y(a.tp)} fill={UP} opacity={0.16} /><line x1={X0} x2={X0 + PW} y1={y(a.entry)} y2={y(a.entry)} stroke={GOLD} strokeWidth={2.5} /><text x={X0 + 14} y={y(a.entry) - 10} fill={GOLD} fontFamily={fontFamily} fontWeight={800} fontSize={26}>ورود (Entry)</text><text x={X0 + 14} y={y(a.sl) - 10} fill={DN} fontFamily={fontFamily} fontWeight={800} fontSize={26}>حدِ ضرر (SL)</text><text x={X0 + 14} y={y(a.tp) + 30} fill={UP} fontFamily={fontFamily} fontWeight={800} fontSize={26}>حدِ سود (TP)</text></g>;
        return null;
      })}
      <path d={areaD} fill="url(#areaG)" opacity={draw} />
      <path d={d} fill="none" stroke="url(#lineG)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <Vignette />
    </svg>
  );
};

// ───────────────────────── پنلِ اندیکاتور (RSI / MACD / تقاطع / بولینگر) ─────────────────────────
// نقطهٔ روی خط در پیشروی p (برای پلی‌هد و دات‌های دقیق)
function ptAt(arr: number[], p: number) { const n = arr.length; const tt = Math.max(0, Math.min(n - 1, p * (n - 1))); const i = Math.min(n - 2, Math.floor(tt)); const f = tt - i; return { t: tt / (n - 1), v: arr[i] + (arr[i + 1] - arr[i]) * f }; }
const Dots: React.FC<{ arr: number[]; xf: (i: number) => number; yf: (v: number) => number; p: number; color: string }> = ({ arr, xf, yf, p, color }) => (
  <>{arr.map((v, i) => { const o = interpolate(p, [i / (arr.length - 1) - 0.02, i / (arr.length - 1) + 0.02], [0, 1], clamp); return <circle key={i} cx={xf(i)} cy={yf(v)} r={4.5} fill={color} stroke="#0b0d12" strokeWidth={1.5} opacity={o} />; })}</>
);

const IndicatorView: React.FC<{ kind: string; frames: number }> = ({ kind, frames }) => {
  const frame = useCurrentFrame();
  const price = [38, 52, 64, 58, 70, 80, 66];
  const x = (i: number, n: number) => X0 + (PW * i) / (n - 1);
  const xf = (i: number) => X0 + (PW * i) / 6;        // ۷ نقطه
  const prog = interpolate(frame, [6, frames * 0.5], [0, 1], clamp);
  const aP = interpolate(frame, [frames * 0.5, frames * 0.78], [0, 1], clamp);
  const pe = Math.min(prog, 0.999);
  const headOp = interpolate(prog, [0.02, 0.08, 0.92, 0.99], [0, 1, 1, 0], clamp); // پلی‌هد حین کشیدن
  const pY0 = 180, pH = 270, py = (v: number) => pY0 + pH * (1 - v / 100);
  const sm = (arr: number[], yf: (v: number) => number) => smooth(arr.map((v, i) => [x(i, arr.length), yf(v)] as [number, number]));
  const pPath = sm(price, py);
  const dprog = prog;

  if (kind === "ma_cross" || kind === "bollinger") {
    const fast = [30, 44, 56, 60, 68, 78, 70], slow = [50, 52, 55, 58, 60, 64, 66];
    const Y0 = 200, PH = 460, yy = (v: number) => Y0 + PH * (1 - v / 100);
    const mk = (arr: number[]) => smooth(arr.map((v, i) => [x(i, arr.length), yy(v)] as [number, number]));
    const cX = x(2.4, 7);
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} 800`} preserveAspectRatio="xMidYMid meet">
        <Defs />
        {[0, 1, 2, 3, 4].map((g) => <line key={g} x1={X0} x2={X0 + PW} y1={Y0 + (PH * g) / 4} y2={Y0 + (PH * g) / 4} stroke={GRID} strokeWidth={1} />)}
        {kind === "bollinger" && <path d={mk(fast.map((v) => v + 14)) + " L" + x(6, 7) + "," + yy(slow[6] - 18) + " " + slow.map((v, i) => "L" + x(6 - i, 7) + "," + yy(slow[6 - i] - 18)).join(" ") + " Z"} fill="rgba(255,208,0,.06)" opacity={aP} />}
        <path d={mk(price)} fill="none" stroke="#cfd6e2" strokeWidth={3.5} strokeLinecap="round" opacity={0.85} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} />
        {kind === "ma_cross" ? <>
          <path d={mk(fast)} fill="none" stroke={GOLD} strokeWidth={4} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} />
          <path d={mk(slow)} fill="none" stroke={OR} strokeWidth={4} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} />
          <Dots arr={fast} xf={xf} yf={yy} p={prog} color={GOLD} /><Dots arr={slow} xf={xf} yf={yy} p={prog} color={OR} />
          <line x1={cX} x2={cX} y1={yy(55)} y2={Y0 + PH} stroke="#fff" strokeWidth={1.5} strokeDasharray="6 5" opacity={aP * 0.7} />
          <circle cx={cX} cy={yy(55)} r={16} fill="none" stroke="#fff" strokeWidth={4} opacity={aP} filter="url(#glow)" /><circle cx={cX} cy={yy(55)} r={6} fill="#fff" opacity={aP} />
          <foreignObject x={cX - 110} y={yy(55) + 26} width={220} height={54} opacity={aP}><div style={{ fontFamily, fontWeight: 800, fontSize: 25, color: "#0b0d12", background: "#fff", borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>تقاطعِ طلایی</div></foreignObject>
          <text x={X0 + 14} y={Y0 + 36} fill={GOLD} fontFamily={fontFamily} fontWeight={800} fontSize={24} opacity={aP}>میانگینِ تند</text><text x={X0 + 14} y={Y0 + 70} fill={OR} fontFamily={fontFamily} fontWeight={800} fontSize={24} opacity={aP}>میانگینِ کند</text>
        </> :
          <><path d={mk(fast.map((v) => v + 14))} fill="none" stroke={GOLD} strokeWidth={3} opacity={aP * 0.9} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} /><path d={mk(slow)} fill="none" stroke="#fff" strokeWidth={2.5} strokeDasharray="6 5" opacity={aP * 0.85} /><path d={mk(fast.map((v) => v - 18))} fill="none" stroke={GOLD} strokeWidth={3} opacity={aP * 0.9} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} /><Dots arr={price} xf={xf} yf={yy} p={prog} color="#cfd6e2" /><text x={X0 + 14} y={yy(90)} fill={GOLD} fontFamily={fontFamily} fontWeight={800} fontSize={26} opacity={aP} filter="url(#sh)">باندِ بولینگر (Bollinger)</text></>}
        <line x1={X0 + PW * pe} x2={X0 + PW * pe} y1={Y0} y2={Y0 + PH} stroke="#fff" strokeWidth={2} opacity={headOp * 0.6} />
        <Vignette />
      </svg>
    );
  }
  // rsi / macd : پنلِ بالا قیمت، پنلِ پایین اندیکاتور (با پلی‌هدِ همگام + مارکرِ سیگنال)
  const bY0 = 468, bH = 198, by = (v: number) => bY0 + bH * (1 - (v + (kind === "macd" ? 12 : 0)) / (kind === "macd" ? 24 : 100));
  const rsiArr = [45, 60, 74, 68, 82, 78, 50], macdArr = [-9, -5, -1, 3, 7, 6, 3], sigArr = [-7, -6, -3, 0, 4, 6, 5];
  const sigX = kind === "rsi" ? x(4, 7) : x(3, 7);    // نقطهٔ سیگنال (اشباع / تقاطع)
  const headX = X0 + PW * pe;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} 800`} preserveAspectRatio="xMidYMid meet">
      <Defs />
      <line x1={X0} x2={X0 + PW} y1={pY0} y2={pY0} stroke={GRID} /><line x1={X0} x2={X0 + PW} y1={pY0 + pH} y2={pY0 + pH} stroke={GRID} />
      <path d={pPath} fill="none" stroke="url(#lineG)" strokeWidth={4} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dprog} />
      <Dots arr={price} xf={xf} yf={py} p={prog} color="#ffd24d" />
      <text x={X0} y={pY0 - 14} fill="#9aa3b3" fontFamily={fontFamily} fontWeight={700} fontSize={24}>قیمت</text>
      <rect x={X0} y={bY0 - 40} width={PW} height={bH + 50} fill="rgba(255,255,255,.025)" rx={12} stroke="rgba(255,255,255,.05)" />
      {kind === "rsi" ? <>
        <rect x={X0} y={by(100)} width={PW} height={by(70) - by(100)} fill={DN} opacity={aP * 0.1} />
        <rect x={X0} y={by(30)} width={PW} height={by(0) - by(30)} fill={UP} opacity={aP * 0.1} />
        {[70, 50, 30].map((L) => <g key={L}><line x1={X0} x2={X0 + PW} y1={by(L)} y2={by(L)} stroke={L === 50 ? GRID : (L === 70 ? DN : UP)} strokeWidth={L === 50 ? 1 : 2} strokeDasharray={L === 50 ? "3 6" : "8 5"} opacity={aP} /><text x={X0 + 8} y={by(L) - 6} fill="#9aa3b3" fontFamily="monospace" fontWeight={700} fontSize={20} opacity={aP}>{L}</text></g>)}
        <text x={X0 + PW - 230} y={by(70) - 8} fill={DN} fontFamily={fontFamily} fontWeight={800} fontSize={23} opacity={aP}>اشباعِ خرید ۷۰</text>
        <text x={X0 + PW - 230} y={by(30) + 28} fill={UP} fontFamily={fontFamily} fontWeight={800} fontSize={23} opacity={aP}>اشباعِ فروش ۳۰</text>
        <path d={sm(rsiArr, by)} fill="none" stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dprog} />
        <Dots arr={rsiArr} xf={xf} yf={by} p={prog} color={GOLD} />
        <line x1={sigX} x2={sigX} y1={py(price[4])} y2={by(rsiArr[4])} stroke={DN} strokeWidth={1.5} strokeDasharray="6 5" opacity={aP * 0.8} />
        <circle cx={sigX} cy={by(rsiArr[4])} r={11} fill={DN} stroke="#fff" strokeWidth={2.5} opacity={aP} filter="url(#glow)" />
        <text x={X0} y={bY0 - 50} fill="#9aa3b3" fontFamily={fontFamily} fontWeight={700} fontSize={24}>RSI</text>
      </> : <>
        <line x1={X0} x2={X0 + PW} y1={by(0)} y2={by(0)} stroke={GRID} strokeWidth={1.5} /><text x={X0 + 8} y={by(0) - 6} fill="#9aa3b3" fontFamily="monospace" fontWeight={700} fontSize={20} opacity={aP}>0</text>
        {macdArr.map((v, i) => { const h = by(0) - by(v - sigArr[i] >= 0 ? 0 : 0); const hist = macdArr[i] - sigArr[i]; const hh = Math.abs(by(0) - by(hist)); return <rect key={i} x={x(i, 7) - 22} y={hist >= 0 ? by(hist) : by(0)} width={44} height={hh} fill={hist >= 0 ? "url(#upG)" : "url(#dnG)"} opacity={interpolate(prog, [i / 6 - 0.02, i / 6 + 0.04], [0, aP * 0.7], clamp)} rx={4} />; })}
        <path d={sm(macdArr, by)} fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dprog} />
        <path d={sm(sigArr, by)} fill="none" stroke={OR} strokeWidth={3} strokeLinecap="round" filter="url(#glow)" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dprog} />
        <Dots arr={macdArr} xf={xf} yf={by} p={prog} color={GOLD} />
        <line x1={sigX} x2={sigX} y1={py(price[3])} y2={by(0)} stroke="#fff" strokeWidth={1.5} strokeDasharray="6 5" opacity={aP * 0.7} />
        <circle cx={sigX} cy={by(macdArr[3])} r={12} fill="none" stroke="#fff" strokeWidth={3} opacity={aP} filter="url(#glow)" /><circle cx={sigX} cy={by(macdArr[3])} r={5} fill="#fff" opacity={aP} />
        <text x={sigX + 16} y={by(macdArr[3]) - 12} fill="#fff" fontFamily={fontFamily} fontWeight={800} fontSize={22} opacity={aP}>تقاطعِ صعودی</text>
        <text x={X0} y={bY0 - 50} fill="#9aa3b3" fontFamily={fontFamily} fontWeight={700} fontSize={24}>MACD</text>
      </>}
      <line x1={headX} x2={headX} y1={pY0} y2={bY0 + bH} stroke="#fff" strokeWidth={2} opacity={headOp * 0.55} />
      <circle cx={headX} cy={py(ptAt(price, pe).v)} r={6} fill="#fff" opacity={headOp} filter="url(#glow)" />
      <circle cx={headX} cy={by(ptAt(kind === "rsi" ? rsiArr : macdArr, pe).v)} r={6} fill="#fff" opacity={headOp} filter="url(#glow)" />
      <Vignette />
    </svg>
  );
};

// ───────────────────────── دیکشنریِ مفاهیم ─────────────────────────
type Def = { t: string; kind: "candles" | "price" | "ind"; data?: any };
const C: Record<string, Def> = {
  // الگوهای شمعی
  doji: { t: "دوجی (Doji)", kind: "candles", data: { d: [[20, 26, 18, 25], [25, 32, 23, 30], [30, 38, 28, 36], [36, 44, 34, 42], [42, 49, 35, 42.3]], hl: [4], lb: "بدنهٔ بسیار کوچک = بلاتکلیفیِ بازار", lbi: 4 } },
  hammer: { t: "چکش (Hammer)", kind: "candles", data: { d: [[60, 63, 54, 56], [56, 58, 48, 50], [50, 52, 44, 46], [46, 47, 36, 45.5]], hl: [3], lb: "فتیلهٔ پایینیِ بلند = برگشتِ صعودی", lbi: 3 } },
  shooting_star: { t: "ستارهٔ دنباله‌دار (Shooting Star)", kind: "candles", data: { d: [[40, 44, 38, 43], [43, 49, 42, 48], [48, 53, 47, 52], [52, 62, 51, 52.5]], hl: [3], lb: "فتیلهٔ بالاییِ بلند = برگشتِ نزولی", lbi: 3 } },
  bullish_engulfing: { t: "پوشای صعودی (Bullish Engulfing)", kind: "candles", data: { d: [[60, 63, 52, 54], [54, 56, 46, 48], [48, 50, 41, 43], [43, 45, 40, 41.5], [40.5, 57, 39, 56]], hl: [3, 4], lb: "کندلِ سبزِ بزرگ، قبلی را می‌بلعد", lbi: 4 } },
  bearish_engulfing: { t: "پوشای نزولی (Bearish Engulfing)", kind: "candles", data: { d: [[40, 46, 38, 44], [44, 52, 42, 50], [50, 58, 48, 56], [56, 59, 54, 57.5], [58, 60, 42, 43]], hl: [3, 4], lb: "کندلِ قرمزِ بزرگ، قبلی را می‌بلعد", lbi: 4 } },
  morning_star: { t: "ستارهٔ صبحگاهی (Morning Star)", kind: "candles", data: { d: [[60, 63, 54, 55], [55, 57, 44, 45], [43, 45, 40, 42], [44, 58, 43, 57]], hl: [1, 2, 3], lb: "سه‌کندلیِ برگشتِ صعودی", lbi: 2 } },
  evening_star: { t: "ستارهٔ شامگاهی (Evening Star)", kind: "candles", data: { d: [[40, 46, 39, 45], [45, 57, 44, 56], [57, 59, 55, 57.5], [56, 57, 43, 44]], hl: [1, 2, 3], lb: "سه‌کندلیِ برگشتِ نزولی", lbi: 2 } },
  pin_bar: { t: "پین‌بار (Pin Bar)", kind: "candles", data: { d: [[55, 58, 50, 52], [52, 54, 47, 49], [49, 51, 38, 50]], hl: [2], lb: "ردِ قیمت با فتیلهٔ بلند", lbi: 2 } },
  marubozu: { t: "مارابوزو (Marubozu)", kind: "candles", data: { d: [[30, 36, 29, 35], [35, 41, 34, 40], [40, 52, 40, 52]], hl: [2], lb: "بدنهٔ کامل بدونِ فتیله = قدرتِ روند", lbi: 2 } },
  harami: { t: "هارامی (Harami)", kind: "candles", data: { d: [[50, 54, 48, 52], [52, 55, 40, 41], [43, 45, 42, 44]], hl: [1, 2], lb: "کندلِ کوچکِ داخلِ کندلِ بزرگ", lbi: 2 } },
  three_white_soldiers: { t: "سه سربازِ سفید", kind: "candles", data: { d: [[30, 33, 29, 32], [32, 40, 31, 39], [39, 47, 38, 46], [46, 54, 45, 53]], hl: [1, 2, 3], lb: "سه کندلِ صعودیِ پیاپی", lbi: 2 } },
  three_black_crows: { t: "سه کلاغِ سیاه", kind: "candles", data: { d: [[54, 55, 46, 47], [47, 48, 39, 40], [40, 41, 32, 33], [33, 34, 26, 27]], hl: [1, 2, 3], lb: "سه کندلِ نزولیِ پیاپی", lbi: 2 } },
  // مفاهیم و الگوهای نموداری
  support_resistance: { t: "حمایت و مقاومت (Support / Resistance)", kind: "price", data: { p: [30, 55, 68, 40, 30, 55, 69, 31, 67, 33, 68, 34], a: [{ t: "hline", y: 70, c: DN, label: "مقاومت" }, { t: "hline", y: 30, c: UP, label: "حمایت" }] } },
  trendline: { t: "خطِ روند (Trendline)", kind: "price", data: { p: [22, 40, 28, 52, 38, 64, 50, 74], a: [{ t: "trend", x1: 0, y1: 16, x2: 1, y2: 56, c: GOLD, label: "خطِ روندِ صعودی" }, { t: "arrow", x1: 0.8, y1: 78, x2: 0.97, y2: 88, c: UP }] } },
  breakout: { t: "بریک‌اوت / شکست (Breakout)", kind: "price", data: { p: [50, 55, 52, 56, 53, 57, 54, 58, 75, 84], a: [{ t: "hline", y: 60, c: DN, label: "مقاومت" }, { t: "arrow", x1: 0.85, y1: 62, x2: 0.97, y2: 88, c: UP }] } },
  pullback: { t: "پولبک (Pullback)", kind: "price", data: { p: [25, 38, 50, 62, 52, 46, 58, 72, 84], a: [{ t: "trend", x1: 0, y1: 22, x2: 1, y2: 80, c: GOLD }, { t: "label", x: 0.55, y: 40, text: "پولبک", c: OR }] } },
  head_shoulders: { t: "سر و شانه (Head & Shoulders)", kind: "price", data: { p: [25, 48, 35, 66, 33, 49, 28, 14], a: [{ t: "hline", y: 33, c: OR, label: "خطِ گردن (Neckline)" }, { t: "label", x: 0.16, y: 56, text: "شانه", c: GOLD }, { t: "label", x: 0.43, y: 74, text: "سر", c: GOLD }, { t: "label", x: 0.72, y: 57, text: "شانه", c: GOLD }, { t: "arrow", x1: 0.86, y1: 30, x2: 0.97, y2: 12, c: DN }] } },
  double_top: { t: "سقفِ دوقلو (Double Top)", kind: "price", data: { p: [20, 60, 38, 61, 25, 10], a: [{ t: "hline", y: 38, c: OR, label: "خطِ گردن" }, { t: "label", x: 0.2, y: 68, text: "سقف ۱", c: GOLD }, { t: "label", x: 0.62, y: 69, text: "سقف ۲", c: GOLD }, { t: "arrow", x1: 0.82, y1: 35, x2: 0.95, y2: 12, c: DN }] } },
  double_bottom: { t: "کفِ دوقلو (Double Bottom)", kind: "price", data: { p: [80, 40, 62, 39, 75, 92], a: [{ t: "hline", y: 62, c: OR, label: "خطِ گردن" }, { t: "label", x: 0.2, y: 32, text: "کف ۱", c: GOLD }, { t: "label", x: 0.62, y: 31, text: "کف ۲", c: GOLD }, { t: "arrow", x1: 0.82, y1: 66, x2: 0.95, y2: 90, c: UP }] } },
  ascending_triangle: { t: "مثلثِ صعودی (Ascending Triangle)", kind: "price", data: { p: [30, 68, 40, 68, 50, 68, 58, 84], a: [{ t: "hline", y: 68, c: DN, label: "مقاومتِ صاف" }, { t: "trend", x1: 0, y1: 26, x2: 0.86, y2: 60, c: UP, label: "کف‌های صعودی" }, { t: "arrow", x1: 0.86, y1: 70, x2: 0.97, y2: 88, c: UP }] } },
  bull_flag: { t: "پرچمِ صعودی (Bull Flag)", kind: "price", data: { p: [18, 70, 64, 58, 62, 56, 60, 88], a: [{ t: "trend", x1: 0, y1: 14, x2: 0.16, y2: 72, c: UP, label: "میله" }, { t: "label", x: 0.5, y: 48, text: "پرچم", c: GOLD }, { t: "arrow", x1: 0.82, y1: 62, x2: 0.97, y2: 90, c: UP }] } },
  channel: { t: "کانال (Channel)", kind: "price", data: { p: [30, 46, 38, 54, 46, 62, 54, 70], a: [{ t: "trend", x1: 0, y1: 22, x2: 1, y2: 62, c: GOLD }, { t: "trend", x1: 0, y1: 40, x2: 1, y2: 80, c: GOLD }] } },
  rising_wedge: { t: "کنجِ صعودی (Rising Wedge)", kind: "price", data: { p: [30, 52, 40, 58, 48, 63, 55, 28], a: [{ t: "trend", x1: 0, y1: 28, x2: 0.86, y2: 58, c: GOLD }, { t: "trend", x1: 0, y1: 48, x2: 0.86, y2: 66, c: GOLD }, { t: "arrow", x1: 0.86, y1: 56, x2: 0.97, y2: 28, c: DN }] } },
  fibonacci: { t: "فیبوناچیِ اصلاحی (Fibonacci)", kind: "price", data: { p: [20, 35, 55, 78, 70, 58, 50, 56], a: [{ t: "fib", lo: 20, hi: 78 }] } },
  supply_demand: { t: "عرضه و تقاضا (Supply / Demand)", kind: "price", data: { p: [26, 50, 72, 48, 24, 55, 74], a: [{ t: "zone", y1: 70, y2: 80, c: DN, label: "ناحیهٔ عرضه" }, { t: "zone", y1: 20, y2: 30, c: UP, label: "ناحیهٔ تقاضا" }] } },
  risk_reward: { t: "ریسک به ریوارد (Risk / Reward)", kind: "price", data: { p: [45, 44, 47, 52, 60, 68], a: [{ t: "rr", entry: 45, sl: 33, tp: 69 }] } },
  // اندیکاتورها
  rsi: { t: "اندیکاتور RSI", kind: "ind", data: { k: "rsi" } },
  macd: { t: "اندیکاتور MACD", kind: "ind", data: { k: "macd" } },
  ma_cross: { t: "تقاطعِ میانگینِ متحرک (MA Cross)", kind: "ind", data: { k: "ma_cross" } },
  bollinger: { t: "باندِ بولینگر (Bollinger Bands)", kind: "ind", data: { k: "bollinger" } },
};

export const CONCEPT_KEYS = Object.keys(C);
export const hasConcept = (k?: string) => !!k && !!C[k];

export const ConceptVisual: React.FC<{ vkey: string; frames: number }> = ({ vkey, frames }) => {
  const def = C[vkey]; if (!def) return null;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 100% at 50% 0%, #121822 0%, #07080c 72%)" }}>
      {def.kind === "candles" && <Candles data={def.data.d} highlight={def.data.hl} label={def.data.lb} lbi={def.data.lbi} frames={frames} />}
      {def.kind === "price" && <PricePath pts={def.data.p} annos={def.data.a} frames={frames} />}
      {def.kind === "ind" && <IndicatorView kind={def.data.k} frames={frames} />}
      <TitleChip t={def.t} />
    </AbsoluteFill>
  );
};
