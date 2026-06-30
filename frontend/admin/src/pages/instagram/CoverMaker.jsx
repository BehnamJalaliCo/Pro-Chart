import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Search, Upload, Image as ImageIcon, Wand2, Download, Loader2, Type, Palette, X,
  Sliders, Sparkles, RotateCcw, Layers, MousePointerClick, Eye, Maximize2,
} from 'lucide-react';
import { instagramAPI } from '../../api/client';

/* ───────────────────────── استودیوی ساختِ کاور ─────────────────────────
   پیش‌نمایش = رندرِ واقعیِ سرور (debounced) → ۱۰۰٪ WYSIWYG، نه تقریبِ مرورگری. */

const RATIO_WH = { '9:16': [9, 16], '4:5': [4, 5], '1:1': [1, 1] };
const RATIO_LABEL = { '9:16': 'ریلز / استوری', '4:5': 'پستِ عمودی', '1:1': 'مربع' };

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

/* ── اجزای UI ── */
const Card = ({ icon, title, hint, accent = 'text-fuchsia-400', children }) => (
  <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
    <div className="flex items-center gap-2">
      <span className={accent}>{icon}</span>
      <h4 className="text-sm font-bold text-slate-100">{title}</h4>
      {hint && <span className="text-[11px] text-slate-500 mr-auto">{hint}</span>}
    </div>
    {children}
  </div>
);

const Color = ({ value, onChange }) => (
  <span className="relative inline-flex shrink-0">
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border border-surface-border" />
  </span>
);

const Range = ({ label, value, min, max, step = 1, suffix = '٪', onChange }) => (
  <label className="block">
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-mono bg-slate-800 rounded px-1.5 py-0.5">{value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(+e.target.value)} className="w-full accent-fuchsia-500" />
  </label>
);

const Text = ({ value, onChange, placeholder, dir = 'rtl', color, onColor }) => (
  <div className="flex gap-2 items-center">
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 outline-none" />
    {onColor && <Color value={color} onChange={onColor} />}
  </div>
);

