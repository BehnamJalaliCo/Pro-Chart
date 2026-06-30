import React from 'react';
import { SPEED_LADDER } from '../ReplayController';

// چیپِ Legend (OHLC) روی چارت — رندرِ خالص؛ همهٔ ورودی‌ها از props.
export function Legend({ legend, TH, symbol, tf }) {
  if (!legend) return null;
  const ch = legend.open != null ? ((legend.close - legend.open) / legend.open) * 100 : null;
  const col = ch == null ? TH.text : ch >= 0 ? TH.up : TH.down;
  return (
    <div className="absolute top-2 right-2 z-20 text-[11px] rounded-md px-2 py-1 font-mono tabular-nums flex items-center gap-2 border" dir="ltr" style={{ background: TH.overlayMask, borderColor: TH.border, backdropFilter: 'blur(2px)' }}>
      <span className="font-bold" style={{ color: TH.textStrong }}>{symbol} · {tf}</span>
      {legend.open != null ? <span style={{ color: col }}>O {legend.open}  H {legend.high}  L {legend.low}  C {legend.close}</span> : <span style={{ color: col }}>C {legend.close}</span>}
      {ch != null && <span style={{ color: col }}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>}
    </div>
  );
}

// شمارشِ معکوسِ بسته‌شدنِ کندل + وضعیتِ بازار — رندرِ خالص.
export function CountdownChip({ countdown, countdownColor, TH, marketOpen }) {
  if (!countdown) return null;
  return (
    <div className="absolute bottom-3 right-3 z-20 pointer-events-none rounded-md px-2 py-1 text-[11px] font-mono tabular-nums flex items-center gap-1.5 border shadow-sm" style={{ borderColor: countdownColor || TH.border, background: TH.popoverBg, color: countdownColor || undefined }} dir="ltr">
      <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="opacity-60">⏱</span><b>{countdown}</b>
    </div>
  );
}

// واترمارکِ لوگوی بازارنما — رندرِ خالص.
export function Watermark({ src, theme }) {
  // لوگوی سفیدِ شفاف؛ روی تمِ روشن invert می‌شود تا مشکی و خوانا بماند.
  return <img src={src} alt="بازارنما" className="absolute bottom-3 left-3 z-20 pointer-events-none select-none" style={{ height: 40, opacity: 0.5, filter: theme === 'light' ? 'invert(1)' : 'none' }} />;
}

// نوارِ کنترلِ بازپخش — رندرِ خالص؛ همهٔ هندلرها از props.
export function ReplayBar({ replay, TH, replayStepBack, replayToggle, replayStep, replaySeek, replaySetSpeed, exitReplay }) {
  if (!replay.on) return null;
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
      <span className="font-bold" style={{ color: TH.accent }}>بازپخش</span>
      <button onClick={replayStepBack} title="گامِ عقب" className="p-1 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>⏮</button>
      <button onClick={replayToggle} title="پخش/مکث" className="p-1 rounded-md text-white transition-colors duration-[120ms]" style={{ background: TH.accent }}>{replay.playing ? '⏸' : '▶'}</button>
      <button onClick={replayStep} title="گامِ جلو" className="p-1 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>⏭</button>
      {/* اسلایدرِ scrub: پرش به هر کندل */}
      <input type="range" min={0} max={Math.max(0, replay.length - 1)} value={replay.idx} onChange={(e) => replaySeek(Number(e.target.value))} title="پرش به کندل" className="w-28 h-1 cursor-pointer transition-colors duration-[120ms]" style={{ accentColor: TH.accent }} />
      <span className="opacity-60 tabular-nums">{replay.length ? `${replay.idx + 1}/${replay.length}` : ''}</span>
      <span className="opacity-60">سرعت</span>
      {SPEED_LADDER.map((sp) => (<button key={sp} onClick={() => replaySetSpeed(sp)} className={`px-1.5 rounded-md tabular-nums transition-colors duration-[120ms] ${replay.speed === sp ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={replay.speed === sp ? { background: TH.accent } : {}}>{sp}×</button>))}
      <button onClick={exitReplay} className="p-1 rounded-md bg-red-500/20 text-red-400 transition-colors duration-[120ms]">✕ خروج</button>
    </div>
  );
}
