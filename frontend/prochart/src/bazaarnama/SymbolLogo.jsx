// بازارنما — لوگوی نماد به سبکِ TradingView: «یک دایرهٔ تختِ تمیز» (بدونِ سایه، بدونِ پرچمِ دوتاییِ روی‌هم).
// فارکس = پرچمِ ارزِ پایه در یک دایرهٔ تمیز؛ فلز = شمشِ طلا/نقره؛ کریپتو = لوگوی واقعی از /crypto-icons؛
// شاخص/انرژی = بَجِ رنگیِ تختِ برنددار؛ ناشناخته = مونوگرامِ رنگی. همه گِرد، هم‌تراز، آنتی‌الیاسِ تمیز، بدونِ drop-shadow.
import React from 'react';
import { cryptoLogoId, onCatalogReady } from './symbolCatalog';

// رنگِ رینگِ ظریفِ لبه (hairline) — تیره در روشن، روشن در تیره. یک خطِ تخت، نه سایه.
const RING = 'var(--logo-ring, rgba(0,0,0,.14))';

// نسخهٔ لوگوها — چون فایل‌های /crypto-icons و /symbol-logos با نامِ ثابت ولی محتوای متغیر (قدیمی→TV)
// سرو می‌شوند و nginx آن‌ها را immutable(۱سال) کش می‌کند، این ?v cacheِ مرورگرِ کاربرانِ قبلی را می‌شکند.
// هر بار لوگوها را عوض کردیم این عدد را +۱ کنید.
const LOGO_V = '2';

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
  // ── ارزهای پرمعاملهٔ بیشتر (طرحِ رسمیِ پرچم‌ها — عمومی، غیرکپی‌رایتی). ──────────────
  CNY: (<g><rect width="24" height="24" fill="#de2910" /><text x="6" y="10.5" textAnchor="middle" fontSize="9" fill="#ffde00">★</text><text x="12" y="5.5" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="13.5" y="8.5" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="13.5" y="12" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="12" y="15" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text></g>),
  SEK: (<g><rect width="24" height="24" fill="#006aa7" /><rect x="8" width="3" height="24" fill="#fecc00" /><rect y="9" width="24" height="3" fill="#fecc00" /></g>),
  NOK: (<g><rect width="24" height="24" fill="#ef2b2d" /><rect x="7" width="5" height="24" fill="#fff" /><rect y="8" width="24" height="5" fill="#fff" /><rect x="8" width="3" height="24" fill="#002868" /><rect y="9" width="24" height="3" fill="#002868" /></g>),
  DKK: (<g><rect width="24" height="24" fill="#c8102e" /><rect x="8" width="3" height="24" fill="#fff" /><rect y="9" width="24" height="3" fill="#fff" /></g>),
  PLN: (<g><rect width="24" height="12" fill="#fff" /><rect y="12" width="24" height="12" fill="#dc143c" /></g>),
  RUB: (<g><rect width="24" height="8" fill="#fff" /><rect y="8" width="24" height="8" fill="#0039a6" /><rect y="16" width="24" height="8" fill="#d52b1e" /></g>),
  MXN: (<g><rect width="8" height="24" fill="#006847" /><rect x="8" width="8" height="24" fill="#fff" /><rect x="16" width="8" height="24" fill="#ce1126" /><circle cx="12" cy="12" r="2.2" fill="none" stroke="#8a6d3b" strokeWidth="0.8" /></g>),
  INR: (<g><rect width="24" height="8" fill="#ff9933" /><rect y="8" width="24" height="8" fill="#fff" /><rect y="16" width="24" height="8" fill="#138808" /><circle cx="12" cy="12" r="2.8" fill="none" stroke="#000080" strokeWidth="0.8" /></g>),
  BRL: (<g><rect width="24" height="24" fill="#009c3b" /><polygon points="12,3 21,12 12,21 3,12" fill="#ffdf00" /><circle cx="12" cy="12" r="4" fill="#002776" /></g>),
  TRY: (<g><rect width="24" height="24" fill="#e30a17" /><circle cx="10" cy="12" r="5" fill="#fff" /><circle cx="11.7" cy="12" r="4" fill="#e30a17" /><text x="16" y="14.5" textAnchor="middle" fontSize="6" fill="#fff">★</text></g>),
  KRW: (<g><rect width="24" height="24" fill="#fff" /><circle cx="12" cy="12" r="5" fill="#0047a0" /><path d="M12 7 a5 5 0 0 1 0 10 a2.5 2.5 0 0 1 0 -5 a2.5 2.5 0 0 0 0 -5 z" fill="#cd2e3a" /></g>),
  SGD: (<g><rect width="24" height="12" fill="#ef3340" /><rect y="12" width="24" height="12" fill="#fff" /><circle cx="6" cy="6" r="3" fill="#fff" /><circle cx="7.6" cy="6" r="2.4" fill="#ef3340" /><text x="11" y="7.6" textAnchor="middle" fontSize="3" fill="#fff">★</text></g>),
  CNH: (<g><rect width="24" height="24" fill="#de2910" /><text x="6" y="10.5" textAnchor="middle" fontSize="9" fill="#ffde00">★</text><text x="12" y="5.5" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="13.5" y="8.5" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="13.5" y="12" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text><text x="12" y="15" textAnchor="middle" fontSize="3.4" fill="#ffde00">★</text></g>),
  HKD: (<g><rect width="24" height="24" fill="#de2910" /><g fill="#fff">{[0,72,144,216,288].map((a)=>(<ellipse key={a} cx="12" cy="6.6" rx="1.5" ry="3.4" transform={`rotate(${a} 12 12)`} />))}</g><circle cx="12" cy="12" r="1.5" fill="#de2910" /></g>),
  ZAR: (<g><rect width="24" height="12" fill="#e03c31" /><rect y="12" width="24" height="12" fill="#001489" /><rect y="9.5" width="24" height="5" fill="#007a4d" /><path d="M0 2 L10 12 L0 22 Z" fill="#000" /></g>),
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
// لوگوهای واقعیِ کریپتوی TradingView (committed در crypto-icons-extra؛ هنگامِ build روی آیکون‌های بستهٔ
// cryptocurrency-icons override می‌شوند). این‌ها دقیقاً لوگوی TV هستند — CryptoLogo لایهٔ محلی را از این‌ها می‌خواند.
(
  '0g 1inch 2z 3ull 4 a2z aaplon aaplx aave abey acnon acu acx ada adbeon aergo aerobud aevo agld ai4 aibtc ain ' +
  'aioz aixbt ake alch ald aleo algo alice allo alpine alu amaton amdon amznon amznx aneton ankr anome ap3x ape apr apt ' +
  'aptm ar arb arc arkm armon arpa arx asmlon asr asteroid astr atm atom auction audio ausd ava avax avgoon avici avnt ' +
  'axs aztec b b2 b3 b3tr babaon babydoge baon bar bch bdag bdtc bera bfic bgb bianrensheng bicity bico biduon bidz bigtime ' +
  'bilion bitcoin bless bluai blub blur bmnron bnb bnbholder bnc bome bonk brev brg broccoli btc bty bxn cake cbk celo celr ' +
  'cetus cfg cfx cgo cgpt check cheel cheq chillguy chz ckb clanker clawnch clore cohron coinon coinx comp copon copxon core coston ' +
  'cow crat crclon crclx crmon cro cross crtr crv crwvon cspr ctc ctk ctp cvc cvx cvxon dag dash data dbc dbx ' +
  'dexe dgb dingo dmtr dodo doge dolo dood dot drift dsync dydx dym edgex eemon efaon egl1 egld eigen ena enj ens ' +
  'enso esports etc eth ethfi eurq evdc f fartcoin fct2 fet ff fhe fida fil fiwa flock floki flow flr fogo frts ' +
  'ftm ftrb ftt fun gaib gala gas genius ghub gldon glmr gmcoin gmeon gmx goated gomining googlon googlx gork gps gram griffain ' +
  'grt gt gun gwei h haedal hajimi han hbar hei hemi hft high himson hmstr hoodon hoodx hot hsk htx huma hyp ' +
  'iauon ibmon icbx icp id iefaon iemgon ika ilv impt imx index init inj intcon iost iota iotx irenon irys islm itoton ' +
  'ivt ivvon izky jailstool jasmy jct jellyjelly jitosol joe jpmon jst jto jup juv jyai kaia kaito kas kava kefuxiaohe kernel kfi ' +
  'kgen kite knch koma koon ksm kta l1x laozi lazio lb lc ldo limo linea link lista lit llyon lm lmton lmts ' +
  'lmwr longxia lpt lqty lrc lrcxon ltc lumia lumint luna lunc lur lyk magic mamo mana manta mantra maon mapo maraon mask ' +
  'maxxing mbox mcn mcoin mea merl meta metaon metis mew mina mito mln mnt mog moodeng morpho movr mplx mpon mrvlon msfton ' +
  'msq mstron mstrx mtc mubarak muon mx myro myx naka naoris navx near neet neiro neo nexo nflxon nil niza nmr ' +
  'nobody nock not nrg ntx num nvdaon nvdax nvoon nxpc obol og ogy okb okloon ol omax ondo ondson op orbs orca ' +
  'orclon order ordi osmo oxyon pallon parti paxg pbron pddon pendle people pepe pepu pfeon pha pieverse pippin pivx pltron plume pond ' +
  'ponke pri prom prompt pros prove psg psqon pth puffer pumpcade puss pyr pyth qbtson qcomon qi qnt qqqon qqqx qrl qtum ' +
  'quai qubic rad rare ray render renq resolv rez rhea rif river rivnon rmv rndr roa roam rog ron rpl rsr rune ' +
  'rvn rvv safe sahara sand santos sapien scarcity scrt sei sentis sfp sgovon shib shibdoge shopon siren sisc six slvon smcion sndkon ' +
  'snek snowon snx sol solv somi soph soso space spyon spyx ssv stat stau stbl stg storj sui summit sushi swarms swash ' +
  'swch swgt sxt syn sys t taiko tao theta thq tia tibbir tics tipon tjrm tlm tlton tnsr ton towns tqqqon trb ' +
  'trhub trx tslaon tslax tsmon tt turbo turt twt uberon ucn uds uma unhon uni upc upeg usdc usdd usdq useless usoon ' +
  'ustc usual utya uusd vanry velo velvet verem vet vine virtual volt von vrton vvv w wallet wbtc whitewhale wif win wing ' +
  'wmton woo wxt xaut xch xcn xdc xe xec xiuxian xlm xny xomon xpl xrb xrp xrph xt xtz xu3o8 xvs yb ' +
  'yfi ygg yuru zama zbcn zcx zec zerebro zig zil zkp '
).split(/\s+/).filter(Boolean).forEach((t) => CRYPTO_ICONS.add(t));

