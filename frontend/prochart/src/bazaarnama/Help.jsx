import React from 'react';
import { X, HelpCircle, Keyboard } from './tvIcons';
import { SHORTCUT_GROUPS } from './hotkeys';

// ─────────────────────────────────────────────────────────────────────────────
// موتورِ رندرِ دیاگرامِ شماتیک به SVG — همهٔ kindها را پوشش می‌دهد، با مختصاتِ نسبی،
// بدونِ NaN/overlap، در حدِ کیفیتِ تصویرهای راهنمای TradingView ولی برداری/تمیز و
// پیاده‌سازیِ اصیلِ خودمان. هر kind ناشناخته بی‌صدا نادیده گرفته می‌شود (هرگز کرش/NaN).
// ─────────────────────────────────────────────────────────────────────────────
function Diagram({ diagram, TH }) {
  if (!diagram || !Array.isArray(diagram.shapes) || !diagram.shapes.length) return null;
  const W = num((diagram.ref && diagram.ref.w), 320);
  const H = num((diagram.ref && diagram.ref.h), 200);

  // تبدیلِ امنِ عدد: NaN/undefined → fallback، و کلیپِ مختصاتِ نسبی به بازهٔ ۰..۱.
  function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
  // x/y نسبی (۰..۱) → پیکسل؛ مقادیرِ >1 پیکسلِ مطلق فرض می‌شوند (سازگاریِ عقب‌رو).
  const px = (x) => { const n = num(x, 0); return n <= 1 && n >= -1 ? n * W : n; };
  const py = (y) => { const n = num(y, 0); return n <= 1 && n >= -1 ? n * H : n; };

  const up = TH.up || '#26a69a';
  const dn = TH.down || '#ef5350';
  const acc = TH.accent || '#2962ff';
  const txt = TH.textStrong || '#d1d4dc';
  const muted = TH.text || '#b2b5be';
  const panel = TH.panel || '#1e222d';
  const grid = TH.border || '#363a45';
  // نگاشتِ نام‌رنگ‌های نمادین → رنگِ تم.
  const col = (c, fb) => (c === 'up' ? up : c === 'down' ? dn : c === 'accent' ? acc : c === 'muted' ? muted : (c || fb || muted));

  // متنِ چندخطی: \n را به چند <tspan> می‌شکند تا در SVG درست نمایش یابد.
  const multiText = (text, x, y, opts = {}) => {
    const lines = String(text == null ? '' : text).split('\n');
    const fs = opts.size || 11;
    const lh = fs * 1.25;
    return lines.map((ln, j) => (
      <tspan key={j} x={x} dy={j === 0 ? 0 : lh}>{ln}</tspan>
    ));
  };

  // پس‌زمینهٔ کندلیِ تزئینی، قطعی (deterministic) — همیشه یکسان، بدونِ overlap.
  const bgCandles = (n, opacity, key) => {
    const els = [];
    const slot = W / (n + 1);
    const cw = Math.max(3, slot * 0.5);
    let seed = 1234;
    for (let k = 0; k < n; k++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r = seed / 233280;
      const cx = slot * (k + 1);
      const mid = H * (0.45 + 0.22 * Math.sin(k * 0.8 + 0.5));
      const bh = 6 + r * 20, isUp = r > 0.5;
      const c = isUp ? up : dn;
      els.push(
        <g key={`${key}-${k}`}>
          <line x1={cx} y1={mid - bh - 7} x2={cx} y2={mid + bh + 7} stroke={c} strokeWidth="1" />
          <rect x={cx - cw / 2} y={mid - bh} width={cw} height={bh * 2} fill={c} rx="1" />
        </g>
      );
    }
    return <g key={key} opacity={opacity == null ? 0.5 : opacity}>{els}</g>;
  };

  // یک کندلِ تکی با OHLC نسبی.
  const oneCandle = (cx, wpx, bodyTop, bodyBot, wickTop, wickBot, c, fill, i) => {
    const yt = py(bodyTop), yb = py(bodyBot);
    const top = Math.min(yt, yb), h = Math.max(2, Math.abs(yb - yt));
    const stroke = c, isHollow = fill === 'hollow';
    return (
      <g key={i}>
        <line x1={cx} y1={py(wickTop)} x2={cx} y2={py(wickBot)} stroke={stroke} strokeWidth="1.3" />
        <rect x={cx - wpx / 2} y={top} width={wpx} height={h} rx="1"
          fill={isHollow ? 'none' : stroke} stroke={stroke} strokeWidth={isHollow ? 1.5 : 1} />
      </g>
    );
  };

  // ساختِ d برای polyline از نقاطِ نسبی.
  const poly = (pts) => (Array.isArray(pts) ? pts.map((p) => `${px(p[0])},${py(p[1])}`).join(' ') : '');

  const node = (s, i) => {
    if (!s || typeof s !== 'object') return null;
    switch (s.kind) {
      // ── پس‌زمینهٔ چندکندلی ──
      case 'candles':
        return bgCandles(s.n || 7, s.opacity, `cands${i}`);

      // ── کندلِ تکی (OHLC) ──
      case 'candle': {
        const cx = px(s.x);
        const wpx = Math.max(5, num(s.w, 0.10) * W);
        return oneCandle(cx, wpx, num(s.bodyTop, 0.35), num(s.bodyBot, 0.6), num(s.wickTop, 0.25), num(s.wickBot, 0.7), col(s.color), s.fill, i);
      }

      // ── میله‌ی OHLC (Bar) ──
      case 'bar': {
        const cx = px(s.x), c = col(s.color), tick = Math.max(4, 0.03 * W);
        return (
          <g key={i}>
            <line x1={cx} y1={py(s.top)} x2={cx} y2={py(s.bot)} stroke={c} strokeWidth="1.5" />
            {s.open != null && <line x1={cx - tick} y1={py(s.open)} x2={cx} y2={py(s.open)} stroke={c} strokeWidth="1.5" />}
            {s.close != null && <line x1={cx} y1={py(s.close)} x2={cx + tick} y2={py(s.close)} stroke={c} strokeWidth="1.5" />}
          </g>
        );
      }

      // ── خطِ شکسته/پاره‌خط ──
      case 'line':
        return <line key={i} x1={px(s.x1)} y1={py(s.y1)} x2={px(s.x2)} y2={py(s.y2)} stroke={s.accent ? acc : col(s.color)} strokeWidth={num(s.w, 2)} strokeDasharray={s.dashed ? '5 4' : ''} strokeLinecap="round" markerEnd={s.arrow ? 'url(#ah)' : ''} />;

      // ── پرتو/نیم‌خط (مثلِ line، اما با سرِ پیکانِ اختیاری) ──
      case 'ray':
        return <line key={i} x1={px(s.x1)} y1={py(s.y1)} x2={px(s.x2)} y2={py(s.y2)} stroke={s.accent === false ? col(s.color) : acc} strokeWidth={num(s.w, 2)} strokeDasharray={s.dashed ? '5 4' : ''} strokeLinecap="round" />;

      case 'hline':
        return <line key={i} x1="0" y1={py(s.y)} x2={W} y2={py(s.y)} stroke={s.accent ? acc : col(s.color)} strokeWidth={num(s.w, 1.5)} strokeDasharray={s.dashed ? '5 4' : ''} />;
      case 'vline':
        return <line key={i} x1={px(s.x)} y1="0" x2={px(s.x)} y2={H} stroke={s.accent ? acc : col(s.color)} strokeWidth={num(s.w, 1.5)} strokeDasharray={s.dashed ? '5 4' : ''} />;

      case 'rect':
      case 'zone': {
        const x = px(s.x ?? s.x1);
        const y = py(s.y ?? s.y1);
        const w = s.w != null ? px(s.w) : Math.abs(px(s.x2) - px(s.x1));
        const h = s.h != null ? py(s.h) : Math.abs(py(s.y2) - py(s.y1));
        const c = s.accent ? acc : col(s.color, acc);
        return <rect key={i} x={Math.min(x, x + w)} y={Math.min(y, y + h)} width={Math.abs(w)} height={Math.abs(h)} fill={c} fillOpacity={num(s.fill, 0.14)} stroke={c} strokeWidth="1.2" strokeDasharray={s.dashed ? '4 3' : ''} rx="2" />;
      }

      // ── آجرِ Renko (مربعِ ۴۵درجه‌ای پلکانی) ──
      case 'brick': {
        const sz = Math.max(8, 0.10 * W);
        const c = col(s.color);
        return <rect key={i} x={px(s.x)} y={py(s.y)} width={sz} height={sz} fill={c} fillOpacity="0.85" stroke={panel} strokeWidth="1.5" rx="1" />;
      }
      // ── بلوکِ Line-Break ──
      case 'block': {
        const w = Math.max(8, 0.11 * W), h = Math.max(8, 0.10 * H);
        const c = col(s.color);
        return <rect key={i} x={px(s.x) - w / 2} y={py(s.y)} width={w} height={h} fill={c} fillOpacity="0.85" stroke={panel} strokeWidth="1.5" rx="1" />;
      }
      // ── میله‌ی Range (High-Low عمودی) ──
      case 'hlbar': {
        const c = col(s.color), bw = Math.max(6, 0.06 * W);
        return <rect key={i} x={px(s.x) - bw / 2} y={py(s.top)} width={bw} height={Math.max(2, py(s.bot) - py(s.top))} fill={c} rx="1.5" />;
      }
      // ── ستونِ نمودارِ ستونی (Columns) از خطِ پایه ──
      case 'columns': {
        const baseY = py(s.baseY ?? 0.9), bars = Array.isArray(s.bars) ? s.bars : [];
        const bw = Math.max(6, (W / (bars.length + 1)) * 0.55);
        return <g key={i}>{bars.map((b, j) => {
          const cx = px(b.x), h = num(b.h, 0.3) * H, c = col(b.color);
          return <rect key={j} x={cx - bw / 2} y={baseY - h} width={bw} height={Math.max(2, h)} fill={c} rx="1" />;
        })}</g>;
      }
      // ── ستونِ Point&Figure (X یا O) ──
      case 'pnfcol': {
        const cx = px(s.x), c = col(s.color);
        const a = py(s.from), b = py(s.to), top = Math.min(a, b), bot = Math.max(a, b);
        const r = Math.max(5, 0.035 * W), gap = r * 2.4, els = [];
        for (let yy = top; yy <= bot + 1; yy += gap) {
          if (s.dir === 'O') els.push(<circle key={yy} cx={cx} cy={yy + r} r={r} fill="none" stroke={c} strokeWidth="1.6" />);
          else els.push(<g key={yy}><line x1={cx - r} y1={yy} x2={cx + r} y2={yy + 2 * r} stroke={c} strokeWidth="1.6" /><line x1={cx - r} y1={yy + 2 * r} x2={cx + r} y2={yy} stroke={c} strokeWidth="1.6" /></g>);
        }
        return <g key={i}>{els}</g>;
      }
      // ── خطِ Kagi (نازک/ضخیم) ──
      case 'kagi': {
        const segs = Array.isArray(s.segments) ? s.segments : [];
        return <g key={i} fill="none" strokeLinejoin="round" strokeLinecap="round">{segs.map((sg, j) => (
          <polyline key={j} points={poly(sg.points)} stroke={sg.thick ? up : dn} strokeWidth={sg.thick ? 3.2 : 1.4} />
        ))}</g>;
      }
      // ── ناحیه‌ی Area زیرِ خط ──
      case 'area': {
        const pts = Array.isArray(s.points) ? s.points : [];
        if (!pts.length) return null;
        const base = py(s.baseline ?? 1.0);
        const c = col(s.color, acc);
        const lineD = poly(pts);
        const fillD = `${px(pts[0][0])},${base} ${lineD} ${px(pts[pts.length - 1][0])},${base}`;
        return <g key={i}>
          <polygon points={fillD} fill={c} fillOpacity="0.16" />
          <polyline points={lineD} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>;
      }
      // ── Baseline (دو رنگ نسبت به خطِ پایه: بالای خط سبز، پایین قرمز) ──
      case 'baseline': {
        const pts = Array.isArray(s.points) ? s.points : [];
        const base = py(s.baseY ?? 0.5);
        const uc = col(s.upColor || 'up'), dc = col(s.downColor || 'down');
        const cidUp = `blUp${i}`, cidDn = `blDn${i}`;
        const fillPoly = pts.length ? `${px(pts[0][0])},${base} ${poly(pts)} ${px(pts[pts.length - 1][0])},${base}` : '';
        return <g key={i}>
          <defs>
            {/* ناحیهٔ بالای خطِ پایه → رنگِ صعودی؛ ناحیهٔ پایین → رنگِ نزولی */}
            <clipPath id={cidUp}><rect x="0" y="0" width={W} height={base} /></clipPath>
            <clipPath id={cidDn}><rect x="0" y={base} width={W} height={Math.max(0, H - base)} /></clipPath>
          </defs>
          <line x1="0" y1={base} x2={W} y2={base} stroke={muted} strokeWidth="1" strokeDasharray="4 3" />
          {pts.length > 0 && <>
            <polygon points={fillPoly} fill={uc} fillOpacity="0.16" clipPath={`url(#${cidUp})`} />
            <polygon points={fillPoly} fill={dc} fillOpacity="0.16" clipPath={`url(#${cidDn})`} />
            <polyline points={poly(pts)} fill="none" stroke={uc} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${cidUp})`} />
            <polyline points={poly(pts)} fill="none" stroke={dc} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${cidDn})`} />
          </>}
        </g>;
      }
      // ── خطِ پله‌ای (Step) ──
      case 'steps':
        return <polyline key={i} points={poly(s.points)} fill="none" stroke={col(s.color, acc)} strokeWidth="2" strokeLinejoin="miter" strokeLinecap="round" />;

      // ── میله‌های حجم (پایینِ چارت) ──
      case 'volbars': {
        const hs = Array.isArray(s.heights) ? s.heights : [];
        const baseY = py(s.y ?? 0.78), maxH = num(s.h, 0.18) * H;
        const bw = Math.max(5, (W / (hs.length + 1)) * 0.5);
        return <g key={i}>{hs.map((hh, j) => {
          const cx = (W / (hs.length + 1)) * (j + 1), h = num(hh, 0.3) * maxH;
          return <rect key={j} x={cx - bw / 2} y={baseY - h} width={bw} height={Math.max(2, h)} fill={j % 2 ? dn : up} fillOpacity="0.55" rx="1" />;
        })}</g>;
      }
      // ── هیستوگرامِ افقیِ پروفایلِ حجم ──
      case 'hist': {
        const bars = 9, els = [], bh = H / (bars + 1);
        let seed = 77;
        for (let k = 0; k < bars; k++) {
          seed = (seed * 9301 + 49297) % 233280;
          const w = (0.12 + (seed / 233280) * 0.5) * W;
          const y = bh * (k + 0.6);
          els.push(<rect key={k} x={px(s.x ?? 0.02)} y={y} width={w} height={bh * 0.6} fill={acc} fillOpacity="0.30" rx="1" />);
        }
        return <g key={i}>{els}</g>;
      }
      // ── میله‌های با فاصلهٔ نابرابر (Range/زمان‌گریز) ──
      case 'equalbars': {
        const n = num(s.count, 8), h = num(s.height, 0.25) * H, baseY = H * 0.62, els = [];
        let x = 0.08 * W, seed = 33;
        for (let k = 0; k < n; k++) {
          seed = (seed * 9301 + 49297) % 233280;
          const gap = (0.04 + (seed / 233280) * 0.10) * W;
          els.push(<rect key={k} x={x} y={baseY - h / 2} width={Math.max(4, 0.035 * W)} height={h} fill={k % 2 ? dn : up} rx="1" />);
          x += gap + 0.035 * W;
        }
        return <g key={i}>{els}</g>;
      }
      // ── دو سری برای مقایسه (raw/ha و …) ──
      case 'series': {
        const x = px(s.x ?? 0.05), y = py(s.y ?? 0.1), w = px(s.w ?? 0.9), h = py(s.h ?? 0.3);
        const smooth = s.role === 'ha' || s.role === 'close' || s.smooth;
        return <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={panel} stroke={grid} strokeWidth="1" rx="3" />
          {Array.from({ length: 6 }).map((_, k) => {
            const cx = x + (w / 7) * (k + 1);
            const amp = smooth ? 0.18 : 0.34;
            const mid = y + h * (0.5 - amp * Math.sin(k * 0.9));
            const bh = h * (smooth ? 0.10 : (0.06 + 0.12 * ((k * 73) % 5) / 5));
            const isUp = smooth ? true : ((k % 3) !== 0);
            return <g key={k}><rect x={cx - 3} y={mid - bh} width="6" height={Math.max(3, bh * 2)} fill={isUp ? up : dn} rx="1" /></g>;
          })}
        </g>;
      }
      // ── نمودارِ کوچکِ روند (مینی‌چارت) برای نمایشِ معکوس‌سازی و … ──
      case 'minichart': {
        const cx = px(s.x), wbox = 0.22 * W, hbox = 0.4 * H, x0 = cx - wbox / 2, y0 = 0.25 * H;
        const upTrend = s.trend !== 'down';
        const pts = upTrend
          ? [[0, 0.9], [0.3, 0.6], [0.6, 0.65], [1, 0.2]]
          : [[0, 0.2], [0.3, 0.5], [0.6, 0.4], [1, 0.85]];
        const P = pts.map((p) => `${x0 + p[0] * wbox},${y0 + p[1] * hbox}`).join(' ');
        return <g key={i}>
          <rect x={x0} y={y0} width={wbox} height={hbox} fill={panel} stroke={grid} strokeWidth="1" rx="3" />
          <polyline points={P} fill="none" stroke={upTrend ? up : dn} strokeWidth="2" strokeLinejoin="round" />
        </g>;
      }
      // ── خطِ آینهٔ معکوس‌سازیِ محور ──
      case 'mirror':
        return <line key={i} x1={px(s.x)} y1="0" x2={px(s.x)} y2={H} stroke={muted} strokeWidth="1.5" strokeDasharray="2 3" />;

      // ── نوارِ انتخابِ تایم‌فریم ──
      case 'tfbar': {
        const items = Array.isArray(s.items) ? s.items : [];
        const padX = 0.06 * W, gap = 0.02 * W;
        const totalW = W - padX * 2;
        const cw = (totalW - gap * (items.length - 1)) / Math.max(1, items.length);
        const y = py(s.y ?? 0.42), ch = Math.max(22, 0.18 * H);
        return <g key={i}>{items.map((it, j) => {
          const x = padX + j * (cw + gap), on = it === s.active;
          return <g key={j}>
            <rect x={x} y={y} width={cw} height={ch} rx="4" fill={on ? acc : panel} fillOpacity={on ? 0.9 : 1} stroke={on ? acc : grid} strokeWidth="1" />
            <text x={x + cw / 2} y={y + ch / 2 + 4} fontSize="11" textAnchor="middle" fill={on ? '#fff' : muted} fontWeight={on ? 700 : 500}>{it}</text>
          </g>;
        })}</g>;
      }
      // ── محورِ قیمت با تیک‌ها و حالتِ مقیاس ──
      case 'axis': {
        const ticks = Array.isArray(s.ticks) ? s.ticks : [];
        const x = W - 0.16 * W;
        return <g key={i}>
          <line x1={x} y1={0.08 * H} x2={x} y2={0.92 * H} stroke={grid} strokeWidth="1.2" />
          {ticks.map((t, j) => {
            const y = 0.12 * H + ((0.78 * H) / Math.max(1, ticks.length - 1)) * j;
            return <g key={j}>
              <line x1={x} y1={y} x2={x + 5} y2={y} stroke={grid} strokeWidth="1" />
              <text x={x + 9} y={y + 4} fontSize="10" fill={muted}>{t}</text>
            </g>;
          })}
          {(s.mode || s.baseAt || s.zeroAt) && <text x={x - 8} y={0.06 * H} fontSize="10" textAnchor="end" fill={acc} fontWeight="700">{s.mode || ''}</text>}
        </g>;
      }
      // ── حالتِ محور (قفل/خودکار) ──
      case 'axisState': {
        const cx = px(s.x), w = 0.22 * W, h = 0.16 * H, y = 0.4 * H;
        return <g key={i}>
          <rect x={cx - w / 2} y={y} width={w} height={h} rx="5" fill={panel} stroke={grid} strokeWidth="1" />
          <text x={cx} y={y + h / 2 + 4} fontSize="11" textAnchor="middle" fill={s.icon === 'lock' ? acc : muted} fontWeight="600">{s.label}</text>
        </g>;
      }
      // ── برچسبِ محور (روی لبهٔ راست/پایین) ──
      case 'axisLabel': {
        const isR = s.side === 'right', isB = s.side === 'bottom';
        const x = isR ? W - 30 : px(s.x);
        const y = isB ? H - 8 : py(s.y);
        const w = 52, h = 16;
        return <g key={i}>
          <rect x={isR ? W - w : x - w / 2} y={y - h / 2} width={w} height={h} rx="3" fill={acc} />
          <text x={isR ? W - w / 2 : x} y={y + 4} fontSize="10" textAnchor="middle" fill="#fff" fontWeight="600">{s.text}</text>
        </g>;
      }
      // ── کراس‌هیر (صلیب/نقطه/پیکان) ──
      case 'crosshair': {
        const x = px(s.x), y = py(s.y);
        return <g key={i}>
          <line x1="0" y1={y} x2={W} y2={y} stroke={muted} strokeWidth="1" strokeDasharray="4 3" />
          <line x1={x} y1="0" x2={x} y2={H} stroke={muted} strokeWidth="1" strokeDasharray="4 3" />
          {s.glyph === 'dot' && <circle cx={x} cy={y} r="4" fill={acc} stroke="#fff" strokeWidth="1.2" />}
          {s.glyph === 'arrow' && <path d={`M${x},${y} l9,3 l-3,1 l3,4 l-2,1 l-3,-4 l-2,2 Z`} fill={acc} />}
        </g>;
      }
      // ── فلشِ کشش به نقطهٔ Snap (مگنت) ──
      case 'snap': {
        const f = s.from || [0.6, 0.4], t = s.to || [0.5, 0.3];
        return <g key={i}>
          <line x1={px(f[0])} y1={py(f[1])} x2={px(t[0])} y2={py(t[1])} stroke={acc} strokeWidth="1.6" strokeDasharray="3 3" markerEnd="url(#ah)" />
          <circle cx={px(t[0])} cy={py(t[1])} r="4" fill={acc} stroke="#fff" strokeWidth="1" />
          {s.target && <text x={px(t[0]) + 7} y={py(t[1]) - 5} fontSize="10" fill={acc} fontWeight="700">{s.target}</text>}
        </g>;
      }
      // ── نقطهٔ لنگر ──
      case 'dot':
      case 'point':
        return <g key={i}>
          <circle cx={px(s.x)} cy={py(s.y)} r={s.accent ? 5 : 4} fill={s.accent ? acc : col(s.color, txt)} stroke={panel} strokeWidth="1.2" />
          {s.label && <text x={px(s.x) + 8} y={py(s.y) + 4} fontSize="10" fill={s.accent ? acc : muted} fontWeight={s.accent ? 700 : 500}>{s.label}</text>}
        </g>;

      // ── سرِ پیکانِ مستقل ──
      case 'arrowhead': {
        const x = px(s.x), y = py(s.y), dmap = {
          'up-right': -45, 'up-left': -135, 'down-right': 45, 'down-left': 135,
          right: 0, left: 180, up: -90, down: 90,
        };
        const ang = (dmap[s.dir] ?? 0) * Math.PI / 180, L = 9;
        return <g key={i}>
          <path d={`M${x},${y} L${x - L * Math.cos(ang - 0.4)},${y - L * Math.sin(ang - 0.4)} L${x - L * Math.cos(ang + 0.4)},${y - L * Math.sin(ang + 0.4)} Z`} fill={acc} />
          {s.label && <text x={x} y={y - 8} fontSize="10" textAnchor="middle" fill={acc} fontWeight="700">{s.label}</text>}
        </g>;
      }
      // ── قوسِ زاویه ──
      case 'arc': {
        const cx = px(s.cx), cy = py(s.cy), r = num(s.r, 0.15) * W;
        const a0 = -num(s.from, 0) * Math.PI / 180, a1 = -num(s.to, 45) * Math.PI / 180;
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const large = Math.abs(num(s.to, 45) - num(s.from, 0)) > 180 ? 1 : 0;
        return <path key={i} d={`M${x0},${y0} A${r},${r} 0 ${large} 0 ${x1},${y1}`} fill="none" stroke={acc} strokeWidth="1.4" />;
      }
      // ── چارتِ تمیزِ تزئینی (cleanchart) ──
      case 'cleanchart':
        return <g key={i}>
          <rect x={0.05 * W} y={0.1 * H} width={0.9 * W} height={0.75 * H} fill="none" stroke={grid} strokeWidth="1" rx="4" />
          <polyline points={poly([[0.1, 0.7], [0.3, 0.45], [0.5, 0.55], [0.7, 0.3], [0.9, 0.4]])} fill="none" stroke={acc} strokeWidth="2" strokeLinejoin="round" />
        </g>;

      // ── آیکون/برچسبِ متنی (نوارِ ابزار، پنل OHLC و …) ──
      case 'icon': {
        const x = px(s.x), y = py(s.y);
        if (s.text != null) {
          return <text key={i} x={x} y={y} fontSize={s.size || 11} fill={s.accent ? acc : muted} fontWeight="600" textAnchor={s.anchor || 'start'}>{s.text}</text>;
        }
        // آیکونِ نام‌دار → دایرهٔ نشانه‌دار با حرفِ اول (بدونِ CDN خارجی).
        return <g key={i}>
          <circle cx={x} cy={y} r="9" fill={panel} stroke={acc} strokeWidth="1.2" />
          <text x={x} y={y + 4} fontSize="10" textAnchor="middle" fill={acc} fontWeight="700">{String(s.name || '?').slice(0, 1).toUpperCase()}</text>
        </g>;
      }

      // ── متنِ چندخطی/کادردار ──
      case 'label':
      case 'text': {
        const x = px(s.x), y = py(s.y);
        const content = s.text != null ? s.text : s.label;
        const fs = s.size || 11;
        if (s.box) {
          const lines = String(content == null ? '' : content).split('\n');
          const bw = Math.max(...lines.map((l) => l.length)) * fs * 0.56 + 14;
          const bh = lines.length * fs * 1.25 + 8;
          return <g key={i}>
            <rect x={x - bw / 2} y={y - fs} width={bw} height={bh} rx="4" fill={panel} stroke={acc} strokeWidth="1" opacity="0.96" />
            <text x={x} y={y} fontSize={fs} fill={s.accent ? acc : txt} fontWeight="600" textAnchor="middle">{multiText(content, x, y, { size: fs })}</text>
          </g>;
        }
        return <text key={i} x={x} y={y} fontSize={fs} fill={s.accent ? acc : muted} fontWeight={s.accent ? 700 : 500} textAnchor={s.anchor || 'middle'}>{multiText(content, x, y, { size: fs })}</text>;
      }

      default:
        return null;
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 240, background: TH.bg, borderRadius: 8, border: `1px solid ${TH.border}` }} dir="ltr">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={acc} /></marker>
      </defs>
      {diagram.shapes.map(node)}
    </svg>
  );
}

