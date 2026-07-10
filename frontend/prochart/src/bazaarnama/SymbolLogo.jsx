// بازارنما — لوگوی نماد به سبکِ TradingView: «یک دایرهٔ تختِ تمیز» (بدونِ سایه، بدونِ پرچمِ دوتاییِ روی‌هم).
// فارکس = پرچمِ ارزِ پایه در یک دایرهٔ تمیز؛ فلز = شمشِ طلا/نقره؛ کریپتو = لوگوی واقعی از /crypto-icons؛
// شاخص/انرژی = بَجِ رنگیِ تختِ برنددار؛ ناشناخته = مونوگرامِ رنگی. همه گِرد، هم‌تراز، آنتی‌الیاسِ تمیز، بدونِ drop-shadow.
import React from 'react';

// رنگِ رینگِ ظریفِ لبه (hairline) — تیره در روشن، روشن در تیره. یک خطِ تخت، نه سایه.
const RING = 'var(--logo-ring, rgba(0,0,0,.14))';

// ── پرچم‌های سادهٔ ۸ ارزِ اصلی (۲۴×۲۴، بعداً در دایره کلیپ می‌شوند). ──────────────
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
const CCY = Object.keys(FLAG);

// ── فلزاتِ گران‌بها → شمشِ فلزیِ گرادیانی (شاین/رفلکشنِ واقعی، تخت و بدونِ drop-shadow). ──
const METAL = {
  XAU: { bg1: '#e7c56b', bg2: '#9a6f14', bar1: '#fff0bf', bar2: '#c48f27', top1: '#fff7dc', top2: '#f0cf78', edge: '#6f4f0e', spark: '#fffdf3' }, // طلا
  XAG: { bg1: '#eef2f7', bg2: '#8a95a2', bar1: '#ffffff', bar2: '#c0c9d4', top1: '#ffffff', top2: '#e2e8f0', edge: '#69727d', spark: '#ffffff' }, // نقره
  XPT: { bg1: '#e4eaec', bg2: '#7f8c8f', bar1: '#fbfdfd', bar2: '#c2cccd', top1: '#ffffff', top2: '#dfe7e8', edge: '#606a6b', spark: '#ffffff' }, // پلاتین
  XPD: { bg1: '#dde3e3', bg2: '#79807e', bar1: '#f7fbfb', bar2: '#bcc4c2', top1: '#ffffff', top2: '#d9dedc', edge: '#5c625f', spark: '#ffffff' }, // پالادیوم
};

