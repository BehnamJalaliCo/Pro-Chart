import React from "react";
import { AbsoluteFill, OffthreadVideo, Audio, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { loadFont } from "@remotion/google-fonts/Vazirmatn";
import { ConceptVisual, hasConcept } from "./ConceptVisual";
import { RealChart, isReal, REAL_CFG } from "./RealChart";
const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["arabic", "latin"] });

export const TRANS = 14; // فریم‌های ترانزیشن بینِ صحنه‌ها
type Scene = { audio: string; footage: string; caption: string; frames: number; visual?: string; data?: any[] };
const OR = "#ff7a00", GOLD = "#ffd000", UP = "#16c784", DOWN = "#ea3943";

// PRNG قطعی (بدونِ Math.random تا رندر پایدار بماند)
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const isLatin = (w: string) => /[A-Za-z]/.test(w);

// ─── تیکرِ قیمتِ متحرک (نوارِ بالا، حسِ کانالِ مالیِ حرفه‌ای) ───
const PAIRS = [
  ["EUR/USD", 1.0864], ["XAU/USD", 2336.4], ["GBP/USD", 1.2718], ["USD/JPY", 157.32],
  ["AUD/USD", 0.6642], ["USD/CHF", 0.8971], ["GBP/JPY", 200.14], ["XAG/USD", 30.18],
  ["EUR/JPY", 170.9], ["USD/CAD", 1.3681],
];
const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const x = -((frame * 2.6) % 2000);
  const row = [...PAIRS, ...PAIRS];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, background: "rgba(6,8,14,.82)", borderBottom: `1px solid rgba(255,122,0,.25)`, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", display: "flex", gap: 46, whiteSpace: "nowrap", transform: `translateX(${x}px)`, paddingRight: 2000, direction: "ltr" }}>
        {row.map(([p, v], i) => {
          const up = (i * 7) % 3 !== 0; const d = (((i * 13) % 50) / 100 + 0.01).toFixed(2);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "monospace", fontSize: 24, fontWeight: 700 }}>
              <span style={{ color: "#cfd5df" }}>{p as string}</span>
              <span style={{ color: "#fff" }}>{v as number}</span>
              <span style={{ color: up ? UP : DOWN }}>{up ? "▲" : "▼"} {d}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── چارتِ کندلِ متحرک (کندل‌ها چپ‌به‌راست ظاهر می‌شوند + خطِ میانگینِ متحرک کشیده می‌شود) ───
const AnimatedChart: React.FC<{ seed: number; frames: number }> = ({ seed, frames }) => {
  const frame = useCurrentFrame();
  const W = 1500, H = 620, N = 26, padX = 60, padY = 60;
  const r = rng(seed + 99);
  let price = 50 + r() * 20;
  const candles = Array.from({ length: N }, () => {
    const o = price; const ch = (r() - 0.46) * 9; price = Math.max(8, Math.min(92, price + ch));
    const c = price; const hi = Math.max(o, c) + r() * 4; const lo = Math.min(o, c) - r() * 4;
    return { o, c, hi, lo };
  });
  const lo = Math.min(...candles.map((d) => d.lo)) - 2, hi = Math.max(...candles.map((d) => d.hi)) + 2;
  const y = (v: number) => padY + (H - 2 * padY) * (1 - (v - lo) / (hi - lo));
  const cw = (W - 2 * padX) / N, bw = cw * 0.56;
  const ma = candles.map((_, i) => { const s = candles.slice(Math.max(0, i - 4), i + 1); return s.reduce((a, d) => a + d.c, 0) / s.length; });
  const reveal = interpolate(frame, [4, frames * 0.82], [0, N], { extrapolateRight: "clamp" });
  const maPts = candles.map((_, i) => `${padX + cw * (i + 0.5)},${y(ma[i])}`).join(" ");
  const lastI = Math.max(0, Math.min(N - 1, Math.floor(reveal) - 1));
  const dotPulse = 1 + 0.3 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 100% at 50% 0%, #11161f 0%, #07080c 70%)" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3, 4].map((g) => { const yy = padY + (H - 2 * padY) * g / 4; return <line key={g} x1={padX} x2={W - padX} y1={yy} y2={yy} stroke="rgba(255,255,255,.06)" strokeWidth={1} />; })}
        {candles.map((d, i) => {
          const grow = interpolate(reveal, [i, i + 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (grow <= 0) return null;
          const cx = padX + cw * (i + 0.5); const green = d.c >= d.o; const col = green ? UP : DOWN;
          const top = y(Math.max(d.o, d.c)), bh = Math.abs(y(d.o) - y(d.c)) * grow;
          return (
            <g key={i} opacity={grow}>
              <line x1={cx} x2={cx} y1={y(d.hi)} y2={y(d.lo)} stroke={col} strokeWidth={2} />
              <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(2, bh)} rx={2} fill={col} />
            </g>
          );
        })}
        <polyline points={maPts} fill="none" stroke={GOLD} strokeWidth={3} strokeLinejoin="round"
          strokeDasharray={4000} strokeDashoffset={interpolate(reveal, [0, N], [4000, 0])} opacity={0.92} />
        <circle cx={padX + cw * (lastI + 0.5)} cy={y(candles[lastI].c)} r={7 * dotPulse} fill={OR} opacity={0.9} />
        <circle cx={padX + cw * (lastI + 0.5)} cy={y(candles[lastI].c)} r={4} fill="#fff" />
      </svg>
      <div style={{ position: "absolute", top: 80, left: 70, fontFamily: "monospace", fontWeight: 700, color: GOLD, fontSize: 30, background: "rgba(6,8,14,.6)", padding: "6px 16px", borderRadius: 8, direction: "ltr" }}>
        XAU/USD · {(2330 + candles[lastI].c).toFixed(1)}
      </div>
    </AbsoluteFill>
  );
};

// ─── لایهٔ موشن: ذراتِ شناور + اسکن‌لایتِ متحرک (حرکتِ مداوم حتی روی فوتیج) ───
const MotionOverlay: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const r = rng(seed + 7);
  const dots = Array.from({ length: 16 }, () => ({ x: r() * 1920, y: r() * 1080, s: 2 + r() * 4, sp: 0.4 + r() * 1.1, o: 0.12 + r() * 0.22 }));
  const sweep = ((frame * 6) % 2600) - 400;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((d, i) => { const yy = ((d.y - frame * d.sp) % 1120 + 1120) % 1120 - 20; return <div key={i} style={{ position: "absolute", left: d.x, top: yy, width: d.s, height: d.s, borderRadius: "50%", background: GOLD, opacity: d.o, boxShadow: `0 0 ${d.s * 2}px ${OR}` }} />; })}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: sweep, width: 320, background: "linear-gradient(90deg,transparent,rgba(255,122,0,.07),transparent)", transform: "skewX(-12deg)" }} />
    </AbsoluteFill>
  );
};

