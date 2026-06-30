import React, { useState } from 'react';
import { Eye, EyeOff, Settings2, Trash2, MoreHorizontal, ChevronDown, ChevronUp, HelpCircle, Copy, Rows3 } from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────────────────────
// ChartLegend (#3) — Legendِ یکپارچهٔ روی چارت سبکِ TradingView:
//   ردیفِ نماد (OHLC) + یک ردیف برای هر اندیکاتورِ فعال (سواچ + نام + مقدارِ زنده +
//   کنترل‌های on-hover: چشم/تنظیمات/سه‌نقطه/حذف). فلشِ collapse + حالتِ Normal/Compact.
//   propهای جدید همگی اختیاری‌اند (backward-compatible)؛ مقادیرِ زنده از indVals می‌آید.
// ─────────────────────────────────────────────────────────────────────────────
function LegendIconBtn({ TH, title, ariaLabel, onClick, danger, children, alwaysShow }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      className={`flex items-center justify-center rounded-md transition-colors duration-[120ms] ${alwaysShow ? '' : 'bn-leg-ctrl'}`}
      style={{ width: 24, height: 24, color: TH.text }}
      onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; if (danger) e.currentTarget.style.color = TH.down; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}
    >
      {children}
    </button>
  );
}

function LegendRow({ item, TH, value, coarse, viewMode, onToggle, onSettings, onRemove, onMore, moreOpen, onCloseMore, onDup, onHelp, hasHelp }) {
  const visible = item.visible !== false;
  const color = item.color || '#2962FF';
  if (viewMode === 'compact') {
    return (
      <button type="button" onClick={() => onSettings(item)} title={item.label}
        className="flex items-center gap-1 rounded px-1.5 h-6 text-[12px] shrink-0"
        style={{ background: TH.chipBg, color: TH.textStrong, opacity: visible ? 1 : 0.45 }}>
        <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: color, boxShadow: `0 0 0 1px ${TH.border}` }} />
        <span className="whitespace-nowrap">{item.label}</span>
      </button>
    );
  }
  return (
    <div className="group/leg flex items-center gap-1.5 rounded-md px-1.5 h-7 relative"
      style={{ opacity: visible ? 1 : 0.45 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <button type="button" onClick={() => onSettings(item)} title="تنظیماتِ اندیکاتور"
        className="rounded-full shrink-0" style={{ width: 10, height: 10, background: color, boxShadow: `0 0 0 1px ${TH.border}` }} />
      <button type="button" onClick={() => onSettings(item)}
        className="text-[12px] font-semibold whitespace-nowrap text-right" style={{ color: TH.textStrong }}>{item.label}</button>
      {value != null && value !== '' && (
        <span className="text-[12px] tabular-nums whitespace-nowrap" dir="ltr" style={{ color }}>{value}</span>
      )}
      <span className="flex-1" />
      <div className={`flex items-center gap-0.5 ${coarse ? '' : 'bn-leg-ctrls'}`}>
        <LegendIconBtn TH={TH} alwaysShow={coarse} title={visible ? 'پنهان‌کردن' : 'نمایش'} ariaLabel="نمایش/پنهان" onClick={() => onToggle(item)}>
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </LegendIconBtn>
        <LegendIconBtn TH={TH} alwaysShow={coarse} title="تنظیمات" ariaLabel="تنظیمات" onClick={() => onSettings(item)}><Settings2 size={16} /></LegendIconBtn>
        <div className="relative">
          <LegendIconBtn TH={TH} alwaysShow={coarse} title="بیشتر" ariaLabel="بیشتر" onClick={() => onMore(item)}><MoreHorizontal size={16} /></LegendIconBtn>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); onCloseMore(); }} />
              <div className="absolute left-0 top-7 z-[61] w-40 rounded-md py-1 text-[12px] shadow-xl" dir="rtl"
                style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
                <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={(e) => { e.stopPropagation(); onDup(item); onCloseMore(); }}><Copy size={13} /> تکثیرِ اندیکاتور</button>
                {hasHelp && (
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={(e) => { e.stopPropagation(); onHelp(item); onCloseMore(); }}><HelpCircle size={13} /> راهنما</button>
                )}
                <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.down }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={(e) => { e.stopPropagation(); onRemove(item); onCloseMore(); }}><Trash2 size={13} /> حذف</button>
              </div>
            </>
          )}
        </div>
        <LegendIconBtn TH={TH} alwaysShow={coarse} danger title="حذفِ اندیکاتور" ariaLabel="حذفِ اندیکاتور" onClick={() => onRemove(item)}><Trash2 size={16} /></LegendIconBtn>
      </div>
    </div>
  );
}

