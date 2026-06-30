import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, X, Plus, BarChart3, Calculator, Activity, Scissors } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton, InfoTip } from '../components/Guide';

function Curve({ pts }) {
  if (!pts || pts.length < 2) return null;
  const w = 300, h = 50, p = 3, lo = Math.min(...pts), hi = Math.max(...pts), rng = (hi - lo) || 1;
  const x = (i) => p + (w - p * 2) * i / (pts.length - 1), y = (v) => p + (h - p * 2) * (1 - (v - lo) / rng);
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12"><polyline fill="none" stroke={pts[pts.length - 1] >= pts[0] ? '#34d399' : '#f87171'} strokeWidth="2" points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} /></svg>;
}

const ORDER_TYPES = [
  { v: 'market', label: 'بازار' },
  { v: 'limit', label: 'حد' },
  { v: 'stop', label: 'استاپ' },
];

function fmtMoney(v) {
  if (v == null) return '—';
  const n = +v;
  return (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '$';
}

function Metric({ label, value, tone }) {
  const cls = tone === 'pos' ? 'text-brand-green' : tone === 'neg' ? 'text-brand-red' : '';
  return (
    <div className="text-center">
      <div className="text-[11px] text-text-muted mb-0.5">{label}</div>
      <div className={`font-black text-sm ${cls}`}>{value}</div>
    </div>
  );
}

export default function PaperTrade() {
  const qc = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['chartSymbols'], queryFn: () => api.chartSymbols(), staleTime: 3600e3 });
  const { data: acc } = useQuery({ queryKey: ['paperAcc'], queryFn: () => api.paperAccount(), refetchInterval: 12000 });
  const { data: pos } = useQuery({ queryKey: ['paperPos'], queryFn: () => api.paperPositions(), refetchInterval: 12000 });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ symbol: 'EURUSD', direction: 'buy', order_type: 'market', limit_price: '', sl: '', tp: '', risk_usd: 100, size: '' });
  const [busy, setBusy] = useState(false);
  const [calcBusy, setCalcBusy] = useState(false);
  const [slPips, setSlPips] = useState(null);
  const [partialBusy, setPartialBusy] = useState(null); // id being partially closed
  const refresh = () => { qc.invalidateQueries({ queryKey: ['paperAcc'] }); qc.invalidateQueries({ queryKey: ['paperPos'] }); };
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const isPending = f.order_type !== 'market';
      await api.paperOpen({
        symbol: f.symbol,
        direction: f.direction,
        order_type: f.order_type,
        limit_price: isPending && f.limit_price ? +f.limit_price : null,
        sl: f.sl ? +f.sl : null,
        tp: f.tp ? +f.tp : null,
        risk_usd: +f.risk_usd,
        size: f.size ? +f.size : null,
      });
      setOpen(false);
      setF((s) => ({ ...s, sl: '', tp: '', limit_price: '', size: '' }));
      setSlPips(null);
      refresh();
    }
    catch (e) { alert(e?.message || 'خطا'); } finally { setBusy(false); }
  };

  const calcSize = async () => {
    if (!f.sl) { alert('برای محاسبهٔ حجم، حد ضرر را وارد کن.'); return; }
    setCalcBusy(true);
    try {
      const entry = f.order_type !== 'market' && f.limit_price ? +f.limit_price : null;
      const r = await api.paperCalcSize(f.symbol, entry, +f.sl, +f.risk_usd);
      up('size', r.size);
      setSlPips(r.sl_pips);
    }
    catch (e) { alert(e?.message || 'خطا در محاسبه'); } finally { setCalcBusy(false); }
  };

  const close = async (id) => { try { await api.paperClose(id); refresh(); } catch { /* */ } };
  const closePartial = async (id, fraction) => {
    setPartialBusy(id);
    try { await api.paperClosePartial(id, fraction); refresh(); }
    catch (e) { alert(e?.message || 'خطا'); } finally { setPartialBusy(null); }
  };

  const symbols = meta?.symbols || [];
  const openPos = pos?.open || [], closedPos = pos?.closed || [];
  const isPending = f.order_type !== 'market';
  const hasPro = acc && (acc.profit_factor != null || acc.true_equity != null || acc.max_drawdown_pct != null);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><Wallet className="text-brand-green" /> حسابِ معاملاتیِ مجازی</h1>
        <div className="flex items-center gap-2">
          <GuideButton guideKey="paper" auto />
          <button onClick={() => setOpen(true)} className="btn-success flex items-center gap-1.5 text-sm"><Plus size={16} /> معاملهٔ جدید</button>
        </div>
      </div>

      {/* حساب */}
      {acc && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <div className="text-xs text-text-muted">اکوییتی (با شناور)</div>
              <div className={`text-2xl font-black ${acc.equity >= acc.start ? 'text-brand-green' : 'text-brand-red'}`}>${acc.equity}</div>
            </div>
            <div className="text-center"><div className="text-xs text-text-muted">موجودی</div><div className="font-black">${acc.balance}</div></div>
            <div className="text-center"><div className="text-xs text-text-muted">شناور</div><div className={`font-black ${acc.floating >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{acc.floating >= 0 ? '+' : ''}{acc.floating}$</div></div>
            <div className="text-center"><div className="text-xs text-text-muted">نرخِ برد</div><div className="font-black">{acc.win_rate != null ? acc.win_rate + '٪' : '—'}</div></div>
            <div className="text-center"><div className="text-xs text-text-muted">معاملات</div><div className="font-black">{acc.closed_count}</div></div>
          </div>
          <Curve pts={acc.curve} />
        </div>
      )}

      {/* متریک‌های حرفه‌ای */}
      {hasPro && (
        <div className="card p-4 mb-4">
          <div className="font-bold text-sm mb-3 flex items-center gap-1.5"><Activity size={15} className="text-brand-green" /> آمارِ حرفه‌ای</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-3 gap-x-2">
            <Metric label="فاکتورِ سود" value={acc.profit_factor != null ? (+acc.profit_factor).toFixed(2) : '—'} tone={acc.profit_factor != null ? (acc.profit_factor >= 1 ? 'pos' : 'neg') : ''} />
            <Metric label="اکوییتیِ واقعی" value={acc.true_equity != null ? '$' + (+acc.true_equity).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} />
            <Metric label="بیشینهٔ افتِ سرمایه" value={acc.max_drawdown_pct != null ? (+acc.max_drawdown_pct).toFixed(1) + '٪' : '—'} tone="neg" />
            <Metric label="میانگینِ برد" value={acc.avg_win != null ? fmtMoney(acc.avg_win) : '—'} tone="pos" />
            <Metric label="میانگینِ باخت" value={acc.avg_loss != null ? fmtMoney(acc.avg_loss) : '—'} tone="neg" />
            <Metric label="بیشترین بردِ پیاپی" value={acc.max_consec_wins != null ? acc.max_consec_wins : '—'} tone="pos" />
            <Metric label="بیشترین باختِ پیاپی" value={acc.max_consec_losses != null ? acc.max_consec_losses : '—'} tone="neg" />
          </div>
        </div>
      )}

      {/* پوزیشن‌های باز */}
      <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><BarChart3 size={15} className="text-brand-green" /> پوزیشن‌های باز ({openPos.length})</div>
      {openPos.length === 0 ? (
        <div className="card p-5 text-center text-text-muted text-sm mb-5">پوزیشنِ بازی نیست. «معاملهٔ جدید» را بزن.</div>
      ) : (
        <div className="space-y-2 mb-5">
          {openPos.map((p) => {
            const pending = p.status === 'pending';
            return (
              <div key={p.id} className="card p-3">
                <div className="flex items-center gap-3">
                  {p.direction === 'buy' ? <TrendingUp size={18} className="text-brand-green" /> : <TrendingDown size={18} className="text-brand-red" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm flex items-center gap-1.5 flex-wrap">
                      {p.symbol} <span className="text-xs text-text-muted">@ {pending ? (p.limit_price ?? p.entry) : p.entry}</span>
                      {pending && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/30">در انتظار</span>}
                    </div>
                    <div className="text-[11px] text-text-muted">SL {p.sl ?? '—'} · TP {p.tp ?? '—'} · ریسک ${p.risk_usd}{!pending && ` · قیمت ${p.price}`}</div>
                  </div>
                  {!pending && <div className={`font-black text-sm ${p.float_pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{p.float_pnl >= 0 ? '+' : ''}{p.float_pnl}$</div>}
                  <button onClick={() => close(p.id)} className="text-text-muted hover:text-brand-red" title={pending ? 'لغو' : 'بستن'}><X size={18} /></button>
                </div>
                {!pending && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-surface-border">
                    <span className="text-[11px] text-text-muted flex items-center gap-1"><Scissors size={12} /> بستنِ جزئی: <InfoTip text="درصدی از حجمِ پوزیشن را می‌بندی و سود را قفل می‌کنی، در حالی که بقیهٔ پوزیشن باز می‌ماند تا سودِ بیشتر بگیرد." /></span>
                    {[0.25, 0.5, 0.75].map((fr) => (
                      <button key={fr} onClick={() => closePartial(p.id, fr)} disabled={partialBusy === p.id}
                        className="text-[11px] font-bold px-2 py-1 rounded-md border border-surface-border text-text-secondary hover:border-brand-green hover:text-brand-green disabled:opacity-40">
                        {partialBusy === p.id ? '…' : Math.round(fr * 100) + '٪'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* تاریخچه */}
      {closedPos.length > 0 && (
        <>
          <div className="font-bold text-sm mb-2">تاریخچه</div>
          <div className="space-y-2">
            {closedPos.map((p) => (
              <div key={p.id} className="card p-3 flex items-center gap-3 opacity-90">
                {p.direction === 'buy' ? <TrendingUp size={16} className="text-text-muted" /> : <TrendingDown size={16} className="text-text-muted" />}
                <div className="flex-1 text-sm"><span className="font-bold">{p.symbol}</span> <span className="text-[11px] text-text-muted">{p.entry} → {p.exit} · {p.outcome === 'tp' ? 'حد سود' : p.outcome === 'sl' ? 'حد ضرر' : 'دستی'}</span></div>
                <div className={`font-black text-sm ${p.pnl_usd >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{p.pnl_usd >= 0 ? '+' : ''}{p.pnl_usd}$</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* مودالِ معاملهٔ جدید */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-black">معاملهٔ جدید</h3><button onClick={() => setOpen(false)} className="text-text-muted"><X size={18} /></button></div>
            <div className="space-y-3 text-sm">
              <select value={f.symbol} onChange={(e) => up('symbol', e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5">{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => up('direction', 'buy')} className={`py-2.5 rounded-lg font-bold border ${f.direction === 'buy' ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>خرید</button>
                <button onClick={() => up('direction', 'sell')} className={`py-2.5 rounded-lg font-bold border ${f.direction === 'sell' ? 'bg-brand-red/15 border-brand-red text-brand-red' : 'border-surface-border text-text-secondary'}`}>فروش</button>
              </div>

              {/* نوعِ سفارش */}
              <div>
                <label className="text-xs text-text-muted inline-flex items-center gap-1">نوعِ سفارش <InfoTip text="«بازار» فوری به قیمتِ لحظه‌ای باز می‌شود؛ «حد» و «استاپ» سفارشِ معلق‌اند که فقط وقتی قیمت به «قیمتِ سفارش» برسد فعال می‌شوند." /></label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {ORDER_TYPES.map((o) => (
                    <button key={o.v} onClick={() => up('order_type', o.v)}
                      className={`py-2 rounded-lg font-bold text-xs border ${f.order_type === o.v ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* قیمتِ سفارش برای limit/stop */}
              {isPending && (
                <div>
                  <label className="text-xs text-text-muted">قیمتِ سفارش</label>
                  <input value={f.limit_price} onChange={(e) => up('limit_price', e.target.value)} dir="ltr" placeholder="قیمتِ فعال‌سازی" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-2 mt-1" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-brand-red">حد ضرر</label><input value={f.sl} onChange={(e) => { up('sl', e.target.value); setSlPips(null); }} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-2 mt-1" /></div>
                <div><label className="text-xs text-brand-green">حد سود</label><input value={f.tp} onChange={(e) => up('tp', e.target.value)} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-2 mt-1" /></div>
              </div>
              <div><label className="text-xs text-text-muted">ریسک ($)</label><input value={f.risk_usd} onChange={(e) => up('risk_usd', e.target.value)} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-2 mt-1" /></div>

              {/* محاسبهٔ حجم بر اساسِ ریسک */}
              <div className="rounded-lg border border-surface-border p-2.5 bg-surface-elevated/50">
                <button onClick={calcSize} disabled={calcBusy} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-brand-green disabled:opacity-50">
                  <Calculator size={14} /> {calcBusy ? 'در حال محاسبه…' : 'محاسبهٔ حجم بر اساسِ ریسک'}
                </button>
                <div className="grid grid-cols-2 gap-2 mt-2 items-end">
                  <div><label className="text-[11px] text-text-muted">حجم (لات)</label><input value={f.size} onChange={(e) => up('size', e.target.value)} dir="ltr" placeholder="خودکار" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 mt-0.5 text-xs" /></div>
                  {slPips != null && <div className="text-[11px] text-text-muted pb-2">{slPips} پیپ ریسک</div>}
                </div>
              </div>

              <button onClick={submit} disabled={busy} className="btn-success w-full disabled:opacity-50">{busy ? 'در حال باز کردن…' : isPending ? 'ثبتِ سفارش' : 'باز کردنِ پوزیشن'}</button>
              <p className="text-[11px] text-text-muted">{isPending ? 'سفارشِ معلق هنگام رسیدنِ قیمت به قیمتِ سفارش فعال می‌شود.' : 'قیمتِ ورود = آخرین قیمتِ بازار. اندازهٔ پوزیشن از ریسک و فاصلهٔ حد ضرر حساب می‌شود.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
