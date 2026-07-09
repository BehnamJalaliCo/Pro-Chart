import React, { useRef, useState, useCallback, useMemo } from 'react';
import { COMPLETIONS, KEYWORDS, REFERENCE } from './scriptlib';

const KW = new Set(KEYWORDS);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+\.?\d*\b)|([A-Za-z_][A-Za-z0-9_.]*)/g;

function highlight(code) {
  let out = '', last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [full, comment, str, num, ident] = m;
    if (comment) out += `<span style="color:#6b7280">${esc(comment)}</span>`;
    else if (str) out += `<span style="color:#86efac">${esc(str)}</span>`;
    else if (num) out += `<span style="color:#fbbf24">${esc(num)}</span>`;
    else if (ident) {
      const root = ident.split('.')[0];
      const after = code[m.index + full.length];
      if (KW.has(root)) out += `<span style="color:#c084fc">${esc(ident)}</span>`;
      else if (after === '(') out += `<span style="color:#60a5fa">${esc(ident)}</span>`;
      else out += `<span style="color:#d1d5db">${esc(ident)}</span>`;
    }
    last = m.index + full.length;
  }
  out += esc(code.slice(last));
  return out + '\n';
}

const FONT = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PAD = 10;
const LH = 20;
const CH = 7.2; // پهنای تقریبیِ هر کاراکترِ مونو
const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const CLOSERS = new Set([')', ']', '}', '"', "'"]);

// نگاشتِ نامِ تابع → {sig, desc} از رویِ REFERENCE برای «راهنمای توابع» و پارامتر-هینت
const DOCS = (() => {
  const map = {};
  for (const grp of REFERENCE) {
    for (const [sig, desc] of grp.items) {
      const re = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g; let mm, found = false;
      while ((mm = re.exec(sig))) { if (!map[mm[1]]) map[mm[1]] = { sig, desc }; found = true; }
      if (!found) sig.split(/\s+/).forEach((n) => { const k = n.replace(/[^A-Za-z0-9_.]/g, ''); if (k && !map[k]) map[k] = { sig, desc }; });
    }
  }
  return map;
})();

// تشخیصِ فراخوانیِ فعال زیرِ کرسر (برای نمایشِ امضای تابع) — تا نزدیک‌ترین «(» بازِ هم‌خط
function activeCall(upto) {
  let depth = 0;
  for (let i = upto.length - 1; i >= 0; i--) {
    const ch = upto[i];
    if (ch === '\n') return null;
    else if (ch === ')') depth++;
    else if (ch === '(') { if (depth === 0) { const nm = (upto.slice(0, i).match(/[A-Za-z_][A-Za-z0-9_.]*$/) || [''])[0]; return nm && DOCS[nm] ? { name: nm, ...DOCS[nm] } : null; } depth--; }
  }
  return null;
}