// items: [{id, key, label, color, visible, scope}]، indVals: {id: 'value-string'}
export function ChartLegend({
  items = [], legend, TH, symbol, tf, indVals = {},
  collapsed = false, onCollapse, viewMode = 'normal', onToggleViewMode,
  onToggleVisible, onSettings, onRemove, onDuplicate, onHelp, hasHelp, onClearAll, coarse = false,
}) {
  const [moreId, setMoreId] = useState(null);
  const ch = legend && legend.open != null ? ((legend.close - legend.open) / legend.open) * 100 : null;
  const col = ch == null ? TH.text : ch >= 0 ? TH.up : TH.down;
  const hasInds = items.length > 0;
  const compact = viewMode === 'compact';

  return (
    <div className="absolute top-2 right-2 z-20 max-w-[min(70%,520px)]"
      style={{ background: TH.overlayMask, backdropFilter: 'blur(2px)', border: `1px solid ${TH.border}`, borderRadius: 8, padding: '4px 6px' }}>
      <style>{`.bn-leg-ctrls{opacity:0;transition:opacity 120ms ease}.group\\/leg:hover .bn-leg-ctrls{opacity:1}.bn-leg-ctrl{opacity:0}.group\\/leg:hover .bn-leg-ctrl{opacity:1}`}</style>
      {/* ردیفِ نماد (OHLC) */}
      <div className="flex items-center gap-2 px-1.5 h-7">
        {hasInds && (
          <button type="button" onClick={() => onCollapse && onCollapse(!collapsed)} title={collapsed ? 'بازکردنِ اندیکاتورها' : 'جمع‌کردنِ اندیکاتورها'} aria-label="جمع/باز"
            className="flex items-center justify-center rounded shrink-0" style={{ width: 18, height: 18, color: TH.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <span className="text-[12px] font-bold tabular-nums whitespace-nowrap" dir="ltr" style={{ color: TH.textStrong }}>{symbol} · {tf}</span>
        {legend && (
          <span className="text-[11px] font-mono tabular-nums whitespace-nowrap" dir="ltr" style={{ color: col }}>
            {legend.open != null ? `O ${legend.open}  H ${legend.high}  L ${legend.low}  C ${legend.close}` : `C ${legend.close}`}
            {ch != null ? `  ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%` : ''}
          </span>
        )}
        {hasInds && (
          <>
            <span className="flex-1" />
            <button type="button" onClick={onToggleViewMode} title={compact ? 'نمای کامل' : 'نمای فشرده'} aria-label="حالتِ نمایش"
              className="flex items-center justify-center rounded shrink-0" style={{ width: 22, height: 22, color: compact ? TH.accent : TH.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Rows3 size={14} /></button>
            <button type="button" onClick={() => { if (window.confirm('همهٔ اندیکاتورها حذف شوند؟')) onClearAll && onClearAll(); }} title="پاکِ همهٔ اندیکاتورها" aria-label="حذفِ همهٔ اندیکاتورها"
              className="flex items-center justify-center rounded shrink-0" style={{ width: 22, height: 22, color: TH.text }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; e.currentTarget.style.color = TH.down; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}><Trash2 size={14} /></button>
          </>
        )}
      </div>
      {/* ردیف‌های اندیکاتور */}
      {hasInds && !collapsed && (
        compact ? (
          <div className="flex flex-wrap items-center gap-1 px-1 pt-0.5 pb-0.5">
            {items.map((it) => (
              <LegendRow key={it.id} item={it} TH={TH} viewMode="compact" coarse={coarse} onSettings={onSettings} onToggle={onToggleVisible} onRemove={onRemove} onMore={() => {}} onDup={onDuplicate} onHelp={onHelp} hasHelp={hasHelp && hasHelp(it)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((it) => (
              <LegendRow key={it.id} item={it} TH={TH} value={indVals[it.id]} coarse={coarse} viewMode="normal"
                onToggle={onToggleVisible} onSettings={onSettings} onRemove={onRemove}
                onMore={() => setMoreId((m) => (m === it.id ? null : it.id))} moreOpen={moreId === it.id} onCloseMore={() => setMoreId(null)}
                onDup={onDuplicate} onHelp={onHelp} hasHelp={hasHelp && hasHelp(it)} />
            ))}
          </div>
        )
      )}
      {hasInds && collapsed && (
        <button type="button" onClick={() => onCollapse && onCollapse(false)} className="text-[11px] px-1.5 pb-0.5 text-right w-full" style={{ color: TH.text, opacity: 0.7 }}>
          {items.length} اندیکاتور
        </button>
      )}
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
  // لوگوی سفیدِ شفاف؛ روی تمِ روشن invert می‌شود. ۵۰٪ بزرگ‌تر (۴۰→۶۰) و بالاتر از محورِ تاریخ (bottom-8).
  return <img src={src} alt="بازارنما" className="absolute bottom-8 left-3 z-20 pointer-events-none select-none" style={{ height: 60, opacity: 0.5, filter: theme === 'light' ? 'invert(1)' : 'none' }} />;
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
