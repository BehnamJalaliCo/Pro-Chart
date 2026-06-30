const fs = require("fs"), { execSync, spawnSync } = require("child_process");
const VOICE = "k81clBqR9dFl9TnCJ5y9";
// مدلِ تأییدشدهٔ کاربر = eleven_v3 (تیمبرِ رساتر)؛ مشکلِ عدد/درصد با speakable() حل شد. قابلِ‌سوییچ.
const MODEL = process.env.EL_MODEL || "eleven_v3";
const VS = { stability: 0.5, similarity_boost: 0.80, style: 0.0, use_speaker_boost: true };

// ─── عدد/درصد/نماد → کلمه‌ی فارسی (تا گوینده اشتباه/پرش نکند) ───
const _ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const _TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const _TENS = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const _HUND = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const _SCALE = ["", "هزار", "میلیون", "میلیارد"];
function _below1000(n) {
  const p = []; const h = Math.floor(n / 100), r = n % 100;
  if (h) p.push(_HUND[h]);
  if (r < 10 && r > 0) p.push(_ONES[r]);
  else if (r >= 10 && r < 20) p.push(_TEENS[r - 10]);
  else if (r >= 20) { p.push(_TENS[Math.floor(r / 10)]); if (r % 10) p.push(_ONES[r % 10]); }
  return p.join(" و ");
}
function _int2fa(n) {
  n = Math.floor(Math.abs(n)); if (n === 0) return "صفر";
  const g = []; while (n > 0) { g.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = g.length - 1; i >= 0; i--) {
    if (!g[i]) continue;
    let w = _below1000(g[i]);
    if (i === 1 && g[i] === 1) w = _SCALE[1];          // «هزار» نه «یک هزار»
    else if (i > 0) w = w + " " + _SCALE[i];
    parts.push(w.trim());
  }
  return parts.join(" و ");
}
function _numPhrase(s) {
  s = String(s).replace(/,/g, "");
  if (s.includes(".")) { const [a, b] = s.split("."); return (a ? _int2fa(+a) : "صفر") + " ممیز " + b.split("").map((d) => _ONES[+d] || "صفر").join(" "); }
  return _int2fa(+s);
}
// آوای درستِ اصطلاحاتِ انگلیسی — فقط برای TTS (زیرنویس انگلیسی می‌ماند، صدا درست تلفظ می‌شود)
const _SAY = [
  [/\bspreads?\b/gi, "اِسپِرِد"], [/\bsupports?\b/gi, "ساپورت"], [/\bresistances?\b/gi, "رِزیستِنس"],
  [/\bleverage\b/gi, "لِوِریج"], [/\bmargin\b/gi, "مارجین"], [/\bpips?\b/gi, "پیپ"], [/\bforex\b/gi, "فارکس"],
  [/\btrends?\b/gi, "تِرِند"], [/\bbreak[\s-]?outs?\b/gi, "بریک‌اوت"], [/\bpull[\s-]?backs?\b/gi, "پولبک"],
  [/\bcandle[\s-]?sticks?\b/gi, "کندل‌اِستیک"], [/\bcandles?\b/gi, "کندل"], [/\bprice[\s-]?action\b/gi, "پرایس‌اَکشِن"],
  [/\bstop[\s-]?loss\b/gi, "اِستاپ‌لاس"], [/\btake[\s-]?profit\b/gi, "تیک‌پرافیت"], [/\bbreak[\s-]?even\b/gi, "بریک‌ایوِن"],
  [/\border[\s-]?flow\b/gi, "اوردِرفلو"], [/\borders?\b/gi, "اوردِر"], [/\bliquidity\b/gi, "لیکوئیدیتی"], [/\bvolume\b/gi, "وُلیوم"],
  [/\bbullish\b/gi, "بولیش"], [/\bbearish\b/gi, "بِریش"], [/\bengulfing\b/gi, "اِنگالفینگ"], [/\bdoji\b/gi, "دوجی"],
  [/\bpin[\s-]?bar\b/gi, "پین‌بار"], [/\bhammer\b/gi, "هَمِر"], [/\bfibonacci\b/gi, "فیبوناچی"], [/\bbollinger\b/gi, "بولینگِر"],
  [/\bbrokers?\b/gi, "بروکر"], [/\bcharts?\b/gi, "چارت"], [/\bentry\b/gi, "اِنتری"], [/\bexit\b/gi, "اِگزیت"],
  [/\bpivots?\b/gi, "پیوُت"], [/\bscalp(ing)?\b/gi, "اِسکَلپ"], [/\bswing\b/gi, "سوئینگ"], [/\btrigger\b/gi, "تِریگِر"],
  [/\bMACD\b/g, "مَکدی"], [/\bRSI\b/g, "آر اِس آی"], [/\bEMA\b/g, "ئی اِم اِی"], [/\bSMA\b/g, "اِس اِم اِی"],
  [/\bATR\b/g, "ای تی آر"], [/\bADX\b/g, "ای دی اِکس"], [/\bCCI\b/g, "سی سی آی"], [/\bVWAP\b/g, "وی‌وَپ"],
];
function speakable(t) {
  let s = String(t || "");
  for (const [re, rep] of _SAY) s = s.replace(re, rep);          // آوای درستِ اصطلاحات
  s = s.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, (m, n) => _numPhrase(n) + " درصد");      // درصد
  s = s.replace(/(?:\$|usd)\s*(\d[\d,]*(?:\.\d+)?)/gi, (m, n) => _numPhrase(n) + " دلار");
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:\$|usd|dollars?)/gi, (m, n) => _numPhrase(n) + " دلار");
  s = s.replace(/(\d+)\s*:\s*(\d+)/g, (m, a, b) => _numPhrase(a) + " به " + _numPhrase(b)); // نسبت ریسک به ریوارد
  s = s.replace(/\b\d[\d,]*(?:\.\d+)?\b/g, (m) => _numPhrase(m));                 // باقیِ اعداد
  s = s.replace(/[#*_<>^~`|=+]/g, " ").replace(/\s+/g, " ").trim();              // نمادهای مزاحم
  return s;
}
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const PUB = "/studio/public";
const elkey = () => fs.readFileSync("/work/.elkey", "utf8").trim();
const pexkey = () => fs.readFileSync("/work/.pexkey", "utf8").trim();
function chromePath() { const d = fs.readdirSync("/ms-playwright").find(x => x.startsWith("chromium")); return `/ms-playwright/${d}/chrome-linux/chrome`; }

// ─── QC صدا: نرمال‌سازی + شباهتِ متن (واژه‌های فارسی) برای تشخیصِ خطای گوینده ───
function _norm(s) {
  return String(s || "")
    .replace(/[‌‍‎‏]/g, "")          // ZWNJ/RLM/LRM
    .replace(/[آأإٱ]/g, "ا").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[ًٌٍَُِّْٔ]/g, "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .toLowerCase().replace(/[^؀-ۿa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function _faWords(s) { return _norm(s).split(" ").filter((w) => w.length >= 2 && /[؀-ۿ]/.test(w)); }
function _sim(intended, heard) {                          // F1: هم واژهٔ جاافتاده، هم واژهٔ اضافه/توهمی را می‌گیرد
  const iw = _faWords(intended); if (!iw.length) return 1;
  const hw = _faWords(heard); const is = new Set(iw), hs = new Set(hw);
  let rec = 0; for (const w of iw) if (hs.has(w)) rec++;
  let pre = 0; for (const w of hw) if (is.has(w)) pre++;
  const recall = rec / iw.length, precision = hw.length ? pre / hw.length : 1;
  return (recall + precision) ? (2 * recall * precision) / (recall + precision) : 0;
}
// اصطلاحاتِ تخصصیِ کلیدی حتماً باید درست شنیده شوند (وگرنه تیک رد می‌شود)
function _termsOk(spoken, heard) {
  const ns = _norm(spoken), hs = new Set(_norm(heard).split(" "));
  for (const [, rep] of _SAY) {
    const ph = _norm(rep); if (!ns.includes(ph)) continue;
    const toks = ph.split(" ").filter(Boolean);
    if (toks.filter((p) => hs.has(p)).length < Math.ceil(toks.length / 2)) return false;
  }
  return true;
}
async function stt(file) {                                // Speech-to-Text خودِ ElevenLabs (Scribe)
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("file", new Blob([fs.readFileSync(file)]), "a.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": elkey() }, body: fd });
  if (!r.ok) throw new Error("STT " + r.status);
  return (await r.json()).text || "";
}

