import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft } from './tvIcons';

// ContextMenu — منوی راست‌کلیکِ عمومیِ سبکِ TradingView (موارد ۱۱۹–۱۲۲).
// قابلِ استفاده برای چارت / درای / محورِ قیمت‌وزمان / سطحِ قیمت.
//
// امضا:
//   <ContextMenu open x y items onClose TH />
//
// props:
//   open    : boolean            — نمایش/مخفی
//   x, y    : number             — مختصاتِ کلیک (viewport؛ همان clientX/clientY)
//   items   : Item[]             — آیتم‌ها (ساختار پایین)
//   onClose : () => void         — بستن (کلیکِ بیرون / Esc / بعد از انتخاب)
//   TH      : theme tokens        — از BazaarNama (bg/panel/border/popoverBg/…)
//
// Item (یکی از این شکل‌ها):
//   { separator: true }                                  — جداکنندهٔ افقی
//   { header: 'برچسب' }                                  — عنوانِ سکشن (کوچک، کم‌رنگ)
//   { label, icon?, hotkey?, onClick?, disabled?,        — آیتمِ عادی
//     danger?, checked?, submenu? }
//       icon    : ReactNode (آیکونِ lucide با size≈14)
//       label   : string | ReactNode
//       hotkey  : string (سمتِ مقابل، LTR، tabular)  مثل "Alt+A"
//       danger  : boolean → متنِ قرمز (حذف/بستن)
//       checked : boolean → علامتِ تیک (حالتِ فعال، مثل log/%/auto)
//       submenu : Item[]  → فلای‌اوتِ تودرتو (باز‌شدن با hover)
//       onClick : بعد از فراخوانی، منو بسته می‌شود (مگر آیتم submenu باشد)

const MENU_W = 236;      // عرضِ ثابتِ منو (px) — برای clamp/flip
const EST_ROW = 30;      // ارتفاعِ تقریبیِ هر ردیف — برای تخمینِ اولیه پیش از اندازه‌گیری
const EDGE = 8;          // فاصلهٔ ایمن از لبهٔ صفحه

