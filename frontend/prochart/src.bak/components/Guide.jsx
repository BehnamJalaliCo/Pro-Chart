import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Info, Lightbulb, CheckCircle2, BookOpen } from 'lucide-react';
import { GUIDES } from '../guides';

// دکمهٔ «راهنمای استفاده» — در سربرگِ هر بخش. آموزشِ پیشرفته و گام‌به‌گامِ آن بخش را باز می‌کند.
export function GuideButton({ guideKey, label = 'راهنمای استفاده', auto = false, className = '' }) {
  const g = GUIDES[guideKey];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!auto || !g) return;
    const k = 'cp_guide_seen_' + guideKey;
    try {
      if (!localStorage.getItem(k)) { setOpen(true); localStorage.setItem(k, '1'); }
    } catch { /* */ }
  }, [guideKey, auto, g]);

  if (!g) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-green/40 text-brand-green text-sm font-bold hover:bg-brand-green/10 transition ${className}`}>
        <HelpCircle size={16} /> {label}
      </button>
      {open && createPortal(<GuideModal g={g} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function GuideModal({ g, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* هدر */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-border bg-surface-card shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-green/15 grid place-items-center text-brand-green shrink-0"><BookOpen size={18} /></div>
            <div className="min-w-0">
              <h3 className="font-black text-text-primary truncate">راهنمای «{g.title}»</h3>
              <p className="text-[11px] text-text-muted">آموزشِ گام‌به‌گامِ این بخش</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-text-muted hover:bg-surface-elevated grid place-items-center shrink-0"><X size={18} /></button>
        </div>

        {/* بدنه */}
        <div className="px-5 py-4 overflow-y-auto grow space-y-5">
          {g.intro && (
            <div className="flex items-start gap-2 bg-brand-green/8 text-text-secondary rounded-xl px-3.5 py-3 text-sm leading-7">
              <Info size={17} className="text-brand-green shrink-0 mt-0.5" />
              <span>{g.intro}</span>
            </div>
          )}

          {(g.features || []).map((f, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4">
              <div className="font-black text-text-primary text-[15px] mb-1.5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-brand-green/15 text-brand-green grid place-items-center text-xs font-black shrink-0">{i + 1}</span>
                {f.name}
              </div>
              {f.what && <p className="text-sm text-text-secondary leading-7 mb-2">{f.what}</p>}
              {Array.isArray(f.how) && f.how.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {f.how.map((step, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm text-text-secondary leading-7">
                      <CheckCircle2 size={15} className="text-brand-green shrink-0 mt-1" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {f.tip && (
                <div className="flex items-start gap-2 bg-amber-400/10 text-amber-500 rounded-lg px-3 py-2 text-xs leading-6 mt-2">
                  <Lightbulb size={14} className="shrink-0 mt-0.5" /> <span>{f.tip}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-surface-border bg-surface-card shrink-0">
          <button onClick={onClose} className="btn-success w-full py-2.5">فهمیدم، شروع می‌کنم ✓</button>
        </div>
      </div>
    </div>
  );
}

// راهنمای کوچکِ کنارِ یک ابزار — آیکونِ (i) که با کلیک توضیحِ کوتاه نشان می‌دهد.
export function InfoTip({ text, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}
        className="text-text-muted hover:text-brand-green" aria-label="راهنما">
        <Info size={15} />
      </button>
      {open && (
        <span className="absolute z-50 top-6 right-0 w-56 bg-surface-card border border-surface-border rounded-xl shadow-xl p-3 text-xs text-text-secondary leading-6 font-normal">
          {text}
        </span>
      )}
    </span>
  );
}
