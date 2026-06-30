import { AbsoluteFill, OffthreadVideo, Audio, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Vazirmatn";
const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["arabic", "latin"] });
const OR = "#ff7a00", GOLD = "#ffd000";
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const Particles = () => {
  const frame = useCurrentFrame();
  const r = rng(13);
  const dots = Array.from({ length: 18 }, () => ({ x: r() * 1080, y: r() * 1920, s: 3 + r() * 5, sp: 0.8 + r() * 2, o: 0.14 + r() * 0.26 }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {dots.map((d, i) => { const yy = ((d.y - frame * d.sp) % 1960 + 1960) % 1960 - 20; return <div key={i} style={{ position: "absolute", left: d.x, top: yy, width: d.s, height: d.s, borderRadius: "50%", background: GOLD, opacity: d.o, boxShadow: `0 0 ${d.s * 2}px ${OR}` }} />; })}
    </AbsoluteFill>
  );
};

export const ShortVideo: React.FC<{ footage: string; audio: string; hook: string; site: string }> = ({ footage, audio, hook, site }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.08, 1.24]);
  const panY = interpolate(frame, [0, durationInFrames], [0, -28]);
  const ctaIn = spring({ frame: frame - Math.round(durationInFrames * 0.45), fps, config: { damping: 16 } });
  const pulse = 1 + 0.04 * Math.sin(frame / 4);
  const prog = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  const isLatin = (w: string) => /[A-Za-z]/.test(w);
  const words = (hook || "").split(/\s+/).filter(Boolean);
  return (
    <AbsoluteFill style={{ backgroundColor: "#07080c", fontFamily, direction: "rtl" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateY(${panY}px)` }}>
        <OffthreadVideo src={staticFile(footage)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.1) saturate(1.18) brightness(0.74)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,6,12,.6) 0%, rgba(4,6,12,.1) 38%, rgba(4,6,12,.95) 100%)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(90% 50% at 50% 36%, rgba(255,122,0,.16), transparent 60%)" }} />
      <Particles />
      <Audio src={staticFile(audio)} />
      <div style={{ position: "absolute", top: 80, right: 0, left: 0, textAlign: "center", color: "#fff", fontWeight: 900, fontSize: 54 }}>کوین پرو FX</div>
      {/* هوکِ کینتیک: کلمه‌به‌کلمه، انگلیسی نارنجی/LTR */}
      <div style={{ position: "absolute", top: "29%", right: 56, left: 56, textAlign: "center", display: "flex", flexWrap: "wrap", gap: "0 18px", justifyContent: "center", direction: "rtl" }}>
        {words.map((w, i) => {
          const s = spring({ frame: frame - (4 + i * 3), fps, config: { damping: 14, mass: 0.6 } });
          const lat = isLatin(w);
          return <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${interpolate(s, [0, 1], [80, 0])}px) scale(${interpolate(s, [0, 1], [0.7, 1])})`, color: lat ? GOLD : "#fff", direction: lat ? "ltr" : "rtl", fontFamily: lat ? "'Segoe UI',Arial,sans-serif" : fontFamily, fontWeight: 900, fontSize: 100, lineHeight: 1.22, textShadow: "0 8px 38px rgba(0,0,0,.78)" }}>{w}</span>;
        })}
      </div>
      <div style={{ position: "absolute", bottom: 360, right: 64, left: 64, textAlign: "center", opacity: ctaIn, transform: `scale(${ctaIn * pulse})` }}>
        <div style={{ display: "inline-block", background: OR, color: "#15100a", fontWeight: 900, fontSize: 56, padding: "20px 46px", borderRadius: 999, boxShadow: "0 14px 40px rgba(255,122,0,.5)" }}>📺 ویدیوی کامل در یوتیوب</div>
      </div>
      <div style={{ position: "absolute", bottom: 210, right: 0, left: 0, textAlign: "center", color: "#ffd24d", fontWeight: 800, fontSize: 44, opacity: ctaIn }}>🌐 {site}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 9, width: `${prog}%`, background: `linear-gradient(90deg,${GOLD},${OR})`, boxShadow: `0 0 14px ${OR}` }} />
    </AbsoluteFill>
  );
};
