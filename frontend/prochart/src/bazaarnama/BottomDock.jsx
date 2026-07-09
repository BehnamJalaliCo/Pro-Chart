import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, X, ChevronUp } from 'lucide-react';
import useResizable from './useResizable';

/*
 * BottomDock — پوسته‌ی داکِ پایینیِ تب‌دار و قابلِ‌تغییرِ‌اندازه (منطقه‌ی ⑤).
 *
 * یک shell بازاستفاده‌پذیر است: محتوا را نمی‌سازد، فقط tabs را می‌چیند.
 * - دستگیره‌ی کشیدن روی لبه‌ی بالا → تغییرِ ارتفاع (۲۰۰–۶۰۰px، پایدار در localStorage 'bn_dock').
 * - هدر: دکمه‌های تب + بیشینه/کمینه/بستن.
 * - بیشینه: ارتفاع تا maxHeight کشیده می‌شود؛ کمینه: فقط هدر می‌ماند.
 *
 * props:
 *   tabs        [{ key, label, node, icon? }]  هر تب یک node آماده‌ی رندر دارد.
 *   activeKey   کلیدِ تبِ فعال (کنترل‌شده) — اختیاری
 *   onActive    (key) => void                 تغییرِ تبِ فعال — اختیاری
 *   onClose     () => void                    کلیکِ دکمه‌ی بستن (مثلاً editorOpen=false)
 *   TH          آبجکتِ تم (bg/panel/border/text/textStrong/chipBg/chipBgHover/accent/accentAi…)
 *   storageKey  کلیدِ پایداریِ ارتفاع (پیش‌فرض 'bn_dock')
 *   minHeight/maxHeight   کرانه‌ها (پیش‌فرض ۲۰۰/۶۰۰)
 *   title       برچسبِ کوچکِ سمتِ راستِ هدر (اختیاری)
 */
export default function BottomDock({
  tabs = [],
  activeKey,
  onActive,
  onClose,
  TH,
  storageKey = 'bn_dock',
  minHeight = 200,
  maxHeight = 600,
  title,
}) {
  const { size, setSize, dragging, handleProps, reset } = useResizable({
    storageKey,
    axis: 'y',
    min: minHeight,
    max: maxHeight,
    initial: 320,
    invert: true, // دستگیره روی لبه‌ی بالا: کشیدن به بالا = بزرگ‌تر
  });

  // تبِ فعالِ داخلی (وقتی والد کنترل نمی‌کند)
  const [innerKey, setInnerKey] = useState(() => (tabs[0] ? tabs[0].key : ''));
  const curKey = activeKey != null ? activeKey : innerKey;
  const selectTab = (k) => { onActive ? onActive(k) : setInnerKey(k); };

  // اگر تبِ فعال دیگر وجود ندارد، به اولین تب برگرد
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.key === curKey)) selectTab(tabs[0].key);
  }, [tabs, curKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [maximized, setMaximized] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const HEADER = 32; // ارتفاعِ تقریبیِ هدر برای حالتِ کمینه
  const bodyHeight = minimized ? 0 : (maximized ? maxHeight : size);
  const active = tabs.find((t) => t.key === curKey);

  const iconBtn = 'p-1 rounded transition-colors';
  const iconStyle = { color: TH.text };

  return (
    <div
      className="border-t flex flex-col shrink-0 relative"
      style={{ height: (minimized ? HEADER : bodyHeight + HEADER), background: TH.panel, borderColor: TH.border }}
    >
      {/* دستگیره‌ی کشیدن روی لبه‌ی بالا (در حالتِ بیشینه/کمینه غیرفعال) */}
      {!maximized && !minimized && (
        <div
          {...handleProps}
          onDoubleClick={reset}
          className="absolute left-0 right-0 -top-1 h-2 z-10 group cursor-ns-resize"
          title="کشیدن برای تغییرِ ارتفاع (دابل‌کلیک: بازنشانی)"
        >
          <div
            className="mx-auto mt-[3px] h-[2px] w-10 rounded-full transition-all duration-150 group-hover:w-16"
            style={{ background: dragging ? TH.accent : TH.border, opacity: dragging ? 1 : undefined }}
            onMouseEnter={(e) => { if (!dragging) e.currentTarget.style.background = TH.accent; }}
            onMouseLeave={(e) => { if (!dragging) e.currentTarget.style.background = TH.border; }}
          />
        </div>
      )}

      {/* هدر: تب‌ها + کنترل‌ها */}
      <div
        className="flex items-center gap-1 px-2 border-b text-xs shrink-0 select-none"
        style={{ borderColor: TH.border, height: HEADER }}
      >
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {tabs.map((t) => {
            const on = t.key === curKey;
            return (
              <button
                key={t.key}
                onClick={() => { selectTab(t.key); if (minimized) setMinimized(false); }}
                className="relative flex items-center gap-1 px-2.5 h-7 rounded-md whitespace-nowrap transition-colors"
                style={
                  on
                    ? { background: `${TH.accent}1f`, color: TH.accent, fontWeight: 600 }
                    : { color: TH.text }
                }
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                {t.icon}
                <span>{t.label}</span>
                {on && (
                  <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full" style={{ background: TH.accent }} />
                )}
              </button>
            );
          })}
        </div>

        {title && (
          <span className="opacity-50 px-1 hidden sm:inline" style={{ color: TH.text }}>
            {title}
          </span>
        )}

        {/* کنترل‌های پنجره */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => { setMinimized((v) => !v); setMaximized(false); }}
            className={iconBtn}
            style={iconStyle}
            title={minimized ? 'بازکردن' : 'کمینه'}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {minimized ? <ChevronUp size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={() => { setMaximized((v) => !v); setMinimized(false); }}
            className={iconBtn}
            style={iconStyle}
            title={maximized ? 'بازگشت' : 'بیشینه'}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Maximize2 size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={iconBtn}
              style={iconStyle}
              title="بستن"
              onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBg; e.currentTarget.style.color = TH.down; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* بدنه‌ی تبِ فعال */}
      {!minimized && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {active ? active.node : (
            <div className="h-full flex items-center justify-center text-xs opacity-50" style={{ color: TH.text }}>
              تبی برای نمایش نیست
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/*
 * NotesTab — تبِ یادداشتِ ساده‌ی پایدار (textarea در localStorage).
 * بازاستفاده‌پذیر؛ بدونِ نیاز به بک‌اند کار می‌کند.
 */
export function NotesTab({ TH, storageKey = 'bn_notes' }) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch (e) { return ''; }
  });
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(storageKey, text); } catch (e) {}
    }, 300); // ذخیره‌ی دیبونس‌شده
    return () => clearTimeout(id);
  }, [text, storageKey]);

  return (
    <div className="h-full flex flex-col p-2" dir="rtl">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="یادداشت‌های معاملاتیِ شما… (به‌صورتِ محلی ذخیره می‌شود)"
        className="flex-1 w-full resize-none rounded-md p-3 text-sm leading-7 outline-none"
        style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }}
      />
      <div className="text-[10px] mt-1 opacity-40 text-left tabular-nums" dir="ltr" style={{ color: TH.text }}>
        {text.length} chars · auto-saved
      </div>
    </div>
  );
}