// یک زیرمنو یا منوی ریشه. بازگشتی رندر می‌شود تا submenuها کار کنند.
function MenuPanel({ items, TH, onClose, style, dir = 'rtl', autoClamp = true }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(style || {});
  const [openSub, setOpenSub] = useState(-1);        // ایندکسِ آیتمی که زیرمنویش باز است
  const closeTimer = useRef(null);

  // اندازه‌گیریِ واقعیِ منو و clampِ داخلِ viewport (flip اگر لازم شد).
  useLayoutEffect(() => {
    if (!autoClamp || !ref.current) return;
    const el = ref.current;
    const w = el.offsetWidth || MENU_W;
    const h = el.offsetHeight || (items.length * EST_ROW);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 9999;
    let left = style.left ?? 0;
    let top = style.top ?? 0;
    // flipِ افقی: در RTL منو از راستِ کلیک باز می‌شود؛ اگر جا نبود به چپ.
    if (left + w > vw - EDGE) left = Math.max(EDGE, left - w);
    if (left < EDGE) left = EDGE;
    // flipِ عمودی: اگر پایین جا نبود، بالا برو.
    if (top + h > vh - EDGE) top = Math.max(EDGE, vh - EDGE - h);
    if (top < EDGE) top = EDGE;
    setPos({ left, top });
  }, [style.left, style.top, items, autoClamp]);

  const armClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpenSub(-1), 140); };
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  useEffect(() => () => cancelClose(), []);

  const rowBase = 'flex items-center gap-2.5 w-full text-right rounded select-none transition-colors duration-[120ms]';

  return (
    <div
      ref={ref}
      dir={dir}
      className="fixed z-[81] p-1 text-[12.5px]"
      style={{
        ...pos,
        width: MENU_W,
        background: TH.popoverBg,
        border: `1px solid ${TH.border}`,
        borderRadius: 6,
        color: TH.text,
        boxShadow: '0 2px 4px rgba(0,0,0,.2), 0 6px 16px -4px rgba(0,0,0,.32)',
        backdropFilter: 'saturate(1.05)',
        animation: 'pcScreenIn .1s ease-out both',
        transformOrigin: 'top right',
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {items.map((it, i) => {
        if (!it) return null;
        if (it.separator) return <div key={i} className="my-1 mx-1 border-t" style={{ borderColor: TH.border }} />;
        if (it.header != null) return (
          <div key={i} className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold tracking-wide truncate" style={{ color: TH.textStrong, opacity: 0.72 }} dir={it.headerDir || dir}>
            {it.header}
          </div>
        );

        const disabled = !!it.disabled;
        const danger = !!it.danger;
        const hasSub = Array.isArray(it.submenu) && it.submenu.length > 0;
        const color = disabled ? TH.text : danger ? TH.down : TH.textStrong;
        const isSubOpen = openSub === i;

        const activate = () => {
          if (disabled) return;
          if (hasSub) { setOpenSub((v) => (v === i ? -1 : i)); return; }
          try { it.onClick && it.onClick(); } finally { onClose && onClose(); }
        };

        return (
          <div key={i} className="relative"
            onMouseEnter={() => { cancelClose(); if (hasSub) setOpenSub(i); else setOpenSub(-1); }}
            onMouseLeave={() => { if (hasSub) armClose(); }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={activate}
              className={`${rowBase} px-2.5 py-1.5 ${disabled ? 'cursor-default' : ''}`}
              style={{ color, minHeight: 30, opacity: disabled ? 0.42 : 1, background: isSubOpen ? TH.chipBg : 'transparent' }}
              onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = TH.chipBg; }}
              onMouseLeave={(e) => { if (!disabled && !isSubOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* آیکون (یا جای‌گیرِ هم‌عرض تا برچسب‌ها هم‌تراز بمانند) */}
              <span className="shrink-0 flex items-center justify-center" style={{ width: 16, color: danger && !disabled ? TH.down : TH.text }}>
                {it.checked ? <Check size={14} style={{ color: TH.accent }} /> : (it.icon || null)}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {/* هاتکی یا فلشِ زیرمنو در سمتِ مقابل */}
              {hasSub ? (
                <ChevronLeft size={14} className="shrink-0" style={{ opacity: 0.6 }} />
              ) : it.hotkey ? (
                <span className="shrink-0 tabular-nums text-[11px] tracking-wide" dir="ltr" style={{ color: TH.text, opacity: 0.55 }}>{it.hotkey}</span>
              ) : null}
            </button>

            {/* فلای‌اوتِ زیرمنو — کنارِ آیتم (RTL: سمتِ چپ) با flipِ خودکار */}
            {hasSub && isSubOpen && (
              <div onMouseEnter={cancelClose} onMouseLeave={armClose}>
                <SubFlyout parentRef={ref} rowIndex={i} items={it.submenu} TH={TH} onClose={onClose} dir={dir} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// زیرمنو: موقعیتش را نسبت به ردیفِ والد حساب می‌کند (fixed، با flip).
function SubFlyout({ parentRef, rowIndex, items, TH, onClose, dir }) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    const rows = parent.querySelectorAll(':scope > div');
    const row = rows[rowIndex];
    const rr = row ? row.getBoundingClientRect() : pr;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
    // پیش‌فرضِ RTL: زیرمنو سمتِ چپِ والد؛ اگر جا نبود، سمتِ راست.
    let left = pr.left - MENU_W + 2;
    if (left < EDGE) left = pr.right - 2;
    if (left + MENU_W > vw - EDGE) left = Math.max(EDGE, vw - EDGE - MENU_W);
    const top = rr.top - 5;
    setStyle({ left, top });
  }, [parentRef, rowIndex]);
  if (!style) return null;
  return <MenuPanel items={items} TH={TH} onClose={onClose} style={style} dir={dir} />;
}

export default function ContextMenu({ open, x, y, items, onClose, TH }) {
  // بستن با Esc / اسکرول / تغییرِ اندازهٔ پنجره.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose(); } };
    const onScroll = () => onClose && onClose();
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', onScroll, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', onScroll);
    };
  }, [open, onClose]);

  if (!open || !Array.isArray(items) || items.length === 0) return null;

  // لایهٔ تمام‌صفحه: کلیکِ بیرون یا راست‌کلیکِ دوباره → بستن.
  return (
    <div
      className="fixed inset-0 z-[80]"
      style={{ background: 'transparent' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      onContextMenu={(e) => { e.preventDefault(); onClose && onClose(); }}
    >
      <MenuPanel items={items} TH={TH} onClose={onClose} style={{ left: x, top: y }} />
    </div>
  );
}
