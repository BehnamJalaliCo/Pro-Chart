// claude-llm — wrapper سبک HTTP روی Claude Code CLI (headless، اشتراک Max).
// POST /complete {prompt, model?, timeout_ms?} → اجرای `claude -p ... --output-format json`.
const http = require("http");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.LLM_PORT || "8085", 10);
const DEFAULT_MODEL = process.env.LLM_MODEL || "sonnet";
const MAX_CONCURRENCY = parseInt(process.env.LLM_MAX_CONCURRENCY || "3", 10);

let active = 0;
const queue = [];
function acquire() {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENCY) { active++; resolve(); }
    else queue.push(resolve);
  });
}
function release() {
  active--;
  const next = queue.shift();
  if (next) { active++; next(); }
}

function runClaude(prompt, model, timeoutMs, system) {
  return new Promise((resolve) => {
    const args = ["-p", prompt, "--output-format", "json", "--model", model || DEFAULT_MODEL];
    // system prompt به‌صورتِ «جایگزینِ کامل» (نه append) اعمال می‌شود تا هویتِ پیش‌فرضِ
    // Claude Code («دستیار برنامه‌نویسی») کاملاً حذف شود و نقشِ دلخواه (مثلاً متخصصِ بازارِ
    // مالی) خالص اعمال گردد. exclude-dynamic بخش‌های محیطی/گیتِ Claude Code را هم حذف می‌کند.
    if (system && String(system).trim()) {
      args.push("--system-prompt", String(system));
      args.push("--exclude-dynamic-system-prompt-sections");
    }
    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) {} resolve({ ok: false, error: "timeout" }); }, timeoutMs || 120000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(t); resolve({ ok: false, error: String(e) }); });
    child.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return resolve({ ok: false, error: (err || "exit " + code).slice(0, 500) });
      try {
        const j = JSON.parse(out);
        resolve({ ok: true, text: j.result != null ? j.result : (j.text != null ? j.text : out) });
      } catch (e) {
        resolve({ ok: true, text: out });
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (req.method === "POST" && req.url === "/complete") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let p;
      try { p = JSON.parse(body); } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end('{"ok":false,"error":"bad json"}');
      }
      await acquire();
      try {
        const r = await runClaude(p.prompt || "", p.model, p.timeout_ms, p.system);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(r));
      } finally { release(); }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log("claude-llm wrapper listening on " + PORT));
