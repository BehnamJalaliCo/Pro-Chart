// بازارنما — نوارِ ابزارِ ترسیمِ گروه‌بندی‌شده (سبکِ TradingView).
// ─────────────────────────────────────────────────────────────────────────────
// به‌جای ریختنِ ۵۲ ابزار در یک اسکرولِ عمودیِ تخت، اینجا ~۱۰ آیکونِ «گروه» داریم.
// هر گروه با hover یا کلیک یک فلای‌اوتِ راست‌بازشونده باز می‌کند که ابزارهای آن گروه
// را به‌صورتِ ردیف‌های برچسب‌دار (آیکونِ کوچک + متنِ فارسی) فهرست می‌کند.
// کلیکِ روی یک ردیف → setTool(id) را صدا می‌زند، آن را به‌عنوانِ ابزارِ به‌خاطرسپرده‌شدهٔ
// گروه ثبت می‌کند و فلای‌اوت بسته می‌شود. کلیکِ بیرون یا انتخاب، فلای‌اوت را می‌بندد.
//
// ارتقاهای پریتیِ TV:
//   • نوارِ منتخب‌ها (Favorites): ابزارهای پین‌شده در بالای ریل به‌صورتِ دکمهٔ مستقیم؛
//     پین/آنپین با ستارهٔ درونِ ردیف‌ها، ماندگار در localStorage.
//   • تولتیپِ نامِ فارسی + هاتکی روی گروه‌ها و ردیف‌ها.
//   • تراکمِ ۳۸px، شعاعِ ۴px، هاور/اکتیوِ tinted (accent با شفافیت) به‌جای پُرکردنِ سخت.
//   • تاگلِ اختیاریِ آهنربا (magnet) — فقط اگر onToggleMagnet پاس داده شود رندر می‌شود.
//
// همهٔ idها واقعی‌اند و دقیقاً متناظرِ TOOLS (در BazaarNama.jsx) و EXT_REGISTRY/EXT_TOOLS
// (در drawtools_ext.js) هستند؛ پس setTool(id) مستقیماً کار می‌کند.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle, Star, Magnet, Lock, LockOpen, Eye, EyeOff, Trash2, PenLine, Check } from 'lucide-react';
import { GLYPH, GROUP_GLYPH } from './glyphs';
import { getHelp } from './help';

// کلیدِ ماندگاریِ ابزارهای پین‌شده.
const FAV_KEY = 'brn.toolrail.favorites';
// کلیدهای ماندگاریِ کنترل‌های پایینِ ریل (وقتی از بیرون کنترل نشوند).
const MAG_MODE_KEY = 'brn.toolrail.magnetMode'; // 'weak' | 'strong'
const STAY_KEY = 'brn.toolrail.stayInDrawing';

// هاتکیِ خواناشدهٔ هر ابزار (هم‌سطح با تعاریفِ hotkeys.js) — برای نمایش در تولتیپ.
const HOTKEY = {
  trend: 'Alt+T', hline: 'Alt+H', vline: 'Alt+V', ray: 'Alt+R',
  rect: 'Alt+E', fib: 'Alt+F', channel: 'Alt+P', text: 'Alt+X',
  longshort: 'Alt+L',
};
// هاتکیِ آهنربا (هم‌سطح با hotkeys.js).
const HOTKEY_MAGNET = 'Ctrl+Alt+M';

