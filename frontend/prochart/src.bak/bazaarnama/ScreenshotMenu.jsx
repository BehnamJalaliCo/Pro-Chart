import React, { useEffect, useRef, useState } from 'react';
import { Camera, Copy, Download, Link as LinkIcon, Droplet, Check, ChevronDown } from 'lucide-react';
import { captureChart, canvasToBlob, downloadBlob, copyBlobToClipboard, copyText, loadScreenshotOpts, saveScreenshotOpts } from './screenshot';

// منوی دوربین (#5): کپی به کلیپ‌بورد / دانلودِ PNG|JPG / کپیِ لینک + تنظیماتِ فرمت/واترمارک/caption.
// propها: getCapture() → { chart, overlay, bg, watermark, caption } ، uploadSnapshot(blob)→Promise<{url}>|null
export default function ScreenshotMenu({ TH, getCapture, uploadSnapshot, iconSize = 18, coarse = false }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState(() => ({ format: 'png', watermark: true, caption: false, ...loadScreenshotOpts() }));
  const ref = useRef(null);
  const toastT = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current); }, []);

  const flash = (msg) => { setToast(msg); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 1800); };
  const setOpt = (patch) => { setOpts((o) => { const n = { ...o, ...patch }; saveScreenshotOpts(patch); return n; }); };

  const build = async (scale) => {
    const cap = getCapture ? getCapture(opts) : null;
    if (!cap) return null;
    return captureChart({ ...cap, scale, format: opts.format, watermark: opts.watermark ? cap.watermark : null, caption: opts.caption ? cap.caption : null });
  };

  const doCopy = async () => {
    setBusy(true);
    try {
      const cv = await build(1); if (!cv) { flash('خطا'); return; }
      const blob = await canvasToBlob(cv, 'png');
      const ok = await copyBlobToClipboard(blob);
      flash(ok ? 'در کلیپ‌بورد کپی شد ✓' : 'کپی پشتیبانی نشد — دانلود کنید');
      if (!ok && blob) downloadBlob(blob, `${(getCapture(opts)?.name) || 'chart'}.png`);
    } finally { setBusy(false); setOpen(false); }
  };

  const doDownload = async () => {
    setBusy(true);
    try {
      const cv = await build(2); if (!cv) { flash('خطا'); return; }
      const blob = await canvasToBlob(cv, opts.format, 0.92);
      downloadBlob(blob, `${(getCapture(opts)?.name) || 'chart'}.${opts.format}`);
      flash('ذخیره شد ✓');
    } finally { setBusy(false); setOpen(false); }
  };

  const doLink = async () => {
    setBusy(true);
    try {
      const cv = await build(2); if (!cv) { flash('خطا'); return; }
      const blob = await canvasToBlob(cv, 'png');
      if (uploadSnapshot) {
        try {
          const r = await uploadSnapshot(blob);
          const url = r && (r.url || r.link);
          if (url) { const full = /^https?:/.test(url) ? url : (window.location.origin + url); await copyText(full); flash('لینک کپی شد ✓'); return; }
        } catch (e) { /* fall through */ }
      }
      // fallback: data-url روی کلیپ‌بورد قابلِ‌اشتراک نیست؛ پس تصویر را کپی/دانلود می‌کنیم
      const ok = await copyBlobToClipboard(blob);
      flash(ok ? 'لینکِ آنلاین در دسترس نیست — تصویر کپی شد' : 'دانلود شد');
      if (!ok && blob) downloadBlob(blob, `${(getCapture(opts)?.name) || 'chart'}.png`);
    } finally { setBusy(false); setOpen(false); }
  };

  const T = TH;
  const item = (icon, label, onClick) => (
    <button onClick={onClick} disabled={busy} className="w-full text-right px-3 py-2 flex items-center gap-2.5 text-[13px] disabled:opacity-50"
      style={{ color: T.textStrong, minHeight: coarse ? 44 : 36 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} title="عکسِ چارت" aria-label="عکسِ چارت" className="p-1.5 rounded-md transition-colors duration-[120ms] flex items-center gap-0.5"
        style={open ? { background: T.accent, color: '#fff' } : { background: T.chipBg }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = T.chipBgHover; }} onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = T.chipBg; }}>
        <Camera size={iconSize} /><ChevronDown size={11} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-56 rounded-lg py-1 shadow-xl" dir="rtl" style={{ background: T.popoverBg, border: `1px solid ${T.border}` }}>
          {item(<Copy size={15} />, 'کپی تصویر', doCopy)}
          {item(<Download size={15} />, 'ذخیرهٔ تصویر', doDownload)}
          {item(<LinkIcon size={15} />, 'کپیِ لینکِ تصویر', doLink)}
          <div className="my-1 border-t" style={{ borderColor: T.border }} />
          {/* فرمت */}
          <div className="px-3 py-1.5 flex items-center justify-between text-[12px]" style={{ color: T.text }}>
            <span>فرمت</span>
            <div className="flex items-center gap-1">
              {['png', 'jpg'].map((f) => (
                <button key={f} onClick={() => setOpt({ format: f })} className="px-2 h-6 rounded text-[11px] uppercase transition-colors duration-[120ms]"
                  style={opts.format === f ? { background: T.accent, color: '#fff' } : { background: T.chipBg, color: T.text }}>{f}</button>
              ))}
            </div>
          </div>
          {/* واترمارک */}
          <button onClick={() => setOpt({ watermark: !opts.watermark })} className="w-full px-3 py-1.5 flex items-center justify-between text-[12px]" style={{ color: T.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <span className="flex items-center gap-2"><Droplet size={14} /> واترمارکِ برند</span>
            <span className="w-4 h-4 flex items-center justify-center rounded" style={{ background: opts.watermark ? T.accent : T.chipBg }}>{opts.watermark && <Check size={12} color="#fff" />}</span>
          </button>
          {/* caption */}
          <button onClick={() => setOpt({ caption: !opts.caption })} className="w-full px-3 py-1.5 flex items-center justify-between text-[12px]" style={{ color: T.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <span>نوارِ نماد/تاریخ</span>
            <span className="w-4 h-4 flex items-center justify-center rounded" style={{ background: opts.caption ? T.accent : T.chipBg }}>{opts.caption && <Check size={12} color="#fff" />}</span>
          </button>
        </div>
      )}
      {toast && (
        <div className="absolute z-50 mt-1 left-0 top-full whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] shadow-lg" dir="rtl"
          style={{ background: T.accent, color: '#fff' }}>{toast}</div>
      )}
    </div>
  );
}
