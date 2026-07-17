import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Wand2, Sparkles, Image as ImageIcon, MousePointerClick, Layers, Type,
  Search, Upload, Download, Eye, RotateCcw, Maximize2, Palette, Loader2, X,
} from 'lucide-react';
import { api } from '../api/client';
import {
  PageHeader, Field, Switch, Segmented, Slider, ColorField, Tag, useToast,
} from '../components/ui';

/* ───────────────────── استودیوی حرفه‌ایِ ساختِ کاور ─────────────────────
   پیش‌نمایش = رندرِ واقعیِ سرور (debounced) → ۱۰۰٪ WYSIWYG، نه تقریبِ مرورگری. */

const RATIO_WH = { '9:16': [9, 16], '4:5': [4, 5], '1:1': [1, 1] };
const RATIO_PX = { '9:16': '1080×1920', '4:5': '1080×1350', '1:1': '1080×1080' };
const RATIO_OPTIONS = [
  { value: '9:16', label: '9:16 ریلز/استوری' },
  { value: '4:5', label: '4:5 پستِ عمودی' },
  { value: '1:1', label: '1:1 مربع' },
];

const PRESETS = [
  { name: 'اصلِ CoinePro', emoji: '🟠', v: { base: 'orange', bgFrom: '#ff7a18', bgTo: '#c98a1c', whiteColor: '#ffffff', yellowColor: '#FFF600', behindColor: '#0e0700', behindOpacity: 95, font: 'Lalezar', behindFont: 'Archivo Black' } },
  { name: 'شبانهٔ طلایی', emoji: '🌙', v: { base: 'gradient', bgFrom: '#1a1205', bgTo: '#3a2a08', whiteColor: '#ffffff', yellowColor: '#ffcf33', behindColor: '#ffcf33', behindOpacity: 16, font: 'Lalezar', behindFont: 'Archivo Black' } },
  { name: 'آبیِ حرفه‌ای', emoji: '🔵', v: { base: 'gradient', bgFrom: '#0b2a4a', bgTo: '#0a4d8c', whiteColor: '#ffffff', yellowColor: '#34d399', behindColor: '#0a1018', behindOpacity: 80, font: 'Vazirmatn', behindFont: 'Archivo Black' } },
  { name: 'بنفشِ مدرن', emoji: '🟣', v: { base: 'gradient', bgFrom: '#3b0764', bgTo: '#7e22ce', whiteColor: '#ffffff', yellowColor: '#fde047', behindColor: '#1a0530', behindOpacity: 85, font: 'Gulzar', behindFont: 'Archivo Black' } },
];

const DEFAULTS = {
  base: 'orange', baseFile: '', basePrev: '',
  elIcon: '', elFile: '', elColor: '',
  elScale: 56, elTop: 15, elRotate: 0, elOpacity: 100, elShadow: true,
  behind: '', behindColor: '#0e0700', behindOpacity: 95, behindSize: 100, behindFont: 'Archivo Black', behindLs: 4,
  white: '', whiteColor: '#ffffff', whiteSize: 100,
  yellow: '', yellowColor: '#FFF600', yellowSize: 100,
  textTop: 60, textStroke: false, strokeColor: '#000000', strokeWidth: 2,
  bgFrom: '#ff7a18', bgTo: '#c98a1c', font: 'Lalezar', ratio: '9:16',
};

const ORANGE_URL = '/api/public/ig-media/cover_bg_orange.jpg';