// ── شاخص‌ها → بَجِ رنگیِ برنددار (S&P/NDX/DJI-style). [regex, رنگ, برچسب] ──────────
// سبکِ TradingView: بَجِ شاخص = دایرهٔ توپرِ برنددار + «عددِ تعدادِ اجزا» به‌سفید (نه حروف).
//   S&P 500 → «500» قرمزِ تیره · Nasdaq 100 → «100» آبی · Dow → «30» فیروزه‌ای.
const INDICES = [
  [/US500|SPX500|\bSPX\b|GSPC|SP500/, '#e3242b', '500'],
  [/NAS100|US100|\bNDX\b|USTEC|NASDAQ|\bNAS\b/, '#0071e3', '100'],
  [/US30|\bDJI\b|DJ30|WS30|DOW/, '#00a0d8', '30'],
  [/US2000|\bRUT\b|RUSSELL/, '#7c3aed', '2000'],
  [/UK100|FTSE/, '#c8102e', '100'],
  [/DE40|GER40|GER30|DE30|\bDAX\b/, '#111827', '40'],
  [/FRA40|\bCAC\b/, '#0055a4', '40'],
  [/JP225|JPN225|N225|NIKKEI/, '#bc002d', '225'],
  [/HK50|\bHSI\b|HANGSENG/, '#de2910', '50'],
  [/AUS200|ASX200|\bASX\b/, '#00843d', '200'],
  [/EU50|STOXX|ESTX/, '#003399', '50'],
  [/\bVIX\b/, '#f59e0b', 'VIX'],
  [/\bDXY\b|USDX|DOLLARINDEX|DOLLARIDX/, '#2e7d32', '$'], // شاخصِ دلار — بَجِ «$» سبزِ تیره (مثلِ TradingView)
];