// چِورونِ کوچکِ درون‌خطی (جایگزینِ lucide ChevronRight) برای نشانهٔ ابزارِ فعال.
function MiniChevron({ size = 13, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// تعریفِ ۹ گروه + ابزارهایشان. هر ابزار {id, label}. آیکون از GLYPH خوانده می‌شود.
const GROUPS = [
  {
    key: 'cursors', label: 'نشانگرها',
    tools: [
      { id: 'cursor', label: 'نشانگر' },
      { id: 'select', label: 'انتخاب/ویرایش' },
    ],
  },
  {
    key: 'lines', label: 'خطوط',
    tools: [
      { id: 'trend', label: 'خط روند' },
      { id: 'ray', label: 'پرتو' },
      { id: 'extline', label: 'خطِ امتداد‌یافته' },
      { id: 'hray', label: 'پرتوِ افقی' },
      { id: 'hline', label: 'خط افقی' },
      { id: 'vline', label: 'خط عمودی' },
      { id: 'crossline', label: 'خطِ صلیبی' },
      { id: 'angle', label: 'زاویهٔ روند' },
      { id: 'infoline', label: 'خطِ اطلاعاتی' },
    ],
  },
  {
    key: 'channels', label: 'کانال‌ها',
    tools: [
      { id: 'channel', label: 'کانالِ موازی' },
      { id: 'pitchfork', label: 'چنگالِ اندروز' },
    ],
  },
  {
    key: 'fib', label: 'فیبوناچی',
    tools: [
      { id: 'fib', label: 'فیبوناچی' },
      { id: 'fibext', label: 'فیبوی گسترشی' },
      { id: 'fib3', label: 'فیبوی ۳نقطه' },
      { id: 'fibfan', label: 'بادبزنِ فیبو' },
      { id: 'fibtime', label: 'زمانیِ فیبو' },
      { id: 'fibtimeext', label: 'زمانیِ روندی' },
      { id: 'fibchannel', label: 'کانالِ فیبو' },
      { id: 'fibcircles', label: 'دایره‌های فیبو' },
      { id: 'fibarcs', label: 'کمان‌های فیبو' },
    ],
  },
  {
    key: 'gann', label: 'گان',
    tools: [
      { id: 'gannbox', label: 'جعبهٔ گان' },
      { id: 'gannfan', label: 'بادبزنِ گان' },
    ],
  },
  {
    key: 'patterns', label: 'الگوها',
    tools: [
      { id: 'xabcd', label: 'XABCD' },
      { id: 'abcd', label: 'ABCD' },
      { id: 'cypher', label: 'سایفر' },
      { id: 'tripattern', label: 'مثلثِ الگو' },
      { id: 'hns', label: 'سر و شانه' },
      { id: 'ell_impulse', label: 'ایمپالسِ الیوت' },
      { id: 'ell_abc', label: 'اصلاحیِ الیوت' },
      { id: 'triangle', label: 'مثلث' },
    ],
  },
  {
    key: 'projection', label: 'پروجکشن و اندازه‌گیری',
    tools: [
      { id: 'longshort', label: 'لانگ/شورت' },
      { id: 'pricerange', label: 'بازهٔ قیمت' },
      { id: 'daterange', label: 'بازهٔ زمان' },
      { id: 'dprange', label: 'قیمت و زمان' },
      { id: 'forecast', label: 'پیش‌بینی' },
      { id: 'ruler', label: 'خط‌کش' },
      { id: 'cyclic', label: 'خطوطِ دوره‌ای' },
      { id: 'sine', label: 'خطِ سینوسی' },
    ],
  },
  {
    key: 'shapes', label: 'اشکال',
    tools: [
      { id: 'rect', label: 'مستطیل' },
      { id: 'rotrect', label: 'مستطیلِ چرخیده' },
      { id: 'circle', label: 'دایره' },
      { id: 'ellipse', label: 'بیضی' },
      { id: 'arrow', label: 'پیکان' },
      { id: 'brush', label: 'قلم‌موی آزاد' },
      { id: 'highlighter', label: 'های‌لایتر' },
    ],
  },
  {
    key: 'annotations', label: 'یادداشت‌ها',
    tools: [
      { id: 'text', label: 'متن' },
      { id: 'callout', label: 'کال‌اوت' },
      { id: 'pricelabel', label: 'برچسبِ قیمت' },
      { id: 'note', label: 'یادداشت' },
      { id: 'arrowdir', label: 'پیکانِ جهت‌دار' },
    ],
  },
];

// idِ ابزار → کلیدِ گروهی که شاملش است (برای تشخیصِ گروهِ فعال).
const TOOL_GROUP = (() => {
  const m = {};
  GROUPS.forEach((g) => g.tools.forEach((t) => { m[t.id] = g.key; }));
  return m;
})();

// idِ ابزار → برچسبِ فارسی‌اش (برای منتخب‌ها و تولتیپ).
const TOOL_LABEL = (() => {
  const m = {};
  GROUPS.forEach((g) => g.tools.forEach((t) => { m[t.id] = t.label; }));
  return m;
})();

// گلیفِ یک ابزار؛ در نبودِ آن به گلیفِ گروهش یا «نشانگر» برمی‌گردد.
const ICON_FOR = (id) => GLYPH[id] || GROUP_GLYPH[TOOL_GROUP[id]] || GLYPH.cursor;

// تولتیپِ خوانا: «نامِ فارسی · هاتکی».
const TIP = (id, label) => (HOTKEY[id] ? `${label} · ${HOTKEY[id]}` : label);

// هکسِ توکنِ تم → rgba با شفافیتِ دلخواه (بدونِ hard-code؛ از TH.accent مشتق می‌شود).
function tint(hex, a) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${a})`;
}

// سبکِ پایهٔ سلولِ ریل (سبکِ TV): سلولِ ۴۰px با آیکونِ ۲۰px، اما هایلایتِ اکتیو/هاور
// به‌صورتِ مربعِ گِردِ «اینست» رندر می‌شود (نه پُرکردنِ تمامِ سلول) — با بوردرِ شفافِ ۴px
// و backgroundClip:padding-box، پس پس‌زمینه فقط داخلِ ۳۲px با شعاعِ ۸px دیده می‌شود.
// آیکون همچنان دقیقاً در مرکزِ سلولِ ۴۰px می‌ماند (بوردر متقارن است).
const CELL = {
  width: 40,
  height: 40,
  border: '4px solid transparent',
  backgroundClip: 'padding-box',
  borderRadius: 8,
};

export default function ToolRail({
  tool, setTool, TH, onHelp,
  // آهنربا: هم روشن/خاموش، هم شدتِ weak/strong (سبکِ TV).
  magnet, onToggleMagnet, magnetMode, onSetMagnetMode,
  // «ماندن در حالتِ ترسیم» (قفلِ ابزار؛ بعد از کشیدن، ابزار فعال می‌ماند).
  stayInDrawing, onToggleStayInDrawing,
  // قفلِ همه / مخفیِ همهٔ ترسیم‌ها + حذفِ همه.
  allLocked, onLockAll, allHidden, onHideAll, onRemoveAll,
}) {
  // ابزارِ «به‌خاطرسپرده‌شده» برای هر گروه (پیش‌فرض: اولین ابزارِ گروه).
  const [remembered, setRemembered] = useState(() => {
    const m = {};
    GROUPS.forEach((g) => { m[g.key] = g.tools[0].id; });
    return m;
  });
  // ابزارهای پین‌شده (Favorites) — ماندگار در localStorage.
  const [pinned, setPinned] = useState(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) return arr.filter((id) => TOOL_LABEL[id]);
    } catch (e) { /* بی‌اعتنا */ }
    return [];
  });
  // کلیدِ گروهی که فلای‌اوتش باز است (یا null).
  const [openKey, setOpenKey] = useState(null);
  // تولتیپِ TV: پیلِ تاریکِ راست‌ایستا با نام + هاتکی (فقط برای دکمه‌های بدونِ فلای‌اوت).
  const [tip, setTip] = useState(null); // { top, label, hotkey }
  // آیا فلای‌اوتِ کوچکِ شدتِ آهنربا (weak/strong) باز است.
  const [magMenu, setMagMenu] = useState(false);
  const rootRef = useRef(null);
  const hoverTimer = useRef(null);

  // ── کنترل‌های پایینِ ریل: controlled از بیرون یا fallbackِ داخلی (ماندگار). ──
  // آهنربا (روشن/خاموش): اگر prop تعریف شده باشد controlled است.
  const magnetControlled = magnet !== undefined;
  const [magnetLocal, setMagnetLocal] = useState(false);
  const magnetOn = magnetControlled ? !!magnet : magnetLocal;
  // شدتِ آهنربا: controlled با magnetMode، وگرنه داخلیِ ماندگار.
  const magModeControlled = magnetMode !== undefined;
  const [magModeLocal, setMagModeLocal] = useState(() => {
    try { const v = localStorage.getItem(MAG_MODE_KEY); if (v === 'weak' || v === 'strong') return v; } catch (e) { /* بی‌اعتنا */ }
    return 'weak';
  });
  const magMode = magModeControlled ? magnetMode : magModeLocal;
  // ماندن در حالتِ ترسیم.
  const stayControlled = stayInDrawing !== undefined;
  const [stayLocal, setStayLocal] = useState(() => {
    try { return localStorage.getItem(STAY_KEY) === '1'; } catch (e) { return false; }
  });
  const stayOn = stayControlled ? !!stayInDrawing : stayLocal;
  // قفلِ همه / مخفیِ همه.
  const lockControlled = allLocked !== undefined;
  const [lockLocal, setLockLocal] = useState(false);
  const lockOn = lockControlled ? !!allLocked : lockLocal;
  const hideControlled = allHidden !== undefined;
  const [hideLocal, setHideLocal] = useState(false);
  const hideOn = hideControlled ? !!allHidden : hideLocal;

  // کنترل‌های پایینِ ریل فقط وقتی رندر می‌شوند که از بیرون وصل شده باشند.
  // در نبودِ وصل‌شدن، BazaarNama نسخهٔ خودش را نشان می‌دهد؛ این گِیت جلوی «دوتا روی هم» را می‌گیرد.
  const showMagnet = typeof onToggleMagnet === 'function' || magnet !== undefined;
  const showStay = typeof onToggleStayInDrawing === 'function' || stayInDrawing !== undefined;
  const showLock = typeof onLockAll === 'function' || allLocked !== undefined;
  const showHide = typeof onHideAll === 'function' || allHidden !== undefined;
  const showRemove = typeof onRemoveAll === 'function';
  const showBottom = showMagnet || showStay || showLock || showHide || showRemove;

  const accentTint = tint(TH.accent, 0.14);

  // گروهی که ابزارِ فعالِ فعلی در آن است.
  const activeGroup = TOOL_GROUP[tool] || null;

  // وقتی ابزارِ فعال از بیرون عوض شد، آن را به‌عنوانِ ابزارِ به‌خاطرسپرده‌شدهٔ گروهش ثبت کن.
  useEffect(() => {
    const gk = TOOL_GROUP[tool];
    if (gk) setRemembered((prev) => (prev[gk] === tool ? prev : { ...prev, [gk]: tool }));
  }, [tool]);

  // ماندگاریِ منتخب‌ها.
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(pinned)); } catch (e) { /* بی‌اعتنا */ }
  }, [pinned]);

  // بستن با کلیکِ بیرون.
  useEffect(() => {
    if (!openKey) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpenKey(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openKey]);

  // بستنِ منوی شدتِ آهنربا با کلیکِ بیرون یا Escape.
  useEffect(() => {
    if (!magMenu) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setMagMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMagMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [magMenu]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const pick = useCallback((groupKey, id) => {
    setRemembered((prev) => ({ ...prev, [groupKey]: id }));
    setTool(id);
    setOpenKey(null);
  }, [setTool]);

  const togglePin = useCallback((id) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // ── هندلرهای کنترل‌های پایین (هم callbackِ بیرونی را صدا می‌زنند، هم fallbackِ داخلی را). ──
  const toggleMagnet = useCallback((next) => {
    if (typeof onToggleMagnet === 'function') onToggleMagnet(next);
    if (!magnetControlled) setMagnetLocal(next);
  }, [onToggleMagnet, magnetControlled]);

  const setMode = useCallback((mode) => {
    if (typeof onSetMagnetMode === 'function') onSetMagnetMode(mode);
    if (!magModeControlled) {
      setMagModeLocal(mode);
      try { localStorage.setItem(MAG_MODE_KEY, mode); } catch (e) { /* بی‌اعتنا */ }
    }
    // انتخابِ شدت، آهنربا را روشن می‌کند (رفتارِ TV).
    if (!magnetOn) toggleMagnet(true);
    setMagMenu(false);
  }, [onSetMagnetMode, magModeControlled, magnetOn, toggleMagnet]);

  const toggleStay = useCallback((next) => {
    if (typeof onToggleStayInDrawing === 'function') onToggleStayInDrawing(next);
    if (!stayControlled) {
      setStayLocal(next);
      try { localStorage.setItem(STAY_KEY, next ? '1' : '0'); } catch (e) { /* بی‌اعتنا */ }
    }
  }, [onToggleStayInDrawing, stayControlled]);

  const toggleLockAll = useCallback((next) => {
    if (typeof onLockAll === 'function') onLockAll(next);
    if (!lockControlled) setLockLocal(next);
  }, [onLockAll, lockControlled]);

  const toggleHideAll = useCallback((next) => {
    if (typeof onHideAll === 'function') onHideAll(next);
    if (!hideControlled) setHideLocal(next);
  }, [onHideAll, hideControlled]);

  const removeAll = useCallback(() => {
    if (typeof onRemoveAll === 'function') onRemoveAll();
  }, [onRemoveAll]);

  // نمایشِ تولتیپِ راست‌ایستا؛ Y را از offsetTopِ خودِ دکمه (نسبت به ریلِ relative) می‌گیرد.
  const showTip = useCallback((e, label, hotkey) => {
    const el = e.currentTarget;
    // Y را نسبت به ریشهٔ relative می‌گیریم (نه offsetParent) تا برای دکمه‌های تودرتو هم درست باشد.
    const rootRect = rootRef.current ? rootRef.current.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    const top = rootRect ? (r.top - rootRect.top + r.height / 2) : (el.offsetTop + el.offsetHeight / 2);
    setTip({ top, label, hotkey: hotkey || '' });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  const openOn = useCallback((key) => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setOpenKey(key);
  }, []);
  const scheduleClose = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenKey(null), 180);
  }, []);

  // جداکنندهٔ گروه‌ها (سبکِ TV): خطِ نازکِ تمام‌عرض با فاصلهٔ عمودیِ اندک.
  const Divider = () => (
    <div className="shrink-0 my-1" style={{ width: 26, height: 1, background: TH.border, opacity: 0.7 }} />
  );

  return (
    <div
      ref={rootRef}
      dir="ltr"
      className="relative flex flex-col items-center justify-start gap-0.5 w-full h-full overflow-visible py-2"
      onMouseLeave={hideTip}
    >
      <style>{`@keyframes brn-tip-in{from{opacity:0;transform:translate(4px,-50%)}to{opacity:1;transform:translate(0,-50%)}}`}</style>

      {/* نوارِ منتخب‌ها (Favorites) — ابزارهای پین‌شده به‌صورتِ دکمهٔ مستقیم. */}
      {pinned.length > 0 && (
        <>
          {pinned.map((id) => {
            const FavIcon = ICON_FOR(id);
            const active = tool === id;
            const label = TOOL_LABEL[id] || id;
            return (
              <button
                key={`fav-${id}`}
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => { hideTip(); setTool(id); }}
                className="relative flex items-center justify-center rounded"
                style={{
                  ...CELL,
                  background: active ? accentTint : 'transparent',
                  color: active ? TH.accent : TH.text,
                  transition: 'background-color 120ms ease, color 120ms ease',
                }}
                onMouseEnter={(e) => showTip(e, `★ ${label}`, HOTKEY[id])}
                onMouseLeave={hideTip}
                onMouseOver={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <FavIcon size={20} />
                {/* نشانهٔ ریزِ منتخب: ستارهٔ کوچک در گوشهٔ بالا-چپ */}
                <Star size={8} className="absolute top-1 left-1 pointer-events-none" fill="currentColor"
                  style={{ color: TH.accent, opacity: active ? 0.9 : 0.55 }} />
              </button>
            );
          })}
          <Divider />
        </>
      )}

      {GROUPS.map((g) => {
        const shownId = remembered[g.key] || g.tools[0].id;
        const Icon = ICON_FOR(shownId);
        const isActiveGroup = activeGroup === g.key;
        const isOpen = openKey === g.key;
        // دکمهٔ غیرفعال: ~۷۰٪ شفافیت، با hover به ۱۰۰٪ می‌رسد (انتقالِ ۱۲۰میلی‌ثانیه).
        const inactiveDim = !isActiveGroup && !isOpen;
        return (
          <div
            key={g.key}
            className="relative shrink-0 flex justify-center"
            onMouseEnter={() => { hideTip(); openOn(g.key); }}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              aria-label={g.label}
              aria-pressed={isActiveGroup}
              title={TIP(shownId, `${TOOL_LABEL[shownId] || g.label} — ${g.label}`)}
              onClick={() => (isOpen ? setOpenKey(null) : openOn(g.key))}
              className="relative flex items-center justify-center rounded"
              style={{
                ...CELL,
                // اکتیوِ tinted (accent با شفافیت) به‌جای پُرکردنِ سختِ آبی — پریتیِ TV.
                background: isActiveGroup ? accentTint : (isOpen ? TH.chipBgHover : 'transparent'),
                color: isActiveGroup ? TH.accent : TH.text,
                opacity: inactiveDim ? 0.7 : 1,
                transition: 'background-color 120ms ease, opacity 120ms ease, color 120ms ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = '1';
                if (!isActiveGroup && !isOpen) e.currentTarget.style.background = TH.chipBgHover;
              }}
              onMouseOut={(e) => {
                if (inactiveDim) e.currentTarget.style.opacity = '0.7';
                if (!isActiveGroup && !isOpen) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={20} />
              {/* مثلثِ فلای‌اوت — فقط روی گروه‌هایی که واقعاً چند ابزار دارند (سبکِ TV). */}
              {g.tools.length > 1 && (
                <span
                  className="absolute bottom-1 right-1 w-0 h-0 pointer-events-none"
                  style={{
                    borderLeft: '3px solid transparent',
                    borderTop: `3px solid ${isActiveGroup ? TH.accent : TH.text}`,
                    opacity: isActiveGroup ? 0.85 : 0.45,
                  }}
                />
              )}
            </button>

            {isOpen && (
              <div
                dir="rtl"
                className="absolute top-0 left-full ml-1.5 z-50 rounded-md overflow-hidden py-1 origin-left"
                style={{
                  background: TH.popoverBg,
                  border: `1px solid ${TH.border}`,
                  boxShadow: '0 6px 22px -6px rgba(0,0,0,.45), 0 2px 6px -2px rgba(0,0,0,.30)',
                  minWidth: 208,
                  animation: 'brn-flyout-in 120ms ease-out both',
                }}
                onMouseEnter={() => openOn(g.key)}
                onMouseLeave={scheduleClose}
              >
                <style>{`@keyframes brn-flyout-in{from{opacity:0;transform:translateX(-4px) scale(.98)}to{opacity:1;transform:none}}`}</style>
                {/* سرتیترِ کم‌رنگِ گروه (TH.text با ۵۰٪ شفافیت). */}
                <div
                  className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider select-none"
                  style={{ color: TH.text, opacity: 0.5 }}
                >
                  {g.label}
                </div>
                {g.tools.map((t) => {
                  const RowIcon = ICON_FOR(t.id);
                  const active = tool === t.id;
                  const isPinned = pinned.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pick(g.key, t.id)}
                      title={TIP(t.id, t.label)}
                      className="group/row w-full flex items-center gap-2.5 px-3 text-[12px] text-right"
                      style={{
                        height: 28,
                        // اکتیوِ tinted هم‌راستا با گروه.
                        background: active ? accentTint : 'transparent',
                        color: active ? TH.accent : TH.textStrong,
                        transition: 'background-color 120ms ease, color 120ms ease',
                      }}
                      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <RowIcon size={16} className="shrink-0" style={{ opacity: active ? 1 : 0.8 }} />
                      <span className="flex-1 whitespace-nowrap leading-none">{t.label}</span>
                      {HOTKEY[t.id] && (
                        <span dir="ltr" className="shrink-0 text-[10px] tabular-nums opacity-45 tnum">{HOTKEY[t.id]}</span>
                      )}
                      {active && <MiniChevron size={13} className="shrink-0 opacity-80" />}
                      {/* پین/آنپینِ منتخب‌ها */}
                      <span
                        role="button"
                        title={isPinned ? 'برداشتن از منتخب‌ها' : 'افزودن به منتخب‌ها'}
                        onClick={(e) => { e.stopPropagation(); togglePin(t.id); }}
                        className="shrink-0"
                        style={{ cursor: 'pointer', color: isPinned ? TH.accent : 'currentColor', opacity: isPinned ? 0.95 : 0.4 }}
                      >
                        <Star size={12} fill={isPinned ? 'currentColor' : 'none'} />
                      </span>
                      {onHelp && getHelp(t.id) && (
                        <span role="button" title="راهنمای این ابزار" onClick={(e) => { e.stopPropagation(); onHelp(t.id); }} className="shrink-0 opacity-40 hover:opacity-100" style={{ cursor: 'pointer' }}><HelpCircle size={12} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── کنترل‌های پایینِ ریل (سبکِ TV): آهنربا/شدت · ماندن در ترسیم · قفلِ همه · مخفیِ همه · حذفِ همه ──
          فقط وقتی رندر می‌شوند که از بیرون وصل شده باشند (وگرنه با کنترل‌های لگاسیِ BazaarNama دوتایی می‌شد). */}
      {showBottom && <Divider />}

      {/* آهنربا (Magnet) — کلیک روی دکمه روشن/خاموش؛ کاراتِ گوشه، منوی شدتِ weak/strong. */}
      {showMagnet && (
      <div
        className="relative shrink-0 flex justify-center"
        onMouseLeave={hideTip}
      >
        <button
          type="button"
          aria-label="آهنربا (Magnet) — چسبیدن به OHLC"
          aria-pressed={magnetOn}
          onClick={() => { hideTip(); toggleMagnet(!magnetOn); }}
          className="relative flex items-center justify-center rounded"
          style={{
            ...CELL,
            background: magnetOn ? accentTint : (magMenu ? TH.chipBgHover : 'transparent'),
            color: magnetOn ? TH.accent : TH.text,
            transition: 'background-color 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => showTip(e, `آهنربا — چسبیدن به OHLC (${magMode === 'strong' ? 'قوی' : 'ضعیف'})`, HOTKEY_MAGNET)}
          onMouseLeave={hideTip}
          onMouseOver={(e) => { if (!magnetOn && !magMenu) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseOut={(e) => { if (!magnetOn && !magMenu) e.currentTarget.style.background = 'transparent'; }}
        >
          <Magnet size={20} />
          {/* کاراتِ منوی شدت — کلیکِ جدا از تاگلِ اصلی. */}
          <span
            role="button"
            aria-label="شدتِ آهنربا"
            onClick={(e) => { e.stopPropagation(); hideTip(); setMagMenu((v) => !v); }}
            className="absolute bottom-0.5 right-0.5 w-0 h-0 pointer-events-auto"
            style={{
              borderLeft: '3.5px solid transparent',
              borderTop: `3.5px solid ${magnetOn ? TH.accent : TH.text}`,
              opacity: magnetOn ? 0.9 : 0.5,
              cursor: 'pointer',
            }}
          />
        </button>

        {magMenu && (
          <div
            dir="rtl"
            className="absolute bottom-0 left-full ml-1.5 z-50 rounded-md overflow-hidden py-1 origin-left"
            style={{
              background: TH.popoverBg,
              border: `1px solid ${TH.border}`,
              boxShadow: '0 6px 22px -6px rgba(0,0,0,.45), 0 2px 6px -2px rgba(0,0,0,.30)',
              minWidth: 176,
              animation: 'brn-flyout-in 120ms ease-out both',
            }}
          >
            <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider select-none" style={{ color: TH.text, opacity: 0.5 }}>
              شدتِ آهنربا
            </div>
            {[
              { m: 'weak', label: 'آهنربای ضعیف', hint: 'فقط نزدیکِ کندل' },
              { m: 'strong', label: 'آهنربای قوی', hint: 'همیشه به OHLC' },
            ].map(({ m, label, hint }) => {
              const on = magMode === m && magnetOn;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="w-full flex items-center gap-2.5 px-3 text-[12px] text-right"
                  style={{
                    height: 30,
                    background: on ? accentTint : 'transparent',
                    color: on ? TH.accent : TH.textStrong,
                    transition: 'background-color 120ms ease, color 120ms ease',
                  }}
                  onMouseOver={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                  onMouseOut={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Magnet size={14} className="shrink-0" style={{ opacity: m === 'strong' ? 1 : 0.7 }} />
                  <span className="flex-1 flex flex-col leading-tight">
                    <span className="whitespace-nowrap">{label}</span>
                    <span className="text-[10px] opacity-50 whitespace-nowrap">{hint}</span>
                  </span>
                  {on && <Check size={13} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ماندن در حالتِ ترسیم (Stay in Drawing Mode) — بعد از کشیدن، ابزار فعال می‌ماند. */}
      {showStay && (
      <button
        type="button"
        aria-label="ماندن در حالتِ ترسیم"
        aria-pressed={stayOn}
        onClick={() => { hideTip(); toggleStay(!stayOn); }}
        className="relative shrink-0 flex items-center justify-center rounded"
        style={{
          ...CELL,
          background: stayOn ? accentTint : 'transparent',
          color: stayOn ? TH.accent : TH.text,
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => showTip(e, 'ماندن در حالتِ ترسیم')}
        onMouseLeave={hideTip}
        onMouseOver={(e) => { if (!stayOn) e.currentTarget.style.background = TH.chipBgHover; }}
        onMouseOut={(e) => { if (!stayOn) e.currentTarget.style.background = 'transparent'; }}
      >
        <PenLine size={20} />
      </button>
      )}

      {(showLock || showHide || showRemove) && <Divider />}

      {/* قفلِ همهٔ ترسیم‌ها (Lock All Drawings). */}
      {showLock && (
      <button
        type="button"
        aria-label="قفلِ همهٔ ترسیم‌ها"
        aria-pressed={lockOn}
        onClick={() => { hideTip(); toggleLockAll(!lockOn); }}
        className="relative shrink-0 flex items-center justify-center rounded"
        style={{
          ...CELL,
          background: lockOn ? accentTint : 'transparent',
          color: lockOn ? TH.accent : TH.text,
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => showTip(e, lockOn ? 'بازکردنِ قفلِ همه' : 'قفلِ همهٔ ترسیم‌ها')}
        onMouseLeave={hideTip}
        onMouseOver={(e) => { if (!lockOn) e.currentTarget.style.background = TH.chipBgHover; }}
        onMouseOut={(e) => { if (!lockOn) e.currentTarget.style.background = 'transparent'; }}
      >
        {lockOn ? <Lock size={20} /> : <LockOpen size={20} />}
      </button>
      )}

      {/* مخفیِ همهٔ ترسیم‌ها (Hide All Drawings) — چشم. */}
      {showHide && (
      <button
        type="button"
        aria-label="نمایش/مخفیِ همهٔ ترسیم‌ها"
        aria-pressed={hideOn}
        onClick={() => { hideTip(); toggleHideAll(!hideOn); }}
        className="relative shrink-0 flex items-center justify-center rounded"
        style={{
          ...CELL,
          background: hideOn ? accentTint : 'transparent',
          color: hideOn ? TH.accent : TH.text,
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => showTip(e, hideOn ? 'نمایشِ همهٔ ترسیم‌ها' : 'مخفیِ همهٔ ترسیم‌ها')}
        onMouseLeave={hideTip}
        onMouseOver={(e) => { if (!hideOn) e.currentTarget.style.background = TH.chipBgHover; }}
        onMouseOut={(e) => { if (!hideOn) e.currentTarget.style.background = 'transparent'; }}
      >
        {hideOn ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      )}

      {/* حذفِ همهٔ ترسیم‌ها (Remove Drawings) — سطلِ قرمز. */}
      {showRemove && (
      <button
        type="button"
        aria-label="حذفِ همهٔ ترسیم‌ها"
        onClick={() => { hideTip(); removeAll(); }}
        className="relative shrink-0 flex items-center justify-center rounded"
        style={{
          ...CELL,
          background: 'transparent',
          color: TH.text,
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
        onMouseEnter={(e) => showTip(e, 'حذفِ همهٔ ترسیم‌ها')}
        onMouseLeave={hideTip}
        onMouseOver={(e) => { e.currentTarget.style.background = TH.chipBgHover; e.currentTarget.style.color = '#f6465d'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}
      >
        <Trash2 size={20} />
      </button>
      )}

      {/* تولتیپِ TV — پیلِ راست‌ایستا با نام + هاتکی؛ Y هم‌ترازِ مرکزِ دکمهٔ اشاره‌شده. */}
      {tip && (
        <div
          dir="rtl"
          className="absolute left-full ml-2 z-[60] pointer-events-none flex items-center gap-1.5 rounded-md px-2 py-1 whitespace-nowrap"
          style={{
            top: tip.top,
            transform: 'translateY(-50%)',
            background: TH.popoverBg,
            border: `1px solid ${TH.border}`,
            boxShadow: '0 4px 14px -4px rgba(0,0,0,.45), 0 1px 3px -1px rgba(0,0,0,.30)',
            animation: 'brn-tip-in 90ms ease-out both',
          }}
        >
          <span className="text-[11px] leading-none font-medium" style={{ color: TH.textStrong }}>{tip.label}</span>
          {tip.hotkey && (
            <span dir="ltr" className="text-[10px] leading-none tnum tabular-nums rounded px-1 py-0.5"
              style={{ color: TH.text, background: TH.chipBg }}>{tip.hotkey}</span>
          )}
        </div>
      )}
    </div>
  );
}