// مودالِ راهنمای یک ابزار/اندیکاتور.
function HelpModalInner({ entry, onClose, TH }) {
  if (!entry) return null;
  // نرمال‌سازیِ متن: برخی ورودی‌ها title/what/example را به‌صورتِ آبجکتِ {fa,en} نوشته‌اند نه رشته.
  // رندرِ مستقیمِ آبجکت در React خطای «Objects are not valid as a React child» و کرش می‌دهد → رشته‌اش کن.
  const str = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v.fa || v.en || v.text || v.label || '') : v);
  // نرمال‌سازی: برخی ورودی‌ها how/tips را رشته نوشته‌اند نه آرایه — جلوگیری از کرشِ .map
  const toArr = (v) => (Array.isArray(v) ? v.map(str) : (typeof v === 'string' && v.trim() ? v.split(/\n+|(?<=\.)\s+(?=[۱-۹0-9])/).map((x) => x.trim()).filter(Boolean) : (v ? [str(v)] : [])));
  const how = toArr(entry.how);
  const tips = toArr(entry.tips);
  const title = str(entry.title);
  const what = str(entry.what);
  const example = str(entry.example);
  // بخش‌های تشریحیِ بلند (سبکِ دانشنامه‌ایِ TradingView): تعریف/تاریخچه/محاسبه/واگرایی/…
  // هر بخش {h: عنوان, body: رشته یا آرایه‌ای از بندها}. body آرایه → فهرستِ گلوله‌ای.
  const sections = Array.isArray(entry.sections) ? entry.sections : [];
  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-auto rounded-xl pc-pop" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.text }}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0" style={{ borderColor: TH.border, background: TH.panel }}>
          <div className="flex items-center gap-2"><HelpCircle size={17} style={{ color: TH.accent }} /><b style={{ color: TH.textStrong }}>{title}</b></div>
          <button onClick={onClose} className="pc-iconbtn w-7 h-7"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 space-y-3 text-[13px] leading-7">
          {what && <p style={{ color: TH.text }}>{what}</p>}
          {entry.diagram && <Diagram diagram={entry.diagram} TH={TH} />}
          {sections.length > 0 && sections.map((s, i) => (
            <div key={i}>
              {str(s.h) && <div className="font-bold mb-1" style={{ color: TH.textStrong }}>{str(s.h)}</div>}
              {Array.isArray(s.body)
                ? <ul className="space-y-1">{s.body.map((b, j) => <li key={j} className="flex gap-1.5"><span style={{ color: TH.accent }}>•</span><span>{str(b)}</span></li>)}</ul>
                : <p style={{ color: TH.text, whiteSpace: 'pre-wrap' }}>{str(s.body)}</p>}
              {s.img && (
                <figure className="mt-2 mb-1">
                  <img src={str(s.img)} alt={str(s.h) || ''} loading="lazy" className="w-full rounded-lg" style={{ border: `1px solid ${TH.border}`, background: '#fff' }} />
                  {str(s.cap) && <figcaption className="mt-1 text-[11.5px] text-center opacity-60" style={{ color: TH.text }}>{str(s.cap)}</figcaption>}
                </figure>
              )}
            </div>
          ))}
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
          {example && (
            <div className="rounded-lg p-2.5" style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
              <div className="font-bold mb-1 text-[12px]" style={{ color: TH.up }}>مثالِ واقعی</div>
              <p className="text-[12.5px]" style={{ color: TH.text }}>{example}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// مرزِ خطا برای راهنما — اگر رندرِ یک راهنما/دیاگرام به هر دلیل خطا داد، به‌جای کرشِ کلِ صفحه
// یک پیامِ کوتاه + دکمهٔ بستن نشان می‌دهد. (باگِ موبایل: تپِ «؟» صفحه را سفید نکند.)
class HelpErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('Help crash:', err, info); } catch (e) { /* noop */ } }
  render() {
    const TH = this.props.TH || {};
    if (this.state.err) {
      return (
        <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) this.props.onClose && this.props.onClose(); }}>
          <div className="w-full max-w-sm rounded-xl p-5 text-center" style={{ background: TH.panel || '#161923', border: `1px solid ${TH.border || '#2a2e39'}`, color: TH.text || '#ddd' }}>
            <div className="text-2xl mb-2">📘</div>
            <div className="font-bold mb-1" style={{ color: TH.textStrong || '#fff' }}>راهنمای این مورد در دسترس نیست</div>
            <div className="text-[12px] opacity-60 leading-6 mb-4">در نمایشِ این راهنما مشکلی پیش آمد. صفحه سالم است؛ می‌توانی ببندی و ادامه بدهی.</div>
            <button onClick={() => { this.setState({ err: null }); this.props.onClose && this.props.onClose(); }} className="px-5 py-2 rounded-lg font-bold" style={{ background: TH.accent || '#2962FF', color: '#fff' }}>باشه</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function HelpModal(props) {
  return (
    <HelpErrorBoundary TH={props.TH} onClose={props.onClose}>
      <HelpModalInner {...props} />
    </HelpErrorBoundary>
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

// ─────────────────────────────────────────────────────────────────────────────
// چیت‌شیتِ کیبورد — جدولِ گروه‌بندی‌شدهٔ همهٔ میان‌بُرها (هم‌ترازِ TradingView).
// SHORTCUT_GROUPS از hotkeys.js می‌آید (تک‌منبعِ حقیقت)، پس هر میان‌بُری که آنجا
// اضافه شود خودکار اینجا هم نمایش داده می‌شود. RTL؛ کلیدها LTR و tabular-nums.
// دو خروجی: HotkeyCheatSheet (شبکهٔ توکار برای جاسازی) + HotkeyCheatSheetModal (مودالِ کامل).
// ─────────────────────────────────────────────────────────────────────────────
export function HotkeyCheatSheet({ TH = {}, groups = SHORTCUT_GROUPS }) {
  return (
    <div dir="rtl" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {groups.map((g) => (
        <div key={g.group}>
          <div className="text-[11px] font-bold mb-1.5 pb-1 border-b" style={{ color: TH.accent, borderColor: TH.border }}>{g.group}</div>
          <div className="space-y-1">
            {g.items.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="opacity-80 truncate" style={{ color: TH.text }}>{s.label}</span>
                <kbd className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-mono tabular-nums border whitespace-nowrap" dir="ltr" style={{ background: TH.chipBg, borderColor: TH.border, color: TH.textStrong }}>{s.combo}</kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// مودالِ کاملِ چیت‌شیت (خودبسنده: بستن با کلیکِ بیرون یا Esc). اگر open نباشد چیزی رندر نمی‌شود.
export function HotkeyCheatSheetModal({ open, onClose, TH = {} }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose && onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="rounded-xl border shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col pc-pop" style={{ background: TH.popoverBg || TH.panel, borderColor: TH.border, color: TH.text }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b sticky top-0" style={{ borderColor: TH.border, background: TH.popoverBg || TH.panel }}>
          <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: TH.textStrong }}><Keyboard size={16} style={{ color: TH.accent }} /> چیت‌شیتِ کیبورد</h3>
          <button onClick={onClose} aria-label="بستن" className="pc-iconbtn w-7 h-7"><X size={16} /></button>
        </div>
        <div className="overflow-auto p-4 bn-thin-scroll">
          <HotkeyCheatSheet TH={TH} />
        </div>
      </div>
    </div>
  );
}