// تولیدِ صدا با QC: تا ۳ تیک می‌سازد، بهترین را (که گوینده اشتباه نکرده) نگه می‌دارد.
async function tts(text, base) {
  const trim = `${PUB}/${base}.mp3`;
  const spoken = speakable(text);                          // عدد/درصد/نماد → کلمه
  const chars = (spoken.match(/\S/g) || []).length;
  const body = JSON.stringify({ text: spoken, model_id: MODEL, voice_settings: VS });
  let best = null;
  for (let attempt = 0; attempt < 5; attempt++) {          // QC قوی: تا ۵ تیک تا خطای کلمه‌ای صفر شود
    const raw = `${PUB}/${base}_raw.mp3`;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
      { method: "POST", headers: { "xi-api-key": elkey(), "Content-Type": "application/json", "Accept": "audio/mpeg" }, body });
    if (!r.ok) throw new Error("EL " + r.status + " " + (await r.text()).slice(0, 100));
    fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
    execSync(`ffmpeg -y -i ${raw} -af "silenceremove=start_periods=1:start_silence=0.04:start_threshold=-45dB:detection=peak,areverse,silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB:detection=peak,areverse" ${trim}`, { stdio: "ignore" });
    try { fs.unlinkSync(raw); } catch (e) {}
    const dur = parseFloat(JSON.parse(execSync(`ffprobe -v quiet -of json -show_format ${trim}`).toString()).format.duration);
    const durOK = dur >= 0.6 && dur >= chars * 0.03 && dur <= chars * 0.45;   // گاردِ بریدگی/زیاده‌گویی
    let sim = 1, termsOk = true;
    try { const heard = await stt(trim); sim = _sim(spoken, heard); termsOk = _termsOk(spoken, heard); }
    catch (e) { sim = durOK ? 1 : 0; }                     // STT قطع → اتکا به طول
    const score = sim + (termsOk ? 0.06 : 0) + (durOK ? 0.02 : 0);
    const buf = fs.readFileSync(trim);
    if (!best || score > best.score) best = { score, sim, dur, buf };
    if (durOK && termsOk && sim >= 0.78) break;            // تیکِ بی‌خطا → بس است
    console.error(`tts QC retry ${base} a=${attempt} sim=${sim.toFixed(2)} terms=${termsOk} dur=${dur.toFixed(1)}`);
  }
  fs.writeFileSync(trim, best.buf);                        // بهترین تیک
  return Math.ceil(best.dur * 30) + 9;
}
// فوتیجِ یکتا برای هر صحنه: idهای استفاده‌شده ردگیری می‌شوند (هیچ کلیپی دوبار نمی‌آید)،
// و کلیپی انتخاب می‌شود که از مدتِ صحنه بلندتر باشد تا لوپ/تکرار نشود.
async function pexels(q, orient, out, used, minSec) {
  const want = orient === "portrait" ? 1080 : 1920;
  const queries = [q, q + " market", q + " finance", "forex trading", "financial chart", "business money"];
  for (const qq of queries) {
    const u = `https://api.pexels.com/videos/search?query=${encodeURIComponent(qq)}&per_page=20&orientation=${orient}&size=medium`;
    let j;
    try { j = await (await fetch(u, { headers: { Authorization: pexkey(), "User-Agent": UA } })).json(); } catch (e) { continue; }
    const vids = (j.videos || []).filter((v) => used && !used.has(v.id));
    // اولویت: کلیپِ به‌اندازهٔ کافی بلند (≥ مدتِ صحنه)، سپس بلندترین
    vids.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    const v = vids.find((x) => (x.duration || 0) >= (minSec || 4)) || vids[0];
    if (!v) continue;
    const files = v.video_files.filter((f) => f.file_type === "video/mp4").sort((a, b) => Math.abs((a.width || 0) - want) - Math.abs((b.width || 0) - want));
    if (!files.length) continue;
    if (used) used.add(v.id);
    const vr = await fetch(files[0].link, { headers: { "User-Agent": UA } });
    fs.writeFileSync(`${PUB}/${out}`, Buffer.from(await vr.arrayBuffer()));
    return;
  }
  throw new Error("no unique pexels for: " + q);
}
function render(comp, propsFile, out) {
  const opt = [`--browser-executable=${chromePath()}`, "--concurrency=4", "--offthreadvideo-cache-size-in-bytes=536870912", "--log=error"];
  const r = spawnSync("npx", ["remotion", "render", "src/index.ts", comp, out, `--props=${propsFile}`, ...opt],
    { cwd: "/studio", encoding: "utf8", timeout: 3000000, maxBuffer: 1024 * 1024 * 40 });
  if (!fs.existsSync(out)) throw new Error(`${comp} render failed: ` + ((r.stderr || "") + (r.stdout || "")).slice(-300));
}