// ─── کپشنِ کینتیک: کلمه‌به‌کلمه ظاهر می‌شود؛ واژه‌های انگلیسی نارنجی و LTR (تفکیکِ زبان) ───
const KineticCaption: React.FC<{ text: string; big?: boolean }> = ({ text, big }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div style={{ direction: "rtl", display: "flex", flexWrap: "wrap", gap: "0 14px", justifyContent: "flex-start" }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - (6 + i * 1.5), fps, config: { damping: 15, mass: 0.5 } });
        const lat = isLatin(w);
        return (
          <span key={i} style={{
            display: "inline-block", opacity: s, transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
            color: lat ? GOLD : "#fff", direction: lat ? "ltr" : "rtl",
            fontFamily: lat ? "'Segoe UI',Arial,sans-serif" : fontFamily,
            fontWeight: 900, fontSize: big ? 74 : 58, lineHeight: 1.4,
            textShadow: lat ? `0 0 18px rgba(255,122,0,.5)` : "0 6px 28px rgba(0,0,0,.75)",
          }}>{w}</span>
        );
      })}
    </div>
  );
};

const SceneView: React.FC<{ scene: Scene; index: number; first: boolean; last: boolean; total: number; title: string }> = ({ scene, index, first, last, total, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vis = scene.visual;
  const real = isReal(vis);                                 // رسم روی چارتِ واقعی (ترمینال)
  const concept = !real && hasConcept(vis);                 // دیاگرامِ شماتیک (الگوهای شمعی/نموداری)
  const showFootage = !real && (!vis || vis === "generic" || vis === "footage");
  const zoom = interpolate(frame, [0, scene.frames], [1.06, 1.16]);
  const panX = interpolate(frame, [0, scene.frames], [0, -26]);
  const tIn = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const underline = interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" });
  const num = String(index + 1).padStart(2, "0");
  return (
    <AbsoluteFill style={{ backgroundColor: "#07080c", fontFamily, direction: "rtl" }}>
      {real ? (
        <RealChart seed={index * 53 + 7} frames={scene.frames} annos={REAL_CFG[vis as string].annos} sub={REAL_CFG[vis as string].sub || null} overlay={REAL_CFG[vis as string].overlay || null} pattern={REAL_CFG[vis as string].pattern} data={scene.data} />
      ) : concept ? (
        <ConceptVisual vkey={vis as string} frames={scene.frames} />
      ) : showFootage ? (
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${panX}px)` }}>
          <OffthreadVideo src={staticFile(scene.footage)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(1.14) brightness(0.78)" }} />
        </AbsoluteFill>
      ) : (
        <AnimatedChart seed={index * 31 + 5} frames={scene.frames} />
      )}
      <AbsoluteFill style={{ background: (concept || real) ? "linear-gradient(180deg, rgba(4,6,12,.18) 0%, rgba(4,6,12,0) 46%, rgba(4,6,12,.92) 100%)" : "linear-gradient(180deg, rgba(4,6,12,.36) 0%, rgba(4,6,12,.05) 40%, rgba(4,6,12,.95) 100%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 82% 16%, rgba(255,122,0,.13), transparent 60%)" }} />
      {!concept && !real && <MotionOverlay seed={index * 17 + 3} />}
      <Audio src={staticFile(scene.audio)} />

      {/* برند + شمارهٔ فصل */}
      <div style={{ position: "absolute", top: 76, right: 66, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: `linear-gradient(135deg,${GOLD},${OR})` }} />
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 34 }}>کوین پرو FX</div>
      </div>
      {!first && (
        <div style={{ position: "absolute", top: 74, left: 70, fontFamily: "monospace", fontWeight: 700, color: OR, fontSize: 30, opacity: 0.9, direction: "ltr" }}>{num}<span style={{ color: "#555" }}>/{String(total).padStart(2, "0")}</span></div>
      )}

      {first && (
        <div style={{ position: "absolute", top: 150, right: 90, opacity: tIn, transform: `translateY(${interpolate(tIn, [0, 1], [40, 0])}px)` }}>
          <div style={{ display: "inline-block", background: OR, color: "#15100a", fontWeight: 900, fontSize: 32, padding: "8px 26px", borderRadius: 999 }}>بلاگ آموزشی فارکس</div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 72, lineHeight: 1.22, marginTop: 18, maxWidth: 1480, textShadow: "0 8px 30px rgba(0,0,0,.6)" }}>{title}</div>
          <div style={{ height: 7, marginTop: 22, width: `${interpolate(tIn, [0, 1], [0, 360])}px`, background: `linear-gradient(90deg,${GOLD},${OR})`, borderRadius: 99 }} />
        </div>
      )}

      {/* کپشنِ کینتیک + خطِ تأکیدِ متحرک */}
      <div style={{ position: "absolute", bottom: 150, right: 90, left: 90 }}>
        <div style={{ borderRight: `8px solid ${OR}`, paddingRight: 28 }}>
          <KineticCaption text={scene.caption} big={first} />
          <div style={{ height: 5, marginTop: 16, width: `${underline * 70}%`, background: `linear-gradient(90deg,${OR},transparent)`, borderRadius: 99 }} />
        </div>
      </div>

      {last && (
        <div style={{ position: "absolute", bottom: 58, left: 90, transform: `scale(${1 + 0.05 * Math.sin(frame / 6)})` }}>
          <div style={{ background: DOWN, color: "#fff", fontWeight: 900, fontSize: 32, padding: "12px 30px", borderRadius: 12, boxShadow: `0 0 30px rgba(234,57,67,.6)` }}>▶ سابسکرایب کن</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// پراگرس‌بارِ سراسری (سطحِ ویدیو → فریم/مدتِ کل)
const Progress: React.FC<{ site: string }> = ({ site }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 7, width: `${p}%`, background: `linear-gradient(90deg,${GOLD},${OR})`, boxShadow: `0 0 12px ${OR}` }} />
      <div style={{ position: "absolute", bottom: 58, right: 90, color: "#d7dbe2", fontSize: 30, fontWeight: 800, fontFamily }}>🌐 {site}</div>
    </AbsoluteFill>
  );
};

export const BlogVideo: React.FC<{ scenes: Scene[]; title: string; site: string }> = ({ scenes, title, site }) => (
  <AbsoluteFill style={{ backgroundColor: "#000", fontFamily, direction: "rtl" }}>
    <TransitionSeries>
      {scenes.flatMap((s, i) => {
        const seq = (
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.frames}>
            <SceneView scene={s} index={i} first={i === 0} last={i === scenes.length - 1} total={scenes.length} title={title} />
          </TransitionSeries.Sequence>
        );
        return i === 0 ? [seq] : [
          <TransitionSeries.Transition key={`t${i}`} timing={linearTiming({ durationInFrames: TRANS })}
            presentation={i % 2 === 0 ? slide({ direction: "from-left" }) : fade()} />,
          seq,
        ];
      })}
    </TransitionSeries>
    <AbsoluteFill style={{ pointerEvents: "none" }}><Ticker /></AbsoluteFill>
    <Progress site={site} />
  </AbsoluteFill>
);
