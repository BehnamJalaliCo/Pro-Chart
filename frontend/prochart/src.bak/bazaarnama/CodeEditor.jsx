import React, { useRef, useState, useCallback, useMemo } from 'react';
import { COMPLETIONS, KEYWORDS } from './scriptlib';

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

export default function CodeEditor({ value: rawValue, onChange, onRun, errorLine }) {
  const value = typeof rawValue === 'string' ? rawValue : ''; // محافظت در برابرِ undefined (اسکریپتِ خراب)
  const taRef = useRef(null);
  const preRef = useRef(null);
  const gutRef = useRef(null);
  const [ac, setAc] = useState(null); // {items, idx, top, left}

  const lines = useMemo(() => value.split('\n').length, [value]);

  const sync = () => {
    const ta = taRef.current; if (!ta) return;
    if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop;
  };

  const updateAc = useCallback((ta) => {
    const pos = ta.selectionStart;
    const upto = ta.value.slice(0, pos);
    const word = (upto.match(/[A-Za-z_][A-Za-z0-9_.]*$/) || [''])[0];
    if (word.length < 1) { setAc(null); return; }
    const items = COMPLETIONS.filter((c) => c.toLowerCase().startsWith(word.toLowerCase()) && c !== word).slice(0, 8);
    if (!items.length) { setAc(null); return; }
    const line = upto.split('\n').length - 1;
    const col = (upto.split('\n').pop() || '').length;
    setAc({ items, idx: 0, word, top: PAD + (line + 1) * LH - ta.scrollTop, left: 44 + PAD + col * 7.2 });
  }, []);

  const accept = (ta, item) => {
    const pos = ta.selectionStart;
    const upto = ta.value.slice(0, pos);
    const word = (upto.match(/[A-Za-z_][A-Za-z0-9_.]*$/) || [''])[0];
    const start = pos - word.length;
    const nv = ta.value.slice(0, start) + item + ta.value.slice(pos);
    onChange(nv);
    setAc(null);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + item.length; });
  };

  const onKey = (e) => {
    const ta = taRef.current;
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc((a) => ({ ...a, idx: (a.idx + 1) % a.items.length })); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc((a) => ({ ...a, idx: (a.idx - 1 + a.items.length) % a.items.length })); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(ta, ac.items[ac.idx]); return; }
      if (e.key === 'Escape') { setAc(null); return; }
    }
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; const nv = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); onChange(nv); requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; }); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); return; }
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: '#0b0e14', overflow: 'hidden', display: 'flex' }} dir="ltr">
      {/* شماره‌خط */}
      <div ref={gutRef} style={{ width: 44, flexShrink: 0, overflow: 'hidden', textAlign: 'right', padding: `${PAD}px 6px`, font: FONT, lineHeight: LH + 'px', color: '#3f4658', userSelect: 'none', background: '#0a0d12' }}>
        {Array.from({ length: lines }, (_, i) => (<div key={i} style={{ color: errorLine === i + 1 ? '#ef4444' : undefined }}>{i + 1}</div>))}
      </div>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <pre ref={preRef} aria-hidden style={{ position: 'absolute', inset: 0, margin: 0, padding: PAD, font: FONT, lineHeight: LH + 'px', whiteSpace: 'pre', overflow: 'auto', pointerEvents: 'none', tabSize: 2 }}
          dangerouslySetInnerHTML={{ __html: highlight(value) }} />
        <textarea ref={taRef} value={value} spellCheck={false} wrap="off"
          onChange={(e) => { onChange(e.target.value); updateAc(e.target); }}
          onScroll={sync} onKeyDown={onKey} onClick={() => setAc(null)} onBlur={() => setTimeout(() => setAc(null), 150)}
          style={{ position: 'absolute', inset: 0, margin: 0, padding: PAD, font: FONT, lineHeight: LH + 'px', whiteSpace: 'pre', overflow: 'auto', background: 'transparent', color: 'transparent', caretColor: '#e5e7eb', border: 'none', outline: 'none', resize: 'none', tabSize: 2 }} />
        {ac && (
          <div style={{ position: 'absolute', top: Math.max(PAD, ac.top), left: Math.min(ac.left, 400), zIndex: 30, background: '#161b27', border: '1px solid #2a3142', borderRadius: 6, boxShadow: '0 6px 20px #0008', minWidth: 160, maxHeight: 200, overflow: 'auto' }}>
            {ac.items.map((it, i) => (
              <div key={it} onMouseDown={(e) => { e.preventDefault(); accept(taRef.current, it); }}
                style={{ padding: '4px 10px', fontSize: 12, font: FONT, cursor: 'pointer', background: i === ac.idx ? '#2962FF' : 'transparent', color: i === ac.idx ? '#fff' : '#cbd2e0' }}>{it}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
