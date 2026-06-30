import React from 'react';
import { X, Sparkles, ShoppingCart, Plus } from 'lucide-react';
import AlertsPanel from './AlertsPanel';
import Screener from './panels/Screener';
import Details from './panels/Details';
import NewsTab from './panels/NewsTab';
import Calendar from './panels/Calendar';
import SymbolLogo from './SymbolLogo';

// پنلِ راست — نوارِ تب + بدنه‌های inline (watch/ai/trade) و واگذاری به پنل‌های جدا
// (Screener/Details/NewsTab/Calendar/AlertsPanel). همهٔ state/handlerها از props می‌آیند؛
// رفتارِ max-md drawer عیناً حفظ شده است.
const _CCY3 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'XAU', 'XAG', 'XPT', 'XPD'];
// نمایشِ خواناتر: جفت‌ارز → EUR/USD ؛ بقیه بدونِ تغییر.
const prettySym = (s = '') => {
  const u = String(s).toUpperCase();
  if (u.length === 6 && _CCY3.includes(u.slice(0, 3)) && _CCY3.includes(u.slice(3, 6))) return `${u.slice(0, 3)}/${u.slice(3, 6)}`;
  return s;
};
export default function RightPanel({
  TH, rightTab, setRightTab,
  symbol, setSymbol, symbols, live, tf,
  watch, toggleWatch, fmtPrice,
  aiBusy, aiQuota, aiList, aiSig,
  getAiSignal, gotoSignal, deleteSignal, clearAiSig,
  order, setOrder, startTrade, submitOrder, curPrice, livePrice, quickTrade,
  overlays, subs,
}) {
  return (
    <div dir="rtl" className="w-64 border-l overflow-hidden shrink-0 flex flex-col max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40 max-md:shadow-2xl" style={{ borderColor: TH.border, background: TH.bg }}>
      <div className="flex border-b overflow-x-auto bn-thin-scroll shrink-0" style={{ borderColor: TH.border, background: TH.bg }}>
        {[['watch', 'واچ‌لیست'], ['ai', 'سیگنال AI'], ['screener', 'اسکنر'], ['details', 'جزئیات'], ['news', 'اخبار'], ['cal', 'تقویم'], ['trade', 'ترید'], ['alerts', 'آلارم']].map(([k, l]) => { const active = rightTab === k; const acc = k === 'ai' ? TH.accentAi : TH.accent; return (<button key={k} onClick={() => setRightTab(k)} className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-[11px] transition-colors duration-[120ms] ${active ? '' : 'opacity-60 hover:opacity-100'}`} style={active ? { color: acc, borderBottom: `2px solid ${acc}` } : {}}>{l}</button>); })}
      </div>
      <div className="flex-1 overflow-auto min-h-0 bn-thin-scroll">
      {rightTab === 'details' ? (
        <Details symbol={symbol} TH={TH} symbols={symbols} prices={live} />
      ) : rightTab === 'news' ? (
        <NewsTab symbol={symbol} TH={TH} />
      ) : rightTab === 'cal' ? (
        <Calendar symbol={symbol} TH={TH} />
      ) : rightTab === 'watch' ? (
        <div className="overflow-auto flex flex-col">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide flex items-center justify-between select-none" style={{ color: TH.text, opacity: 0.55 }}>
            <span>واچ‌لیست</span><span className="tabular-nums">{watch.length}</span>
          </div>
          {watch.length === 0 && <div className="px-3 py-6 text-center text-[11px] opacity-40">نمادی نیست — از پایین اضافه کن.</div>}
          {watch.map((s) => {
            const lp = live[s];
            const dir = lp?.dir || 0;
            const col = dir > 0 ? TH.up : dir < 0 ? TH.down : TH.text;
            const active = symbol === s;
            return (
              <button key={s} onClick={() => setSymbol(s)} className="group/row flex items-center gap-2.5 w-full px-3 h-9 transition-colors"
                style={{ background: active ? TH.subtle : 'transparent', borderRight: `2px solid ${active ? TH.accent : 'transparent'}` }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <SymbolLogo symbol={s} size={22} />
                <span className="flex-1 min-w-0 text-[12px] font-semibold leading-none truncate text-left" dir="ltr" style={{ color: active ? TH.accent : TH.textStrong }}>{prettySym(s)}</span>
                <span className="flex items-center gap-1 shrink-0" dir="ltr">
                  {lp && <span className="tabular-nums text-[11px]" style={{ color: col }}>{fmtPrice(s, lp.mid)}</span>}
                  {dir !== 0 && <span style={{ color: col }} className="text-[9px]">{dir > 0 ? '▲' : '▼'}</span>}
                  <X size={12} className="opacity-0 group-hover/row:opacity-50 hover:!opacity-100 transition-opacity" style={{ color: TH.down }} onClick={(e) => { e.stopPropagation(); toggleWatch(s); }} />
                </span>
              </button>
            );
          })}
          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide select-none" style={{ color: TH.text, opacity: 0.55 }}>افزودنِ نماد</div>
          <div className="px-2 pb-3 flex flex-col gap-0.5">
            {symbols.filter((s) => !watch.includes(s)).slice(0, 16).map((s) => (
              <button key={s} onClick={() => toggleWatch(s)} className="flex items-center gap-2.5 px-2 h-8 rounded-md transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <SymbolLogo symbol={s} size={20} />
                <span className="flex-1 text-[12px] truncate text-left" dir="ltr" style={{ color: TH.text }}>{prettySym(s)}</span>
                <Plus size={13} className="opacity-60 shrink-0" style={{ color: TH.accent }} />
              </button>
            ))}
          </div>
        </div>
      ) : rightTab === 'ai' ? (
        <div className="p-2 text-xs space-y-2">
          <button onClick={getAiSignal} disabled={aiBusy} className="w-full py-2 rounded-md text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-opacity duration-[120ms]" style={{ background: TH.accentAi }}>
            <Sparkles size={14} className={aiBusy ? 'animate-pulse' : ''} /> {aiBusy ? 'در حال تحلیل…' : 'سیگنالِ AI برای ' + symbol}
          </button>
          {aiQuota && <div className="text-center text-[10px] opacity-60">سهمیهٔ امروز: {aiQuota.remaining} از {aiQuota.limit} ({aiQuota.tier})</div>}
          {aiList.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] opacity-50 px-1">ستاپ‌های من — روی هرکدام بزن تا چارت همان‌جا برود:</div>
              {aiList.map((s) => {
                const b = s.direction === 'buy';
                const sm = { active: ['فعال', '#3b82f6'], tp1: ['TP1 ✅', '#22c55e'], tp2: ['TP2 ✅', '#22c55e'], tp3: ['TP3 🎯', '#22c55e'], sl: ['SL', '#ef4444'] };
                const sv = sm[s.status] || sm.active;
                const cur = s.symbol === symbol && s.tf === tf;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border" style={{ borderColor: cur ? '#8b5cf6' : TH.border, background: TH.subtle }}>
                    <button onClick={() => gotoSignal(s)} className="flex-1 flex items-center gap-1.5 min-w-0" title="رفتن به این ستاپ روی چارت">
                      <span>{b ? '🟢' : '🔴'}</span>
                      <span className="font-bold whitespace-nowrap" dir="ltr">{s.symbol}·{s.tf}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: sv[1] + '22', color: sv[1] }}>{sv[0]}</span>
                      {cur && <span className="text-[9px] text-violet-400 whitespace-nowrap">• روی چارت</span>}
                    </button>
                    <button onClick={() => deleteSignal(s)} title="حذفِ سیگنال" className="opacity-40 hover:opacity-100 shrink-0"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
          {aiSig ? (() => {
            const buy = aiSig.direction === 'buy';
            const stMap = { active: ['فعال', '#3b82f6'], tp1: ['TP1 خورد ✅', '#22c55e'], tp2: ['TP2 خورد ✅', '#22c55e'], tp3: ['TP3 خورد 🎯', '#22c55e'], sl: ['حد ضرر خورد', '#ef4444'] };
            const stv = stMap[aiSig.status] || stMap.active;
            return (
              <div className="rounded-xl p-3 border" style={{ borderColor: TH.border, background: TH.subtle }}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-black ${buy ? 'text-green-400' : 'text-red-400'}`}>{buy ? '🟢 خرید' : '🔴 فروش'} {aiSig.symbol} · {aiSig.tf}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: stv[1] + '22', color: stv[1] }}>{stv[0]}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${aiSig.confidence}%`, background: aiSig.confidence >= 75 ? '#22c55e' : aiSig.confidence >= 60 ? '#f59e0b' : '#ef4444' }} /></div>
                  <span className="text-[11px] font-bold">{aiSig.confidence}٪</span>
                </div>
                <p className="text-[11px] opacity-80 leading-5 mb-2">{aiSig.reason}</p>
                <div className="space-y-1 font-mono text-[11px]" dir="ltr">
                  <div className="flex justify-between"><span className="text-blue-400">Entry</span><b>{aiSig.entry}</b></div>
                  <div className="flex justify-between"><span className="text-red-400">SL</span><b className="text-red-400">{aiSig.sl}</b></div>
                  <div className="flex justify-between"><span className="text-green-400">TP1</span><b className="text-green-400">{aiSig.tp1}</b></div>
                  {aiSig.tp2 && <div className="flex justify-between"><span className="text-green-500">TP2</span><b className="text-green-500">{aiSig.tp2}</b></div>}
                  {aiSig.tp3 && <div className="flex justify-between"><span className="text-green-600">TP3</span><b className="text-green-600">{aiSig.tp3}</b></div>}
                </div>
                <button onClick={clearAiSig} className="w-full mt-2 py-1 rounded text-[11px] opacity-60 hover:opacity-100" style={{ background: TH.chipBg }}>پاک‌کردنِ سیگنال از چارت</button>
              </div>
            );
          })() : <div className="opacity-50 text-[11px] text-center py-3">دکمهٔ بالا را بزن تا قوی‌ترین هوشِ مصنوعی یک ستاپِ کامل (ورود/حدضرر/اهداف) بچیند.</div>}
        </div>
      ) : rightTab === 'screener' ? (
        <Screener symbol={symbol} TH={TH} symbols={symbols} prices={live} setSymbol={setSymbol} />
      ) : rightTab === 'trade' ? (
        <div className="p-2 text-xs space-y-2">
          <div className="flex gap-1">
            <button onClick={() => startTrade('buy')} className="flex-1 py-1.5 rounded bg-green-600 text-white font-bold">خرید</button>
            <button onClick={() => startTrade('sell')} className="flex-1 py-1.5 rounded bg-red-600 text-white font-bold">فروش</button>
          </div>
          {order ? (() => {
            const risk = Math.abs(order.entry - order.sl), reward = Math.abs(order.tp - order.entry);
            const rr = risk ? (reward / risk).toFixed(2) : '—';
            const row = (lbl, key, col) => (<div className="flex items-center justify-between"><span style={{ color: col }}>{lbl}</span><input type="number" value={order[key]} onChange={(e) => setOrder((o) => ({ ...o, [key]: parseFloat(e.target.value) }))} className="w-24 rounded px-2 py-0.5 outline-none font-mono" style={{ background: TH.chipBg }} dir="ltr" /></div>);
            return (<div className="space-y-1.5 rounded p-2" style={{ background: TH.subtle }}>
              <div className="text-[10px] opacity-60">روی چارت خطوط را بکش (⇕) یا اینجا ویرایش کن:</div>
              {row('🎯 هدف', 'tp', '#22c55e')}
              {row(order.side === 'buy' ? '🔵 ورودِ خرید' : '🔴 ورودِ فروش', 'entry', '#3b82f6')}
              {row('🛑 حد ضرر', 'sl', '#ef4444')}
              <div className="flex justify-between border-t pt-1" style={{ borderColor: TH.border }}><span>نسبتِ ریسک/ریوارد</span><b className={reward >= risk ? 'text-green-400' : 'text-amber-400'}>R:R {rr}</b></div>
              <div className="flex gap-1"><button onClick={submitOrder} className="flex-1 py-1 rounded-md text-white transition-opacity duration-[120ms]" style={{ background: TH.accent }}>ثبتِ سفارش</button><button onClick={() => setOrder(null)} className="px-2 py-1 rounded" style={{ background: TH.chipBg }}>لغو</button></div>
            </div>);
          })() : <div className="opacity-50 text-[11px]">خرید/فروش را بزن تا خطوطِ سفارشِ قابلِ‌درگ روی چارت بیاید.</div>}
          {/* DOM — نردبانِ قیمت */}
          {(() => { const px = curPrice(); if (!px) return null; const step = px * 0.0002; const rows = []; for (let i = 8; i >= -8; i--) { const lv = px + i * step; rows.push(<div key={i} onClick={() => order && setOrder((o) => ({ ...o, entry: lv }))} className={`flex justify-between px-2 py-0.5 cursor-pointer ${Math.abs(i) < 1 ? 'bg-blue-500/20' : ''}`} dir="ltr"><span className="font-mono opacity-80">{lv.toFixed(5)}</span><span className="font-mono" style={{ color: i > 0 ? '#ef4444' : i < 0 ? '#22c55e' : '#3b82f6' }}>{Math.abs(Math.round(50 * Math.exp(-Math.abs(i) / 3)))}</span></div>); } return (<div className="mt-1"><div className="text-[10px] opacity-50 px-2 mb-0.5">DOM — عمقِ بازار</div><div className="rounded overflow-hidden text-[10px] border" style={{ borderColor: TH.border }}>{rows}</div></div>); })()}
        </div>
      ) : (
        <div className="p-2 text-xs">
          <AlertsPanel symbol={symbol} price={curPrice() || livePrice} TH={TH} indicators={[...overlays, ...subs]} />
          <div className="mt-3 flex gap-1"><button onClick={() => quickTrade('buy')} className="flex-1 py-1 rounded bg-green-600 text-white flex items-center justify-center gap-1"><ShoppingCart size={12} /> خرید</button><button onClick={() => quickTrade('sell')} className="flex-1 py-1 rounded bg-red-600 text-white">فروش</button></div>
        </div>
      )}
      </div>
    </div>
  );
}