// ── انرژی → بَجِ تیره با برچسب. [regex, رنگ, برچسب] ──────────────────────────────
const ENERGY = [
  [/WTI|USOIL|CRUDE|\bXTI\b|CL_/, '#1f2937', 'WTI'],
  [/BRENT|UKOIL|\bXBR\b/, '#111827', 'BR'],
  [/NATGAS|NAT_?GAS|\bXNG\b|\bNG_/, '#0284c7', 'NG'],
  [/\bOIL\b/, '#1f2937', 'OIL'],
];

// ── کالاها (فلزِ صنعتی/کشاورزی) → بَجِ برنددارِ اصیل با کدِ فیوچرزِ استاندارد. [regex, رنگ, برچسب] ──
const COMMODITIES = [
  [/COPPER|\bXCU\b|\bHG_?\b/, '#b06a33', 'Cu'],
  [/CORN|\bZC_?\b/, '#b8860b', 'ZC'],
  [/WHEAT|\bZW_?\b/, '#a67c00', 'ZW'],
  [/SOYBEAN|\bSOY\b|\bZS_\b/, '#5b7a1e', 'ZS'],
  [/COFFEE|\bKC_?\b/, '#6f4e37', 'KC'],
  [/SUGAR|\bSB_?\b/, '#8d6e63', 'SB'],
  [/COCOA|\bCC_?\b/, '#5a3825', 'CC'],
  [/COTTON|\bCT_?\b/, '#6b7280', 'CT'],
  [/ALUMIN/, '#78838f', 'Al'],
];