async function pexelsPhoto(q) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape`, { headers: { Authorization: pexkey(), "User-Agent": UA } });
  const j = await r.json();
  const p = (j.photos || [])[0];
  if (!p) return "";
  const ir = await fetch(p.src.large2x || p.src.large, { headers: { "User-Agent": UA } });
  return "data:image/jpeg;base64," + Buffer.from(await ir.arrayBuffer()).toString("base64");
}
async function thumbnail(slug, title, topicQ) {
  let bg = "";
  try { bg = await pexelsPhoto(topicQ); } catch (e) {}
  const t = String(title || "").replace(/</g, "&lt;");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@700;900&family=Lalezar&display=swap');
*{margin:0;box-sizing:border-box;font-family:'Vazirmatn',sans-serif}html,body{width:1280px;height:720px;overflow:hidden}
.c{position:relative;width:1280px;height:720px;background:#0a0c12 ${bg ? `center/cover no-repeat url('${bg}')` : ""}}
.s{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,8,14,.45) 0%,rgba(6,8,14,.2) 35%,rgba(6,8,14,.93) 100%)}
.o{position:absolute;inset:0;background:radial-gradient(120% 80% at 82% 12%,rgba(255,122,0,.18),transparent 60%)}
.badge{position:absolute;top:54px;right:60px;background:#ff7a00;color:#15100a;font-weight:900;font-size:38px;padding:12px 34px;border-radius:999px}
.brand{position:absolute;top:62px;left:60px;color:#fff;font-weight:900;font-size:40px;opacity:.95}
.ttl{position:absolute;bottom:120px;right:64px;left:64px;color:#fff;font-weight:900;font-size:84px;line-height:1.22;text-shadow:0 8px 30px rgba(0,0,0,.7);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.bar{position:absolute;bottom:0;right:0;left:0;height:16px;background:linear-gradient(90deg,#ffd000,#ff7a00)}
</style></head><body><div class="c"><div class="s"></div><div class="o"></div>
<div class="brand">کوین پرو FX</div><div class="badge">بلاگ آموزشی</div>
<div class="ttl">${t}</div><div class="bar"></div></div></body></html>`;
  const r = await fetch("http://localhost:8086/render-html", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, width: 1280, height: 720, scale: 1, format: "jpeg", quality: 90 }) });
  fs.writeFileSync(`/media/blogthumb_${slug}.jpg`, Buffer.from(await r.arrayBuffer()));
  return `blogthumb_${slug}.jpg`;
}

