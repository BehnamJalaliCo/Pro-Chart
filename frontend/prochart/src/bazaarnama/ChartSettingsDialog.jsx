// بازارنما — دیالوگِ کاملِ «تنظیماتِ چارت» (کپیِ برابرِ اصلِ پنجرهٔ Chart settings تریدینگ‌ویو).
// کامپوننتِ کاملاً مستقل و افزایشی؛ هیچ فایلِ مشترکی را تغییر نمی‌دهد.
//
// امضا:  export default function ChartSettingsDialog({ open, onClose, TH, settings, onChange })
//   - open     : bool  — نمایش/مخفی
//   - onClose  : ()    — بستنِ دیالوگ (X / Esc / کلیکِ بیرون / دکمهٔ «تأیید»)
//   - TH       : توکنِ تمِ فعلی (همان THEMES[theme] در BazaarNama)
//   - settings : object — وضعیتِ فعلیِ تنظیماتِ چارت (کلیدهای مسطحِ زیر). هر کلیدِ نبود
//                          با DEFAULTS پُر می‌شود، پس می‌توان با {} یا undefined هم شروع کرد.
//   - onChange : (patch) => void — با یک آبجکتِ *مسطحِ* جزئی صدا زده می‌شود؛ یکپارچه‌ساز
//                          باید shallow-merge کند:  setSettings(s => ({ ...s, ...patch })).
//                          تغییرات زنده‌اند (مثلِ TV). دکمهٔ «انصراف» به snapshotِ زمانِ باز‌شدن برمی‌گرداند.
//
// ── شمای settings (کلیدهای مسطح؛ نگاشتِ پیشنهادی به stateهای BazaarNama در انتهای فایل) ──
//   Symbol:      symUpColor, symDownColor, symBordersShown, symBorderUpColor,
//                symBorderDownColor, symWickShown, symWickUpColor, symWickDownColor,
//                symHollow, symThinBars
//   Status line: slSymbol, slOHLC, slChange, slVolume, slIndTitles, slIndValues,
//                slIndArgs, slMarketStatus
//   Scales:      scaleMode (0 عادی/1 لاگ/2 درصد), scaleInvert, scaleLock,
//                scaleCountdown, scaleFontSize, priceLineShown, scaleCurrency, scaleUnit
//   Appearance:  bgType ('solid'|'gradient'), bgColor, bgColor2, gridVert, gridVertColor,
//                gridHorz, gridHorzColor, crosshairStyle (0 خط/1 نقطه‌چین),
//                crosshairColor, watermarkShown, watermarkOpacity, navButtons, scrollScale
//   Events:      evDividends, evSplits, evEarnings

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TIMEZONES } from './scales_crosshair';
import {
  Settings, X, Palette, Ruler, Eye, CalendarDays, RotateCcw, Save,
  ChevronDown, AlignLeft, Type, Info, Trash2, CandlestickChart, BellRing,
} from 'lucide-react';

// ───────────────────────── پیش‌فرض‌ها (مبنای TVِ دارک) ─────────────────────────
const DEFAULTS = {
  // Symbol
  symUpColor: '#26a69a', symDownColor: '#ef5350',
  symBordersShown: true, symBorderUpColor: '#26a69a', symBorderDownColor: '#ef5350',
  symWickShown: true, symWickUpColor: '#26a69a', symWickDownColor: '#ef5350',
  symHollow: false, symThinBars: false,
  precision: 'default',
  // Status line
  slLogo: true, slSymbol: true, slOHLC: true, slChange: true, slVolume: true,
  slLastDayChange: false,
  slIndTitles: true, slIndValues: true, slIndArgs: true, slMarketStatus: true,
  // Scales & lines
  scaleMode: 0, scaleInvert: false, scaleLock: false,
  scaleCountdown: true, scaleFontSize: 12, priceLineShown: true,
  scaleCurrency: false, scaleUnit: false,
  // Appearance / Canvas
  bgType: 'solid', bgColor: '#131722', bgColor2: '#0c0e15',
  gridVert: true, gridVertColor: '#1e222d',
  gridHorz: true, gridHorzColor: '#1e222d',
  crosshairStyle: 1, crosshairColor: '#9598a1',
  watermarkShown: true, watermarkOpacity: 50,
  navButtons: true, scrollScale: true,
  // Trading
  tradeButtons: true,
  // Alerts
  alertLinesShown: true, alertLinesActiveOnly: false,
  // Events
  evDividends: false, evSplits: false, evEarnings: false,
};