// ── سهامِ پرمعامله → بَجِ برنددارِ رنگی (رنگِ برندِ واقعیِ شرکت، فقط factؚ عمومی). ──
// سبکِ TradingView: هر سهم یک لوگوی رنگی دارد؛ اینجا معادلِ اصیل = دایرهٔ توپرِ رنگِ برند + تیکرِ سفید،
// به‌جای مونوگرامِ خاکستریِ عمومی. هیچ لوگوی اختصاصیِ کپی‌رایتی کپی نمی‌شود — فقط رنگِ برند (عدد/واقعیت).
const STOCKS = {
  AAPL: '#111111', MSFT: '#0067b8', GOOGL: '#4285f4', GOOG: '#4285f4', AMZN: '#ff9900',
  TSLA: '#e31937', META: '#0866ff', NVDA: '#76b900', NFLX: '#e50914', AMD: '#ed1c24',
  INTC: '#0071c5', IBM: '#0530ad', ORCL: '#c74634', CRM: '#00a1e0', ADBE: '#ed1c24',
  PYPL: '#003087', DIS: '#113ccf', BABA: '#ff6a00', KO: '#f40009', PEP: '#004b93',
  MCD: '#da291c', NKE: '#111111', V: '#1a1f71', MA: '#c8102e', JPM: '#005eb8',
  BAC: '#e31837', WMT: '#0071ce', COST: '#e31837', PFE: '#0093d0', BA: '#0039a6',
  UBER: '#111111', SBUX: '#00704a', SHOP: '#5a863e', SPOT: '#1db954', COIN: '#0052ff',
  PLTR: '#101418', ABNB: '#e8484d', QCOM: '#3253dc', TXN: '#c8102e', AVGO: '#cc0000',
  CSCO: '#1ba0d7', T: '#00a8e0', VZ: '#cd040b', XOM: '#e01e2b', CVX: '#0066b2',
  GS: '#6c99c8', MS: '#00558c', C: '#004685', WFC: '#c40404', GE: '#1d67b2',
  F: '#00274e', GM: '#171c8f', MRNA: '#1c2b4a', LLY: '#c8102e', JNJ: '#d51900',
  MU: '#4e7d2f', ARM: '#111111', DELL: '#007db8', HPQ: '#0096d6', SONY: '#111111',
  // دستهٔ دومِ نمادهای پرمعامله (نیمه‌هادی/کلود/خودرو/خرده‌فروشی/دارو/چینی) — رنگِ برندِ عمومی.
  TSM: '#c8102e', ASML: '#0b5cff', AMAT: '#f36f21', LRCX: '#00539b', ADI: '#00539b',
  SNOW: '#1c86c9', CRWD: '#e01e2b', NET: '#f6821f', DDOG: '#632ca6', PANW: '#fa582d',
  ZS: '#0075c9', SQ: '#2b2f36', RIVN: '#0d2440', LCID: '#1a1f2b', NIO: '#00a3a3',
  BIDU: '#2319dc', PDD: '#e02e24', JD: '#e1251b', UNH: '#002677', HD: '#f96302',
  LOW: '#004990', CAT: '#1a1a1a', PG: '#004b8d', MRK: '#00857c', ABBV: '#071d49',
  TMO: '#e1251b', NVO: '#001965', SAP: '#0faaff', TM: '#eb0a1e', HON: '#e11b22',
  RTX: '#c8102e', UPS: '#644117', BKNG: '#003580', GILD: '#c8102e', BLK: '#111111',
  AXP: '#006fcf', PM: '#c8102e', LIN: '#0058a3', ACN: '#a100ff', NOW: '#111111',
  // ETFهای پرمعامله — بَجِ برنددار به‌جای مونوگرامِ خاکستری (رنگِ برندِ عمومی).
  SPY: '#d21e2b', QQQ: '#5b57c9', IWM: '#00a0d8', DIA: '#0071c5', VOO: '#96151d',
  VTI: '#96151d', GLD: '#c9a233', SLV: '#7d8896', ARKK: '#101418', XLF: '#004b8d',
  XLE: '#1f2937', EEM: '#009a44', TLT: '#004990', HYG: '#5a863e', SMH: '#0b5cff',
  // دستهٔ سومِ سهام (رشد/خرده‌فروشیِ محبوب) — رنگِ برندِ عمومی.
  SMCI: '#0f5c2e', MSTR: '#e8770c', RBLX: '#e2231a', HOOD: '#0a8f04', SOFI: '#0a1f3c',
  DKNG: '#1a7d2e', MARA: '#101418', RIOT: '#f26522', U: '#101418', PINS: '#e60023',
  ROKU: '#6f1ab1', DASH: '#eb1700', ZM: '#2d8cff', ADP: '#d0271d', BX: '#101418',
};

