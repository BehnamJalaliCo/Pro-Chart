// اردر تیکتِ حرفه‌ای — سطحِ صرافی/بروکر (Binance/OKX/MT5-گونه).
// خرید/فروش · بازار/حدی/توقف/توقف-حدی/دنباله‌رو · بریکت(OCO) · اسلایدرِ درصدِ موجودی · اهرم ·
// حدِ سود/ضرر · R:R زنده (با ریسک/ریوارد به‌USDT) · خلاصهٔ مارجین/کارمزد/لیکویید · اعتبارسنجی.
// توکن‌محورِ TH (تمِ چارت) + دوزبانه (useT + fallbackِ محلیِ tx).
// اجرای واقعی فقط برای LBank است؛ سفارش فارکس صرفاً پیش‌نمایش محلی می‌ماند.
import React, { useState, useEffect } from 'react';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { useT } from '../i18n';
import { useApp } from '../appStore';
import { api } from '../api/client';
import { bump } from '../app/haptics';
import { priceDigits } from './symbolMeta';

const PCTS = [25, 50, 75, 100];
const LEV_PRESETS = [5, 10, 20, 50, 100];
// انواعِ سفارشِ هم‌ترازِ TradingView (Market/Limit/Stop/Stop-Limit/Trailing). بریکت‌OCO و partial مُدیفایرند.
const ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit', 'trailing'];
const TIFS = ['GTC', 'IOC', 'FOK'];
const num = (s) => parseFloat(String(s == null ? '' : s).replace(/,/g, '')) || 0;
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
// قیمت (نه مبلغِ USDT) با دقتِ ثابتِ نماد + جداکنندهٔ هزارگان — هم‌راستا با محور/لجندِ چارت.
const fmtPx = (sym, n) => { if (!Number.isFinite(n)) return '—'; const d = priceDigits(sym, n); return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };

