// اردر تیکتِ حرفه‌ای — سطحِ صرافی/بروکر (Binance/OKX/MT5-گونه).
// خرید/فروش · بازار/حدی · اسلایدرِ درصدِ موجودی · اهرم · حدِ سود/ضرر · خلاصهٔ سفارش (مارجین/کارمزد/RR).
// توکن‌محورِ TH (تمِ چارت) + دوزبانه (useT). اجرای واقعی از همان submitOrder (پیش‌نمایشِ امنِ مهمان).
import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useT } from '../i18n';

const PCTS = [25, 50, 75, 100];
const LEV_PRESETS = [5, 10, 20, 50, 100];
const num = (s) => parseFloat(String(s == null ? '' : s).replace(/,/g, '')) || 0;
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');

export default function OrderTicket({ TH, symbol, order, setOrder, startTrade, submitOrder, curPrice, livePrice, fmtPrice, available = null }) {
  const t = useT();
  const side = order?.side || 'buy';
  const [orderType, setOrderType] = useState('market');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(order?.leverage || 10);
  const [pct, setPct] = useState(0);

  const px = (orderType === 'limit' && order?.entry) ? num(order.entry) : (curPrice() || livePrice || 0);
  const isCrypto = /USDT|USDC|BTC|ETH|USD$/.test(symbol || '') && !/^(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG)/.test(symbol || '');
  const avail = available != null ? num(available) : null;
  const notional = (avail != null ? avail : 1000) * leverage; // ظرفیتِ خرید (USDT)
  const amt = num(amount);
  const cost = amt * px;
  const margin = leverage ? cost / leverage : cost;
  const fee = cost * 0.0005;
  const tp = num(order?.tp), sl = num(order?.sl);
  const risk = Math.abs(px - sl), reward = Math.abs(tp - px);
  const rr = risk ? (reward / risk).toFixed(2) : null;

  // با تغییرِ اهرم، در order هم نگه‌داریم (برای اجرای واقعیِ آینده)
  useEffect(() => { if (order && order.leverage !== leverage) setOrder((o) => (o ? { ...o, leverage } : o)); /* eslint-disable-next-line */ }, [leverage]);

  const pickSide = (s) => { startTrade(s); };
  const applyPct = (p) => { setPct(p); const a = (notional / (px || 1)) * (p / 100); setAmount(a ? a.toFixed(isCrypto ? 4 : 2) : ''); };
  const setField = (key, v) => setOrder((o) => (o ? { ...o, [key]: num(v) } : o));

  const baseUnit = isCrypto ? (symbol || '').replace(/USDT|USDC|USD$/,'') || symbol : symbol;

  const seg = { flex: 1, border: 0, cursor: 'pointer', fontWeight: 800, fontSize: 14, height: 40, borderRadius: 10, background: 'transparent', color: TH.text, fontFamily: 'inherit', transition: '.2s' };
  const fieldBox = { display: 'flex', alignItems: 'center', background: TH.chipBg, border: `1px solid ${TH.border}`, borderRadius: 12, height: 44, padding: '0 12px' };
  const inputCss = { flex: 1, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: TH.textStrong, outline: 'none', width: '100%' };
  const cell = { flex: 1, background: TH.chipBg, border: `1px solid ${TH.border}`, borderRadius: 12, padding: '8px 10px' };

  return (
    <div className="p-2.5 space-y-3" style={{ color: TH.text }}>
      {/* خرید/فروش */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: TH.subtle }}>
        <button onClick={() => pickSide('buy')} style={{ ...seg, ...(side === 'buy' ? { background: TH.up, color: '#fff', boxShadow: '0 4px 12px -3px rgba(0,0,0,.25)' } : {}) }}>{t('trade.buy')}</button>
        <button onClick={() => pickSide('sell')} style={{ ...seg, ...(side === 'sell' ? { background: TH.down, color: '#fff' } : {}) }}>{t('trade.sell')}</button>
      </div>

      {/* بازار/حدی + موجودی */}
      <div className="flex items-center gap-1.5">
        {['market', 'limit'].map((tp2) => (
          <button key={tp2} onClick={() => setOrderType(tp2)} className="rounded-lg" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, padding: '6px 12px', color: orderType === tp2 ? TH.textStrong : TH.text, background: orderType === tp2 ? TH.chipBgHover : 'transparent' }}>
            {t(`trade.${tp2}`)}
          </button>
        ))}
        <span className="text-[11px] mr-auto" style={{ color: TH.text }} dir="ltr">
          {t('trade.avail')} <b style={{ color: TH.textStrong }}>{avail != null ? fmt(avail) : '—'}</b> USDT
        </span>
      </div>

      {/* قیمت (حدی) */}
      {orderType === 'limit' && (
        <div>
          <div className="text-[11px] mb-1" style={{ color: TH.text }}>{t('trade.price')}</div>
          <div style={fieldBox}>
            <input value={order?.entry ?? ''} onChange={(e) => setField('entry', e.target.value)} inputMode="decimal" dir="ltr" className="tabular-nums" style={inputCss} />
          </div>
        </div>
      )}

      {/* مقدار */}
      <div>
        <div className="flex justify-between text-[11px] mb-1" style={{ color: TH.text }}>
          <span>{t('trade.amount')}</span><span dir="ltr">≈ {fmt(cost)} USDT</span>
        </div>
        <div style={fieldBox}>
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setPct(0); }} placeholder="0.00" inputMode="decimal" dir="ltr" className="tabular-nums" style={inputCss} />
          <span className="text-[11px] font-bold" style={{ color: TH.text }}>{baseUnit}</span>
        </div>
        {/* درصدِ موجودی */}
        <div className="flex gap-1.5 mt-2">
          {PCTS.map((p) => (
            <button key={p} onClick={() => applyPct(p)} className="flex-1 rounded-lg" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, padding: '5px 0', color: pct === p ? '#fff' : TH.text, background: pct === p ? TH.accent : TH.chipBg }}>{p}%</button>
          ))}
        </div>
      </div>

      {/* اهرم */}
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
        <span className="text-[12px] font-bold" style={{ color: TH.text }}>{t('trade.leverage')}</span>
        <input type="range" min="1" max="125" value={leverage} onChange={(e) => setLeverage(+e.target.value)} className="flex-1" style={{ accentColor: TH.accent }} />
        <span className="font-extrabold tabular-nums" dir="ltr" style={{ color: TH.accent, minWidth: 34, textAlign: 'left' }}>{leverage}×</span>
      </div>
      <div className="flex gap-1">
        {LEV_PRESETS.map((L) => (
          <button key={L} onClick={() => setLeverage(L)} className="flex-1 rounded-md tabular-nums" dir="ltr" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 10.5, padding: '3px 0', color: leverage === L ? TH.accent : TH.text, background: leverage === L ? TH.chipBgHover : 'transparent' }}>{L}×</button>
        ))}
      </div>

      {/* حدِ سود/ضرر */}
      {order && (
        <div className="flex gap-2">
          <div style={cell}>
            <div className="text-[10.5px] font-bold mb-1" style={{ color: TH.up }}>🎯 {t('trade.tp')}</div>
            <input value={order.tp ?? ''} onChange={(e) => setField('tp', e.target.value)} inputMode="decimal" dir="ltr" className="tabular-nums" style={{ ...inputCss, fontSize: 13 }} />
          </div>
          <div style={cell}>
            <div className="text-[10.5px] font-bold mb-1" style={{ color: TH.down }}>🛑 {t('trade.sl')}</div>
            <input value={order.sl ?? ''} onChange={(e) => setField('sl', e.target.value)} inputMode="decimal" dir="ltr" className="tabular-nums" style={{ ...inputCss, fontSize: 13 }} />
          </div>
        </div>
      )}

      {/* خلاصهٔ سفارش */}
      <div className="rounded-xl px-3 py-2.5 text-[12px] space-y-1" style={{ background: TH.subtle }}>
        <Row TH={TH} k={t('trade.cost')} v={`${fmt(cost)} USDT`} />
        <Row TH={TH} k={t('trade.margin')} v={`${fmt(margin)} USDT`} />
        <Row TH={TH} k={t('trade.rr')} v={rr ? `R/R ${rr}` : '—'} vColor={rr && reward >= risk ? TH.up : (rr ? '#e8a33d' : TH.textStrong)} />
        <Row TH={TH} k={t('trade.fee')} v={`${fmt(fee)} USDT`} />
      </div>

      {/* دکمهٔ اقدام */}
      <button onClick={() => { if (!order) startTrade(side); else submitOrder(); }}
        className="w-full flex items-center justify-center gap-2 rounded-xl active:scale-[.98] transition-transform"
        style={{ height: 50, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, color: '#fff', background: side === 'buy' ? TH.up : TH.down, boxShadow: '0 10px 22px -8px rgba(0,0,0,.3)' }}>
        <ShoppingCart size={17} /> {side === 'buy' ? t('trade.buy') : t('trade.sell')} {baseUnit}
      </button>
    </div>
  );
}

function Row({ TH, k, v, vColor }) {
  return (
    <div className="flex justify-between" style={{ color: TH.text }}>
      <span>{k}</span>
      <b dir="ltr" className="tabular-nums" style={{ color: vColor || TH.textStrong }}>{v}</b>
    </div>
  );
}