/* قالب‌بندیِ عددیِ امن — رشته را همان‌طور نگه می‌دارد، عدد را با اعشارِ ثابت. */
function fmtNum(v, d = 2) {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

/*
 * Stat — کارتِ کوچکِ KPI برای ردیفِ «نمای کلی» (سبکِ TradingView Strategy Tester).
 * tone: 'up' | 'down' | undefined — رنگِ عدد از توکن‌های تم.
 */
function Stat({ TH, label, value, sub, tone }) {
  const color = tone === 'up' ? TH.up : tone === 'down' ? TH.down : TH.textStrong;
  return (
    <div
      className="rounded-md px-3 py-2 flex flex-col gap-1 flex-1 min-w-[120px]"
      style={{ background: TH.subtle, border: `1px solid ${TH.border}` }}
    >
      <span className="text-[10px] opacity-60 whitespace-nowrap" style={{ color: TH.text }}>{label}</span>
      <span className="text-sm font-bold tabular-nums" dir="ltr" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] opacity-50 tabular-nums" dir="ltr" style={{ color: TH.text }}>{sub}</span>}
    </div>
  );
}

/*
 * MRow — یک ردیفِ «برچسب … مقدار» برای جدول‌های عملکرد/مشخصات.
 * value می‌تواند node باشد (مثلاً دو مقدارِ رنگی).
 */
function MRow({ TH, label, value, tone }) {
  const color = tone === 'up' ? TH.up : tone === 'down' ? TH.down : TH.textStrong;
  return (
    <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: TH.border }}>
      <span className="text-xs opacity-70" style={{ color: TH.text }}>{label}</span>
      <span className="text-xs font-bold tabular-nums" dir="ltr" style={{ color }}>{value}</span>
    </div>
  );
}

