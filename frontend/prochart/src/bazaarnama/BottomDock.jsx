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
  const { size, setSize, dragging, handleProps } = useResizable({
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
          className="absolute left-0 right-0 -top-1 h-2 z-10 group cursor-ns-resize"
          title="کشیدن برای تغییرِ ارتفاع"
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

/*
 * StrategyTesterTab — جای‌گاهِ تبِ «تستِ استراتژی».
 * فعلاً نتیجه‌ای ندارد؛ وقتی والد result بدهد همان را رندر می‌کند،
 * در غیرِ این‌صورت حالتِ خالیِ مودبانه نشان می‌دهد.
 */
export function StrategyTesterTab({ TH, children }) {
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
