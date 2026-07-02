// بازارنما — لوگوی نماد (اوریجینال). جفت‌ارزها = دو پرچمِ دایره‌ایِ روی‌هم؛
// فلز/نفت/شاخص/کریپتو = نشانِ رنگیِ اختصاصی. پرچم‌ها طرحِ سادهٔ پرچمِ ملی (پابلیک‌دامین) هستند.
import React from 'react';

// پرچم‌های سادهٔ ۸ ارزِ اصلی (۲۴×۲۴، بعداً در دایره کلیپ می‌شوند).
const FLAG = {
  USD: (<g><rect width="24" height="24" fill="#fff" /><rect width="24" height="24" fill="#b22234" />{[1,3,5,7,9,11].map((i)=>(<rect key={i} y={i*2} width="24" height="2" fill="#fff" />))}<rect width="13" height="14" fill="#3c3b6e" /></g>),
  EUR: (<g><rect width="24" height="24" fill="#039" /><circle cx="12" cy="12" r="6" fill="none" stroke="#fc0" strokeWidth="1.4" strokeDasharray="0.7 1.7" /></g>),
  GBP: (<g><rect width="24" height="24" fill="#012169" /><path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="4" /><path d="M0 0L24 24M24 0L0 24" stroke="#c8102e" strokeWidth="1.8" /><path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="6" /><path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="3" /></g>),
  JPY: (<g><rect width="24" height="24" fill="#fff" /><circle cx="12" cy="12" r="6" fill="#bc002d" /></g>),
  CHF: (<g><rect width="24" height="24" fill="#d52b1e" /><rect x="10.5" y="5" width="3" height="14" fill="#fff" /><rect x="5" y="10.5" width="14" height="3" fill="#fff" /></g>),
  CAD: (<g><rect width="24" height="24" fill="#fff" /><rect width="6" height="24" fill="#d52b1e" /><rect x="18" width="6" height="24" fill="#d52b1e" /><circle cx="12" cy="12" r="3.2" fill="#d52b1e" /></g>),
  AUD: (<g><rect width="24" height="24" fill="#00247d" /><rect width="11" height="8" fill="#012169" /><path d="M0 0l11 8M11 0L0 8" stroke="#fff" strokeWidth="1.6" /><path d="M5.5 0v8M0 4h11" stroke="#fff" strokeWidth="2.2" /><circle cx="17" cy="15" r="1.2" fill="#fff" /><circle cx="20" cy="9" r="1" fill="#fff" /></g>),
  NZD: (<g><rect width="24" height="24" fill="#00247d" /><rect width="11" height="8" fill="#012169" /><path d="M0 0l11 8M11 0L0 8" stroke="#fff" strokeWidth="1.6" /><path d="M5.5 0v8M0 4h11" stroke="#fff" strokeWidth="2.2" /><circle cx="18" cy="14" r="1.2" fill="#cc142b" /><circle cx="20" cy="9" r="1" fill="#cc142b" /></g>),
};

// نشانِ تک‌رنگ برای کالا/شاخص/کریپتو/ارزِ ناشناخته.
const BADGE = {
  XAU: ['#caa53d', 'طلا'], XAG: ['#9ca3af', 'نقره'], XPT: ['#8a9597', 'Pt'], XPD: ['#7d8a8c', 'Pd'],
  OIL: ['#2b2b2b', 'OIL'], WTI: ['#2b2b2b', 'WTI'], BRENT: ['#2b2b2b', 'BR'],
};

// کریپتو — رنگِ برندِ هر کوین + نمادِ نمایشی (تیکر یا glyph). تطبیق با کوینِ پایه (بدونِ USDT/USD).
const CRYPTO = {
  BTC: ['#f7931a', '₿'], ETH: ['#627eea', 'Ξ'], BNB: ['#f3ba2f', 'BNB'], SOL: ['#14f195', 'SOL'],
  XRP: ['#23292f', 'XRP'], ADA: ['#0033ad', 'ADA'], DOGE: ['#c2a633', 'DOGE'], TRX: ['#ef0027', 'TRX'],
  AVAX: ['#e84142', 'AVAX'], LINK: ['#2a5ada', 'LINK'], DOT: ['#e6007a', 'DOT'], MATIC: ['#8247e5', 'POL'],
  LTC: ['#345d9d', 'Ł'], BCH: ['#0ac18e', 'BCH'], ATOM: ['#2e3148', 'ATOM'], UNI: ['#ff007a', 'UNI'],
  XLM: ['#14b6e7', 'XLM'], ETC: ['#328332', 'ETC'], FIL: ['#0090ff', 'FIL'], APT: ['#0ea5a4', 'APT'],
  NEAR: ['#111111', 'NEAR'], ARB: ['#28a0f0', 'ARB'], OP: ['#ff0420', 'OP'], INJ: ['#00b6ff', 'INJ'],
  SUI: ['#4da2ff', 'SUI'], TIA: ['#7b2bf9', 'TIA'], SEI: ['#9e1f19', 'SEI'], RUNE: ['#00ccbb', 'RUNE'],
  AAVE: ['#b6509e', 'AAVE'], GRT: ['#6f4cff', 'GRT'], ALGO: ['#111111', 'ALGO'], FTM: ['#1969ff', 'FTM'],
  SAND: ['#00adef', 'SAND'], MANA: ['#ff2d55', 'MANA'], AXS: ['#0055d5', 'AXS'], SHIB: ['#ffa409', 'SHIB'],
  PEPE: ['#4b9f3e', 'PEPE'], WIF: ['#c4a484', 'WIF'], FLOKI: ['#f0a92a', 'FLOKI'], BONK: ['#f5ac1c', 'BONK'],
  TON: ['#0098ea', 'TON'], ICP: ['#3b00b9', 'ICP'], HBAR: ['#222222', 'HBAR'], VET: ['#15bdff', 'VET'],
  RNDR: ['#cf1011', 'RNDR'], IMX: ['#0d3ad7', 'IMX'], STX: ['#5546ff', 'STX'], TAO: ['#111111', 'TAO'],
  ORDI: ['#111111', 'ORDI'], JUP: ['#3a9e7e', 'JUP'], GALA: ['#111111', 'GALA'], CHZ: ['#cd0124', 'CHZ'],
  ENS: ['#5298ff', 'ENS'], LDO: ['#00a3ff', 'LDO'], CRV: ['#40649f', 'CRV'], DYDX: ['#6966ff', 'DYDX'],
  GMT: ['#caa46a', 'GMT'], FET: ['#1e1e2a', 'FET'], AR: ['#111111', 'AR'], EGLD: ['#1b46c2', 'EGLD'],
};