// تعریفِ گرادیان‌های یک فلز (idها بر پایهٔ نوع؛ تکراری اما یکسان → بی‌خطر).
function metalDefs(kind) {
  const m = METAL[kind] || METAL.XAU;
  return (
    <defs>
      <radialGradient id={`mlBg-${kind}`} cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stopColor={m.bg1} /><stop offset="1" stopColor={m.bg2} />
      </radialGradient>
      <linearGradient id={`mlBar-${kind}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={m.bar1} /><stop offset="1" stopColor={m.bar2} />
      </linearGradient>
      <linearGradient id={`mlTop-${kind}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={m.top1} /><stop offset="1" stopColor={m.top2} />
      </linearGradient>
    </defs>
  );
}

// گلیفِ شمش در فضای ۲۴×۲۴ (بدونِ پس‌زمینه — بالادست پر می‌شود). نیازمندِ metalDefs(kind).
function ingotPaint(kind) {
  const m = METAL[kind] || METAL.XAU;
  return (
    <g strokeLinejoin="round">
      <path d="M6 15.7L18 15.7L15.7 10.1L8.3 10.1Z" fill={`url(#mlBar-${kind})`} stroke={m.edge} strokeWidth="0.6" />
      <path d="M8.3 10.1L15.7 10.1L14.4 8.3L9.6 8.3Z" fill={`url(#mlTop-${kind})`} stroke={m.edge} strokeWidth="0.6" />
      <line x1="9" y1="13.9" x2="14.8" y2="13.9" stroke={m.spark} strokeWidth="0.7" opacity="0.6" />
      <line x1="7.6" y1="14.9" x2="9.6" y2="11.2" stroke={m.spark} strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}

// شمشِ فلزی به‌صورتِ svgِ مستقل (دایرهٔ تختِ تمیز، یک رینگِ ظریف، بدونِ drop-shadow).
function metalSvg(kind, s) {
  const c = s / 2, r = c - 0.5;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" aria-hidden>
      {metalDefs(kind)}
      <circle cx={c} cy={c} r={r} fill={`url(#mlBg-${kind})`} />
      <g transform={`scale(${s / 24})`}>{ingotPaint(kind)}</g>
      <circle cx={c} cy={c} r={r} fill="none" stroke={RING} strokeWidth="1" />
    </svg>
  );
}

// ── کریپتو — رنگِ برند + گلیف (fallback وقتی آیکونِ واقعی نبود). تطبیق با کوینِ پایه. ──
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

// ── مانیفستِ آیکون‌های کریپتوِ موجود در /crypto-icons (basenameِ فایل‌ها؛ برای hasRealLogo). ──
// این‌ها فقط نامِ فایل‌اند (نه خودِ آیکون) — سبک و بی‌خطر. اگر تیکر اینجا بود یعنی لوگوی واقعی داریم.
const CRYPTO_ICONS = new Set((
  '$pac 0xbtc 1inch 2give aave abt act actn ada add adx ae aeon aeur agi agrs aion algo amb amp ampl ankr ant ' +
  'ape apex appc ardr arg ark arn arnx ary ast atlas atm atom audr aury auto avax aywa bab bal band bat bay ' +
  'bcbc bcc bcd bch bcio bcn bco bcpt bdl beam bela bix blcn blk block blz bnb bnt bnty booty bos bpt bq brd ' +
  'bsd bsv btc btcd btch btcp btcz btdx btg btm bts btt btx burst bze call cc cdn cdt cenz chain chat chips ' +
  'chsb chz cix clam cloak cmm cmt cnd cnx cny cob colx comp coqui cred crpt crv crw cs ctr ctxc cvc d dai ' +
  'dash dat data dbc dcn dcr deez dent dew dgb dgd dlt dnt dock doge dot drgn drop dta dth dtr ebst eca edg ' +
  'edo edoge ela elec elf elix ella emb emc emc2 eng enj entrp eon eop eos eqli equa etc eth ethos etn etp ' +
  'eur evx exmo exp fair fct fida fil fjc fldc flo flux fsn ftc fuel fun game gas gbp gbx gbyte generic gin ' +
  'glxt gmr gmt gno gnt gold grc grin grs grt gsc gto gup gusd gvt gxs gzr hight hns hodl hot hpb hsr ht ' +
  'html huc husd hush icn icp icx ignis ilk ink ins ion iop iost iotx iq itc jnt jpy kcs kin klown kmd knc ' +
  'krb ksm lbc lend leo link lkk loom lpt lrc lsk ltc lun maid mana matic max mcap mco mda mds med meetone ' +
  'mft miota mith mkr mln mnx mnz moac mod mona msr mth mtl music mzc nano nas nav ncash ndz nebl neo neos ' +
  'neu nexo ngc nio nkn nlc2 nlg nmc nmr npxs ntbc nuls nxs nxt oax ok omg omni one ong ont oot ost ox oxt ' +
  'oxy part pasc pasl pax paxg pay payx pink pirl pivx plr poa poe polis poly pot powr ppc ppp ppt pre prl ' +
  'pungo pura qash qiwi qlc qnt qrl qsp qtum r rads rap ray rcn rdd rdn ren rep repv2 req rhoc ric rise rlc ' +
  'rpx rub rvn ryo safe safemoon sai salt san sand sbd sberbank sc ser shift sib sin skl sky slr sls smart ' +
  'sngls snm snt snx soc sol spacehbit spank sphtx srn stak start steem storj storm stox stq strat stx sub ' +
  'sumo sushi sys taas tau tbx tel ten tern tgch theta tix tkn tks tnb tnc tnt tomo tpay trig trtl trx tusd ' +
  'tzc ubq uma uni unity usd usdc usdt utk veri vet via vib vibe vivo vrc vrsc vtc vtho wabi wan waves wax ' +
  'wbtc wgr wicc wings wpr wtc x xas xbc xbp xby xcp xdn xem xin xlm xmcc xmg xmo xmr xmy xp xpa xpm xpr xrp ' +
  'xsg xtz xuc xvc xvg xzc yfi yoyow zcl zec zel zen zest zil zilla zrx'
).split(' '));

// ── شاخص‌ها → بَجِ رنگیِ برنددار (S&P/NDX/DJI-style). [regex, رنگ, برچسب] ──────────
const INDICES = [
  [/US500|SPX500|\bSPX\b|GSPC|SP500/, '#2962ff', 'SPX'],
  [/NAS100|US100|\bNDX\b|USTEC|NASDAQ|\bNAS\b/, '#0098d8', 'NDX'],
  [/US30|\bDJI\b|DJ30|WS30|DOW/, '#0a4a86', 'DJI'],
  [/US2000|\bRUT\b|RUSSELL/, '#7c3aed', 'RUT'],
  [/UK100|FTSE/, '#c8102e', 'FTSE'],
  [/DE40|GER40|GER30|DE30|\bDAX\b/, '#111827', 'DAX'],
  [/FRA40|\bCAC\b/, '#0055a4', 'CAC'],
  [/JP225|JPN225|N225|NIKKEI/, '#bc002d', 'N225'],
  [/HK50|\bHSI\b|HANGSENG/, '#de2910', 'HSI'],
  [/AUS200|ASX200|\bASX\b/, '#00843d', 'ASX'],
  [/EU50|STOXX|ESTX/, '#003399', 'STX'],
  [/\bVIX\b/, '#f59e0b', 'VIX'],
];

// ── انرژی → بَجِ تیره با برچسب. [regex, رنگ, برچسب] ──────────────────────────────
const ENERGY = [
  [/WTI|USOIL|CRUDE|\bXTI\b|CL_/, '#1f2937', 'WTI'],
  [/BRENT|UKOIL|\bXBR\b/, '#111827', 'BR'],
  [/NATGAS|NAT_?GAS|\bXNG\b|\bNG_/, '#0284c7', 'NG'],
  [/\bOIL\b/, '#1f2937', 'OIL'],
];

const METAL_RE = /^(XAU|XAG|XPT|XPD)/;
const INDEX_RE = /US30|US500|SPX500|SP500|GSPC|NAS100|US100|NDX|USTEC|NASDAQ|\bNAS\b|\bSPX\b|\bDJI\b|DJ30|WS30|DOW|US2000|\bRUT\b|RUSSELL|UK100|FTSE|DE40|GER40|GER30|DE30|\bDAX\b|FRA40|\bCAC\b|JP225|JPN225|N225|NIKKEI|HK50|\bHSI\b|HANGSENG|AUS200|ASX200|\bASX\b|EU50|STOXX|ESTX|\bVIX\b/;
const ENERGY_RE = /WTI|USOIL|CRUDE|\bXTI\b|CL_|BRENT|UKOIL|\bXBR\b|NATGAS|NAT_?GAS|\bXNG\b|\bNG_|OIL/;

// تجزیهٔ نماد به ارزِ پایه/مظنه (اگر جفت‌ارز باشد).
function pair(sym = '') {
  const s = String(sym).toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length >= 6) {
    const a = s.slice(0, 3), b = s.slice(3, 6);
    if (CCY.includes(a) && CCY.includes(b)) return [a, b];
    if ((a === 'XAU' || a === 'XAG' || a === 'XPT' || a === 'XPD') && CCY.includes(b)) return [a, b];
  }
  return null;
}