// ── لوگوی واقعیِ برندِ سهام/ETF → logoidِ CDN عمومیِ نمادها (همان مرجعی که TradingView از آن لوگو می‌گیرد). ──
// نگاشتِ تیکر → logoid؛ سرو با سه لایه: (۱) فایلِ محلی /symbol-logos، (۲) پراکسی+کشِ بک‌اند /api/symbol-logo،
// (۳) مستقیم از CDN؛ اگر هر سه شکست خورد → بَجِ رنگیِ برند (رفتارِ قبلی). لوگوها علامتِ خودِ شرکت‌اند (استفادهٔ اسمی).
const STOCK_LOGO = {
  AAPL:'apple', ABBV:'abbvie', ABNB:'airbnb', ACN:'accenture', ADBE:'adobe',
  ADI:'analog-devices', ADP:'automatic-data-processing', AMAT:'applied-materials', AMD:'advanced-micro-devices', AMZN:'amazon',
  ARKK:'ark-etf-tr', ARM:'arm', ASML:'asml', AVGO:'broadcom', AXP:'american-express',
  BA:'boeing', BABA:'alibaba', BAC:'bank-of-america', BIDU:'baidu', BKNG:'booking',
  BLK:'blackrock', BX:'blackstone', C:'citigroup', CAT:'caterpillar', COIN:'coinbase',
  COST:'costco-wholesale', CRM:'salesforce', CRWD:'crowdstrike', CSCO:'cisco', CVX:'chevron',
  DASH:'doordash', DDOG:'datadog', DELL:'dell', DIA:'spdr-sandp500-etf-tr', DIS:'walt-disney',
  DKNG:'draftkings', EEM:'ishares', F:'ford', GE:'ge-aerospace', GILD:'gilead',
  GLD:'spdr-gold-trust', GM:'general-motors', GOOG:'alphabet', GOOGL:'alphabet', GS:'goldman-sachs',
  HD:'home-depot', HON:'honeywell', HOOD:'robinhood', HPQ:'hp', HYG:'ishares',
  IBM:'international-bus-mach', INTC:'intel', IWM:'ishares', JD:'jd-com', JNJ:'johnson-and-johnson',
  JPM:'jpmorgan-chase', KO:'coca-cola', LCID:'lucid-group', LIN:'linde', LLY:'eli-lilly',
  LOW:'lowe-s', LRCX:'lam-research', MA:'mastercard', MARA:'marathon-digital-holdings', MCD:'mcdonalds',
  META:'meta-platforms', MRK:'merck-and-co', MRNA:'moderna', MS:'morgan-stanley', MSFT:'microsoft',
  MSTR:'microstrategy', MU:'micron-technology', NET:'cloudflare-inc', NFLX:'netflix', NIO:'nio',
  NKE:'nike', NOW:'servicenow', NVDA:'nvidia', NVO:'novo-nordisk', ORCL:'oracle',
  PANW:'palo-alto-networks', PDD:'pinduoduo', PEP:'pepsico', PFE:'pfizer', PG:'procter-and-gamble',
  PINS:'pinterest', PLTR:'palantir', PM:'philip-morris', PYPL:'paypal', QCOM:'qualcomm',
  QQQ:'nasdaq', RBLX:'roblox', RIOT:'riot-blockchain', RIVN:'rivian', ROKU:'roku',
  RTX:'raytheon', SAP:'sap', SBUX:'starbucks', SHOP:'shopify', SLV:'ishares',
  SMCI:'super-micro-computer', SMH:'vaneck', SNOW:'snowflake', SOFI:'sofi', SONY:'sony',
  SPOT:'spotify-technology', SPY:'spdr-sandp500-etf-tr', SQ:'block', T:'at-and-t', TLT:'ishares',
  TM:'toyota', TMO:'thermo-fisher-scientific', TSLA:'tesla', TSM:'taiwan-semiconductor', TXN:'texas-instruments',
  U:'unity', UBER:'uber', UNH:'unitedhealth', UPS:'united-parcel', V:'visa',
  VOO:'vanguard', VTI:'vanguard', VZ:'verizon', WFC:'wells-fargo', WMT:'walmart',
  XLE:'sector/energy', XLF:'sector/financial', XOM:'exxon', ZM:'zoom-video-communications', ZS:'zscaler',
};

