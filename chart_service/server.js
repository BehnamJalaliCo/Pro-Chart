// chart-renderer — رندر چارت TradingView (lightweight-charts) با خطوط Entry/SL/TP
// در chromium headless و خروجی PNG. ورودی POST /render.
const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const PORT = parseInt(process.env.CHART_PORT || "8086", 10);
const W = 1200, H = 675; // 16:9 حرفه‌ای

// کتابخانه‌ی رسمی TradingView به‌صورت inline (بدون وابستگی به CDN در زمان اجرا)
const LWC = fs.readFileSync(
  path.join(__dirname, "node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js"),
  "utf-8"
);

let browser = null;
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }
  return browser;
}

function buildHtml(payload) {
  const { symbol, timeframe, direction, candles, entry, sl, tp1, tp2, tp3 } = payload;
  const isLong = direction === "long" || direction === "buy";
  const dirFa = isLong ? "▲ LONG" : "▼ SHORT";
  const dirColor = isLong ? "#089981" : "#F23645";
  // priceLine ها فقط برای مقادیر معتبر
  const lines = [];
  const mk = (price, color, title) => {
    if (price === null || price === undefined || isNaN(price)) return;
    lines.push({ price: Number(price), color, title });
  };
  mk(entry, "#2962FF", "ENTRY");
  mk(sl, "#F23645", "SL");
  mk(tp1, "#089981", "TP1");
  mk(tp2, "#089981", "TP2");
  mk(tp3, "#089981", "TP3");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#131722;}
    #c{width:${W}px;height:${H}px;position:relative;}
    #wm{position:absolute;top:18px;left:24px;z-index:5;color:#d1d4dc;font-family:Arial,Helvetica,sans-serif;}
    #wm .s{font-size:30px;font-weight:bold;letter-spacing:1px;}
    #wm .t{font-size:16px;color:#787b86;margin-top:2px;}
    #wm .d{font-size:18px;font-weight:bold;margin-top:6px;color:${dirColor};}
    #brand{position:absolute;bottom:14px;right:24px;z-index:5;color:#787b86;font-family:Arial;font-size:15px;font-weight:bold;opacity:.85;}
  </style></head><body>
  <div id="c">
    <div id="wm"><div class="s">${symbol}</div><div class="t">${timeframe} • TradingView</div><div class="d">${dirFa}</div></div>
    <div id="brand">CoinePro FX VIP</div>
  </div>
  <script>${LWC}</script>
  <script>
    const chart = LightweightCharts.createChart(document.getElementById('c'), {
      width: ${W}, height: ${H},
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc', fontSize: 12 },
      grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      watermark: { visible: false },
    });
    const s = chart.addCandlestickSeries({
      upColor: '#089981', downColor: '#F23645',
      borderUpColor: '#089981', borderDownColor: '#F23645',
      wickUpColor: '#089981', wickDownColor: '#F23645',
    });
    s.setData(${JSON.stringify(candles)});
    const cnd = ${JSON.stringify(candles)};
    const lines = ${JSON.stringify(lines)};
    for (const l of lines) {
      s.createPriceLine({ price: l.price, color: l.color, lineWidth: 2,
        lineStyle: 2, axisLabelVisible: true, title: l.title });
    }
    // سری نامرئی تا autoscale همه‌ی خطوط (SL..TP3) را در کادر نگه دارد، نه فقط کندل‌ها
    const lv = lines.map(l => l.price);
    if (lv.length) {
      const hi = Math.max(...lv, ...cnd.map(c=>c.high));
      const lo = Math.min(...lv, ...cnd.map(c=>c.low));
      const pad = (hi - lo) * 0.06 || 0.001;
      const inv = chart.addLineSeries({ color: 'rgba(0,0,0,0)', lineWidth: 1,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
      inv.setData([{ time: cnd[0].time, value: hi + pad }, { time: cnd[cnd.length-1].time, value: lo - pad }]);
    }
    chart.timeScale().fitContent();
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
  </script></body></html>`;
}

const app = express();
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// رندر یک HTML دلخواه (دیاگرام‌های آموزشی) → PNG. فقط داخلی است.
app.post("/render-html", async (req, res) => {
  const { html, width, height, scale, format, quality } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "html required" });
  }
  const w = Math.min(Math.max(parseInt(width || 1080, 10), 200), 2000);
  const h = Math.min(Math.max(parseInt(height || 720, 10), 200), 2000);
  const dsf = Math.min(Math.max(parseInt(scale || 2, 10), 1), 2);   // scale=1 → سبک‌تر (برای تامبنیل)
  const isJpeg = String(format || "").toLowerCase() === "jpeg";
  const q = Math.min(Math.max(parseInt(quality || 88, 10), 40), 95);
  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    await page.setContent(html, { waitUntil: "networkidle" });
    // منتظرِ آماده‌شدنِ کاملِ فونت‌های وب بمان؛ وگرنه اسکرین‌شات با فونتِ فالبک گرفته می‌شود
    // (باعثِ فرق‌کردنِ فونتِ فارسی/Archivo Black بینِ رندرها می‌شد — حالا قطعی است)
    try {
      await page.evaluate(async () => {
        if (document.fonts) {
          await document.fonts.ready;
          await Promise.all(["Lalezar", "Archivo Black", "Vazirmatn", "Gulzar", "Markazi Text"]
            .map((f) => document.fonts.load(`64px "${f}"`).catch(() => {})));
          await document.fonts.ready;
        }
      });
      await new Promise((r) => setTimeout(r, 300));
    } catch (_) {}
    const shot = isJpeg
      ? await page.screenshot({ type: "jpeg", quality: q })
      : await page.screenshot({ type: "png" });
    res.set("Content-Type", isJpeg ? "image/jpeg" : "image/png").send(shot);
  } catch (e) {
    console.error("render_html_error", e.message);
    res.status(500).json({ error: String(e.message).slice(0, 200) });
  } finally {
    if (page) { try { await page.close(); } catch (_) {} }
  }
});

app.post("/render", async (req, res) => {
  const p = req.body || {};
  if (!p.symbol || !Array.isArray(p.candles) || p.candles.length < 2) {
    return res.status(400).json({ error: "symbol + candles[] required" });
  }
  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.setContent(buildHtml(p), { waitUntil: "load" });
    await page.waitForFunction("window.__ready === true", { timeout: 8000 });
    const el = await page.$("#c");
    const png = await el.screenshot({ type: "png" });
    res.set("Content-Type", "image/png").send(png);
  } catch (e) {
    console.error("render_error", e.message);
    res.status(500).json({ error: String(e.message).slice(0, 200) });
  } finally {
    if (page) { try { await page.close(); } catch (_) {} }
  }
});

// ساختِ ویدیوی عمودیِ اینستاگرام — صدای ElevenLabs + زیرنویس + موزیک (اسکریپتِ python در /work)
app.post("/ig-video", (req, res) => {
  const job = req.body || {};
  if (!Array.isArray(job.scenes) || job.scenes.length === 0) {
    return res.status(400).json({ error: "scenes[] required" });
  }
  const py = spawn("python3", ["/work/ig_video.py"], { env: { ...process.env, IG_MEDIA: "/media" } });
  let out = "", err = "";
  py.stdout.on("data", (d) => (out += d));
  py.stderr.on("data", (d) => (err += d));
  py.on("error", (e) => res.status(500).json({ error: String(e.message).slice(0, 200) }));
  py.on("close", (code) => {
    if (res.headersSent) return;
    if (code !== 0) return res.status(500).json({ error: (err || "video gen failed").slice(0, 400) });
    try {
      const last = out.trim().split("\n").filter(Boolean).pop();
      res.json(JSON.parse(last));
    } catch (e) {
      res.status(500).json({ error: "bad generator output", raw: out.slice(-300) });
    }
  });
  py.stdin.write(JSON.stringify(job));
  py.stdin.end();
});

// موتورِ ریلزِ سطح‌جهانی (reel_engine.py): سبک/موزیک/seed برای تنوع، فونتِ Estedad، کاراوکه، گرید، بیت-سینک
app.post("/reel", (req, res) => {
  const job = req.body || {};
  if (!Array.isArray(job.scenes) || job.scenes.length === 0) {
    return res.status(400).json({ error: "scenes[] required" });
  }
  const slug = String(job.slug || "reel").replace(/[^A-Za-z0-9_]/g, "") || "reel";
  const vw = `/media/work_${slug}`;
  try {
    fs.mkdirSync(`${vw}/bg`, { recursive: true });
    fs.writeFileSync(`${vw}/job.json`, JSON.stringify(job));
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 200) });
  }
  const py = spawn("python3", ["/work/reel_engine.py"], {
    env: { ...process.env, VWORK: vw, IG_MEDIA: "/media", NODE_PATH: "/app/node_modules" },
  });
  let out = "", err = "";
  py.stdout.on("data", (d) => (out += d));
  py.stderr.on("data", (d) => (err += d));
  py.on("error", (e) => { if (!res.headersSent) res.status(500).json({ error: String(e.message).slice(0, 200) }); });
  py.on("close", (code) => {
    if (res.headersSent) return;
    if (code !== 0) return res.status(500).json({ error: (err || "reel gen failed").slice(-500) });
    try {
      const last = out.trim().split("\n").filter(Boolean).pop();
      res.json(JSON.parse(last));
    } catch (e) {
      res.status(500).json({ error: "bad reel output", raw: (err || out).slice(-300) });
    }
  });
});

// کاروسل/پستِ اسلایدی (carousel_engine.py) → چند JPG در /media
app.post("/carousel", (req, res) => {
  const job = req.body || {};
  if (!Array.isArray(job.slides) || job.slides.length === 0) {
    return res.status(400).json({ error: "slides[] required" });
  }
  const slug = String(job.slug || "car").replace(/[^A-Za-z0-9_]/g, "") || "car";
  const vw = `/media/work_${slug}`;
  try {
    fs.mkdirSync(vw, { recursive: true });
    fs.writeFileSync(`${vw}/job.json`, JSON.stringify(job));
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 200) });
  }
  const py = spawn("python3", ["/work/carousel_engine.py"], {
    env: { ...process.env, VWORK: vw, IG_MEDIA: "/media", NODE_PATH: "/app/node_modules" },
  });
  let out = "", err = "";
  py.stdout.on("data", (d) => (out += d));
  py.stderr.on("data", (d) => (err += d));
  py.on("error", (e) => { if (!res.headersSent) res.status(500).json({ error: String(e.message).slice(0, 200) }); });
  py.on("close", (code) => {
    if (res.headersSent) return;
    if (code !== 0) return res.status(500).json({ error: (err || "carousel failed").slice(-500) });
    try { res.json(JSON.parse(out.trim().split("\n").filter(Boolean).pop())); }
    catch (e) { res.status(500).json({ error: "bad carousel output", raw: (err || out).slice(-300) }); }
  });
});

// بلاگ → ویدیوی سینماییِ Remotion (۱۶:۹) + شورتِ عمودی (۹:۱۶) با صدای Behnam v3 + فوتیجِ Pexels
app.post("/blog-video", async (req, res) => {
  try {
    const mod = "/studio/bloggen.js";
    delete require.cache[require.resolve(mod)];   // لودِ تازه (mount زنده)
    const { generate } = require(mod);
    const out = await generate(req.body || {});
    res.json(out);
  } catch (e) {
    console.error("blog_video_error", e.message);
    res.status(500).json({ error: String(e.message).slice(0, 400) });
  }
});

app.listen(PORT, () => console.log("chart-renderer listening on " + PORT));