const TPL_KEY = 'bn_chart_setting_tpls'; // namespaceِ اختصاصی — با هیچ کلیدِ دیگری تداخل ندارد

const loadTpls = () => {
  try { const o = JSON.parse(localStorage.getItem(TPL_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
};
const saveTpls = (o) => { try { localStorage.setItem(TPL_KEY, JSON.stringify(o)); } catch (e) { /* noop */ } };

const TABS = [
  { id: 'symbol',     label: 'نماد',        en: 'Symbol',      icon: Palette },
  { id: 'status',     label: 'خطِ وضعیت',    en: 'Status line', icon: AlignLeft },
  { id: 'scales',     label: 'مقیاس و خطوط', en: 'Scales',      icon: Ruler },
  { id: 'appearance', label: 'بوم',         en: 'Canvas',      icon: Eye }, // TV نامِ این تب را از Appearance به Canvas تغییر داد — برچسب را هم‌راستا کردیم (idِ داخلی دست‌نخورده می‌ماند)
  { id: 'trading',    label: 'معامله',      en: 'Trading',     icon: CandlestickChart },
  { id: 'alerts',     label: 'آلارم‌ها',     en: 'Alerts',      icon: BellRing },
  { id: 'events',     label: 'رویدادها',     en: 'Events',      icon: CalendarDays },
];

const FONT_SIZES = [10, 11, 12, 14, 16];

export default function ChartSettingsDialog({ open, onClose, TH, settings, onChange }) {
  const [tab, setTab] = useState('symbol');
  const [tplMenu, setTplMenu] = useState(false);
  const [tpls, setTpls] = useState(loadTpls);
  const snapRef = useRef(null); // snapshotِ زمانِ باز‌شدن برای «انصراف»

  // آبجکتِ کاملِ تنظیمات با پُرکردنِ کلیدهای نبود.
  const s = useMemo(() => ({ ...DEFAULTS, ...(settings || {}) }), [settings]);

  const emit = (patch) => { if (onChange) onChange(patch); };
  const set = (key, val) => emit({ [key]: val });

  // اکشن‌ها پیش از افکت‌هایی که به آن‌ها ارجاع می‌دهند تعریف می‌شوند (پرهیز از TDZ / وضوحِ بیشتر).
  const handleCancel = () => { if (snapRef.current) emit(snapRef.current); onClose && onClose(); };
  const handleOk = () => { onClose && onClose(); };
  const handleDefaults = () => emit({ ...DEFAULTS });

  const doSaveTpl = () => {
    const name = (typeof window !== 'undefined' ? window.prompt('نامِ تمپلیت را وارد کنید:', 'تمپلیتِ من') : '') || '';
    const n = name.trim();
    if (!n) return;
    const next = { ...tpls, [n]: { ...s } };
    setTpls(next); saveTpls(next); setTplMenu(false);
  };
  const doLoadTpl = (name) => { const t = tpls[name]; if (t) emit({ ...DEFAULTS, ...t }); setTplMenu(false); };
  const doDelTpl = (name) => { const next = { ...tpls }; delete next[name]; setTpls(next); saveTpls(next); };

  // با هر باز‌شدن: snapshot بگیر، تبِ نماد، منوی تمپلیت بسته، تمپلیت‌ها تازه.
  useEffect(() => {
    if (!open) return;
    snapRef.current = { ...DEFAULTS, ...(settings || {}) };
    setTplMenu(false);
    setTpls(loadTpls());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc → انصراف (بازگردانیِ snapshot).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); handleCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div
        className="w-full max-w-[720px] rounded-lg overflow-hidden flex flex-col pc-pop"
        style={{
          height: 'min(600px, 90vh)',
          background: TH.panel,
          border: `1px solid ${TH.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          color: TH.textStrong,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ───────── هدر ───────── */}
        <div className="flex items-center gap-2.5 px-4 h-[52px] shrink-0 border-b" style={{ borderColor: TH.border }}>
          <Settings size={18} style={{ color: TH.accent }} />
          <span className="font-bold text-[14px]">تنظیماتِ چارت</span>
          <button onClick={handleCancel} title="بستن (Esc)"
            className="mr-auto p-1.5 rounded-md transition-colors duration-[120ms]"
            style={{ color: TH.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <X size={18} />
          </button>
        </div>

        {/* ───────── بدنه: ریلِ تب + محتوا ───────── */}
        <div className="flex-1 flex min-h-0">
          {/* ریلِ تبِ عمودی (سمتِ شروع/راستِ RTL — همان «چپِ» TV) */}
          <div className="w-[168px] shrink-0 border-l overflow-y-auto bn-thin-scroll py-2"
            style={{ borderColor: TH.border, background: TH.subtle }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-right transition-colors duration-[120ms]"
                  style={{
                    color: on ? TH.textStrong : TH.text,
                    background: on ? TH.chipBg : 'transparent',
                    fontWeight: on ? 700 : 500,
                    borderRight: on ? `2px solid ${TH.accent}` : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <Icon size={16} style={{ color: on ? TH.accent : TH.text }} />
                  <span className="flex-1">{t.label}</span>
                  <span className="text-[10px] opacity-40" dir="ltr">{t.en}</span>
                </button>
              );
            })}
          </div>

          {/* محتوای تب */}
          <div className="flex-1 min-w-0 overflow-y-auto bn-thin-scroll px-5 py-4">
            {tab === 'symbol' && <SymbolTab TH={TH} s={s} set={set} />}
            {tab === 'status' && <StatusTab TH={TH} s={s} set={set} />}
            {tab === 'scales' && <ScalesTab TH={TH} s={s} set={set} />}
            {tab === 'appearance' && <AppearanceTab TH={TH} s={s} set={set} />}
            {tab === 'trading' && <TradingTab TH={TH} s={s} set={set} />}
            {tab === 'alerts' && <AlertsTab TH={TH} s={s} set={set} />}
            {tab === 'events' && <EventsTab TH={TH} s={s} set={set} />}
          </div>
        </div>

        {/* ───────── پاورقی: تمپلیت / پیش‌فرض / انصراف / تأیید ───────── */}
        <div className="flex items-center gap-2 px-4 h-[54px] shrink-0 border-t" style={{ borderColor: TH.border }}>
          {/* منوی تمپلیت */}
          <div className="relative">
            <button onClick={() => setTplMenu((v) => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-colors duration-[120ms]"
              style={{ background: TH.chipBg, color: TH.textStrong }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
              <Save size={14} /> تمپلیت <ChevronDown size={13} />
            </button>
            {tplMenu && (
              <div className="absolute bottom-full mb-1 right-0 w-60 rounded-lg p-1 pc-pop z-10"
                style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
                <button onClick={doSaveTpl}
                  className="flex items-center gap-2 w-full text-right px-2.5 py-2 text-[12.5px] rounded-md transition-colors duration-[120ms]"
                  style={{ color: TH.accent }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <Save size={14} /> ذخیرهٔ تنظیماتِ فعلی…
                </button>
                <div className="my-1 h-px" style={{ background: TH.border }} />
                {Object.keys(tpls).length === 0 ? (
                  <div className="px-2.5 py-2 text-[11.5px] opacity-55">هنوز تمپلیتی ذخیره نشده.</div>
                ) : (
                  Object.keys(tpls).map((name) => (
                    <div key={name}
                      className="group flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors duration-[120ms]"
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <button onClick={() => doLoadTpl(name)}
                        className="flex-1 text-right px-1 py-1 text-[12.5px] truncate" style={{ color: TH.textStrong }}>
                        {name}
                      </button>
                      <button onClick={() => doDelTpl(name)} title="حذفِ تمپلیت"
                        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]"
                        style={{ color: TH.down }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={handleDefaults}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition-colors duration-[120ms]"
            style={{ background: 'transparent', color: TH.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <RotateCcw size={14} /> بازنشانی به پیش‌فرض
          </button>

          <div className="mr-auto flex items-center gap-2">
            <button onClick={handleCancel}
              className="h-8 px-4 rounded-md text-[12.5px] font-semibold transition-colors duration-[120ms]"
              style={{ background: TH.chipBg, color: TH.textStrong }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
              انصراف
            </button>
            <button onClick={handleOk}
              className="h-8 px-5 rounded-md text-[12.5px] font-bold text-white transition-opacity duration-[120ms] hover:opacity-90"
              style={{ background: TH.accent }}>
              تأیید
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════ تب‌ها ═════════════════════════

function SymbolTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="بدنهٔ کندل" en="Candle body" />
      <ColorPairRow TH={TH} label="صعودی / نزولی"
        upColor={s.symUpColor} downColor={s.symDownColor}
        onUp={(v) => set('symUpColor', v)} onDown={(v) => set('symDownColor', v)}
        dimUp={s.symHollow} />
      {s.symHollow && (
        <div className="text-[11px] pr-1 pb-1 opacity-60" style={{ color: TH.text }}>
          در حالتِ توخالی، بدنهٔ صعودی شفاف است و فقط لبه رنگ می‌گیرد.
        </div>
      )}

      <SectionTitle TH={TH} title="حاشیه‌ها" en="Borders"
        toggle={{ on: s.symBordersShown, onToggle: () => set('symBordersShown', !s.symBordersShown) }} />
      {s.symBordersShown && (
        <ColorPairRow TH={TH} label="صعودی / نزولی"
          upColor={s.symBorderUpColor} downColor={s.symBorderDownColor}
          onUp={(v) => set('symBorderUpColor', v)} onDown={(v) => set('symBorderDownColor', v)} />
      )}

      <SectionTitle TH={TH} title="فتیله (Wick)" en="Wick"
        toggle={{ on: s.symWickShown, onToggle: () => set('symWickShown', !s.symWickShown) }} />
      {s.symWickShown && (
        <ColorPairRow TH={TH} label="صعودی / نزولی"
          upColor={s.symWickUpColor} downColor={s.symWickDownColor}
          onUp={(v) => set('symWickUpColor', v)} onDown={(v) => set('symWickDownColor', v)} />
      )}

      <SectionTitle TH={TH} title="سبک" en="Style" />
      <ToggleRow TH={TH} label="کندل‌های توخالی" hint="Hollow candles — بدنهٔ صعودی بدونِ پُرشدگی"
        on={s.symHollow} onToggle={() => set('symHollow', !s.symHollow)} />
      <ToggleRow TH={TH} label="میله‌های نازک" hint="Thin bars — پهنای کمترِ کندل‌ها"
        on={s.symThinBars} onToggle={() => set('symThinBars', !s.symThinBars)} />

      <SectionTitle TH={TH} title="اصلاحِ داده" en="Data modification" />
      <Row TH={TH} label="دقت (Precision)" hint="تعدادِ ارقامِ اعشارِ محورِ قیمت — «خودکار» بر اساسِ نماد تعیین می‌شود">
        <SelectBox TH={TH} value={s.precision != null ? String(s.precision) : 'default'}
          options={[
            { v: 'default', label: 'خودکار' },
            { v: '0', label: '1' }, { v: '1', label: '0.1' }, { v: '2', label: '0.01' },
            { v: '3', label: '0.001' }, { v: '4', label: '0.0001' }, { v: '5', label: '0.00001' },
          ]}
          onChange={(v) => set('precision', v)} />
      </Row>
      <Row TH={TH} label="منطقهٔ زمانی (Timezone)" hint="منطقهٔ زمانیِ محورِ زمان و کراس‌هیر">
        <SelectBox TH={TH} value={s.timezone || 'UTC'}
          options={TIMEZONES.map((z) => ({ v: z.id, label: z.label }))}
          onChange={(v) => set('timezone', v)} />
      </Row>
    </div>
  );
}

function StatusTab({ TH, s, set }) {
  const rows = [
    ['slLogo', 'لوگو', 'نمایشِ لوگو/پرچمِ نماد در خطِ وضعیت'],
    ['slSymbol', 'نامِ نماد', 'نمایشِ نماد در خطِ وضعیت'],
    ['slMarketStatus', 'وضعیتِ بازار', 'نشانگرِ باز/بستهٔ بازار'],
    ['slOHLC', 'مقادیرِ OHLC', 'باز/سقف/کف/بسته'],
    ['slChange', 'تغییرات', 'تغییرِ مطلق و درصدیِ کندل'],
    ['slLastDayChange', 'تغییرِ روزِ قبل', 'تغییر نسبت به بستهٔ سشنِ گذشته (Last day change)'],
    ['slVolume', 'حجم', 'حجمِ کندلِ جاری'],
    ['slIndTitles', 'عنوانِ اندیکاتورها', 'نامِ اندیکاتورهای فعال'],
    ['slIndValues', 'مقدارِ اندیکاتورها', 'مقادیرِ زندهٔ اندیکاتورها'],
    ['slIndArgs', 'آرگومان‌های اندیکاتور', 'پارامترها کنارِ نامِ اندیکاتور'],
  ];
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="نمایش در خطِ وضعیت" en="Status line" />
      {rows.map(([k, label, hint]) => (
        <ToggleRow key={k} TH={TH} label={label} hint={hint} on={s[k]} onToggle={() => set(k, !s[k])} />
      ))}
    </div>
  );
}

function ScalesTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="حالتِ مقیاس" en="Scale mode" />
      <div className="py-1.5">
        <Segmented TH={TH}
          value={s.scaleMode}
          options={[{ v: 0, label: 'عادی' }, { v: 1, label: 'لگاریتمی' }, { v: 2, label: 'درصدی' }]}
          onChange={(v) => set('scaleMode', v)} />
      </div>
      <ToggleRow TH={TH} label="وارونه‌کردنِ محور" hint="Invert scale — جابه‌جاییِ بالا/پایین"
        on={s.scaleInvert} onToggle={() => set('scaleInvert', !s.scaleInvert)} />
      <ToggleRow TH={TH} label="قفلِ بازهٔ مقیاس" hint="Lock price to bar ratio"
        on={s.scaleLock} onToggle={() => set('scaleLock', !s.scaleLock)} />

      <SectionTitle TH={TH} title="خطوط و برچسب‌ها" en="Lines & labels" />
      <ToggleRow TH={TH} label="خطِ قیمتِ آخر" hint="نمایشِ خطِ قیمتِ جاری + برچسبِ رنگی"
        on={s.priceLineShown} onToggle={() => set('priceLineShown', !s.priceLineShown)} />
      <ToggleRow TH={TH} label="شمارشِ معکوسِ بسته‌شدن" hint="Countdown to bar close روی برچسبِ قیمت"
        on={s.scaleCountdown} onToggle={() => set('scaleCountdown', !s.scaleCountdown)} />
      <ToggleRow TH={TH} label="نمادِ ارز" hint="نمایشِ واحدِ ارزِ نماد کنارِ مقیاس"
        on={s.scaleCurrency} onToggle={() => set('scaleCurrency', !s.scaleCurrency)} />
      <ToggleRow TH={TH} label="واحد" hint="نمایشِ واحدِ اندازه‌گیری روی مقیاس"
        on={s.scaleUnit} onToggle={() => set('scaleUnit', !s.scaleUnit)} />

      <SectionTitle TH={TH} title="متن" en="Text" />
      <Row TH={TH} label="اندازهٔ فونتِ مقیاس" icon={Type}>
        <SelectBox TH={TH} value={s.scaleFontSize}
          options={FONT_SIZES.map((f) => ({ v: f, label: `${f}px` }))}
          onChange={(v) => set('scaleFontSize', Number(v))} />
      </Row>
    </div>
  );
}

function AppearanceTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="پس‌زمینه" en="Background" />
      <div className="py-1.5">
        <Segmented TH={TH}
          value={s.bgType}
          options={[{ v: 'solid', label: 'یکدست' }, { v: 'gradient', label: 'گرادیان' }]}
          onChange={(v) => set('bgType', v)} />
      </div>
      <ColorRow TH={TH} label={s.bgType === 'gradient' ? 'رنگِ بالا' : 'رنگ'}
        color={s.bgColor} onChange={(v) => set('bgColor', v)} />
      {s.bgType === 'gradient' && (
        <ColorRow TH={TH} label="رنگِ پایین" color={s.bgColor2} onChange={(v) => set('bgColor2', v)} />
      )}

      <SectionTitle TH={TH} title="شبکه (Grid)" en="Grid" />
      <ColorRow TH={TH} label="خطوطِ عمودی"
        color={s.gridVertColor} onChange={(v) => set('gridVertColor', v)}
        toggle={{ on: s.gridVert, onToggle: () => set('gridVert', !s.gridVert) }} />
      <ColorRow TH={TH} label="خطوطِ افقی"
        color={s.gridHorzColor} onChange={(v) => set('gridHorzColor', v)}
        toggle={{ on: s.gridHorz, onToggle: () => set('gridHorz', !s.gridHorz) }} />

      <SectionTitle TH={TH} title="کراس‌هیر" en="Crosshair" />
      <Row TH={TH} label="سبکِ خط">
        <SelectBox TH={TH} value={s.crosshairStyle}
          options={[{ v: 0, label: 'یکسره' }, { v: 1, label: 'نقطه‌چین' }]}
          onChange={(v) => set('crosshairStyle', Number(v))} />
      </Row>
      <ColorRow TH={TH} label="رنگِ کراس‌هیر" color={s.crosshairColor} onChange={(v) => set('crosshairColor', v)} />

      <SectionTitle TH={TH} title="واترمارک و ناوبری" en="Watermark & navigation" />
      <ToggleRow TH={TH} label="واترمارکِ لوگو" hint="نمایشِ لوگوی شبح‌مانند در پس‌زمینه"
        on={s.watermarkShown} onToggle={() => set('watermarkShown', !s.watermarkShown)} />
      {s.watermarkShown && (
        <Row TH={TH} label="شفافیتِ واترمارک">
          <div className="flex items-center gap-2 w-[180px]">
            <input type="range" min={0} max={100} value={s.watermarkOpacity}
              onChange={(e) => set('watermarkOpacity', Number(e.target.value))}
              className="flex-1 accent-current" style={{ accentColor: TH.accent }} />
            <span className="text-[12px] tabular-nums tnum w-9 text-left" dir="ltr" style={{ color: TH.text }}>
              {s.watermarkOpacity}%
            </span>
          </div>
        </Row>
      )}
      <ToggleRow TH={TH} label="دکمه‌های ناوبری" hint="دکمه‌های پرش/بازنشانیِ گوشهٔ چارت"
        on={s.navButtons} onToggle={() => set('navButtons', !s.navButtons)} />
      <ToggleRow TH={TH} label="اسکرول و مقیاس" hint="اجازهٔ اسکرول/زومِ محورها با درگ"
        on={s.scrollScale} onToggle={() => set('scrollScale', !s.scrollScale)} />
    </div>
  );
}

function TradingTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="عمومی" en="General" />
      <ToggleRow TH={TH} label="دکمه‌های خرید/فروش" hint="نمایشِ دکمه‌های SELL/BUY مستقیماً روی چارت"
        on={s.tradeButtons} onToggle={() => set('tradeButtons', !s.tradeButtons)} />
      <div className="mt-3 flex items-start gap-2 p-3 rounded-lg text-[11.5px] leading-relaxed"
        style={{ background: TH.subtle, color: TH.text }}>
        <Info size={14} className="shrink-0 mt-0.5 opacity-70" />
        <span>دکمه‌های SELL/BUY تیکتِ سفارش را باز می‌کنند (Bid/Ask). گزینه‌های بیشترِ معامله در نسخه‌های بعدی افزوده می‌شوند.</span>
      </div>
    </div>
  );
}

function AlertsTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="نمایشِ خطوط روی چارت" en="Chart line visibility" />
      <ToggleRow TH={TH} label="خطوطِ آلارم" hint="نمایشِ خطِ افقی برای هر آلارمِ ذخیره‌شده روی چارت"
        on={s.alertLinesShown} onToggle={() => set('alertLinesShown', !s.alertLinesShown)} />
      <ToggleRow TH={TH} label="فقط آلارم‌های فعال" hint="مخفی‌کردنِ خطوطِ آلارم‌های غیرفعال/منقضی"
        on={s.alertLinesActiveOnly} onToggle={() => set('alertLinesActiveOnly', !s.alertLinesActiveOnly)} />
    </div>
  );
}

function EventsTab({ TH, s, set }) {
  return (
    <div className="space-y-1">
      <SectionTitle TH={TH} title="رویدادها روی چارت" en="Events on chart" />
      <ToggleRow TH={TH} label="سودِ سهام (Dividends)" hint="نشانگرِ D روی محورِ زمان"
        on={s.evDividends} onToggle={() => set('evDividends', !s.evDividends)} />
      <ToggleRow TH={TH} label="تقسیمِ سهام (Splits)" hint="نشانگرِ تقسیم روی محورِ زمان"
        on={s.evSplits} onToggle={() => set('evSplits', !s.evSplits)} />
      <ToggleRow TH={TH} label="گزارشِ درآمد (Earnings)" hint="نشانگرِ E روی محورِ زمان"
        on={s.evEarnings} onToggle={() => set('evEarnings', !s.evEarnings)} />
      <div className="mt-3 flex items-start gap-2 p-3 rounded-lg text-[11.5px] leading-relaxed"
        style={{ background: TH.subtle, color: TH.text }}>
        <Info size={14} className="shrink-0 mt-0.5 opacity-70" />
        <span>رویدادهای شرکتی مخصوصِ سهام‌اند؛ برای نمادهای فارکس/فلزات/کریپتو داده‌ای نمایش داده نمی‌شود.</span>
      </div>
    </div>
  );
}

// ═════════════════════════ اجزای کمکی ═════════════════════════

function SectionTitle({ TH, title, en, toggle }) {
  return (
    <div className="flex items-center gap-2 pt-3.5 pb-1.5 first:pt-0.5">
      <span className="text-[11px] font-bold tracking-wide" style={{ color: TH.textStrong }}>{title}</span>
      <span className="text-[10px] opacity-40" dir="ltr" style={{ color: TH.text }}>{en}</span>
      <div className="flex-1 h-px" style={{ background: TH.border }} />
      {toggle && <Switch TH={TH} on={toggle.on} onToggle={toggle.onToggle} />}
    </div>
  );
}

function Row({ TH, label, hint, icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3 py-2 min-h-[38px]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[13px]" style={{ color: TH.textStrong }}>
          {Icon && <Icon size={14} style={{ color: TH.text }} />}
          <span className="truncate">{label}</span>
        </div>
        {hint && <div className="text-[11px] opacity-55 mt-0.5" style={{ color: TH.text }}>{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleRow({ TH, label, hint, on, onToggle }) {
  return (
    <Row TH={TH} label={label} hint={hint}>
      <Switch TH={TH} on={on} onToggle={onToggle} />
    </Row>
  );
}

function ColorRow({ TH, label, color, onChange, toggle }) {
  return (
    <Row TH={TH} label={label}>
      <div className="flex items-center gap-2">
        <ColorSwatch TH={TH} color={color} onChange={onChange} disabled={toggle && !toggle.on} />
        {toggle && <Switch TH={TH} on={toggle.on} onToggle={toggle.onToggle} />}
      </div>
    </Row>
  );
}

function ColorPairRow({ TH, label, upColor, downColor, onUp, onDown, dimUp }) {
  return (
    <Row TH={TH} label={label}>
      <div className="flex items-center gap-2">
        <ColorSwatch TH={TH} color={upColor} onChange={onUp} disabled={dimUp} />
        <ColorSwatch TH={TH} color={downColor} onChange={onDown} />
      </div>
    </Row>
  );
}

// سواچِ رنگ: مربعِ رنگی که پیکرِ رنگِ بومیِ مرورگر را باز می‌کند + hexِ فشرده کنارش.
function ColorSwatch({ TH, color, onChange, disabled }) {
  const safe = normalizeHex(color) || '#000000';
  return (
    <label
      className="relative flex items-center gap-1.5 h-7 pl-1.5 pr-1 rounded-md cursor-pointer transition-opacity duration-[120ms]"
      style={{ background: TH.chipBg, border: `1px solid ${TH.border}`, opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <span className="w-5 h-5 rounded shrink-0" style={{ background: color, border: `1px solid ${TH.border}` }} />
      <span className="text-[11px] tabular-nums tnum uppercase" dir="ltr" style={{ color: TH.text }}>{safe}</span>
      <input type="color" value={safe} onChange={(e) => onChange && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer" tabIndex={-1} aria-label="انتخابِ رنگ" />
    </label>
  );
}

function Switch({ TH, on, onToggle }) {
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={!!on}
      className="relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-[150ms] shrink-0"
      style={{ background: on ? TH.accent : TH.border }}>
      <span className="absolute w-3.5 h-3.5 rounded-full bg-white transition-all duration-[150ms]"
        style={{ right: on ? '2px' : '18px', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
    </button>
  );
}

function Segmented({ TH, value, options, onChange }) {
  return (
    <div className="inline-flex items-center rounded-md p-0.5 gap-0.5" style={{ background: TH.subtle }}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)}
            className="px-3 h-7 rounded text-[12px] font-semibold transition-colors duration-[120ms]"
            style={on ? { background: TH.accent, color: '#fff' } : { background: 'transparent', color: TH.text }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectBox({ TH, value, options, onChange }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-7 pr-3 pl-7 rounded-md text-[12px] font-semibold outline-none cursor-pointer"
        style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }}>
        {options.map((o) => <option key={String(o.v)} value={o.v}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute left-1.5 pointer-events-none" style={{ color: TH.text }} />
    </div>
  );
}

// hex-normalize: خروجیِ input[type=color] همیشه 6رقمی است؛ ورودیِ نامعتبر/rgba را رد می‌کند.
function normalizeHex(c) {
  if (typeof c !== 'string') return null;
  const m = c.trim().match(/^#([0-9a-fA-F]{6})$/) || c.trim().match(/^#([0-9a-fA-F]{3})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return `#${h.toLowerCase()}`;
}