// ── شاخص‌ها → logoidِ رسمیِ شاخص (S&P/Nasdaq/Dow…). موازیِ INDICES؛ STOXX/VIX عمداً بَج می‌مانند (لوگوی خوبی ندارند). ──
const INDEX_LOGO = [
  [/US500|SPX500|\bSPX\b|GSPC|SP500/, 'indices/s-and-p-500'],
  [/NAS100|US100|\bNDX\b|USTEC|NASDAQ|\bNAS\b/, 'indices/nasdaq-100'],
  [/US30|\bDJI\b|DJ30|WS30|DOW/, 'indices/dow-30'],
  [/US2000|\bRUT\b|RUSSELL/, 'indices/russell-2000'],
  [/UK100|FTSE/, 'indices/ftse-100-index'],
  [/DE40|GER40|GER30|DE30|\bDAX\b/, 'indices/dax'],
  [/FRA40|\bCAC\b/, 'indices/cac-40'],
  [/JP225|JPN225|N225|NIKKEI/, 'indices/nikkei-225'],
  [/HK50|\bHSI\b|HANGSENG/, 'indices/hang-seng'],
  [/AUS200|ASX200|\bASX\b/, 'indices/asx-200'],
  [/\bDXY\b|USDX|DOLLARINDEX|DOLLARIDX/, 'indices/u-s-dollar-index'],
];

// ── فلزاتِ گران‌بها → logoidِ واقعیِ TradingView. ──
const METAL_LOGOID = { XAU: 'metal/gold', XAG: 'metal/silver', XPT: 'metal/platinum', XPD: 'metal/palladium' };

// ── انرژی → logoidِ واقعیِ TradingView (نفت = crude-oil؛ گازِ طبیعی = natural-gas). [regex, logoid] ──
const ENERGY_LOGO = [
  [/WTI|USOIL|CRUDE|\bXTI\b|CL_|BRENT|UKOIL|\bXBR\b|\bOIL\b/, 'crude-oil'],
  [/NATGAS|NAT_?GAS|\bXNG\b|\bNG_/, 'natural-gas'],
];

function stockLogoId(sym = '') {
  const stk = String(sym).toUpperCase().split(':').pop().replace(/[^A-Z]/g, '');
  return STOCK_LOGO[stk] || null;
}
function energyLogoId(sym = '') {
  const s = String(sym).toUpperCase();
  for (const [re, lid] of ENERGY_LOGO) if (re.test(s)) return lid;
  return null;
}
function indexLogoId(sym = '') {
  const s = String(sym).toUpperCase();
  for (const [re, lid] of INDEX_LOGO) if (re.test(s)) return lid;
  return null;
}

// لوگوی واقعیِ برند با سه لایهٔ fallback؛ اگر هر سه شکست خورد → المانِ fallback (بَجِ رنگی). گِرد و تخت مثلِ بقیه.
function RemoteLogo({ logoid, size, fallback }) {
  const name = logoid.replace(/\//g, '-');
  // logoidهای کریپتو (crypto/…) در باندلِ محلیِ symbol-logos نیستند → مستقیم از پراکسی (بدونِ ۴۰۴ِ بی‌جا).
  const srcs = React.useMemo(() => [
    ...(logoid.startsWith('crypto/') ? [] : [`/symbol-logos/${name}.svg?v=${LOGO_V}`]),  // لایهٔ ۱: باندلِ محلی
    `/api/public/symbol-logo?id=${encodeURIComponent(logoid)}`,        // لایهٔ ۲: پراکسی+کشِ بک‌اند
    `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`,       // لایهٔ ۳: مستقیم از CDN
  ], [name, logoid]);
  const [i, setI] = React.useState(0);
  if (i >= srcs.length) return fallback;                               // fallbackِ نهایی → بَجِ رنگی
  return (
    <span
      className="shrink-0"
      aria-hidden
      style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${RING}`, lineHeight: 0, verticalAlign: 'middle', background: 'var(--logo-bg, #fff)' }}
    >
      <img
        src={srcs[i]}
        width={size}
        height={size}
        onError={() => setI((n) => n + 1)}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
        alt=""
      />
    </span>
  );
}

const METAL_RE = /^(XAU|XAG|XPT|XPD)/;
const INDEX_RE = /US30|US500|SPX500|SP500|GSPC|NAS100|US100|NDX|USTEC|NASDAQ|\bNAS\b|\bSPX\b|\bDJI\b|DJ30|WS30|DOW|US2000|\bRUT\b|RUSSELL|UK100|FTSE|DE40|GER40|GER30|DE30|\bDAX\b|FRA40|\bCAC\b|JP225|JPN225|N225|NIKKEI|HK50|\bHSI\b|HANGSENG|AUS200|ASX200|\bASX\b|EU50|STOXX|ESTX|\bVIX\b/;
const ENERGY_RE = /WTI|USOIL|CRUDE|\bXTI\b|CL_|BRENT|UKOIL|\bXBR\b|NATGAS|NAT_?GAS|\bXNG\b|\bNG_|OIL/;
const COMMODITY_RE = /COPPER|\bXCU\b|\bHG_?\b|CORN|\bZC_?\b|WHEAT|\bZW_?\b|SOYBEAN|\bSOY\b|\bZS_\b|COFFEE|\bKC_?\b|SUGAR|\bSB_?\b|COCOA|\bCC_?\b|COTTON|\bCT_?\b|ALUMIN/;

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
  const stk = s.split(':').pop();                                     // 'NASDAQ:AAPL' → 'AAPL'
  if (STOCKS[stk]) return { color: STOCKS[stk], txt: stk.length > 4 ? stk.slice(0, 4) : stk, stock: true };
  if (METAL_RE.test(s)) return { key: s.slice(0, 3), color: (METAL[s.slice(0, 3)] || METAL.XAU).bg2, txt: s.slice(0, 3) };
  for (const [re, color, txt] of INDICES) if (re.test(s)) return { color, txt, index: true };
  for (const [re, color, txt] of ENERGY) if (re.test(s)) return { color, txt };
  for (const [re, color, txt] of COMMODITIES) if (re.test(s)) return { color, txt };
  return { color: '#64748b', txt: s.slice(0, 3) };
}

// ── نگاشتِ ارز → کدِ کشورِ ISO (برای پرچمِ واقعیِ TradingView: /symbol-logos/country-XX.svg). ──
const CCY_CC = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ',
  CNY: 'CN', SEK: 'SE', NOK: 'NO', DKK: 'DK', PLN: 'PL', RUB: 'RU', MXN: 'MX', INR: 'IN',
  BRL: 'BR', TRY: 'TR', KRW: 'KR', SGD: 'SG', HKD: 'HK', ZAR: 'ZA', CNH: 'CN',
};

// ── سکهٔ پرچمِ یک ارز: پرچمِ واقعیِ TradingView (country/XX)؛ اگر نبود → پرچمِ SVGِ خودمان (fallback). ──
function FlagCoin({ ccy, s }) {
  const [err, setErr] = React.useState(false);
  const cc = CCY_CC[ccy];
  return (
    <span
      className="shrink-0"
      style={{ display: 'inline-block', width: s, height: s, borderRadius: '50%', overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${RING}`, lineHeight: 0, verticalAlign: 'middle', background: 'var(--logo-bg, #fff)' }}
      aria-hidden
    >
      {!err && cc ? (
        <img
          src={`/symbol-logos/country-${cc}.svg?v=${LOGO_V}`}
          width={s}
          height={s}
          onError={() => setErr(true)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
        />
      ) : (
        <svg width={s} height={s} viewBox="0 0 24 24" style={{ display: 'block' }}>
          {FLAG[ccy] || <rect width="24" height="24" fill="#64748b" />}
        </svg>
      )}
    </span>
  );
}

