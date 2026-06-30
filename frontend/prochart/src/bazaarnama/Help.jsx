import React from 'react';
import { X, HelpCircle } from 'lucide-react';

// رندرِ دیاگرامِ شماتیکِ ساخت‌یافته به SVG (مثلِ تصویرهای راهنمای TradingView، ولی برداری/تمیز).
function Diagram({ diagram, TH }) {
  if (!diagram || !Array.isArray(diagram.shapes) || !diagram.shapes.length) return null;
  const W = (diagram.ref && diagram.ref.w) || 320;
  const H = (diagram.ref && diagram.ref.h) || 200;
  const px = (x) => (x <= 1 ? x * W : x);
  const py = (y) => (y <= 1 ? y * H : y);
  const up = TH.up || '#26a69a';
  const dn = TH.down || '#ef5350';
  const acc = TH.accent || '#2962ff';
  const txt = TH.textStrong || '#d1d4dc';
  const muted = TH.text || '#b2b5be';
  let candleSeed = 0;
  const node = (s, i) => {
    switch (s.kind) {
      case 'candles': {
        // چند کندلِ نمونه به‌عنوانِ پس‌زمینه
        const n = 7, cw = W / (n * 2.2), els = [];
        for (let k = 0; k < n; k++) {
          candleSeed = (candleSeed * 9301 + 49297) % 233280;
          const r = candleSeed / 233280;
          const cx = (k + 0.7) * (W / (n + 0.5));
          const mid = H * (0.35 + 0.3 * Math.sin(k * 0.9));
          const bh = 10 + r * 26, isUp = r > 0.5;
          els.push(<g key={`c${k}`} opacity="0.5">
            <line x1={cx} y1={mid - bh - 8} x2={cx} y2={mid + bh + 8} stroke={isUp ? up : dn} strokeWidth="1" />
            <rect x={cx - cw / 2} y={mid - bh} width={cw} height={bh * 2} fill={isUp ? up : dn} rx="1" />
          </g>);
        }
        return <g key={i}>{els}</g>;
      }
      case 'line':
        return <line key={i} x1={px(s.x1)} y1={py(s.y1)} x2={px(s.x2)} y2={py(s.y2)} stroke={s.accent ? acc : (s.color || muted)} strokeWidth={s.w || 2} strokeDasharray={s.dashed ? '5 4' : ''} markerEnd={s.arrow ? 'url(#ah)' : ''} />;
      case 'hline':
        return <line key={i} x1="0" y1={py(s.y)} x2={W} y2={py(s.y)} stroke={s.accent ? acc : (s.color || muted)} strokeWidth={s.w || 1.5} strokeDasharray={s.dashed ? '5 4' : ''} />;
      case 'vline':
        return <line key={i} x1={px(s.x)} y1="0" x2={px(s.x)} y2={H} stroke={s.accent ? acc : (s.color || muted)} strokeWidth={s.w || 1.5} strokeDasharray={s.dashed ? '5 4' : ''} />;
      case 'rect':
      case 'zone':
        return <rect key={i} x={px(s.x ?? s.x1)} y={py(s.y ?? s.y1)} width={px(s.w ?? (s.x2 - s.x1))} height={py(s.h ?? (s.y2 - s.y1))} fill={(s.color || acc)} fillOpacity={s.fill ?? 0.14} stroke={s.color || acc} strokeWidth="1" strokeDasharray={s.dashed ? '4 3' : ''} rx="2" />;
      case 'dot':
      case 'point':
        return <g key={i}>
          <circle cx={px(s.x)} cy={py(s.y)} r={s.accent ? 5 : 4} fill={s.accent ? acc : (s.color || txt)} stroke="#0008" strokeWidth="0.5" />
          {s.label && <text x={px(s.x) + 7} y={py(s.y) + 4} fontSize="10" fill={s.accent ? acc : muted} fontWeight={s.accent ? 700 : 400}>{s.label}</text>}
        </g>;
      case 'label':
      case 'text':
        return <text key={i} x={px(s.x)} y={py(s.y)} fontSize={s.size || 11} fill={s.accent ? acc : muted} fontWeight={s.accent ? 700 : 500} textAnchor={s.anchor || 'middle'}>{s.text || s.label}</text>;
      default:
        return null;
    }
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 240, background: TH.bg, borderRadius: 8, border: `1px solid ${TH.border}` }} dir="ltr">
      <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={acc} /></marker></defs>
      {diagram.shapes.map(node)}
    </svg>
  );
}

// مودالِ راهنمای یک ابزار/اندیکاتور.
export default function HelpModal({ entry, onClose, TH }) {
  if (!entry) return null;
  // نرمال‌سازی: برخی ورودی‌ها how/tips را رشته نوشته‌اند نه آرایه — جلوگیری از کرشِ .map
  const toArr = (v) => (Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/\n+|(?<=\.)\s+(?=[۱-۹0-9])/).map((x) => x.trim()).filter(Boolean) : (v ? [v] : [])));
  const how = toArr(entry.how);
  const tips = toArr(entry.tips);
  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-auto rounded-xl pc-pop" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.text }}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0" style={{ borderColor: TH.border, background: TH.panel }}>
          <div className="flex items-center gap-2"><HelpCircle size={17} style={{ color: TH.accent }} /><b style={{ color: TH.textStrong }}>{entry.title}</b></div>
          <button onClick={onClose} className="pc-iconbtn w-7 h-7"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 space-y-3 text-[13px] leading-7">
          {entry.what && <p style={{ color: TH.text }}>{entry.what}</p>}
          {entry.diagram && <Diagram diagram={entry.diagram} TH={TH} />}
          {how.length > 0 && (
            <div>
              <div className="font-bold mb-1" style={{ color: TH.textStrong }}>گام‌به‌گامِ استفاده</div>
              <ol className="list-decimal pr-5 space-y-1">{how.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          {tips.length > 0 && (
            <div>
              <div className="font-bold mb-1" style={{ color: TH.textStrong }}>نکته‌های حرفه‌ای</div>
              <ul className="space-y-1">{tips.map((s, i) => <li key={i} className="flex gap-1.5"><span style={{ color: TH.accent }}>•</span><span>{s}</span></li>)}</ul>
            </div>
          )}
          {entry.example && (
            <div className="rounded-lg p-2.5" style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
              <div className="font-bold mb-1 text-[12px]" style={{ color: TH.up }}>مثالِ واقعی</div>
              <p className="text-[12.5px]" style={{ color: TH.text }}>{entry.example}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// دکمهٔ کوچکِ «؟» که کنارِ هر ابزار قرار می‌گیرد.
export function HelpDot({ onClick, TH, size = 13 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title="راهنمای این ابزار" className="inline-flex items-center justify-center rounded-full hover:opacity-100 opacity-50" style={{ width: size + 4, height: size + 4, color: TH ? TH.text : '#888' }}>
      <HelpCircle size={size} />
    </button>
  );
}