/* ── کارتِ بخش (تمِ روشن) ── */
function Section({ icon: Icon, title, hint, color = 'text-brand', children }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={color}><Icon size={16} /></span>
        <h4 className="text-sm font-black text-ink">{title}</h4>
        {hint && <span className="text-[11px] text-ink-muted mr-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── دراپ‌داونِ فونت ── */
function FontSelect({ value, onChange, fonts }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input cursor-pointer">
      {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
    </select>
  );
}

export default function Cover() {
  const [show, toastNode] = useToast();
  const [fonts, setFonts] = useState(['Vazirmatn', 'Lalezar', 'Gulzar', 'Markazi Text', 'Archivo Black']);
  const [ratios, setRatios] = useState(['9:16', '4:5', '1:1']);
  const [s, setS] = useState(DEFAULTS);
  const set = (k, v) => setS((o) => ({ ...o, [k]: v }));
  const setMany = (obj) => setS((o) => ({ ...o, ...obj }));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState('');         // 'search' | 'base' | 'el'
  const [preview, setPreview] = useState('');    // url رندرِ واقعی
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState('');
  const baseRef = useRef();
  const elRef = useRef();
  const renderSeq = useRef(0);

  /* فونت‌ها + لینکِ گوگل‌فونت برای دراپ‌داون‌ها */
  useEffect(() => {
    api.coverFonts().then((d) => { if (d?.fonts) setFonts(d.fonts); if (d?.ratios) setRatios(d.ratios); }).catch(() => {});
    const id = 'cover-gfonts';
    if (!document.getElementById(id)) {
      const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@600;800;900&family=Lalezar&family=Gulzar&family=Markazi+Text:wght@600;700&family=Archivo+Black&display=swap';
      document.head.appendChild(l);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* spec یکسان برای پیش‌نمایش و خروجی — کلیدها دقیقاً مطابقِ بک‌اند */
  const buildSpec = useCallback(() => ({
    base_filename: s.base === 'gradient' ? 'gradient' : (s.base === 'upload' ? (s.baseFile || 'gradient') : 'cover_bg_orange.jpg'),
    element_icon: s.elIcon || null, element_filename: s.elFile || null, element_color: s.elColor || null,
    element_scale: s.elScale, element_top: s.elTop, element_rotate: s.elRotate, element_opacity: s.elOpacity, element_shadow: s.elShadow,
    text_top: s.textTop,
    behind_text: s.behind, behind_color: s.behindColor, behind_opacity: s.behindOpacity, behind_size: s.behindSize,
    behind_font: s.behindFont, behind_letter_spacing: s.behindLs,
    white_text: s.white, white_color: s.whiteColor, white_size: s.whiteSize,
    yellow_text: s.yellow, yellow_color: s.yellowColor, yellow_size: s.yellowSize,
    text_stroke: s.textStroke, stroke_color: s.strokeColor, stroke_width: s.strokeWidth,
    bg_from: s.bgFrom, bg_to: s.bgTo, font: s.font, ratio: s.ratio,
  }), [s]);

  /* ── پیش‌نمایشِ زنده = رندرِ واقعیِ سرور (debounced ~650ms) ── */
  useEffect(() => {
    const seq = ++renderSeq.current;
    setRendering(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.coverRender(buildSpec());
        if (seq === renderSeq.current) { setPreview(`${r.url}?t=${Date.now()}`); setRenderErr(''); }
      } catch (er) {
        if (seq === renderSeq.current) setRenderErr(er?.message || 'خطای رندر');
      } finally {
        if (seq === renderSeq.current) setRendering(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [buildSpec]);

  /* ── آپلودها ── */
  const uploadBase = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy('base');
    try { const r = await api.upload(f); setMany({ base: 'upload', baseFile: r.filename, basePrev: r.url || '' }); }
    catch (er) { show(er?.message || 'خطای آپلود', 'err'); }
    finally { setBusy(''); if (baseRef.current) baseRef.current.value = ''; }
  };
  const uploadEl = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy('el');
    try { const r = await api.upload(f); setMany({ elFile: r.filename, elIcon: '' }); }
    catch (er) { show(er?.message || 'خطای آپلود', 'err'); }
    finally { setBusy(''); if (elRef.current) elRef.current.value = ''; }
  };
  const search = async () => {
    if (!query.trim()) return; setBusy('search');
    try { const r = await api.coverSearch(query.trim()); setResults(r.results || []); }
    catch (er) { show(er?.message || 'جستجو ناموفق', 'err'); }
    finally { setBusy(''); }
  };

  const [rw, rh] = RATIO_WH[s.ratio] || [9, 16];

  return (
    <div>
      <PageHeader
        title="استودیوی ساختِ کاور"
        sub="پیش‌نمایش دقیقاً همان خروجیِ نهایی است؛ هر تغییری بدهی خودکار رندر می‌شود."
        icon={Wand2}
        action={
          <button onClick={() => { setS(DEFAULTS); setResults([]); setQuery(''); }}
            className="btn-ghost flex items-center gap-1.5 text-sm"><RotateCcw size={15} /> بازنشانی</button>
        }
      />

      <div className="grid lg:grid-cols-[400px_1fr] gap-5">
        {/* ───── ستونِ کنترل‌ها (اسکرول‌شونده) ───── */}
        <div className="space-y-4 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:pl-1 pb-4">

          {/* قالب‌های آماده */}
          <Section icon={Sparkles} title="قالبِ آماده" color="text-accent-amber">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setMany({ ...p.v, basePrev: p.v.base === 'orange' ? ORANGE_URL : '' })}
                  className="flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 text-ink-soft rounded-xl px-2.5 py-2.5 text-right transition">
                  <span>{p.emoji}</span> {p.name}
                </button>
              ))}
            </div>
          </Section>

          {/* پس‌زمینه */}
          <Section icon={ImageIcon} title="پس‌زمینه" color="text-accent-orange">
            <div className="grid grid-cols-3 gap-2">
              {[['orange', '🟠 نارنجیِ اصل'], ['gradient', '🎨 گرادیان'], ['upload', '⬆️ آپلود']].map(([k, lbl]) => (
                <button key={k} onClick={() => { if (k === 'upload') baseRef.current?.click(); else setMany({ base: k, basePrev: k === 'orange' ? ORANGE_URL : '' }); }}
                  className={`text-xs font-bold rounded-xl px-2 py-2.5 border transition ${s.base === k ? 'border-brand-500 bg-brand-50 text-brand' : 'border-slate-200 bg-white text-ink-soft hover:border-slate-300'}`}>
                  {busy === 'base' && k === 'upload' ? '...' : lbl}
                </button>
              ))}
              <input ref={baseRef} type="file" accept="image/*" onChange={uploadBase} className="hidden" />
            </div>
            {s.base === 'gradient' && (
              <div className="grid grid-cols-2 gap-2">
                <ColorField label="از رنگ" value={s.bgFrom} onChange={(v) => set('bgFrom', v)} />
                <ColorField label="تا رنگ" value={s.bgTo} onChange={(v) => set('bgTo', v)} />
              </div>
            )}
            {s.base === 'upload' && s.basePrev && (
              <div className="flex items-center gap-2">
                <img src={s.basePrev} alt="" className="w-9 h-12 object-cover rounded-lg border border-slate-200" />
                <span className="text-xs text-accent-green font-bold">✓ کاورِ خامِ آپلودشده</span>
              </div>
            )}
          </Section>

          {/* المانِ وسط */}
          <Section icon={MousePointerClick} title="المانِ وسط" hint="فارسی هم سرچ می‌شود" color="text-brand">
            <div className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="طلا، شمع، موشک، نمودار…" className="input" />
              <button onClick={search} disabled={busy === 'search'}
                className="btn-primary flex items-center justify-center px-3.5 shrink-0 disabled:opacity-50">
                {busy === 'search' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
            {results.length > 0 && (
              <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                {results.map((r) => (
                  <button key={r.id} onClick={() => setMany({ elIcon: r.id, elFile: '' })} title={r.id}
                    className={`aspect-square rounded-lg p-1.5 bg-slate-50 flex items-center justify-center ring-2 transition ${s.elIcon === r.id ? 'ring-brand-500' : 'ring-transparent hover:ring-slate-300'}`}>
                    <img src={r.preview} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button onClick={() => elRef.current?.click()} className="btn-soft flex items-center gap-1.5 text-xs px-3 py-1.5">
                {busy === 'el' ? '...' : <><Upload size={13} /> آپلودِ PNG</>}
              </button>
              {s.elFile && <Tag color="green">✓ المانِ آپلودشده</Tag>}
              {(s.elIcon || s.elFile) && (
                <button onClick={() => setMany({ elIcon: '', elFile: '' })} className="text-accent-red font-bold mr-auto flex items-center gap-1"><X size={12} /> حذفِ المان</button>
              )}
              <input ref={elRef} type="file" accept="image/png" onChange={uploadEl} className="hidden" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Slider label="بزرگنمایی" value={s.elScale} min={15} max={300} unit="٪" onChange={(v) => set('elScale', v)} />
              <Slider label="ارتفاع" value={s.elTop} min={2} max={75} unit="٪" onChange={(v) => set('elTop', v)} />
              <Slider label="چرخش" value={s.elRotate} min={-45} max={45} unit="°" onChange={(v) => set('elRotate', v)} />
              <Slider label="شفافیت" value={s.elOpacity} min={10} max={100} unit="٪" onChange={(v) => set('elOpacity', v)} />
            </div>
            <Switch checked={s.elShadow} onChange={(v) => set('elShadow', v)} label="سایهٔ المان" icon={Layers} />
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <ColorField label="تک‌رنگ‌سازیِ المان" value={s.elColor || '#ffffff'} onChange={(v) => set('elColor', v)} />
              </div>
              {s.elColor
                ? <button onClick={() => set('elColor', '')} className="text-accent-red text-xs font-bold pb-2">حذفِ رنگ</button>
                : <Palette size={16} className="text-ink-muted pb-2.5" />}
            </div>
          </Section>

          {/* متنِ محوِ پشت */}
          <Section icon={Layers} title="متنِ محوِ پشت" color="text-accent-pink">
            <Field label="نوشتهٔ پشت">
              <input value={s.behind} onChange={(e) => set('behind', e.target.value)} dir="ltr" placeholder="مثلاً TIMEFRAME یا GOLD" className="input font-mono" />
            </Field>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Field label="فونتِ پشت"><FontSelect value={s.behindFont} onChange={(v) => set('behindFont', v)} fonts={fonts} /></Field>
              <ColorField label="رنگ" value={s.behindColor} onChange={(v) => set('behindColor', v)} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Slider label="اندازه" value={s.behindSize} min={50} max={200} unit="٪" onChange={(v) => set('behindSize', v)} />
              <Slider label="پررنگی" value={s.behindOpacity} min={20} max={100} unit="٪" onChange={(v) => set('behindOpacity', v)} />
              <Slider label="فاصلهٔ حروف" value={s.behindLs} min={0} max={20} unit="px" onChange={(v) => set('behindLs', v)} />
            </div>
          </Section>

          {/* نوشته‌های جلو */}
          <Section icon={Type} title="نوشته‌ها" color="text-accent-green">
            <Field label="فونتِ فارسی"><FontSelect value={s.font} onChange={(v) => set('font', v)} fonts={fonts} /></Field>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Field label="نوشتهٔ سفید (خطِ اول)">
                <input value={s.white} onChange={(e) => set('white', e.target.value)} dir="rtl" placeholder="خطِ اول" className="input" />
              </Field>
              <ColorField value={s.whiteColor} onChange={(v) => set('whiteColor', v)} />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Field label="نوشتهٔ زرد (خطِ تأکید)">
                <input value={s.yellow} onChange={(e) => set('yellow', e.target.value)} dir="rtl" placeholder="خطِ دوم" className="input" />
              </Field>
              <ColorField value={s.yellowColor} onChange={(v) => set('yellowColor', v)} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Slider label="اندازهٔ سفید" value={s.whiteSize} min={50} max={200} unit="٪" onChange={(v) => set('whiteSize', v)} />
              <Slider label="اندازهٔ زرد" value={s.yellowSize} min={50} max={200} unit="٪" onChange={(v) => set('yellowSize', v)} />
            </div>
            <Slider label="ارتفاعِ بلوکِ متن" value={s.textTop} min={40} max={92} unit="٪" onChange={(v) => set('textTop', v)} />
            <Switch checked={s.textStroke} onChange={(v) => set('textStroke', v)} label="دورخطِ متن" icon={Type} />
            {s.textStroke && (
              <div className="grid grid-cols-2 gap-2 items-end">
                <ColorField label="رنگِ دورخط" value={s.strokeColor} onChange={(v) => set('strokeColor', v)} />
                <Slider label="ضخامتِ دورخط" value={s.strokeWidth} min={1} max={6} unit="px" onChange={(v) => set('strokeWidth', v)} />
              </div>
            )}
          </Section>
        </div>

        {/* ───── صحنهٔ پیش‌نمایشِ واقعی (چسبان) ───── */}
        <div className="lg:sticky lg:top-4 h-fit">
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Eye size={16} className="text-brand" />
              <span className="text-sm font-black text-ink">پیش‌نمایشِ واقعی</span>
              <span className="text-[11px] text-accent-green flex items-center gap-1 font-bold"><Sparkles size={11} /> دقیقاً همان خروجی</span>
            </div>

            {/* نسبتِ تصویر */}
            <div className="overflow-x-auto -mx-1 px-1">
              <Segmented value={s.ratio} onChange={(v) => set('ratio', v)} options={RATIO_OPTIONS.filter((o) => ratios.includes(o.value))} />
            </div>

            {/* صحنه */}
            <div className="relative mx-auto rounded-2xl overflow-hidden shadow-card bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f1f5f9_0_50%)] bg-[length:24px_24px]"
              style={{ aspectRatio: `${rw}/${rh}`, maxHeight: '60vh', width: 'auto', maxWidth: '100%' }}>
              {preview
                ? <img src={preview} alt="cover" className={`w-full h-full object-contain transition-opacity duration-200 ${rendering ? 'opacity-60' : 'opacity-100'}`} />
                : <div className="absolute inset-0 flex items-center justify-center text-ink-muted"><Loader2 size={26} className="animate-spin" /></div>}
              {rendering && preview && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-ink/70 backdrop-blur text-white text-[11px] rounded-full px-2.5 py-1">
                  <Loader2 size={12} className="animate-spin" /> در حالِ رندر…
                </div>
              )}
              {renderErr && (
                <div className="absolute bottom-2 inset-x-2 bg-accent-red/90 text-white text-xs rounded-xl px-3 py-2 text-center font-bold">{renderErr}</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a href={preview || '#'} download={`cover_${s.ratio.replace(':', 'x')}.png`}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition ${preview && !renderErr ? 'btn-primary' : 'bg-slate-200 text-ink-muted pointer-events-none'}`}>
                <Download size={16} /> دانلودِ کاورِ HD
              </a>
              <span className="text-[11px] text-ink-muted flex items-center gap-1 font-bold"><Maximize2 size={12} /> {RATIO_PX[s.ratio]}</span>
            </div>
            <p className="text-[11px] text-ink-muted text-center">هر تغییری بدهی، پیش‌نمایش خودکار با خروجیِ واقعی به‌روز می‌شود.</p>
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