// انتخابِ رنگ/برچسبِ بَج برای شاخص/انرژی/کریپتو-fallback/فلز/ناشناخته.
function badgeFor(sym = '') {
  const s = String(sym).toUpperCase();
  const base = s.replace(/USDT$|USD$/, '');
  if (CRYPTO[base]) return { color: CRYPTO[base][0], txt: CRYPTO[base][1] };
  if (METAL_RE.test(s)) return { key: s.slice(0, 3), color: (METAL[s.slice(0, 3)] || METAL.XAU).bg2, txt: s.slice(0, 3) };
  for (const [re, color, txt] of INDICES) if (re.test(s)) return { color, txt, index: true };
  for (const [re, color, txt] of ENERGY) if (re.test(s)) return { color, txt };
  return { color: '#64748b', txt: s.slice(0, 3) };
}

// ── یک دایرهٔ تختِ تمیز با پرچمِ ارزِ ccy (سبکِ TV؛ بدونِ سایه، فقط یک رینگِ ظریف). ──
function flagSvg(ccy, s) {
  const c = s / 2, r = c - 0.5;
  const id = `fclip_${ccy}_${s}`;
  const flag = FLAG[ccy];
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" aria-hidden>
      <clipPath id={id}><circle cx={c} cy={c} r={r} /></clipPath>
      <g clipPath={`url(#${id})`} transform={`translate(${c - r} ${c - r}) scale(${(2 * r) / 24})`}>
        {flag || <rect width="24" height="24" fill="#64748b" />}
      </g>
      <circle cx={c} cy={c} r={r} fill="none" stroke={RING} strokeWidth="1" />
    </svg>
  );
}