const FontSelect = ({ value, onChange, fonts }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:border-fuchsia-500 outline-none cursor-pointer">
    {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
  </select>
);

export default function CoverMaker() {
  const [fonts, setFonts] = useState(['Vazirmatn', 'Lalezar', 'Gulzar', 'Markazi Text', 'Archivo Black']);
  const [ratios, setRatios] = useState(['9:16', '4:5', '1:1']);
  const [s, setS] = useState(DEFAULTS);
  const set = (k, v) => setS((o) => ({ ...o, [k]: v }));
  const setMany = (obj) => setS((o) => ({ ...o, ...obj }));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState('');           // 'search' | 'base' | 'el'
  const [preview, setPreview] = useState('');      // url رندرِ واقعی
  const [rendering, setRendering] = useState(false);
  const [renderErr, setRenderErr] = useState('');
  const baseRef = useRef();
  const elRef = useRef();
  const renderSeq = useRef(0);

  /* فونت‌ها + لینکِ گوگل‌فونت برای دراپ‌داون‌ها */
  useEffect(() => {
    instagramAPI.coverFonts().then((d) => { setFonts(d.fonts || fonts); setRatios(d.ratios || ratios); }).catch(() => {});
    const id = 'cover-gfonts';
    if (!document.getElementById(id)) {
      const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@600;800;900&family=Lalezar&family=Gulzar&family=Markazi+Text:wght@600;700&family=Archivo+Black&display=swap';
      document.head.appendChild(l);
    } // eslint-disable-next-line
  }, []);

  /* payload یکسان برای پیش‌نمایش و خروجی */
  const buildPayload = useCallback(() => ({
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

  /* ── پیش‌نمایشِ زنده = رندرِ واقعیِ سرور (debounced) ── */
  useEffect(() => {
    const seq = ++renderSeq.current;
    setRendering(true);
    const t = setTimeout(async () => {
      try {
        const r = await instagramAPI.coverRender(buildPayload());
        if (seq === renderSeq.current) { setPreview(`${r.url}?t=${Date.now()}`); setRenderErr(''); }
      } catch (er) {
        if (seq === renderSeq.current) setRenderErr(er?.response?.data?.detail || 'خطای رندر');
      } finally {
        if (seq === renderSeq.current) setRendering(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [buildPayload]);

  /* ── آپلودها ── */
  const uploadBase = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy('base');
    try { const fd = new FormData(); fd.append('file', f); const r = await instagramAPI.uploadMedia(fd); setMany({ base: 'upload', baseFile: r.filename, basePrev: r.url }); }
    catch (er) { alert(er?.response?.data?.detail || 'خطای آپلود'); } finally { setBusy(''); if (baseRef.current) baseRef.current.value = ''; }
  };
  const uploadEl = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy('el');
    try { const fd = new FormData(); fd.append('file', f); const r = await instagramAPI.uploadMedia(fd); setMany({ elFile: r.filename, elIcon: '' }); }
    catch (er) { alert(er?.response?.data?.detail || 'خطای آپلود'); } finally { setBusy(''); if (elRef.current) elRef.current.value = ''; }
  };
  const search = async () => {
    if (!query.trim()) return; setBusy('search');
    try { const r = await instagramAPI.coverSearch(query.trim()); setResults(r.results || []); }
    catch (er) { alert(er?.response?.data?.detail || 'جستجو ناموفق'); } finally { setBusy(''); }
  };

  const [rw, rh] = RATIO_WH[s.ratio] || [9, 16];

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-5">
      {/* ───── ستونِ کنترل‌ها ───── */}
      <div className="space-y-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pl-1 pb-4">
        <div className="flex items-center gap-2">
          <Wand2 size={18} className="text-fuchsia-400" />
          <h3 className="font-bold text-slate-100">استودیوی ساختِ کاور</h3>
          <button onClick={() => { setS(DEFAULTS); setResults([]); }} title="بازنشانی"
            className="mr-auto flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400"><RotateCcw size={13} /> ریست</button>
        </div>

        {/* قالب‌های آماده */}
        <Card icon={<Sparkles size={15} />} title="قالبِ آماده" accent="text-amber-400">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => setMany({ ...p.v, basePrev: p.v.base === 'orange' ? ORANGE_URL : '' })}
                className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 hover:border-fuchsia-500 text-slate-200 rounded-lg px-2.5 py-2 text-right">
                <span>{p.emoji}</span> {p.name}
              </button>
            ))}
          </div>
        </Card>

        {/* پس‌زمینه */}
        <Card icon={<ImageIcon size={15} />} title="پس‌زمینه" accent="text-sky-400">
          <div className="grid grid-cols-3 gap-2">
            {[['orange', '🟠 نارنجیِ اصل'], ['gradient', '🎨 گرادیان'], ['upload', '⬆️ آپلود']].map(([k, lbl]) => (
              <button key={k} onClick={() => { if (k === 'upload') baseRef.current?.click(); else setMany({ base: k, basePrev: k === 'orange' ? ORANGE_URL : '' }); }}
                className={`text-xs rounded-lg px-2 py-2 border ${s.base === k ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-200' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                {busy === 'base' && k === 'upload' ? '...' : lbl}
              </button>
            ))}
            <input ref={baseRef} type="file" accept="image/*" onChange={uploadBase} className="hidden" />
          </div>
          {s.base === 'gradient' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">از <Color value={s.bgFrom} onChange={(v) => set('bgFrom', v)} /> تا <Color value={s.bgTo} onChange={(v) => set('bgTo', v)} /></div>
          )}
          {s.base === 'upload' && s.basePrev && (
            <div className="flex items-center gap-2"><img src={s.basePrev} alt="" className="w-9 h-12 object-cover rounded" /><span className="text-xs text-emerald-400">✓ کاورِ خامِ آپلودشده</span></div>
          )}
        </Card>

        {/* المان */}
        <Card icon={<MousePointerClick size={15} />} title="المانِ وسط" hint="فارسی هم سرچ می‌شود" accent="text-fuchsia-400">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="طلا، شمع، موشک، نمودار…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 outline-none" />
            <button onClick={search} disabled={busy === 'search'} className="flex items-center justify-center bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg px-3 shrink-0 disabled:opacity-50">
              {busy === 'search' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
          {results.length > 0 && (
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
              {results.map((r) => (
                <button key={r.id} onClick={() => setMany({ elIcon: r.id, elFile: '' })} title={r.id}
                  className={`aspect-square rounded-lg p-1.5 bg-slate-800 flex items-center justify-center ring-2 ${s.elIcon === r.id ? 'ring-fuchsia-500' : 'ring-transparent hover:ring-slate-600'}`}>
                  <img src={r.preview} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => elRef.current?.click()} className="flex items-center gap-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5">{busy === 'el' ? '...' : <><Upload size={13} /> آپلودِ PNG</>}</button>
            {s.elFile && <span className="text-emerald-400">✓ المانِ آپلودشده</span>}
            {(s.elIcon || s.elFile) && <button onClick={() => setMany({ elIcon: '', elFile: '' })} className="text-rose-400 mr-auto">حذفِ المان</button>}
            <input ref={elRef} type="file" accept="image/png" onChange={uploadEl} className="hidden" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Range label="بزرگنمایی" value={s.elScale} min={15} max={300} onChange={(v) => set('elScale', v)} />
            <Range label="ارتفاع" value={s.elTop} min={2} max={75} onChange={(v) => set('elTop', v)} />
            <Range label="چرخش" value={s.elRotate} min={-45} max={45} suffix="°" onChange={(v) => set('elRotate', v)} />
            <Range label="شفافیت" value={s.elOpacity} min={10} max={100} onChange={(v) => set('elOpacity', v)} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.elShadow} onChange={(e) => set('elShadow', e.target.checked)} className="accent-fuchsia-500" /> سایه</label>
            <span className="flex items-center gap-1"><Palette size={13} /> تک‌رنگ <Color value={s.elColor || '#ffffff'} onChange={(v) => set('elColor', v)} /></span>
            {s.elColor && <button onClick={() => set('elColor', '')} className="text-rose-400">حذفِ رنگ</button>}
          </div>
        </Card>

        {/* متنِ محوِ پشت */}
        <Card icon={<Layers size={15} />} title="متنِ محوِ پشت" accent="text-purple-300">
          <Text value={s.behind} onChange={(v) => set('behind', v)} placeholder="مثلاً TIMEFRAME یا GOLD" dir="ltr" color={s.behindColor} onColor={(v) => set('behindColor', v)} />
          <div>
            <div className="text-xs text-slate-400 mb-1">فونتِ نوشتهٔ پشت</div>
            <FontSelect value={s.behindFont} onChange={(v) => set('behindFont', v)} fonts={fonts} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Range label="اندازه" value={s.behindSize} min={50} max={200} onChange={(v) => set('behindSize', v)} />
            <Range label="پررنگیِ ردیفِ اول" value={s.behindOpacity} min={20} max={100} onChange={(v) => set('behindOpacity', v)} />
            <Range label="فاصلهٔ حروف" value={s.behindLs} min={0} max={20} suffix="px" onChange={(v) => set('behindLs', v)} />
          </div>
        </Card>

        {/* متن‌های جلو */}
        <Card icon={<Type size={15} />} title="نوشته‌ها" accent="text-emerald-400">
          <div><div className="text-xs text-slate-400 mb-1">فونتِ فارسی</div><FontSelect value={s.font} onChange={(v) => set('font', v)} fonts={fonts} /></div>
          <div><div className="text-xs text-slate-400 mb-1">نوشتهٔ سفید</div><Text value={s.white} onChange={(v) => set('white', v)} placeholder="خطِ اول" color={s.whiteColor} onColor={(v) => set('whiteColor', v)} /></div>
          <div><div className="text-xs text-slate-400 mb-1">نوشتهٔ زرد</div><Text value={s.yellow} onChange={(v) => set('yellow', v)} placeholder="خطِ دوم (تأکید)" color={s.yellowColor} onColor={(v) => set('yellowColor', v)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Range label="اندازهٔ سفید" value={s.whiteSize} min={50} max={200} onChange={(v) => set('whiteSize', v)} />
            <Range label="اندازهٔ زرد" value={s.yellowSize} min={50} max={200} onChange={(v) => set('yellowSize', v)} />
          </div>
          <Range label="ارتفاعِ بلوکِ متن" value={s.textTop} min={40} max={92} onChange={(v) => set('textTop', v)} />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.textStroke} onChange={(e) => set('textStroke', e.target.checked)} className="accent-fuchsia-500" /> دورخط</label>
            {s.textStroke && <><Color value={s.strokeColor} onChange={(v) => set('strokeColor', v)} /><span>ضخامت<input type="range" min="1" max="6" value={s.strokeWidth} onChange={(e) => set('strokeWidth', +e.target.value)} className="accent-fuchsia-500 w-16 mr-1" /></span></>}
          </div>
        </Card>
      </div>

      {/* ───── صحنهٔ پیش‌نمایشِ واقعی ───── */}
      <div className="lg:sticky lg:top-4 h-fit space-y-3">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={15} className="text-fuchsia-400" />
            <span className="text-sm font-bold text-slate-200">پیش‌نمایشِ واقعی</span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Sparkles size={11} /> دقیقاً همان خروجی</span>
            {/* نسبت */}
            <div className="mr-auto flex bg-slate-800 rounded-lg p-0.5">
              {ratios.map((r) => (
                <button key={r} onClick={() => set('ratio', r)} title={RATIO_LABEL[r]}
                  className={`text-xs px-2.5 py-1 rounded-md ${s.ratio === r ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{r}</button>
              ))}
            </div>
          </div>

          {/* صحنه */}
          <div className="relative mx-auto rounded-xl overflow-hidden bg-[repeating-conic-gradient(#1e293b_0_25%,#0f172a_0_50%)] bg-[length:24px_24px] shadow-2xl"
            style={{ aspectRatio: `${rw}/${rh}`, maxHeight: '64vh', width: 'auto', maxWidth: '100%' }}>
            {preview
              ? <img src={preview} alt="cover" className={`w-full h-full object-contain transition-opacity duration-200 ${rendering ? 'opacity-60' : 'opacity-100'}`} />
              : <div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 size={26} className="animate-spin" /></div>}
            {rendering && preview && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur text-white text-[11px] rounded-full px-2.5 py-1">
                <Loader2 size={12} className="animate-spin" /> در حالِ رندر…
              </div>
            )}
            {renderErr && <div className="absolute bottom-2 inset-x-2 bg-rose-600/90 text-white text-xs rounded-lg px-3 py-2 text-center">{renderErr}</div>}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <a href={preview || '#'} download={`cover_${s.ratio.replace(':', 'x')}.png`}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${preview ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 pointer-events-none'}`}>
              <Download size={16} /> دانلودِ کاورِ HD
            </a>
            <div className="text-[11px] text-slate-500 flex items-center gap-1"><Maximize2 size={12} /> {rw === 9 ? '1080×1920' : rw === 4 ? '1080×1350' : '1080×1080'}</div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 text-center">هر تغییری بدهی، پیش‌نمایش خودکار با خروجیِ واقعی به‌روز می‌شود.</p>
        </div>
      </div>
    </div>
  );
}
