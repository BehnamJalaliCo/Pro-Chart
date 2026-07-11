// بازارنما — نوارِ ابزارِ ترسیمِ گروه‌بندی‌شده (سبکِ TradingView).
// ─────────────────────────────────────────────────────────────────────────────
// به‌جای ریختنِ ۵۲ ابزار در یک اسکرولِ عمودیِ تخت، اینجا ~۱۰ آیکونِ «گروه» داریم.
// هر گروه با hover یا کلیک یک فلای‌اوتِ راست‌بازشونده باز می‌کند که ابزارهای آن گروه
// را به‌صورتِ ردیف‌های برچسب‌دار (آیکونِ کوچک + متنِ فارسی) فهرست می‌کند.
// کلیکِ روی یک ردیف → setTool(id) را صدا می‌زند، آن را به‌عنوانِ ابزارِ به‌خاطرسپرده‌شدهٔ
// گروه ثبت می‌کند و فلای‌اوت بسته می‌شود. کلیکِ بیرون یا انتخاب، فلای‌اوت را می‌بندد.
//
// همهٔ idها واقعی‌اند و دقیقاً متناظرِ TOOLS (در BazaarNama.jsx) و EXT_REGISTRY/EXT_TOOLS
// (در drawtools_ext.js) هستند؛ پس setTool(id) مستقیماً کار می‌کند.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle, Star } from 'lucide-react';
import { GLYPH, GROUP_GLYPH } from './glyphs';
import { getHelp } from './help';

// ماندگاریِ ابزارهای منتخبِ ترسیم (Drawing Favorites — مثلِ نوارِ منتخبِ تریدینگ‌ویو)
const FAV_KEY = 'bn_toolfavs';
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') || []; } catch (e) { return []; } };
const saveFavs = (arr) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) { /* noop */ } };

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

// گلیفِ یک ابزار؛ در نبودِ آن به گلیفِ گروهش یا «نشانگر» برمی‌گردد.
const ICON_FOR = (id) => GLYPH[id] || GROUP_GLYPH[TOOL_GROUP[id]] || GLYPH.cursor;
// idِ ابزار → برچسبِ فارسی (برای tooltipِ نوارِ منتخب).
const TOOL_LABEL = (() => { const m = {}; GROUPS.forEach((g) => g.tools.forEach((t) => { m[t.id] = t.label; })); return m; })();