// آیا نماد کریپتو است؟ (نه جفت‌ارز، نه فلز/کالا، نه شاخص/انرژی) → تیکرِ کوینِ پایه.
function cryptoTicker(sym = '') {
  const s = String(sym).toUpperCase();
  if (pair(s)) return null;
  if (METAL_RE.test(s)) return null;
  if (INDEX_RE.test(s) || ENERGY_RE.test(s)) return null;
  const base = s.replace(/USDT$|USD$/, '');
  return base ? base.toLowerCase() : null;
}

// بَجِ رنگیِ تخت (شاخص/انرژی/کریپتو-fallback/ناشناخته) — دایرهٔ توپرِ تمیز، بدونِ براقیِ سه‌بعدی/سایه.
function badgeSvg(sym, s) {
  const bd = badgeFor(sym);
  if (bd.key && METAL[bd.key]) return metalSvg(bd.key, s);
  const c = s / 2, r = c - 0.5;
  const fs = bd.txt.length > 3 ? s * 0.27 : bd.txt.length > 2 ? s * 0.34 : s * 0.46;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0" aria-hidden>
      <circle cx={c} cy={c} r={r} fill={bd.color} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={fs} fontWeight="700" letterSpacing={bd.txt.length > 2 ? -0.4 : 0} fontFamily="IRANYekanX, Ravagh, Vazirmatn, sans-serif">{bd.txt}</text>
      <circle cx={c} cy={c} r={r} fill="none" stroke={RING} strokeWidth="1" />
    </svg>
  );
}

// لوگوی واقعیِ کریپتو از /crypto-icons/{ticker}.svg؛ اگر نبود → بَجِ رنگی. تخت و گرد، بدونِ سایه.
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
      style={{ borderRadius: '50%', display: 'block' }}
      alt=""
    />
  );
}

// آیا نماد لوگوی «واقعی» دارد؟ (برای فیلترِ حذفِ نمادهای بی‌لوگو در واچ‌لیست/سرچ)
// true = پرچمِ فارکس / شمشِ فلز / بَجِ برنددارِ شاخص یا انرژی / آیکونِ واقعیِ کریپتو (یا کوینِ شناخته‌شده).
// false = فقط مونوگرامِ خاکستریِ ناشناخته (نمادِ بی‌لوگو).
export function hasRealLogo(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (!s) return false;
  if (pair(s)) return true;                                   // جفت‌ارز یا فلز/ارز → پرچم/شمش
  if (METAL_RE.test(s)) return true;                          // فلزِ تنها → شمش
  if (INDEX_RE.test(s) || ENERGY_RE.test(s)) return true;     // شاخص/انرژی → بَجِ برنددار
  const ct = cryptoTicker(s);                                 // تیکرِ کوینِ پایه (lowercase) یا null
  if (ct) return CRYPTO_ICONS.has(ct) || CRYPTO[ct.toUpperCase()] != null;
  return false;                                               // مونوگرامِ خاکستریِ ناشناخته
}

export default function SymbolLogo({ symbol, size = 22 }) {
  const p = pair(symbol);
  const s = size;
  if (p) {
    // سبکِ TV: یک دایرهٔ تختِ تمیزِ ارزِ پایه (نه پرچمِ دوتاییِ روی‌هم، نه سایه).
    const base = p[0];
    if (METAL[base]) return metalSvg(base, s);
    return flagSvg(base, s);
  }
  const ct = cryptoTicker(symbol);
  if (ct) return <CryptoLogo symbol={symbol} ticker={ct} size={s} />;
  return badgeSvg(symbol, s);
}