export default function CodeEditor({ value: rawValue, onChange, onRun, onSave, onNew, errorLine }) {
  const value = typeof rawValue === 'string' ? rawValue : ''; // محافظت در برابرِ undefined (اسکریپتِ خراب)
  const taRef = useRef(null);
  const preRef = useRef(null);
  const gutRef = useRef(null);
  const [ac, setAc] = useState(null); // {items, idx, top, left}
  const [sel, setSel] = useState(0); // موقعیتِ کرسر (selectionStart)
  const [scrollY, setScrollY] = useState(0);
  const [help, setHelp] = useState(false); // پنلِ راهنمای توابع
  const [q, setQ] = useState('');

  const lines = useMemo(() => value.split('\n').length, [value]);

  const caret = useMemo(() => {
    const upto = value.slice(0, Math.min(sel, value.length));
    const parts = upto.split('\n');
    return { line: parts.length - 1, col: (parts[parts.length - 1] || '').length };
  }, [value, sel]);

  // امضای تابعِ فعال (فقط وقتی اتوکامپلیت باز نیست)
  const hint = useMemo(() => (ac ? null : activeCall(value.slice(0, Math.min(sel, value.length)))), [ac, value, sel]);

  const sync = () => {
    const ta = taRef.current; if (!ta) return;
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop;
    setScrollY(ta.scrollTop);
  };

  const setCaret = (ta, pos) => requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos; setSel(pos); });

  const updateAc = useCallback((ta) => {
    const pos = ta.selectionStart;
    const upto = ta.value.slice(0, pos);
    const word = (upto.match(/[A-Za-z_][A-Za-z0-9_.]*$/) || [''])[0];
    if (word.length < 1) { setAc(null); return; }
    const items = COMPLETIONS.filter((c) => c.toLowerCase().startsWith(word.toLowerCase()) && c !== word).slice(0, 8);
    if (!items.length) { setAc(null); return; }
    const line = upto.split('\n').length - 1;
    const col = (upto.split('\n').pop() || '').length;
    setAc({ items, idx: 0, word, top: PAD + (line + 1) * LH - ta.scrollTop, left: 44 + PAD + col * CH });
  }, []);

  const accept = (ta, item) => {
    const pos = ta.selectionStart;
    const upto = ta.value.slice(0, pos);
    const word = (upto.match(/[A-Za-z_][A-Za-z0-9_.]*$/) || [''])[0];
    const start = pos - word.length;
    const nv = ta.value.slice(0, start) + item + ta.value.slice(pos);
    onChange(nv);
    setAc(null);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + item.length; setSel(start + item.length); });
  };

  // درجِ متن در محلِ کرسر (راهنما/دکمه‌ها)
  const insertText = (t) => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const nv = ta.value.slice(0, s) + t + ta.value.slice(en);
    onChange(nv);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + t.length; setSel(s + t.length); });
  };

  // کامنت/آنکامنتِ خطوطِ انتخاب‌شده (Ctrl+/)
  const toggleComment = (ta) => {
    const s = ta.selectionStart, en = ta.selectionEnd;
    const v = ta.value;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', en); if (le === -1) le = v.length;
    const block = v.slice(ls, le);
    const rows = block.split('\n');
    const allC = rows.every((r) => r.trim() === '' || /^\s*\/\//.test(r));
    const next = rows.map((r) => {
      if (r.trim() === '') return r;
      if (allC) return r.replace(/^(\s*)\/\/ ?/, '$1');
      const lead = (r.match(/^\s*/) || [''])[0];
      return lead + '// ' + r.slice(lead.length);
    }).join('\n');
    const nv = v.slice(0, ls) + next + v.slice(le);
    onChange(nv);
    const delta = next.length - block.length;
    requestAnimationFrame(() => { ta.selectionStart = ls; ta.selectionEnd = en + delta; setSel(en + delta); });
  };

  const onKey = (e) => {
    const ta = taRef.current;
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc((a) => ({ ...a, idx: (a.idx + 1) % a.items.length })); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc((a) => ({ ...a, idx: (a.idx - 1 + a.items.length) % a.items.length })); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(ta, ac.items[ac.idx]); return; }
      if (e.key === 'Escape') { setAc(null); return; }
    }
    // اجرا (افزودن به چارت)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); return; }
    // فراخوانیِ دستیِ اتوکامپلیت
    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); updateAc(ta); return; }
    // کامنت/آنکامنت
    if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleComment(ta); return; }
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; const nv = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); onChange(nv); setCaret(ta, s + 2); return; }
    // Enter با حفظِ تورفتگیِ خطِ قبل
    if (e.key === 'Enter' && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      const before = ta.value.slice(0, s);
      const indent = (before.slice(before.lastIndexOf('\n') + 1).match(/^[\t ]*/) || [''])[0];
      const ins = '\n' + indent;
      const nv = ta.value.slice(0, s) + ins + ta.value.slice(en);
      onChange(nv); setCaret(ta, s + ins.length); return;
    }
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    // پرشِ روی جفتِ بسته (skip-over)
    if (!mod && CLOSERS.has(e.key) && ta.selectionStart === ta.selectionEnd && ta.value[ta.selectionStart] === e.key) {
      e.preventDefault(); setCaret(ta, ta.selectionStart + 1); return;
    }
    // بستنِ خودکارِ جفت‌ها
    if (!mod && PAIRS[e.key] && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      const s = ta.selectionStart;
      const nv = ta.value.slice(0, s) + e.key + PAIRS[e.key] + ta.value.slice(s);
      onChange(nv); setCaret(ta, s + 1); return;
    }
    // حذفِ جفتِ خالی با Backspace
    if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
      const s = ta.selectionStart, a = ta.value[s - 1], b = ta.value[s];
      if (PAIRS[a] && PAIRS[a] === b) { e.preventDefault(); const nv = ta.value.slice(0, s - 1) + ta.value.slice(s + 1); onChange(nv); setCaret(ta, s - 1); return; }
    }
  };

  const refList = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return REFERENCE;
    return REFERENCE.map((g) => ({ g: g.g, items: g.items.filter(([sig, desc]) => (sig + ' ' + desc).toLowerCase().includes(s)) })).filter((g) => g.items.length);
  }, [q]);

  const line0 = caret.line;
  const hintLeft = Math.min(44 + PAD + caret.col * CH, 400);

  return (
    <div style={{ position: 'relative', height: '100%', background: '#0b0e14', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} dir="ltr">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* شماره‌خط */}
        <div ref={gutRef} style={{ width: 44, flexShrink: 0, overflow: 'hidden', textAlign: 'right', padding: `${PAD}px 6px`, font: FONT, lineHeight: LH + 'px', color: '#3f4658', userSelect: 'none', background: '#0a0d12' }}>
          {Array.from({ length: lines }, (_, i) => (<div key={i} style={{ color: errorLine === i + 1 ? '#ef4444' : (i === line0 ? '#a9b1c2' : undefined) }}>{i + 1}</div>))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* لایهٔ هایلایتِ خطِ فعال و خطِ خطا (پشتِ متن) */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: LH, top: PAD + line0 * LH - scrollY, background: 'rgba(255,255,255,.045)' }} />
            {errorLine > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, height: LH, top: PAD + (errorLine - 1) * LH - scrollY, background: 'rgba(239,68,68,.13)', boxShadow: 'inset 2px 0 0 #ef4444' }} />
            )}
          </div>
          <pre ref={preRef} aria-hidden style={{ position: 'absolute', inset: 0, margin: 0, padding: PAD, font: FONT, lineHeight: LH + 'px', whiteSpace: 'pre', overflow: 'auto', pointerEvents: 'none', tabSize: 2 }}
            dangerouslySetInnerHTML={{ __html: highlight(value) }} />
          <textarea ref={taRef} value={value} spellCheck={false} wrap="off"
            onChange={(e) => { onChange(e.target.value); setSel(e.target.selectionStart); updateAc(e.target); }}
            onScroll={sync} onKeyDown={onKey}
            onKeyUp={(e) => setSel(e.target.selectionStart)}
            onClick={(e) => { setAc(null); setSel(e.target.selectionStart); }}
            onSelect={(e) => setSel(e.target.selectionStart)}
            onBlur={() => setTimeout(() => setAc(null), 150)}
            style={{ position: 'absolute', inset: 0, margin: 0, padding: PAD, font: FONT, lineHeight: LH + 'px', whiteSpace: 'pre', overflow: 'auto', background: 'transparent', color: 'transparent', caretColor: '#e5e7eb', border: 'none', outline: 'none', resize: 'none', tabSize: 2 }} />
          {/* امضای تابعِ فعال */}
          {hint && (
            <div style={{ position: 'absolute', top: Math.max(PAD, PAD + (line0 + 1) * LH - scrollY), left: hintLeft, zIndex: 25, background: '#161b27', border: '1px solid #2a3142', borderRadius: 6, boxShadow: '0 6px 20px #0007', padding: '4px 10px', maxWidth: 360, pointerEvents: 'none' }}>
              <span style={{ font: FONT, fontSize: 12, color: '#7dd3fc' }}>{hint.sig}</span>
              <span style={{ fontSize: 11, color: '#8a93a6', marginInlineStart: 8 }}>{hint.desc}</span>
            </div>
          )}
          {/* اتوکامپلیت */}
          {ac && (
            <div style={{ position: 'absolute', top: Math.max(PAD, ac.top), left: Math.min(ac.left, 400), zIndex: 30, background: '#161b27', border: '1px solid #2a3142', borderRadius: 6, boxShadow: '0 6px 20px #0008', minWidth: 200, maxWidth: 420, maxHeight: 240, overflow: 'auto' }}>
              {ac.items.map((it, i) => {
                const d = DOCS[it];
                return (
                  <div key={it} onMouseDown={(e) => { e.preventDefault(); accept(taRef.current, it); }}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: i === ac.idx ? '#2962FF' : 'transparent', color: i === ac.idx ? '#fff' : '#cbd2e0' }}>
                    <span style={{ font: FONT }}>{it}</span>
                    {d && <span style={{ fontSize: 10.5, color: i === ac.idx ? 'rgba(255,255,255,.75)' : '#6b7280', marginInlineStart: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{d.desc}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* پنلِ راهنمای توابع */}
        {help && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, zIndex: 40, background: '#0e1420', borderInlineStart: '1px solid #1b2130', display: 'flex', flexDirection: 'column' }} dir="rtl">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid #1b2130' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c084fc' }}>ƒ راهنمای توابع</span>
              <button onClick={() => setHelp(false)} title="بستن" style={{ marginInlineStart: 'auto', color: '#8a93a6', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی تابع…" style={{ margin: 8, padding: '5px 8px', fontSize: 12, background: '#161b27', color: '#d1d4dc', border: '1px solid #2a3142', borderRadius: 4, outline: 'none' }} />
            <div style={{ flex: 1, overflow: 'auto', padding: '0 4px 8px' }}>
              {refList.map((g) => (
                <div key={g.g} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10.5, color: '#6b7280', padding: '4px 6px 2px', fontWeight: 700 }}>{g.g}</div>
                  {g.items.map(([sig, desc], i) => (
                    <div key={i} onMouseDown={(e) => { e.preventDefault(); insertText((sig.match(/^[A-Za-z_][A-Za-z0-9_.]*/) || [sig])[0]); }}
                      title="درجِ نامِ تابع در محلِ کرسر" style={{ padding: '3px 6px', borderRadius: 4, cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#161b27'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <div dir="ltr" style={{ font: FONT, fontSize: 11.5, color: '#7dd3fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sig}</div>
                      <div style={{ fontSize: 10.5, color: '#8a93a6' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              ))}
              {!refList.length && <div style={{ fontSize: 11, color: '#6b7280', padding: 8 }}>موردی یافت نشد.</div>}
            </div>
          </div>
        )}
      </div>

      {/* نوارِ وضعیت + اکشن‌ها */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 24, flexShrink: 0, padding: '0 8px', background: '#0a0d12', borderTop: '1px solid #1b2130', font: FONT, fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
        <span>Ln {line0 + 1}, Col {caret.col + 1}</span>
        <span style={{ color: '#3f4658' }}>·</span>
        <span>{lines} خط</span>
        {errorLine > 0 && <span style={{ color: '#ef4444' }}>⚠ خطا در خطِ {errorLine}</span>}
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} dir="rtl">
          {onNew && <button onClick={onNew} title="اسکریپتِ جدید" style={btnStyle('#161b27', '#cbd2e0')}>جدید</button>}
          {onSave && <button onClick={onSave} title="ذخیره" style={btnStyle('#161b27', '#cbd2e0')}>ذخیره</button>}
          <button onClick={() => setHelp((v) => !v)} title="راهنمای توابع" style={btnStyle(help ? 'rgba(41,98,255,.16)' : '#161b27', help ? '#7dd3fc' : '#cbd2e0')}>ƒ راهنما</button>
          {onRun && <button onClick={onRun} title="افزودن به چارت (Ctrl+Enter)" style={btnStyle('#2962ff', '#fff')}>افزودن به چارت</button>}
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return { display: 'flex', alignItems: 'center', gap: 4, height: 18, padding: '0 8px', fontSize: 11, borderRadius: 4, background: bg, color, border: 'none', cursor: 'pointer', lineHeight: 1 };
}