function flagSvg(ccy, s) {
  return <FlagCoin ccy={ccy} s={s} />;
}

// ── جفت‌ارز → دو پرچمِ کشور در یک دایرهٔ نصف‌شده (سبکِ TradingView؛ تخت، بدونِ سایه). ──
// نیمهٔ راست = ارزِ پایه (اول)، نیمهٔ چپ = ارزِ مظنه (دوم). هر پرچم بدونِ کِشیدگی
// (aspect حفظ می‌شود) و از مرکز کراپ می‌شود؛ یک درزِ سفیدِ نازک وسط + یک رینگِ ظریفِ لبه.
// ظرفِ CSS دایره‌ای (border-radius + overflow) → دایرهٔ کاملِ تمیز، بدونِ clipPath/idِ تکراری.
// سبکِ TradingView: جفت‌ارز = «دو سکهٔ پرچمِ دایره‌ایِ روی‌هم‌افتاده» (نه نیم‌دایرهٔ تقسیم‌شده).
//   پایه (base) = سکهٔ بزرگ‌ترِ جلو، پایین-چپ؛ مظنه (quote) = سکهٔ کوچک‌ترِ پشت، بالا-راست.
//   هر پرچم داخلِ یک دایرهٔ کامل کلیپ می‌شود؛ یک رینگِ روشن دورِ سکهٔ جلو تا از سکهٔ پشت جدا شود.
//   پرچم‌ها اصیلِ خودِ Pro-Chart‌اند (عمومی)؛ فقط چیدمان مطابقِ قراردادِ TV است.
function pairFlagSvg(base, quote, s) {
  const back = Math.round(s * 0.62);   // مظنه — کوچک‌ترِ پشت
  const front = Math.round(s * 0.74);  // پایه — بزرگ‌ترِ جلو
  return (
    <span
      className="shrink-0"
      aria-hidden
      style={{ position: 'relative', display: 'inline-block', width: s, height: s, verticalAlign: 'middle', lineHeight: 0 }}
    >
      {/* مظنه (quote) — سکهٔ کوچک‌ترِ پشت، گوشهٔ بالا-راست */}
      <span style={{ position: 'absolute', top: 0, right: 0, lineHeight: 0 }}>{flagSvg(quote, back)}</span>
      {/* پایه (base) — سکهٔ بزرگ‌ترِ جلو، پایین-چپ؛ رینگِ روشن برای جداسازیِ دو سکه */}
      <span style={{ position: 'absolute', bottom: 0, left: 0, borderRadius: '50%', boxShadow: '0 0 0 1.5px var(--logo-bg, #fff)', lineHeight: 0 }}>{flagSvg(base, front)}</span>
    </span>
  );
}