const CCY = Object.keys(FLAG);

// تجزیهٔ نماد به ارزِ پایه/مظنه (اگر جفت‌ارز باشد).
function pair(sym = '') {
  const s = String(sym).toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length >= 6) {
    const a = s.slice(0, 3), b = s.slice(3, 6);
    if (CCY.includes(a) && CCY.includes(b)) return [a, b];
    // طلا/نقره در برابر دلار: XAUUSD / XAGUSD
    if ((a === 'XAU' || a === 'XAG' || a === 'XPT' || a === 'XPD') && CCY.includes(b)) return [a, b];
  }
  return null;
}

function badgeFor(sym = '') {
  const s = String(sym).toUpperCase();
  // کریپتو: کوینِ پایه را با حذفِ پسوندِ USDT/USD دقیق تطبیق بده (نه زیررشتهٔ مبهم)
  const base = s.replace(/USDT$|USD$/, '');
  if (CRYPTO[base]) return { color: CRYPTO[base][0], txt: CRYPTO[base][1] };
  for (const k of Object.keys(BADGE)) if (s.includes(k)) return { key: k, color: BADGE[k][0], txt: BADGE[k][1] };
  // شاخص‌ها
  if (/US30|US500|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|JP225|US100|FRA40|HK50/.test(s)) return { color: '#3b82f6', txt: s.slice(0, 3) };
  return { color: '#64748b', txt: s.slice(0, 3) };
}

// یک دایرهٔ پرچم/نشان. r شعاع، (cx,cy) مرکز.
function Disc({ ccy, cx, cy, r, ring }) {
  const id = `clip_${ccy}_${cx}_${cy}`.replace(/\./g, '');
  const flag = FLAG[ccy];
  return (
    <g>
      {ring && <circle cx={cx} cy={cy} r={r + 0.6} fill={ring} />}
      <clipPath id={id}><circle cx={cx} cy={cy} r={r} /></clipPath>
      <g clipPath={`url(#${id})`} transform={`translate(${cx - r} ${cy - r}) scale(${(2 * r) / 24})`}>
        {flag || <rect width="24" height="24" fill="#64748b" />}
      </g>
    </g>
  );
}

// آیا نماد کریپتو است؟ (نه جفت‌ارز، نه فلز/کالا، نه شاخص) → تیکرِ کوینِ پایه برمی‌گرداند.
function cryptoTicker(sym = '') {
  const s = String(sym).toUpperCase();
  if (pair(s)) return null; // جفت‌ارز
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return null; // فلز
  if (/US30|US500|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|JP225|US100|FRA40|HK50|OIL|WTI|BRENT|^XTI|^XBR|^XNG/.test(s)) return null; // شاخص/انرژی
  const base = s.replace(/USDT$|USD$/, '');
  return base ? base.toLowerCase() : null;
}

// بَجِ رنگیِ fallback (وقتی لوگوی واقعی نبود).
function badgeSvg(sym, s) {
  const bd = badgeFor(sym);
  const fs = bd.txt.length > 2 ? s * 0.30 : s * 0.46;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" aria-hidden>
      <circle cx={s / 2} cy={s / 2} r={s / 2 - 0.5} fill={bd.color} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={fs} fontWeight="700" fontFamily="Ravagh, Vazirmatn, sans-serif">{bd.txt}</text>
    </svg>
  );
}

// لوگوی واقعیِ کریپتو از /crypto-icons/{ticker}.svg؛ اگر نبود → بَجِ رنگی.
function CryptoLogo({ symbol, ticker, size }) {
  const [err, setErr] = React.useState(false);
  if (err) return badgeSvg(symbol, size);
  return (
    <img
      src={`/crypto-icons/${ticker}.svg`}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="shrink-0"
      style={{ borderRadius: '50%' }}
      alt=""
    />
  );
}

export default function SymbolLogo({ symbol, size = 22 }) {
  const p = pair(symbol);
  const s = size;
  if (p) {
    const [a, b] = p;
    const r = s * 0.30;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" aria-hidden>
        {/* مظنه پشت (راست‌پایین)، پایه جلو (چپ‌بالا) */}
        <Disc ccy={b} cx={s * 0.62} cy={s * 0.6} r={r} ring="#0008" />
        <Disc ccy={a} cx={s * 0.38} cy={s * 0.42} r={r} ring="var(--logo-ring,#1e222d)" />
      </svg>
    );
  }
  const ct = cryptoTicker(symbol);
  if (ct) return <CryptoLogo symbol={symbol} ticker={ct} size={s} />;
  return badgeSvg(symbol, s);
}