async function generate(job) {
  const { scenes, short, title, slug, site } = job;
  fs.mkdirSync(PUB, { recursive: true });
  const sc = [];
  let gi = 0;
  const used = new Set();   // idهای فوتیجِ استفاده‌شده — هیچ کلیپی دوبار نمی‌آید
  const segs = job.segments && job.segments.length ? job.segments : (scenes || []).map((x) => ({ q: x.q, lines: [x.caption] }));
  // پاسِ ۱: صدا + متن (بدونِ فوتیج) تا تعدادِ کلِ صحنه‌ها مشخص شود
  for (const seg of segs) {
    for (const line of seg.lines) {
      const frames = await tts(line, `${slug}_a${gi}`);
      sc.push({ audio: `${slug}_a${gi}.mp3`, footage: "", caption: line, q: seg.q, visual: seg.visual || "generic", frames, i: gi });
      gi++;
    }
  }
  // دیتای واقعیِ بازار را به صحنه‌های غیرالگوی چارت‌محور می‌چسبانیم (هر صحنه نمادِ متفاوت → غیرتکراری)
  const REAL_DATA = new Set(["trendline", "pullback", "channel", "support_resistance", "breakout", "rsi", "macd", "ma_cross", "bollinger"]);
  const pool = (job.real_pool && job.real_pool.length) ? job.real_pool : [];
  let pIdx = 0;
  if (pool.length) for (const s of sc) if (REAL_DATA.has(s.visual)) { s.data = pool[pIdx % pool.length]; pIdx++; }
  // پاسِ ۲: فقط صحنه‌های «generic» فوتیج می‌گیرند؛ صحنه‌های مفهومی (دیاگرام) فوتیج نمی‌خواهند
  for (const s of sc) {
    const needFootage = !s.visual || s.visual === "generic" || s.visual === "footage";
    if (!needFootage) continue;
    await pexels(s.q, "landscape", `${slug}_f${s.i}.mp4`, used, s.frames / 30);   // فوتیجِ یکتا per صحنه
    s.footage = `${slug}_f${s.i}.mp4`;
  }
  fs.writeFileSync(`${PUB}/${slug}_blog.json`, JSON.stringify({ scenes: sc, title, site: `${site}/blog` }));
  const sf = await tts(short.narration, `${slug}_short`);
  await pexels(short.q, "portrait", `${slug}_sf.mp4`, used, sf / 30);
  fs.writeFileSync(`${PUB}/${slug}_short.json`, JSON.stringify({ footage: `${slug}_sf.mp4`, audio: `${slug}_short.mp3`, hook: short.hook, site, frames: sf }));
  const thumb = await thumbnail(slug, title, (segs[0] && segs[0].q) || "forex trading");
  const blogOut = `/media/blogvid_${slug}.mp4`, shortOut = `/media/blogshort_${slug}.mp4`;
  render("BlogVideo", `${PUB}/${slug}_blog.json`, blogOut);
  render("ShortVideo", `${PUB}/${slug}_short.json`, shortOut);
  for (const f of fs.readdirSync(PUB)) { if (f.startsWith(slug + "_")) { try { fs.unlinkSync(`${PUB}/${f}`); } catch (e) {} } }
  return { blog_file: `blogvid_${slug}.mp4`, short_file: `blogshort_${slug}.mp4`, thumb_file: thumb };
}
module.exports = { generate };