/*
 * StrategyTesterTab — تبِ «تستِ استراتژی» با چیدمانِ هم‌ترازِ TradingView:
 *   نمای کلی / عملکرد / معاملات / مشخصات.
 *
 * props:
 *   TH          آبجکتِ تم.
 *   result      اختیاری — آبجکتِ نتیجهٔ بک‌تست (هم‌شکلِ `bt` در بازارنما):
 *               { trades, net, win, wins, pf|pfTxt, dd|ddTxt, equity[{e}],
 *                 avgTrade, avgWin, avgLoss, maxWin, maxLoss, expectancy, sharpe,
 *                 winStreak, lossStreak, longN, shortN, grossProfit, grossLoss,
 *                 list[{ dir, t, r }], err }
 *   properties  اختیاری — آبجکتِ تنظیماتِ بک‌تست:
 *               { initialCapital, commission, slippage, orderSize, pyramiding, currency }
 *   children    اختیاری — سازگاریِ عقب‌رو: اگر داده شود همان رندر می‌شود.
 *
 * اگر result نباشد و children هم نباشد، حالتِ خالیِ مودبانه نشان داده می‌شود.
 */
export function StrategyTesterTab({ TH, children, result, properties }) {
  const [sub, setSub] = useState('overview');

  // نتیجهٔ خطادار: پیامِ خطا را تمیز نشان بده.
  if (result && result.err) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center" dir="rtl">
        <p className="text-xs leading-6" style={{ color: TH.down }}>{result.err}</p>
      </div>
    );
  }

  if (result) {
    const SUBS = [
      ['overview', 'نمای کلی'],
      ['performance', 'عملکرد'],
      ['trades', 'معاملات'],
      ['properties', 'مشخصات'],
    ];
    const net = Number(result.net) || 0;
    const avgTrade = Number(result.avgTrade) || 0;
    const list = result.list || [];

    return (
      <div className="h-full flex flex-col" dir="rtl">
        {/* نوارِ زیرتب‌ها */}
        <div
          className="flex items-center gap-1 px-2 border-b text-[11px] shrink-0"
          style={{ borderColor: TH.border }}
        >
          {SUBS.map(([k, l]) => {
            const on = sub === k;
            return (
              <button
                key={k}
                onClick={() => setSub(k)}
                className="relative px-2.5 h-7 rounded-md whitespace-nowrap transition-colors"
                style={on ? { color: TH.accent, fontWeight: 600 } : { color: TH.text }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                {l}
                {on && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full" style={{ background: TH.accent }} />}
              </button>
            );
          })}
        </div>

        {/* بدنهٔ زیرتب */}
        <div className="flex-1 min-h-0 overflow-auto p-3">
          {sub === 'overview' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Stat TH={TH} label="سودِ خالص" value={fmtNum(net, 2)} tone={net >= 0 ? 'up' : 'down'} />
                <Stat TH={TH} label="کلِ معاملات" value={fmtNum(result.trades, 0)} />
                <Stat TH={TH} label="نرخِ برد" value={`${fmtNum(result.win, 1)}٪`} sub={result.wins != null ? `${result.wins}/${result.trades}` : undefined} />
                <Stat TH={TH} label="فاکتورِ سود" value={fmtNum(result.pfTxt != null ? result.pfTxt : result.pf, 2)} />
                <Stat TH={TH} label="حداکثر افت" value={fmtNum(result.ddTxt != null ? result.ddTxt : result.dd, 2)} tone="down" />
              </div>
              {/* منحنیِ سرمایه — عرضِ کامل */}
              {result.equity && result.equity.length > 1 && (() => {
                const es = result.equity.map((p) => p.e);
                const mn = Math.min(0, ...es), mx = Math.max(0, ...es);
                const rng = mx - mn || 1; const W = 600, Hh = 120;
                const pts = result.equity.map((p, i) => `${(i / (result.equity.length - 1)) * W},${Hh - ((p.e - mn) / rng) * Hh}`).join(' ');
                const zeroY = Hh - ((0 - mn) / rng) * Hh;
                const col = net >= 0 ? TH.up : TH.down;
                return (
                  <div className="rounded-md p-2" style={{ background: TH.subtle, border: `1px solid ${TH.border}` }}>
                    <div className="text-[10px] opacity-60 mb-1" style={{ color: TH.text }}>منحنیِ سرمایه</div>
                    <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" className="w-full" style={{ height: Hh }}>
                      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke={TH.border} strokeWidth="1" />
                      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                );
              })()}
            </div>
          )}

          {sub === 'performance' && (
            <div className="max-w-md">
              <MRow TH={TH} label="میانگینِ معامله" value={fmtNum(avgTrade, 5)} tone={avgTrade >= 0 ? 'up' : 'down'} />
              <MRow TH={TH} label="میانگینِ برد / باخت" value={<><span style={{ color: TH.up }}>{fmtNum(result.avgWin, 4)}</span> / <span style={{ color: TH.down }}>{fmtNum(result.avgLoss, 4)}</span></>} />
              <MRow TH={TH} label="بزرگ‌ترین برد / باخت" value={<><span style={{ color: TH.up }}>{fmtNum(result.maxWin, 4)}</span> / <span style={{ color: TH.down }}>{fmtNum(result.maxLoss, 4)}</span></>} />
              <MRow TH={TH} label="انتظارِ ریاضی" value={fmtNum(result.expectancy, 5)} />
              <MRow TH={TH} label="نسبتِ شارپ (≈)" value={fmtNum(result.sharpe, 2)} />
              <MRow TH={TH} label="بیشترین بردِ متوالی" value={fmtNum(result.winStreak, 0)} tone="up" />
              <MRow TH={TH} label="بیشترین باختِ متوالی" value={fmtNum(result.lossStreak, 0)} tone="down" />
              <MRow TH={TH} label="لانگ / شورت" value={`${fmtNum(result.longN, 0)} / ${fmtNum(result.shortN, 0)}`} />
              <MRow TH={TH} label="سودِ ناخالص / زیانِ ناخالص" value={<><span style={{ color: TH.up }}>{fmtNum(result.grossProfit, 2)}</span> / <span style={{ color: TH.down }}>{fmtNum(result.grossLoss, 2)}</span></>} />
            </div>
          )}

          {sub === 'trades' && (
            <div className="max-w-2xl">
              {/* سرستون */}
              <div className="flex items-center justify-between py-1 border-b text-[10px] opacity-50 sticky top-0" style={{ borderColor: TH.border, background: TH.panel, color: TH.text }}>
                <span>جهت · تاریخ</span>
                <span>بازده</span>
              </div>
              {list.length ? list.slice().reverse().map((tr, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b" style={{ borderColor: TH.border }}>
                  <span className="flex items-center gap-1.5 opacity-70 text-xs" dir="ltr">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: tr.dir === 1 ? TH.up : TH.down }} />
                    {new Date((tr.t || 0) * 1000).toLocaleDateString('fa-IR')}
                  </span>
                  <b className="text-xs tabular-nums" dir="ltr" style={{ color: (tr.r || 0) >= 0 ? TH.up : TH.down }}>
                    {(tr.r || 0) >= 0 ? '+' : ''}{fmtNum(tr.r, 5)}
                  </b>
                </div>
              )) : <div className="opacity-50 py-3 text-xs" style={{ color: TH.text }}>معامله‌ای ثبت نشد.</div>}
            </div>
          )}

          {sub === 'properties' && (
            <div className="max-w-md">
              {properties ? (
                <>
                  {properties.initialCapital != null && <MRow TH={TH} label="سرمایهٔ اولیه" value={fmtNum(properties.initialCapital, 2)} />}
                  {properties.currency != null && <MRow TH={TH} label="واحدِ پول" value={properties.currency} />}
                  {properties.orderSize != null && <MRow TH={TH} label="اندازهٔ سفارش" value={String(properties.orderSize)} />}
                  {properties.pyramiding != null && <MRow TH={TH} label="هرمی‌سازی" value={fmtNum(properties.pyramiding, 0)} />}
                  {properties.commission != null && <MRow TH={TH} label="کارمزد" value={String(properties.commission)} />}
                  {properties.slippage != null && <MRow TH={TH} label="اسلیپیج" value={String(properties.slippage)} />}
                </>
              ) : (
                <p className="text-xs opacity-60 leading-6" style={{ color: TH.text }}>
                  تنظیماتِ بک‌تست (سرمایهٔ اولیه، کارمزد، اسلیپیج و اندازهٔ سفارش) این‌جا نمایش داده می‌شود.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (children) return <div className="h-full overflow-auto" dir="rtl">{children}</div>;

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6" dir="rtl">
      <div className="text-sm font-bold" style={{ color: TH.textStrong }}>تستِ استراتژی</div>
      <p className="text-xs opacity-60 max-w-xs leading-6" style={{ color: TH.text }}>
        یک اسکریپتِ استراتژی بنویسید و «بک‌تست» را بزنید تا نتایجِ کامل
        (منحنیِ سرمایه، جدولِ معاملات و معیارهای عملکرد) این‌جا با عرضِ کامل نمایش داده شود.
      </p>
    </div>
  );
}