export default function ToolRail({ tool, setTool, TH, onHelp }) {
  // ابزارِ «به‌خاطرسپرده‌شده» برای هر گروه (پیش‌فرض: اولین ابزارِ گروه).
  const [remembered, setRemembered] = useState(() => {
    const m = {};
    GROUPS.forEach((g) => { m[g.key] = g.tools[0].id; });
    return m;
  });
  // ابزارهای منتخب (ستاره‌دار) — بالای نوار به‌صورتِ دسترسیِ سریع نمایش داده می‌شوند.
  const [favs, setFavs] = useState(loadFavs);
  const toggleFav = useCallback((id) => {
    setFavs((prev) => { const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]; saveFavs(next); return next; });
  }, []);
  // کلیدِ گروهی که فلای‌اوتش باز است (یا null).
  const [openKey, setOpenKey] = useState(null);
  const rootRef = useRef(null);
  const hoverTimer = useRef(null);

  // گروهی که ابزارِ فعالِ فعلی در آن است.
  const activeGroup = TOOL_GROUP[tool] || null;

  // وقتی ابزارِ فعال از بیرون عوض شد، آن را به‌عنوانِ ابزارِ به‌خاطرسپرده‌شدهٔ گروهش ثبت کن.
  useEffect(() => {
    const gk = TOOL_GROUP[tool];
    if (gk) setRemembered((prev) => (prev[gk] === tool ? prev : { ...prev, [gk]: tool }));
  }, [tool]);

  // بستن با کلیکِ بیرون.
  useEffect(() => {
    if (!openKey) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpenKey(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpenKey(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openKey]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const pick = useCallback((groupKey, id) => {
    setRemembered((prev) => ({ ...prev, [groupKey]: id }));
    setTool(id);
    setOpenKey(null);
  }, [setTool]);

  const openOn = useCallback((key) => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setOpenKey(key);
  }, []);
  const scheduleClose = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenKey(null), 180);
  }, []);

  return (
    <div
      ref={rootRef}
      dir="ltr"
      className="relative flex flex-col items-center justify-start gap-1 w-full h-full overflow-visible py-2"
    >
      {/* نوارِ منتخب (Drawing Favorites) — دسترسیِ سریع به ابزارهای ستاره‌دار */}
      {favs.length > 0 && (
        <>
          {favs.map((id) => {
            const FavIcon = ICON_FOR(id);
            const active = tool === id;
            return (
              <button
                key={'fav-' + id}
                type="button"
                title={`منتخب · ${TOOL_LABEL[id] || id}`}
                onClick={() => setTool(id)}
                className="relative flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                style={{ background: active ? TH.accent : 'transparent', color: active ? '#fff' : TH.text, opacity: active ? 1 : 0.8, transition: 'background-color 120ms ease, opacity 120ms ease' }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseOut={(e) => { if (!active) { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = 'transparent'; } }}
              >
                <FavIcon size={18} />
                <Star size={7} className="absolute top-1 right-1 pointer-events-none" style={{ fill: TH.accent, color: TH.accent }} />
              </button>
            );
          })}
          <span className="w-5 h-px my-0.5 shrink-0" style={{ background: TH.border }} aria-hidden="true" />
        </>
      )}
      {GROUPS.map((g) => {
        const shownId = remembered[g.key] || g.tools[0].id;
        const shownTool = g.tools.find((t) => t.id === shownId);
        const Icon = ICON_FOR(shownId);
        const isActiveGroup = activeGroup === g.key;
        const isOpen = openKey === g.key;
        // دکمهٔ غیرفعال: ~۷۰٪ شفافیت، با hover به ۱۰۰٪ می‌رسد (انتقالِ ۱۲۰میلی‌ثانیه).
        const inactiveDim = !isActiveGroup && !isOpen;
        return (
          <div
            key={g.key}
            className="relative shrink-0 flex justify-center"
            onMouseEnter={() => openOn(g.key)}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              aria-label={g.label}
              title={shownTool ? `${g.label} · ${shownTool.label}` : g.label}
              aria-pressed={isActiveGroup}
              onClick={() => (isOpen ? setOpenKey(null) : openOn(g.key))}
              className="relative flex items-center justify-center w-8 h-8 rounded-md"
              style={{
                background: isActiveGroup ? TH.accent : (isOpen ? TH.chipBgHover : 'transparent'),
                color: isActiveGroup ? '#fff' : TH.text,
                opacity: inactiveDim ? 0.7 : 1,
                transition: 'background-color 120ms ease, opacity 120ms ease, color 120ms ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = '1';
                if (!isActiveGroup) e.currentTarget.style.background = TH.chipBgHover;
              }}
              onMouseOut={(e) => {
                if (inactiveDim) e.currentTarget.style.opacity = '0.7';
                if (!isActiveGroup && !isOpen) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={18} />
              {/* نشانهٔ ریزِ کارت: مثلثِ ظریف در گوشهٔ پایین‌راست */}
              <span
                className="absolute bottom-1 right-1 w-0 h-0 pointer-events-none"
                style={{
                  borderLeft: '3px solid transparent',
                  borderTop: `3px solid ${isActiveGroup ? 'rgba(255,255,255,.85)' : TH.text}`,
                  opacity: isActiveGroup ? 0.85 : 0.45,
                }}
              />
            </button>

            {isOpen && (
              <div
                dir="rtl"
                className="absolute top-0 left-full ml-1.5 z-50 rounded-md overflow-hidden py-1 origin-left"
                style={{
                  background: TH.popoverBg,
                  border: `1px solid ${TH.border}`,
                  boxShadow: '0 6px 22px -6px rgba(0,0,0,.45), 0 2px 6px -2px rgba(0,0,0,.30)',
                  minWidth: 196,
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
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pick(g.key, t.id)}
                      className="w-full flex items-center gap-2.5 px-3 text-[12px] text-right"
                      style={{
                        height: 28,
                        background: active ? TH.accent : 'transparent',
                        color: active ? '#fff' : TH.textStrong,
                        transition: 'background-color 120ms ease, color 120ms ease',
                      }}
                      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <RowIcon size={16} className="shrink-0" style={{ opacity: active ? 1 : 0.8 }} />
                      <span className="flex-1 whitespace-nowrap leading-none">{t.label}</span>
                      {active && <MiniChevron size={13} className="shrink-0 opacity-80" />}
                      <span role="button" title={favs.includes(t.id) ? 'حذف از منتخب' : 'افزودن به منتخب'} onClick={(e) => { e.stopPropagation(); toggleFav(t.id); }} className="shrink-0" style={{ cursor: 'pointer', opacity: favs.includes(t.id) ? 1 : 0.35 }}><Star size={12} style={favs.includes(t.id) ? { fill: TH.accent, color: TH.accent } : {}} /></span>
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
    </div>
  );
}