export default function OrderTicket({ TH, symbol, order, setOrder, startTrade, submitOrder, curPrice, livePrice, fmtPrice, available = null }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const tx = (fa, en) => (lang === 'en' ? en : fa); // fallbackِ محلی تا رشته‌ها به i18n منتقل شوند
  const side = order?.side || 'buy';
  const [orderType, setOrderType] = useState('market');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(order?.leverage || 10);
  const [pct, setPct] = useState(0);
  const [tif, setTif] = useState('GTC');
  const [bracket, setBracket] = useState(true);   // TP+SL به‌صورتِ OCO
  const [reduceOnly, setReduceOnly] = useState(false);
  const [conn, setConn] = useState(null);
  useEffect(() => { let a = true; api.bnConnectStatus().then((r) => { if (a) setConn(r || {}); }).catch(() => {}); return () => { a = false; }; }, []);

  const isLimitish = orderType === 'limit' || orderType === 'stop_limit';
  const isStopish = orderType === 'stop' || orderType === 'stop_limit';
  const isTrailing = orderType === 'trailing';
  const limitPx = num(order?.entry);
  const stopPx = num(order?.stopPrice);
  const trailPct = num(order?.trail);
  const mkt = curPrice() || livePrice || 0;
  // قیمتِ مؤثرِ ورود بر اساسِ نوعِ سفارش (مبنای cost/margin/RR)
  const px = orderType === 'limit' ? (limitPx || mkt)
    : orderType === 'stop' ? (stopPx || mkt)
    : orderType === 'stop_limit' ? (limitPx || stopPx || mkt)
    : mkt;

  const isCrypto = /USDT|USDC|BTC|ETH|USD$/.test(symbol || '') && !/^(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG)/.test(symbol || '');
  const avail = available != null ? num(available) : null;
  const notional = (avail != null ? avail : 1000) * leverage; // ظرفیتِ خرید (USDT)
  const amt = num(amount);
  const cost = amt * px;
  const margin = leverage ? cost / leverage : cost;
  const fee = cost * 0.0005;
  const tp = num(order?.tp), sl = num(order?.sl);
  const risk = Math.abs(px - sl), reward = Math.abs(tp - px);
  // فاصلهٔ TP/SL به پیپ و درصد (هم‌ترازِ نمایشِ فاصله در تیکتِ TV) — فقط نمایشی، مدیریتِ ریسک.
  const _pd = Math.max(1, priceDigits(symbol, px || 1)); const pipSize = Math.pow(10, -(_pd - 1)); const isFx6 = /^[A-Z]{6}$/.test(symbol || '');
  const distHint = (v) => { if (!(v > 0) || !(px > 0)) return ''; const d = Math.abs(v - px); const pct = (d / px * 100).toFixed(2); return isFx6 ? `${Math.round(d / pipSize)} pip · ${pct}٪` : `${pct}٪`; };
  const rr = risk ? (reward / risk).toFixed(2) : null;
  const riskAmt = sl ? risk * amt : 0;      // زیانِ محتمل تا SL (USDT)
  const rewardAmt = tp ? reward * amt : 0;  // سودِ محتمل تا TP (USDT)
  // لیکوییدِ تخمینی (ایزوله، تقریبی) — فقط راهنما، نه دقیق
  const liq = px && leverage > 1 ? (side === 'buy' ? px * (1 - 1 / leverage) : px * (1 + 1 / leverage)) : 0;
  // پیش‌نمایشِ حدِ ضررِ دنباله‌رو
  const trailStop = isTrailing && trailPct ? (side === 'buy' ? mkt * (1 - trailPct / 100) : mkt * (1 + trailPct / 100)) : 0;

  // با تغییرِ اهرم، در order هم نگه‌داریم (برای اجرای واقعیِ آینده)
  useEffect(() => { if (order && order.leverage !== leverage) setOrder((o) => (o ? { ...o, leverage } : o)); /* eslint-disable-next-line */ }, [leverage]);

  // اجرای واقعی فقط برای LBank مجاز است؛ OneRoyal/فارکس referral-only است.
  const connected = !!(
    isCrypto && (conn?.accounts?.lbank?.connected || conn?.lbank || conn?.lbank_connected)
  );

  // ── اعتبارسنجی: خطاهای مسدودکننده (errs) + هشدارهای نرم (warns) ──
  const errs = [];
  const warns = [];
  if (amt <= 0) errs.push(tx('مقدار را وارد کن', 'Enter amount'));
  if (isLimitish && limitPx <= 0) errs.push(tx('قیمتِ حدی لازم است', 'Limit price required'));
  if (isStopish && stopPx <= 0) errs.push(tx('قیمتِ ماشه لازم است', 'Trigger price required'));
  if (isTrailing && trailPct <= 0) errs.push(tx('فاصلهٔ دنباله لازم است', 'Trail distance required'));
  if (avail != null && margin > avail) errs.push(tx('مارجینِ لازم از موجودی بیشتر است', 'Margin exceeds balance'));
  // جهتِ ماشهٔ توقف نسبت به قیمتِ روز
  if (isStopish && stopPx > 0 && mkt > 0) {
    if (side === 'buy' && stopPx < mkt) warns.push(tx('برای خرید، ماشه معمولاً بالای قیمت است', 'Buy stop is usually above price'));
    if (side === 'sell' && stopPx > mkt) warns.push(tx('برای فروش، ماشه معمولاً زیرِ قیمت است', 'Sell stop is usually below price'));
  }
  // سازگاریِ حدِ ضرر/سود با جهتِ معامله (بریکت/OCO)
  if (sl > 0) {
    if (side === 'buy' && sl >= px) warns.push(tx('برای خرید، حدِ ضرر باید زیرِ ورود باشد', 'For buy, SL must be below entry'));
    if (side === 'sell' && sl <= px) warns.push(tx('برای فروش، حدِ ضرر باید بالای ورود باشد', 'For sell, SL must be above entry'));
  }
  if (tp > 0) {
    if (side === 'buy' && tp <= px) warns.push(tx('برای خرید، حدِ سود باید بالای ورود باشد', 'For buy, TP must be above entry'));
    if (side === 'sell' && tp >= px) warns.push(tx('برای فروش، حدِ سود باید زیرِ ورود باشد', 'For sell, TP must be above entry'));
  }
  const blocking = errs.length > 0;

  const typeLabel = (ty) => ty === 'market' ? t('trade.market')
    : ty === 'limit' ? t('trade.limit')
    : ty === 'stop' ? tx('توقف', 'Stop')
    : ty === 'stop_limit' ? tx('توقف-حدی', 'Stop-Limit')
    : tx('دنباله‌رو', 'Trailing');

  const placeReal = async () => {
    if (!isCrypto) {
      window.alert(tx(
        'OneRoyal فقط مسیر معرفی است و معاملهٔ مستقیم فارکس در Pro Chart فعال نیست.',
        'OneRoyal is referral-only; direct forex trading is not available in Pro Chart.'
      ));
      return;
    }
    if (blocking) { window.alert(errs.join('\n')); return; }
    const priceArg = isLimitish ? limitPx : 0; // فقط سفارش‌های حدی قیمت می‌گیرند (رفتارِ فعلیِ bnRealOrder حفظ شد)
    const lines = [
      `${side === 'buy' ? t('trade.buy') : t('trade.sell')} ${baseUnit} · ${typeLabel(orderType)}`,
      `${t('trade.amount')}: ${amount || 0}`,
    ];
    if (isStopish) lines.push(`${tx('ماشه', 'Trigger')}: ${stopPx || '—'}`);
    lines.push(`${t('trade.price')}: ${isLimitish ? (limitPx || px) : px}`);
    if (isTrailing) lines.push(`${tx('فاصلهٔ دنباله', 'Trail')}: ${trailPct}%`);
    if (bracket && (tp || sl)) lines.push(`OCO · TP ${tp || '—'} / SL ${sl || '—'}`);
    if (reduceOnly) lines.push(tx('فقط کاهش', 'Reduce-only'));
    if (!window.confirm(lines.join('\n'))) return; // تأییدِ ریسک حفظ شد
    bump();
    try {
      const r = await api.bnRealOrder(side, symbol, amt, priceArg);
      window.alert(r?.placed || r?.ok ? '✓' : (r?.msg || 'OK'));
    } catch (e) { window.alert(e?.message || (e?.data?.detail) || 'خطا'); }
  };

  const onAction = () => {
    if (!order) { startTrade(side); return; }
    if (connected && amt > 0) placeReal(); else submitOrder();
  };

  const pickSide = (s) => { startTrade(s); };
  const applyPct = (p) => { setPct(p); const a = (notional / (px || 1)) * (p / 100); setAmount(a ? a.toFixed(isCrypto ? 4 : 2) : ''); };
  // استپرِ ±ِ مقدار (سبکِ –/+ِ فیلدِ Quantityِ TV) — گامِ تطبیقی بر اساسِ بزرگیِ مقدار؛ کف صفر.
  const stepAmount = (dir) => { const cur = num(amount); const step = cur >= 100 ? 1 : cur >= 10 ? 0.1 : 0.01; const next = Math.max(0, Math.round((cur + dir * step) / step) * step); setAmount(String(+next.toFixed(isCrypto ? 4 : 2))); setPct(0); };
  const setField = (key, v) => setOrder((o) => (o ? { ...o, [key]: num(v) } : o));

  const baseUnit = isCrypto ? (symbol || '').replace(/USDT|USDC|USD$/,'') || symbol : symbol;

  const seg = { flex: 1, border: 0, cursor: 'pointer', fontWeight: 800, fontSize: 14, height: 40, borderRadius: 10, background: 'transparent', color: TH.text, fontFamily: 'inherit', transition: '.2s' };
  const fieldBox = { display: 'flex', alignItems: 'center', background: TH.chipBg, border: `1px solid ${TH.border}`, borderRadius: 12, height: 44, padding: '0 12px' };
  const inputCss = { flex: 1, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: TH.textStrong, outline: 'none', width: '100%' };
  const cell = { flex: 1, background: TH.chipBg, border: `1px solid ${TH.border}`, borderRadius: 12, padding: '8px 10px' };
  const chip = (on) => ({ border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5, padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', color: on ? TH.textStrong : TH.text, background: on ? TH.chipBgHover : 'transparent', transition: '.15s' });

  return (
    <div className="p-2.5 space-y-3" style={{ color: TH.text }}>
      {/* خرید/فروش */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: TH.subtle }}>
        <button onClick={() => pickSide('buy')} style={{ ...seg, ...(side === 'buy' ? { background: TH.up, color: '#fff', boxShadow: '0 4px 12px -3px rgba(0,0,0,.25)' } : {}) }}>{t('trade.buy')}</button>
        <button onClick={() => pickSide('sell')} style={{ ...seg, ...(side === 'sell' ? { background: TH.down, color: '#fff' } : {}) }}>{t('trade.sell')}</button>
      </div>

      {/* نوعِ سفارش (Market/Limit/Stop/Stop-Limit/Trailing) — اسکرولِ افقی در پنلِ باریک */}
      <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {ORDER_TYPES.map((ty) => (
          <button key={ty} onClick={() => setOrderType(ty)} className="rounded-lg" style={chip(orderType === ty)}>
            {typeLabel(ty)}
          </button>
        ))}
        <span className="text-[11px] mr-auto pl-1" style={{ color: TH.text }} dir="ltr">
          {t('trade.avail')} <b style={{ color: TH.textStrong }}>{avail != null ? fmt(avail) : '—'}</b> USDT
        </span>
      </div>

      {/* قیمتِ ماشه (توقف/توقف-حدی) */}
      {isStopish && (
        <div>
          <div className="text-[11px] mb-1" style={{ color: TH.text }}>{tx('قیمتِ ماشه', 'Trigger price')}</div>
          <div style={fieldBox}>
            <input value={order?.stopPrice ?? ''} onChange={(e) => setField('stopPrice', e.target.value)} placeholder="0.00" inputMode="decimal" dir="ltr" className="tabular-nums" style={inputCss} />
          </div>
        </div>
      )}

      {/* قیمتِ حدی (حدی/توقف-حدی) */}
      {isLimitish && (
        <div>
          <div className="text-[11px] mb-1" style={{ color: TH.text }}>{tx('قیمتِ حدی', 'Limit price')}</div>
          <div style={fieldBox}>
            <input value={order?.entry ?? ''} onChange={(e) => setField('entry', e.target.value)} placeholder="0.00" inputMode="decimal" dir="ltr" className="tabular-nums" style={inputCss} />
          </div>
        </div>
      )}

      {/* فاصلهٔ دنباله (دنباله‌رو) */}
      {isTrailing && (
        <div>
          <div className="flex justify-between text-[11px] mb-1" style={{ color: TH.text }}>
            <span>{tx('فاصلهٔ دنباله', 'Trail distance')}</span>
            {trailStop ? <span dir="ltr">{tx('حدِ ضرر', 'stop')} ≈ {fmt(trailStop)}</span> : null}
          </div>
          <div style={fieldBox}>
            <input value={order?.trail ?? ''} onChange={(e) => setField('trail', e.target.value)} placeholder="0.5" inputMode="decimal" dir="ltr" className="tabular-nums" style={inputCss} />
            <span className="text-[11px] font-bold" style={{ color: TH.text }}>%</span>
          </div>
        </div>
      )}

      {/* اعتبارِ سفارش (TIF) — فقط برای سفارش‌های حدی */}
      {isLimitish && (
        <div className="flex items-center gap-1">
          <span className="text-[11px]" style={{ color: TH.text }}>{tx('اعتبار', 'TIF')}</span>
          {TIFS.map((f) => (
            <button key={f} onClick={() => setTif(f)} className="tabular-nums" dir="ltr" style={chip(tif === f)}>{f}</button>
          ))}
        </div>
      )}

      {/* مقدار */}
      <div>
        <div className="flex justify-between text-[11px] mb-1" style={{ color: TH.text }}>
          <span>{t('trade.amount')}</span><span dir="ltr">≈ {fmt(cost)} USDT</span>
        </div>
        <div style={fieldBox}>
          <button onClick={() => stepAmount(-1)} aria-label="کاهشِ مقدار" className="shrink-0 flex items-center justify-center rounded-md" style={{ width: 26, height: 26, border: 0, cursor: 'pointer', color: TH.text, background: TH.chipBgHover, fontWeight: 800, fontSize: 16, lineHeight: 1 }}>−</button>
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setPct(0); }} placeholder="0.00" inputMode="decimal" dir="ltr" className="tabular-nums" style={{ ...inputCss, textAlign: 'center' }} />
          <span className="text-[11px] font-bold shrink-0" style={{ color: TH.text }}>{baseUnit}</span>
          <button onClick={() => stepAmount(1)} aria-label="افزایشِ مقدار" className="shrink-0 flex items-center justify-center rounded-md mr-1" style={{ width: 26, height: 26, border: 0, cursor: 'pointer', color: TH.text, background: TH.chipBgHover, fontWeight: 800, fontSize: 16, lineHeight: 1 }}>+</button>
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

      {/* بریکت (OCO) / فقط-کاهش */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => setBracket((v) => !v)} style={chip(bracket)}>{tx('بریکت (OCO)', 'Bracket (OCO)')}</button>
        <button onClick={() => setReduceOnly((v) => !v)} style={chip(reduceOnly)}>{tx('فقط کاهش', 'Reduce-only')}</button>
      </div>

      {/* حدِ سود/ضرر (پایهٔ بریکت/OCO) */}
      {order && bracket && (
        <div className="flex gap-2">
          <div style={cell}>
            <div className="text-[10.5px] font-bold mb-1" style={{ color: TH.up }}>🎯 {t('trade.tp')}</div>
            <input value={order.tp ?? ''} onChange={(e) => setField('tp', e.target.value)} inputMode="decimal" dir="ltr" className="tabular-nums" style={{ ...inputCss, fontSize: 13 }} />
            {distHint(tp) && <div className="text-[9px] mt-0.5 tabular-nums" dir="ltr" style={{ color: TH.up, opacity: 0.7 }}>{distHint(tp)}</div>}
          </div>
          <div style={cell}>
            <div className="text-[10.5px] font-bold mb-1" style={{ color: TH.down }}>🛑 {t('trade.sl')}</div>
            <input value={order.sl ?? ''} onChange={(e) => setField('sl', e.target.value)} inputMode="decimal" dir="ltr" className="tabular-nums" style={{ ...inputCss, fontSize: 13 }} />
            {distHint(sl) && <div className="text-[9px] mt-0.5 tabular-nums" dir="ltr" style={{ color: TH.down, opacity: 0.7 }}>{distHint(sl)}</div>}
          </div>
        </div>
      )}

      {/* خلاصهٔ سفارش */}
      <div className="rounded-xl px-3 py-2.5 text-[12px] space-y-1" style={{ background: TH.subtle }}>
        <Row TH={TH} k={tx('قیمتِ ورود', 'Entry')} v={px ? `${fmtPx(symbol, px)} USDT` : '—'} />
        {isStopish && <Row TH={TH} k={tx('ماشه', 'Trigger')} v={stopPx ? fmt(stopPx) : '—'} />}
        <Row TH={TH} k={t('trade.cost')} v={`${fmt(cost)} USDT`} />
        <Row TH={TH} k={t('trade.margin')} v={`${fmt(margin)} USDT`} />
        <Row TH={TH} k={t('trade.rr')} v={rr ? `R/R ${rr}` : '—'} vColor={rr && reward >= risk ? TH.up : (rr ? '#e8a33d' : TH.textStrong)} />
        {(riskAmt > 0 || rewardAmt > 0) && (
          <Row TH={TH} k={tx('ریسک / ریوارد', 'Risk / Reward')}
            v={`−${fmt(riskAmt)} / +${fmt(rewardAmt)}`}
            vColor={TH.textStrong} />
        )}
        <Row TH={TH} k={t('trade.fee')} v={`${fmt(fee)} USDT`} />
        {liq > 0 && <Row TH={TH} k={tx('لیکوییدِ تخمینی', 'Est. liq.')} v={fmtPx(symbol, liq)} vColor="#e8a33d" />}
      </div>

      {/* اعتبارسنجی — خطاهای مسدودکننده و هشدارها */}
      {order && (errs.length > 0 || warns.length > 0) && (
        <div className="rounded-xl px-3 py-2 text-[11px] space-y-1" style={{ background: TH.subtle, border: `1px solid ${errs.length ? TH.down : '#e8a33d'}` }}>
          {errs.map((m, i) => (
            <div key={`e${i}`} className="flex items-center gap-1.5" style={{ color: TH.down }}>
              <AlertTriangle size={12} /> <span>{m}</span>
            </div>
          ))}
          {warns.map((m, i) => (
            <div key={`w${i}`} className="flex items-center gap-1.5" style={{ color: '#e8a33d' }}>
              <AlertTriangle size={12} /> <span>{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* دکمهٔ اقدام — اگر حساب متصل باشد سفارشِ واقعی (با تأیید)، وگرنه پیش‌نمایش */}
      <button onClick={onAction} disabled={connected && blocking}
        className="w-full flex items-center justify-center gap-2 rounded-xl active:scale-[.98] transition-transform"
        style={{ height: 50, border: 0, cursor: (connected && blocking) ? 'not-allowed' : 'pointer', opacity: (connected && blocking) ? .55 : 1, fontFamily: 'inherit', fontWeight: 800, fontSize: 15, color: '#fff', background: side === 'buy' ? TH.up : TH.down, boxShadow: '0 10px 22px -8px rgba(0,0,0,.3)' }}>
        <ShoppingCart size={17} className="shrink-0" />
        {/* برچسبِ پویا سبکِ TV: «خرید 0.5 EURUSD @ بازار» / «… @ 1.14000 حدی» — نمایشِ سمت+مقدار+نماد+نوع/قیمت پیش از کلیک */}
        <span className="truncate">{side === 'buy' ? t('trade.buy') : t('trade.sell')}{Number(amount) > 0 ? ` ${amount}` : ''} {baseUnit} @ {orderType === 'market' ? typeLabel('market') : ((isLimitish ? limitPx : stopPx) > 0 ? `${fmtPx(symbol, isLimitish ? limitPx : stopPx)} ${typeLabel(orderType)}` : typeLabel(orderType))}</span>
      </button>
      {!connected && (
        <div className="text-center" style={{ fontSize: 10.5, color: TH.text, opacity: .7, marginTop: -4 }}>
          {isCrypto
            ? t('trade.connect')
            : tx('OneRoyal فقط مسیر معرفی است؛ این سفارش پیش‌نمایش محلی است.', 'OneRoyal is referral-only; this order is a local preview.')}
        </div>
      )}
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