// آیا نماد کریپتو است؟ (نه جفت‌ارز، نه فلز/کالا، نه شاخص/انرژی) → تیکرِ کوینِ پایه.
function cryptoTicker(sym = '') {
  const s = String(sym).toUpperCase();
  if (pair(s)) return null;
  if (METAL_RE.test(s)) return null;
  if (INDEX_RE.test(s) || ENERGY_RE.test(s) || COMMODITY_RE.test(s)) return null;
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

// لوگوی واقعیِ کریپتو: (۱) آیکونِ محلیِ /crypto-icons، (۲) لوگوی برندِ TV از کاتالوگ (پراکسی/CDN)،
// (۳) بَجِ رنگی. کاتالوگ که async لود شود، با onCatalogReady یک re-render می‌شود تا لوگوها ظاهر شوند.
function CryptoLogo({ symbol, ticker, size }) {
  const [err, setErr] = React.useState(false);
  const [, bump] = React.useState(0);
  React.useEffect(() => onCatalogReady(() => bump((n) => n + 1)), []);
  // لایهٔ ۱: آیکونِ محلی (سریع، باندل‌شده) — مانیفستِ CRYPTO_ICONS با فایل‌های /crypto-icons سینک است.
  if (!err && ticker && CRYPTO_ICONS.has(String(ticker).toLowerCase())) {
    return (
      <img
        src={`/crypto-icons/${ticker}.svg?v=${LOGO_V}`}
        width={size}
        height={size}
        onError={() => setErr(true)}
        className="shrink-0"
        style={{ borderRadius: '50%', display: 'block' }}
        alt=""
      />
    );
  }
  // لایهٔ ۲: logoidِ کریپتوی TV از کاتالوگ (کلِ جهانِ TV-دارای‌لوگو، بدونِ سقف) → پراکسی/CDN.
  const lid = cryptoLogoId(symbol);
  if (lid) return <RemoteLogo logoid={lid} size={size} fallback={badgeSvg(symbol, size)} />;
  // لایهٔ ۳: بَجِ رنگیِ برند.
  return badgeSvg(symbol, size);
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
  if (COMMODITY_RE.test(s)) return true;                      // کالا → بَجِ برنددار
  if (STOCKS[s.split(':').pop()]) return true;                // سهامِ شناخته‌شده → بَجِ برنددار
  const ct = cryptoTicker(s);                                 // تیکرِ کوینِ پایه (lowercase) یا null
  if (ct) return CRYPTO_ICONS.has(ct) || CRYPTO[ct.toUpperCase()] != null || cryptoLogoId(s) != null;
  return false;                                               // مونوگرامِ خاکستریِ ناشناخته
}

export default function SymbolLogo({ symbol, size = 22 }) {
  const p = pair(symbol);
  const s = size;
  if (p) {
    // سبکِ TV: فلز/ارز → لوگوی واقعیِ فلزِ TV (fallback شمشِ خودمان)؛ ارز/ارز → دو پرچمِ واقعیِ کشورِ TV.
    const base = p[0], quote = p[1];
    if (METAL[base]) return <RemoteLogo logoid={METAL_LOGOID[base]} size={s} fallback={metalSvg(base, s)} />;
    return pairFlagSvg(base, quote, s);
  }
  // شاخص/سهام/ETF/انرژی/فلزِ تنها → لوگوی واقعیِ TV (سه لایه)؛ fallback = بَجِ/شمشِ قبلی.
  const idx = indexLogoId(symbol);
  if (idx) return <RemoteLogo logoid={idx} size={s} fallback={badgeSvg(symbol, s)} />;
  const en = energyLogoId(symbol);
  if (en) return <RemoteLogo logoid={en} size={s} fallback={badgeSvg(symbol, s)} />;
  if (METAL_RE.test(String(symbol).toUpperCase())) {
    const mk = String(symbol).toUpperCase().slice(0, 3);
    return <RemoteLogo logoid={METAL_LOGOID[mk] || 'metal/gold'} size={s} fallback={metalSvg(mk, s)} />;
  }
  const stk = stockLogoId(symbol);
  if (stk) return <RemoteLogo logoid={stk} size={s} fallback={badgeSvg(symbol, s)} />;
  const ct = cryptoTicker(symbol);
  if (ct) return <CryptoLogo symbol={symbol} ticker={ct} size={s} />;
  return badgeSvg(symbol, s);
}
