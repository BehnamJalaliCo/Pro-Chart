[⬅ 13. The Instagram Automation Suite](instagram.md) · [🏠 Home · خانه](../README.md) · [15. Core Infrastructure & Security Posture ➡](core-security.md)

---

## 14. Content, SEO & AI Growth Engine

> *“The product trades. The growth engine makes the product **discoverable**.”*

CoinePro‑FX is not only a trading platform — it is a self‑propagating media company wired into the same codebase. A single Celery worker pool simultaneously (a) writes original Persian articles with Claude, (b) ingests world forex news and translates it, (c) renders cinematic YouTube videos from those articles, (d) drips lesson videos to YouTube, and (e) mines Google Search Console to tell itself which pages to fix. Everything is **fail‑soft**: if Claude, YouTube, Cloudflare or Search Console is unavailable, the trading core never blocks and the growth task simply returns a reason and exits.

This chapter documents the five interlocking subsystems and the safety model that lets a coding assistant (Claude Code CLI) be repurposed as a scoped, market‑only content brain.

---

### 14.1 Architecture at a glance

```
                         ┌────────────────────────────────────────────┐
                         │            claude-llm (Node)               │
   src/llm/client.py ───▶│  HTTP wrapper around `claude -p … --json`  │
   (async, fail-soft,    │  --system-prompt  +  --exclude-dynamic     │
    Redis cache,         │  CLAUDE_CODE_OAUTH_TOKEN (long-lived)      │
    semaphore=3)         └────────────────────────────────────────────┘
        ▲   ▲   ▲   ▲
        │   │   │   └──────────────── src/llm/narrator.py   (signal analysis)
        │   │   └──────────────────── src/llm/sanity_gate.py (2nd-opinion gate)
        │   └──────────────────────── src/news/translate.py  (news → Persian)
        └──────────────────────────── src/news/blog.py       (original SEO articles)

   src/news/ingest.py ── RSS → translate → Article → drip buffer → Telegram channel
   src/news/blog.py   ── keyword bank → Claude article → Article (+FAQ) → channel
        │
        ▼  (Article rows in DB)
   src/publish/blog_video.py ── Claude scene script → chart-renderer /blog-video
        │                        (Remotion + Pexels footage + Behnam-v3 voice + thumbnail)
        │                        → youtube.upload(blog)  +  youtube.upload(short)  +  IG story
   src/publish/academy_drip.py ── ordered lessons → thumbnail → youtube.upload (1/day)

   src/seo/tasks.py (Celery beat) ── mine GSC → seo_actions
                                  ── PageSpeed weekly QA
                                  ── schema-health daily (URL Inspection)
                                  ── Cloudflare smart-purge
   src/core/seo_notify.py ── every published article → sitemap invalidate + IndexNow ping
```

---

### 14.2 The LLM gateway — `claude-llm` + `src/llm/client.py`

The platform never calls the Anthropic HTTP API with a metered API key. Instead it runs the **Claude Code CLI in headless mode** behind a tiny Node HTTP wrapper (`llm_service/server.js`). This is the single chokepoint for every Claude call in the project.

#### 14.2.1 The wrapper service

`llm_service/server.js` (≈80 lines) exposes two routes:

| Route | Method | Behaviour |
|-------|--------|-----------|
| `/health` | GET | returns `ok` (used by the compose healthcheck) |
| `/complete` | POST | `{prompt, model?, timeout_ms?, system?}` → spawns `claude` |

The core is `runClaude()`, which spawns the CLI:

```js
const args = ["-p", prompt, "--output-format", "json", "--model", model || DEFAULT_MODEL];
if (system && String(system).trim()) {
  args.push("--system-prompt", String(system));
  args.push("--exclude-dynamic-system-prompt-sections");
}
const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
```

Key engineering decisions visible in the code:

* **In‑process concurrency limiter.** `MAX_CONCURRENCY=3` (`LLM_MAX_CONCURRENCY`) with a hand‑rolled `acquire()/release()` queue, so the Max subscription is never rate‑slammed. The Python client (`_sem = asyncio.Semaphore(3)`) adds a *second* limiter on the caller side — defence in depth.
* **Hard timeout with SIGKILL.** A `setTimeout` kills the child and resolves `{ok:false, error:"timeout"}` so a stuck generation can never wedge the worker.
* **Robust JSON parse.** It reads the CLI’s `--output-format json` envelope and returns `j.result ?? j.text ?? out`; on parse failure it falls back to the raw stdout rather than throwing.
* **Every failure is a value, not an exception.** `child.on("error")`, non‑zero exit, and timeout all `resolve({ok:false, error})`. The HTTP layer always answers `200` with an `ok` flag.

#### 14.2.2 The `--system-prompt` replace technique

This is the crucial trick that turns a *coding* assistant into a *forex analyst*. Claude Code ships with a default system identity (“you are a coding assistant”) plus dynamic environment sections (cwd, git status, tool gates). For market content those would leak persona and waste context. The wrapper passes:

* `--system-prompt <text>` → **fully replaces** the default identity with the caller’s role.
* `--exclude-dynamic-system-prompt-sections` → strips the Claude Code environment/tooling preamble.

The result is a clean, role‑pure model: when `narrator.py` sends *“you are a senior forex analyst”*, that is the **only** identity in context. The Python side opts into this with `system_replace=True`:

```python
use_field = bool(system and system_replace)
full = prompt if (not system or system_replace) else f"{system}\n\n{prompt}"
...
if use_field:
    body["system"] = system   # goes to the server as a separate field → --system-prompt
```

Two modes coexist for backward compatibility:

| Mode | Trigger | Effect |
|------|---------|--------|
| **Replace** (`system_replace=True`) | `blog_video.py` scene director | system goes to `--system-prompt`, default identity removed |
| **Prepend** (`system_replace=False`) | `narrator.py`, `sanity_gate.py`, `translate.py`, `blog.py` | system is concatenated to the top of the prompt text (legacy, equally scoped by content) |

#### 14.2.3 The dedicated, long‑lived auth token

The `claude-llm` container does **not** share the host’s interactive login. From `docker-compose.yml`:

```yaml
claude-llm:
  user: "1000:1000"
  environment:
    HOME: /creds
    CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
  volumes:
    - /home/forex/.claude_llm_home:/creds
```

The token is created once with `claude setup-token` and is **independent of the host’s `/login` session**, so a host re‑login never makes the service’s auth go stale. `HOME` is pinned to an isolated `/creds` mount so the service has its own credential store. The Dockerfile installs a pinned CLI (`@anthropic-ai/claude-code@2.1.154`) to keep behaviour reproducible. Memory is capped at `512M`/`0.5 cpu`.

#### 14.2.4 The async Python client — fail‑soft + caching

`src/llm/client.py` (`LLMClient`) is the only thing the rest of the codebase imports. Its contract is: **never break the caller.**

* **Disabled → `None`.** `if not settings.LLM_ENABLED: return None`. Every consumer has a non‑LLM fallback path.
* **Any exception → `None`.** The `httpx` call is wrapped; on failure it logs `llm_call_failed` and returns `None` (`# noqa: BLE001 — fail-soft`).
* **Optional Redis cache.** When `cache_ttl` is set, the key is `sha256(model|system|full)[:32]`, so identical prompts (e.g. the same news headline retranslated) hit cache instead of re‑spending budget. Cache get/set are themselves wrapped — Redis down ≠ failure.
* **Client‑side semaphore** (`Semaphore(3)`) mirrors the server limit.
* **Generous timeout headroom.** `httpx` timeout = caller timeout `+ 15s` so the CLI’s own kill always wins the race.

```python
async def complete(self, prompt, system=None, model=None, timeout=None,
                   cache_ttl=None, system_replace=False) -> str | None:
    if not settings.LLM_ENABLED:
        return None
    ...
    try:
        resp = await client.post(f"{self.url}/complete", json=body)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:           # fail-soft
        logger.warning("llm_call_failed", error=str(exc))
        return None
    if not data.get("ok"):
        logger.warning("llm_error", ...)
        return None
    return (data.get("text") or "").strip() or None
```

#### 14.2.5 How Claude is scoped & kept safe (market‑only)

Every call ships a hard‑coded **role system prompt** that fences the model into the market domain and forbids fabrication. The codebase contains six distinct, hand‑tuned roles:

| Module | Role given to Claude | Output discipline & guardrails |
|--------|---------------------|-------------------------------|
| `src/news/blog.py` | *“Behnam Jalali, senior forex analyst & educator”* | HTML‑only (`<h2><p><b><ul>`), E‑E‑A‑T tone, mandatory FAQ, numeric examples, risk warning |
| `src/news/translate.py` | senior financial translator/editor | Persian only, never asks questions, never says “no text provided” |
| `src/publish/blog_video.py` | senior video director/screenwriter | strict JSON segments, English terms verbatim, diagram keys |
| `src/llm/narrator.py` | senior CoinePro analyst | *“analyse only from given data; invent no number/price/fact”* |
| `src/llm/sanity_gate.py` | senior risk manager (2nd opinion) | strict JSON `{approve,confidence,reason}`, **fail‑open** |
| `src/llm/news_sentiment.py` | macro analyst | per‑currency risk, advisory‑only (soft, not a hard gate) |

Two safety stances appear deliberately:

* **fail‑soft** for *content* (no content < broken pipeline): translation/blog/narration return `None` and the caller skips.
* **fail‑open** for the *trading sanity gate*: `review_signal()` returns `{"approve": True}` on disabled/error/unparsable input, so an LLM hiccup never silently blocks a valid signal.

All generated HTML passes through `sanitize_article_html()` before storage (see `blog.py` / `ingest.py`), and outbound source links are run through `validate_url()` — the LLM is never trusted to emit safe markup.

---

### 14.3 The blog → cinematic video pipeline (`src/publish/blog_video.py`)

Twice a day (09:00 & 20:00 Tehran → `crontab(hour=5)` and `crontab(hour=16)` UTC), the platform turns one freshly published article into a **3–8 minute narrated YouTube video plus a 9:16 short**, and even an Instagram story linking to it.

#### 14.3.1 Pick → script → render → publish

1. **Pick** — `_pick_blog()` selects the newest published blog Article with `video_yt_id IS NULL`. The `NULL` guard guarantees no article is ever filmed twice.
2. **Script (Claude as film director)** — `_scenes()` strips the article HTML to plain text (≤4500 chars) and asks Claude, under the `_SYS` director prompt, to return strict JSON:

   ```json
   {"segments":[{"q":"3-5 English footage words","visual":"doji|breakout|…|generic",
                 "lines":["short Persian narration line"]}],
    "short":{"hook":"…","narration":"…","q":"…"}}
   ```

   The director prompt enforces real craft: a **strong 2‑line hook**, a narrative arc, fast rhythm (8–14 word lines), **10–16 visually distinct segments** so no two scenes look alike, English trading terms written in Latin letters (`MACD`, `RSI`, `stop loss` — no Persian transliteration, so the TTS pronounces them correctly), and a closing CTA. It retries up to twice with a 300s timeout because scene generation is heavy.
3. **The `visual` field = educational diagrams.** Each segment maps to a concrete chart concept (`doji`, `bullish_engulfing`, `head_shoulders`, `fibonacci`, `rsi`, `ma_cross`, …). The renderer draws the *actual* pattern the narration is describing instead of irrelevant stock footage; motivational/CTA segments use `"generic"` and get cinematic footage instead.
4. **Real market candles.** `_real_pool()` pulls real `M5` OHLC windows for 12 different symbols (`EURUSD`, `GBPJPY`, `XAU`‑family pairs, …) straight from the `candles` table, so diagrams render on **genuine price data**, each scene a different instrument.
5. **Render (chart‑renderer `/blog-video`).** The job (`segments`, `short`, `title`, `slug`, `site`, `real_pool`) is POSTed to `chart-renderer:8086/blog-video` (timeout 3200s). That route loads `/studio/bloggen.js` (a live‑mounted Remotion project) which: synthesises the **Behnam v3 cloned voice** narration, pulls **unique per‑scene Pexels footage**, composites diagrams over real candles, and renders both the 16:9 master and the 9:16 short — plus a **real‑element thumbnail**.
6. **Publish.** `youtube.upload()` posts the master into the *“بلاگ آموزشی فارکس”* playlist with the thumbnail and a full description (`_description()` embeds the article summary, the academy CTA, the canonical `/article/<slug>` link and hashtags). The short is uploaded to the shorts playlist with `#Shorts` and a link back to the full video.
7. **Cross‑post + record.** `_post_ig_story()` renders a branded 1080×1920 story card (HTML→JPEG via `/render-html`) with a clickable YouTube link sticker placed exactly over the drawn button (`link_x/y/w/h`). Finally `video_yt_id`, `short_yt_id`, `video_published_at` are committed so the article is permanently marked done.

#### 14.3.2 Reliability details

* **Event‑loop hygiene.** The Celery task `blog_to_video` (`time_limit=4000`, `soft_time_limit=3800`) runs through `_run()` which calls `engine.dispose(close=False)` before each job — a documented fix for the *“TCPTransport closed … handler is closed”* failure that occurs when a global async engine is bound to a previous task’s closed loop.
* **Stage‑by‑stage fail‑soft.** Scene failure, render failure and upload failure each return a structured `{"ok": False, "reason": …}` and clean up temp files via `_cleanup()` — a half‑finished run never leaves orphan media or a half‑marked article.

---

### 14.4 Academy lesson video pipeline (`src/publish/academy_drip.py`)

A complementary pipeline publishes the **160‑lesson forex academy** to YouTube, one lesson per day at 15:00 Tehran (`crontab(minute=30, hour=11)` UTC).

* **Strict ordering.** Lessons are sorted by `_LEVEL_RANK` (beginner → intermediate → advanced → pro/“حرفه‌ای” → ai → mt4 → mt5) then `order_in_level` then `id`. `next_target()` returns the first lesson that has a real video file and is *not yet* recorded as `uploaded` in `lesson_publications` — the anti‑duplicate ledger.
* **Real academy video reuse.** `_video_map()` resolves the exact `.mp4` the VIP site serves (from `AcademyVideo.hls_url`, `status="ready"`), falling back to `{slug}.mp4`. YouTube viewers get the identical asset paying students see.
* **Per‑lesson themed thumbnails.** `thumbnail.make_thumbnail()` renders a 1280×720 JPEG (HTML→image via chart‑renderer) reading *“جلسهٔ X” + level name + lesson title + academy logo*, with a **distinct colour theme per level** (`_THEME`: orange/red/blue/gold/black). Output is JPEG‑quality‑90 to stay under YouTube’s 2 MB thumbnail cap.
* **Rich descriptions & playlists.** `_description()` embeds the full cleaned lesson body (≤3000 chars), the academy CTA, and links; each level becomes its own YouTube playlist under the academy name (`_playlist_title()`), since YouTube has no nested folders.
* **Idempotent ledger.** `_record()` upserts on `unique(lesson, platform)` with `status` (`uploaded`/`failed`), `external_id`, `url`, and error text — so re‑runs never double‑post and failures are retried next day.

#### 14.4.1 The YouTube uploader (`src/publish/youtube.py`)

A dependency‑light client (raw `httpx`, no heavy Google SDK):

* **OAuth2 refresh‑token flow** — owner authorises once, `YOUTUBE_REFRESH_TOKEN` lives in `.env`; `_access_token()` mints a short‑lived token per upload.
* **Resumable upload** — initiates a session (`uploadType=resumable`), reads the `Location` header, PUTs the bytes; category is fixed to `27` (Education).
* **Find‑or‑create playlist** — paginates `mine=true` playlists, creates a public one if missing, then adds the video.
* **Thumbnail set** as a separate authenticated call.
* **Never throws** — every path returns `{ok, id, url}` or `{ok:false, reason, detail}` so the drip loop can record and move on.

---

### 14.5 News subsystem — ingestion, buffering, drip (`src/news/`)

The news engine reads world + Iranian forex/market RSS, translates with Claude, stores as Articles, and **drips** them to the Telegram channel so the feed looks human, not bursty.

#### 14.5.1 Sources & cadence (`src/news/sources.py`)

13 vetted feeds: Investing.com (forex/commodities/economy/stocks), ForexLive, FXEmpire, plus two Iranian Persian feeds (`اقتصاد آنلاین`, `مهر — اقتصاد`, tagged `origin=iran, lang=fa` so they need no translation). The policy is *“whatever’s newest, no daily cap, throttled per run”*: `PER_RUN_INTL=6`, `PER_RUN_IRAN=3`, `PER_RUN_MAX=6` (analysis). Running every 15 min naturally spreads content across 24h.

#### 14.5.2 The ingestion gauntlet (`ingest.py → ingest_once`)

Each candidate item passes a strict, ordered filter chain before it is ever saved:

| # | Filter | Purpose |
|---|--------|---------|
| 1 | link‑slug `_exists()` | per‑link dedup |
| 2 | `_iran_is_market()` | Iranian general feeds: keep only market topics (طلا/دلار/نفت/بورس…) via **word‑start** matching (not substring, so «ین» inside «زمین» is ignored) |
| 3 | `_is_non_market()` | global kill‑list of sports/celebrity/health click‑bait via **whole‑token** matching (so «مسی»/Messi never trips on «مسیر») |
| 4 | `_is_dup_title()` | cross‑source dedup via Redis `SETNX` with 3‑day TTL (same story from another outlet) |
| 5 | `_enrich_from_page()` | if RSS body is thin/imageless, fetch the page and pick the **richest** body container + `og:image` |
| 6 | `MIN_BODY_CHARS` (250) | quality gate — thin stories never post |
| 7 | `is_broker_ad()` | broker‑advertising filter, run **twice** (raw English + final Persian) |
| 8 | translate / clean | English → `translate_news()` (Claude); Persian → `_clean_fa_news()` strips breadcrumbs, dates, «کد خبر», «برچسب‌ها» |

Surviving items become `Article` rows via `_save_article()`, which adds an XSS‑sanitised body, a content‑hash dedup (`md5` of normalised text — near‑identical re‑translations are rejected), `word_count`, `meta_description`, SEO tags, and then immediately calls `notify_search_engines([slug])` (§14.7). The daily reset boundary is **07:00 Tehran**, not UTC midnight (`day_start_utc()`).

#### 14.5.3 The drip buffer (the “human cadence” trick)

Instead of spraying a batch of stories at the channel the moment ingest runs, items are buffered:

* `enqueue_channel_post()` RPUSHes a render job onto the Redis list `news:drip_queue` (capped at `_DRIP_MAX=240`, `LTRIM` keeps the freshest).
* The Celery task `drip_news` runs every 10 min and `drip_once(batch=1)` LPOPs **exactly one** item onto `telegram:events`, where the bot consumer renders it (image + headline + “full text” button).

Result: a smooth, evenly‑spaced channel stream across the whole day rather than clusters around the ingest minutes.

#### 14.5.4 Original SEO articles (`src/news/blog.py` + `keywords.py`)

Distinct from news, `generate_blog_post` (every 2h, cap 10/day) writes **original** Persian articles to avoid any copyright issue:

* **Keyword‑clustered targets.** `keywords.py` defines 13 topic clusters (آموزش فارکس، تحلیل تکنیکال، پرایس اکشن، مدیریت سرمایه، طلا/XAUUSD، بروکر، سیگنال…). Each cluster = one comprehensive **pillar page** + dozens of long‑tail **child** articles. `_pick_target()` builds pillars first (for topical authority), then rotates children, skipping anything used in the last 7 days.
* **Claude as analyst.** The `_SYSTEM` prompt commissions an 800–1100‑word, E‑E‑A‑T‑grade article with `<h2>` sections, lists, a concrete numeric example, a risk note, and a mandatory **“سوالات متداول”** block with exactly 3 real `<h3>?</h3>` Q&A pairs — the raw material the FAQ schema (§14.7) later harvests.
* **Internal linking.** Child articles auto‑link to their pillar (`<a href="/article/{pillar.slug}">`), wiring the topic cluster together for SEO.
* **Quality gates.** `MIN_WORDS=300`, content‑hash dedup, broker‑ad defence, then `notify_search_engines()` + channel enqueue (hashtag `#بلاگ`).

---

### 14.6 The SEO ecosystem (`src/seo/`)

A trio of Celery‑beat jobs turns Google’s own data into an actionable backlog, monitors speed and structured data, and keeps caches fresh — entirely server‑side, no manual SEO labour.

#### 14.6.1 Daily Search Console mining (`tasks.mine_search_console`, 06:00 UTC)

`gsc_client.py` talks to the GSC REST API directly (only `google.oauth2` for the Service‑Account token; the SA key file is **never printed**). `_mine()` pulls a 28‑day window (with a 3‑day data‑settling lag) and `analyzer.py` extracts three high‑value signals, each emitted as a deduplicated `seo_actions` row:

| Signal | Logic | Action produced |
|--------|-------|-----------------|
| **CTR opportunity** (`mine_ctr_opportunities`) | good rank (pos ≤ 20) but CTR < ½ of the position’s expected CTR (industry curve `_EXPECTED_CTR`) | “rewrite title/meta for «query»”, ranked by estimated lost clicks |
| **Zero‑click pages** (`mine_zero_click_pages`) | impressions ≥ threshold but **0** clicks | “content doesn’t match search intent / weak snippet” |
| **Rank drops** (`mine_rank_drops`) | page was top‑20 and avg position worsened ≥ `SEO_RANK_DROP_THRESHOLD` vs the previous 14‑day window | “investigate fresh competition / staleness” |

`daily_totals()` also stores per‑day clicks/impressions/CTR/position into `seo_metrics_daily` (upsert) for the admin trend chart. Severity scales by impressions (`high` ≥ 1000). After mining, **page‑targeted** actions (drops + zero‑click) trigger a Cloudflare purge so Googlebot re‑crawls the fixed version (CTR actions target a *query*, not a URL, so they are not purged).

#### 14.6.2 Weekly PageSpeed QA (`tasks.run_pagespeed`, Mon 04:30 UTC)

For each monitored URL (from `seo_monitored_urls`, else config defaults), both `mobile` and `desktop` strategies are run through PageSpeed Insights. `gsc_client.pagespeed()` normalises Lighthouse into scores (performance/SEO/accessibility/best‑practices) + Core Web Vitals (`lcp_ms`, `cls`, `tbt_ms`, `fcp_ms`, `si_ms`) + the top opportunity audits as human‑readable issues. Results land in `seo_pagespeed`; a **mobile** performance score below `SEO_PAGESPEED_MIN_SCORE` (80) opens a deduplicated `pagespeed` action (severity `high` if < 60).

#### 14.6.3 Daily schema‑health monitor (`tasks.monitor_schema_health`, 06:15 UTC)

`_schema_health()` samples static pages + the 15 newest articles and runs each through the **URL Inspection API** (`inspect_url`). It raises actions for (a) **structured‑data errors** — Rich Results verdict `FAIL`/`PARTIAL` or per‑item `ERROR` issues → `schema` action, and (b) **real index problems** — a curated `_PROBLEM` list (`noindex`, `blocked`, `redirect`, `duplicate`, `soft 404`, `crawl anomaly`…) → `index_issue` action. Ordinary “not yet indexed” states are intentionally ignored to keep the dashboard noise‑free. The API quota is respected with a small sample.

#### 14.6.4 Article / FAQ JSON‑LD schema (`src/seo/schema.py`)

`build_article_graph()` emits a full `@graph`: an `Article` node (headline, image, dates, author Person, publisher Organization, `wordCount`, `articleSection`, `keywords`) + a 3‑level `BreadcrumbList` + a conditional `FAQPage`.

The **anti‑penalty rule** is explicit: `extract_faq()` only builds `FAQPage` from a *real* on‑page “سوالات متداول” heading and its `<h?>…؟</h?> + <p>…</p>` pairs. If the article has no FAQ section, **no FAQPage is emitted** — the structured data always matches what the user actually sees, avoiding Google’s “mismatched FAQ” penalties. This is why the blog prompt (§14.5.4) is *required* to produce that exact section.

#### 14.6.5 Cloudflare smart‑purge (`src/seo/cloudflare.py`)

`purge_urls()` purges by exact URL in batches of 30 (Cloudflare’s per‑request cap), de‑duplicating input. It is invoked on publish/edit/delete and from the SEO miner. Like everything here it is fully fail‑soft: if token/zone are unset or the API errors, it returns `False` and never breaks the publish path; the API token is **never logged**.

#### 14.6.6 Dynamic sitemap + IndexNow (`src/core/seo_notify.py`)

The growth flywheel closes here: every time an article is saved (news, analysis, or blog), `notify_search_engines([slug])` runs:

1. **Invalidate** the cached articles sitemap (`seo:sitemap:articles`) so the new URL appears in `/sitemap.xml` immediately — the sitemap is generated dynamically, so all ~hundreds of articles are auto‑indexed on publish.
2. **Ping IndexNow** (Bing/Yandex) with the fresh URL for near‑instant indexing (Google re‑crawls the sitemap on its own cadence).

A manual `indexnow_backfill` task (`submit_all_to_indexnow`) can re‑submit the entire published archive in 1000‑URL chunks.

---

### 14.7 Configuration & operational summary

Everything is feature‑flagged off by default and enabled via settings/`.env` (`src/core/config.py`):

| Setting | Default | Controls |
|---------|---------|----------|
| `LLM_ENABLED` | `False` | master switch for all Claude usage |
| `LLM_SERVICE_URL` | `http://claude-llm:8085` | wrapper endpoint |
| `LLM_MODEL` | `sonnet` | default model |
| `LLM_NARRATOR/NEWS/SANITY_GATE_ENABLED` | `False` | per‑feature LLM toggles |
| `BLOG_VIDEO_ENABLED` | `False` | blog→video pipeline |
| `ACADEMY_DRIP_ENABLED` | `False` | academy lesson drip |
| `YOUTUBE_ENABLED` + client/secret/refresh | `False`/empty | YouTube uploads |
| `SEO_GSC_SITE` / `SEO_SA_PATH` | `sc-domain:…` | Search Console |
| `SEO_PAGESPEED_MIN_SCORE` | `80` | PageSpeed alert threshold |
| `SEO_RANK_DROP_THRESHOLD` | `2.0` | rank‑drop sensitivity |
| `CLOUDFLARE_API_TOKEN/ZONE_ID` | empty | smart‑purge |
| `CLAUDE_CODE_OAUTH_TOKEN` | empty | the long‑lived headless auth token |

**Celery‑beat cadence (UTC):** news ingest `*/15`, drip `*/10`, blog generate `:15 */2h`, academy drip `11:30`, blog→video `05:30` & `16:30`, GSC mine `06:00`, PageSpeed `Mon 04:30`, schema‑health `06:15`.

The design philosophy is consistent across all five subsystems: **the growth engine is a guest in the trading host.** It is gated, rate‑limited, fail‑soft (content) / fail‑open (trading gate), and every external dependency (Claude, YouTube, Cloudflare, GSC, Redis) can vanish without touching a single trade.

---
---

## ۱۴. موتورِ محتوا، سئو و رشدِ هوشِ مصنوعی

> *«محصول، معامله می‌کند. موتورِ رشد، محصول را **قابل‌کشف** می‌کند.»*

کوین‌پرو‌FX فقط یک پلتفرمِ معاملاتی نیست؛ یک شرکتِ رسانه‌ایِ خودتکثیر است که در همان کدبیس سیم‌کشی شده. یک استخرِ workerِ Celery هم‌زمان: (الف) با Claude مقالاتِ اصیلِ فارسی می‌نویسد، (ب) اخبارِ جهانیِ فارکس را می‌خواند و ترجمه می‌کند، (پ) از همان مقالات ویدیوی سینماییِ یوتیوب می‌سازد، (ت) درس‌های آکادمی را قطره‌چکانی در یوتیوب منتشر می‌کند، و (ث) Google Search Console را داده‌کاوی می‌کند تا به خودش بگوید کدام صفحه را اصلاح کند. همه‌چیز **fail‑soft** است: اگر Claude، یوتیوب، Cloudflare یا Search Console در دسترس نباشد، هستهٔ معاملاتی هرگز بلاک نمی‌شود و تسکِ رشد فقط یک دلیل برمی‌گرداند و خارج می‌شود.

این فصل پنج زیرسیستمِ درهم‌تنیده و مدلِ امنیتی‌ای را مستند می‌کند که اجازه می‌دهد یک دستیارِ کدنویسی (Claude Code CLI) به یک مغزِ محتواییِ scope‑شده و فقط‑بازارِ‌مالی تبدیل شود.

---

### ۱۴.۱ نمای کلیِ معماری

همان نمودارِ بخشِ انگلیسی برقرار است: `src/llm/client.py` تنها دروازهٔ async به سرویسِ `claude-llm` است؛ شش نقشِ متفاوت (راوی سیگنال، گیتِ نظرِدوم، ترجمهٔ خبر، مقالهٔ بلاگ، کارگردانِ ویدیو، سنتیمنتِ خبری) از همین دروازه عبور می‌کنند. خروجیِ Article به دو پایپلاینِ ویدیو (بلاگ‌ویدیو و درسِ آکادمی) و به موتورِ سئو (داده‌کاویِ GSC + sitemap پویا) خوراک می‌دهد.

```
RSS ─▶ ترجمهٔ Claude ─▶ Article ─▶ بافرِ drip ─▶ کانالِ تلگرام
بانکِ کلیدواژه ─▶ مقالهٔ Claude (+FAQ) ─▶ Article ─▶ کانال
Article ─▶ سناریوی Claude ─▶ chart-renderer/blog-video (Remotion+Pexels+صدای بهنام v3) ─▶ یوتیوب + شورت + استوریِ IG
درس‌های مرتب ─▶ تامبنیلِ تم‌دار ─▶ یوتیوب (روزی یک درس)
GSC ─▶ اکشن‌های سئو · PageSpeed · سلامتِ schema · purge کلودفلر
هر مقاله ─▶ ابطالِ کشِ sitemap + ping به IndexNow
```

---

### ۱۴.۲ دروازهٔ LLM — سرویسِ `claude-llm` + `src/llm/client.py`

پلتفرم هرگز با کلیدِ متریک به API انتروپیک وصل نمی‌شود. به‌جای آن، **Claude Code CLI در حالتِ headless** پشتِ یک wrapperِ کوچکِ Node (`llm_service/server.js`) اجرا می‌شود. این، تنها گلوگاهِ تمامِ فراخوانی‌های Claude در پروژه است.

#### ۱۴.۲.۱ سرویسِ wrapper

`server.js` دو مسیر دارد: `GET /health` (برای healthcheckِ compose) و `POST /complete` که `{prompt, model?, timeout_ms?, system?}` می‌گیرد و `claude` را spawn می‌کند:

```js
const args = ["-p", prompt, "--output-format", "json", "--model", model || DEFAULT_MODEL];
if (system && String(system).trim()) {
  args.push("--system-prompt", String(system));
  args.push("--exclude-dynamic-system-prompt-sections");
}
```

تصمیم‌های مهندسیِ کلیدی:

* **محدودکنندهٔ هم‌زمانیِ درون‌فرایندی.** `MAX_CONCURRENCY=3` با صفِ دستیِ `acquire()/release()` تا اشتراکِ Max هرگز با نرخِ بالا کوبیده نشود. کلاینتِ پایتون (`Semaphore(3)`) محدودکنندهٔ دوم را در سمتِ caller اضافه می‌کند — دفاع در عمق.
* **تایم‌اوتِ سخت با SIGKILL.** یک `setTimeout` بچه را می‌کشد و `{ok:false,error:"timeout"}` برمی‌گرداند تا یک تولیدِ گیرکرده هرگز worker را قفل نکند.
* **پارسِ مقاومِ JSON.** پوششِ `--output-format json` را می‌خواند و `j.result ?? j.text ?? out` برمی‌گرداند؛ در خطای پارس به stdout خام برمی‌گردد، نه پرتابِ استثنا.
* **هر خطا یک مقدار است، نه استثنا.** خطای spawn، خروجِ غیرصفر و تایم‌اوت همگی `resolve({ok:false})` می‌کنند؛ لایهٔ HTTP همیشه `200` با پرچمِ `ok` پاسخ می‌دهد.

#### ۱۴.۲.۲ تکنیکِ جایگزینیِ `--system-prompt`

این، ترفندِ حیاتی است که یک دستیارِ *کدنویسی* را به یک *تحلیلگرِ فارکس* تبدیل می‌کند. Claude Code یک هویتِ پیش‌فرض («تو دستیارِ کدنویسی هستی») به‌علاوهٔ بخش‌های پویای محیطی (cwd، گیت، گیتِ ابزارها) دارد که برای محتوای بازار مضر و پرت‌اند. wrapper این‌ها را می‌فرستد:

* `--system-prompt <text>` → هویتِ پیش‌فرض را **کاملاً جایگزین** می‌کند.
* `--exclude-dynamic-system-prompt-sections` → پیش‌درآمدِ محیط/ابزارِ Claude Code را حذف می‌کند.

نتیجه یک مدلِ خالصِ نقش‌محور است: وقتی `narrator.py` می‌گوید *«تو یک تحلیلگرِ ارشدِ فارکس هستی»*، این **تنها** هویتِ موجود در context است. سمتِ پایتون با `system_replace=True` واردِ این حالت می‌شود:

```python
use_field = bool(system and system_replace)
full = prompt if (not system or system_replace) else f"{system}\n\n{prompt}"
...
if use_field:
    body["system"] = system   # به‌عنوانِ فیلدِ جدا → --system-prompt
```

| حالت | ماشه | اثر |
|------|------|-----|
| **جایگزینی** (`system_replace=True`) | کارگردانِ `blog_video.py` | system به `--system-prompt` می‌رود، هویتِ پیش‌فرض حذف |
| **پیش‌الصاق** (`system_replace=False`) | `narrator`/`sanity_gate`/`translate`/`blog` | system به ابتدای متنِ prompt می‌چسبد (سازگاریِ قدیمی، با محتوا scope‑شده) |

#### ۱۴.۲.۳ توکنِ احرازِ اختصاصی و بلندمدت

کانتینرِ `claude-llm` لاگینِ تعاملیِ هاست را **به اشتراک نمی‌گذارد**. از `docker-compose.yml`:

```yaml
claude-llm:
  user: "1000:1000"
  environment:
    HOME: /creds
    CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
  volumes:
    - /home/forex/.claude_llm_home:/creds
```

توکن یک‌بار با `claude setup-token` ساخته می‌شود و **مستقل از سشنِ `/login`ِ هاست** است؛ پس یک لاگینِ دوبارهٔ هاست هرگز احرازِ سرویس را stale نمی‌کند. `HOME` روی mountِ ایزولهٔ `/creds` پین شده تا سرویس فروشگاهِ اعتبارِ خودش را داشته باشد. Dockerfile نسخهٔ ثابتی از CLI (`@anthropic-ai/claude-code@2.1.154`) نصب می‌کند و حافظه به `512M`/`0.5 cpu` محدود است.

#### ۱۴.۲.۴ کلاینتِ پایتونِ async — fail‑soft + کش

`src/llm/client.py` تنها چیزی است که بقیهٔ کدبیس import می‌کند. قرارداد: **هرگز caller را نشکن.**

* **غیرفعال → `None`.** `if not settings.LLM_ENABLED: return None`. هر مصرف‌کننده مسیرِ بدونِ‌LLM دارد.
* **هر استثنا → `None`.** فراخوانیِ `httpx` پوشش دارد؛ در خطا `llm_call_failed` لاگ و `None` برمی‌گردد.
* **کشِ اختیاریِ Redis.** با `cache_ttl`، کلید `sha256(model|system|full)[:32]` است؛ پس promptهای یکسان (مثلاً همان تیترِ خبر) به‌جای خرجِ دوباره از کش می‌خورند. get/set کش هم پوشش دارند — Redیسِ خراب ≠ خطا.
* **سمافورِ سمتِ کلاینت** (`Semaphore(3)`) آینهٔ حدِ سرور است.
* **هدررومِ سخاوتمندِ تایم‌اوت.** تایم‌اوتِ `httpx` = تایم‌اوتِ caller `+ ۱۵ ثانیه` تا killِ خودِ CLI همیشه برندهٔ مسابقه باشد.

#### ۱۴.۲.۵ چگونه Claude scope و امن نگه داشته می‌شود (فقط بازارِ مالی)

هر فراخوانی یک **system promptِ نقشیِ سفت‌وسخت** می‌فرستد که مدل را در دامنهٔ بازار حصار می‌کشد و ساختنِ واقعیت را ممنوع می‌کند. کدبیس شش نقشِ متمایزِ دست‌تنظیم دارد:

| ماژول | نقشِ Claude | انضباطِ خروجی و گاردها |
|-------|-------------|------------------------|
| `src/news/blog.py` | «بهنام جلالی، تحلیلگر و مربیِ ارشدِ فارکس» | فقط HTML، لحنِ E‑E‑A‑T، FAQ اجباری، مثالِ عددی، هشدارِ ریسک |
| `src/news/translate.py` | مترجم/ویراستارِ ارشدِ مالی | فقط فارسی، هرگز سؤال نمی‌پرسد |
| `src/publish/blog_video.py` | کارگردان/فیلم‌نامه‌نویسِ ارشد | JSONِ سختِ سگمنت‌ها، اصطلاحاتِ انگلیسی عیناً، کلیدِ دیاگرام |
| `src/llm/narrator.py` | تحلیلگرِ ارشدِ کوین‌پرو | «فقط از دادهٔ داده‌شده؛ هیچ عدد/قیمت/واقعیت نساز» |
| `src/llm/sanity_gate.py` | ریسک‌منیجرِ ارشد (نظرِ دوم) | JSONِ سخت، **fail‑open** |
| `src/llm/news_sentiment.py` | تحلیلگرِ ماکرو | ریسکِ per‑currency، فقط advisory (نرم، نه گیتِ سخت) |

دو ایستارِ ایمنیِ عمدی:

* **fail‑soft** برای *محتوا* (نبودِ محتوا < پایپلاینِ شکسته): ترجمه/بلاگ/روایت `None` برمی‌گردانند و caller رد می‌شود.
* **fail‑open** برای *گیتِ سلامتِ معاملاتی*: `review_signal()` در حالتِ غیرفعال/خطا/غیرقابل‌پارس `{"approve": True}` برمی‌گرداند تا یک سکسکهٔ LLM هرگز سیگنالِ معتبر را بی‌صدا بلاک نکند.

تمامِ HTMLِ تولیدشده پیش از ذخیره از `sanitize_article_html()` و لینک‌ها از `validate_url()` می‌گذرند — به مدل برای تولیدِ markupِ امن هرگز اعتماد نمی‌شود.

---

### ۱۴.۳ پایپلاینِ بلاگ → ویدیوی سینمایی (`src/publish/blog_video.py`)

روزی دو بار (۹:۰۰ و ۲۰:۰۰ تهران → `crontab(hour=5)` و `crontab(hour=16)` UTC) پلتفرم یک مقالهٔ تازه‌منتشرشده را به **ویدیوی روایت‌محورِ ۳ تا ۸ دقیقه‌ایِ یوتیوب + یک شورتِ ۹:۱۶** و حتی یک استوریِ اینستاگرام تبدیل می‌کند.

#### ۱۴.۳.۱ انتخاب ← سناریو ← رندر ← انتشار

۱. **انتخاب** — `_pick_blog()` تازه‌ترین بلاگِ منتشرشده با `video_yt_id IS NULL` را برمی‌دارد. گاردِ `NULL` تضمین می‌کند هیچ مقاله‌ای دوبار فیلم نشود.
۲. **سناریو (Claude به‌مثابهِ کارگردان)** — `_scenes()` متن را تا ۴۵۰۰ نویسه پاک می‌کند و زیرِ promptِ `_SYS` از Claude یک JSONِ سخت می‌خواهد:

```json
{"segments":[{"q":"3-5 English footage words","visual":"doji|breakout|…|generic",
              "lines":["جملهٔ کوتاهِ فارسی"]}],
 "short":{"hook":"…","narration":"…","q":"…"}}
```

promptِ کارگردان هنرِ واقعی را الزام می‌کند: **هوکِ قویِ ۲‌خطی**، قوسِ روایی، ریتمِ تند (جملاتِ ۸ تا ۱۴ کلمه)، **۱۰ تا ۱۶ سگمنتِ بصریِ کاملاً متمایز** تا هیچ صحنه‌ای شبیهِ دیگری نباشد، نوشتنِ اصطلاحاتِ انگلیسی به حروفِ لاتین (`MACD`، `RSI`، `stop loss` — بدونِ آوانگاریِ فارسی تا TTS درست تلفظ کند) و CTAِ پایانی. تا دو بار با تایم‌اوتِ ۳۰۰ ثانیه retry می‌کند چون تولیدِ سناریو سنگین است.
۳. **فیلدِ `visual` = دیاگرامِ آموزشی.** هر سگمنت به یک مفهومِ چارتِ مشخص نگاشت می‌شود (`doji`، `bullish_engulfing`، `head_shoulders`، `fibonacci`، `rsi`، `ma_cross`…). رندرر همان الگویی که روایت دربارهٔ آن حرف می‌زند را می‌کشد نه فوتیجِ بی‌ربط؛ سگمنت‌های انگیزشی/CTA با `"generic"` فوتیجِ سینمایی می‌گیرند.
۴. **کندل‌های واقعیِ بازار.** `_real_pool()` پنجره‌های واقعیِ `M5` را برای ۱۲ نمادِ متفاوت مستقیماً از جدولِ `candles` می‌کشد تا دیاگرام‌ها روی **دادهٔ قیمتِ واقعی** رندر شوند، هر صحنه یک نماد.
۵. **رندر (`/blog-video`).** job به `chart-renderer:8086/blog-video` (تایم‌اوت ۳۲۰۰ ثانیه) POST می‌شود؛ آن مسیر `/studio/bloggen.js` (پروژهٔ Remotionِ زنده‌mount‌شده) را لود می‌کند که **صدای کلون‌شدهٔ بهنام v3** را می‌سازد، **فوتیجِ یکتای هر صحنه از Pexels** می‌کشد، دیاگرام‌ها را روی کندلِ واقعی ترکیب می‌کند و هم ۱۶:۹ و هم شورتِ ۹:۱۶ را — به‌علاوهٔ **تامبنیلِ با المان‌های واقعی** — رندر می‌کند.
۶. **انتشار.** `youtube.upload()` ویدیوی اصلی را در playlistِ «بلاگ آموزشی فارکس» با تامبنیل و توضیحاتِ کامل (`_description()` خلاصه، CTAِ آکادمی، لینکِ `/article/<slug>` و هشتگ) می‌گذارد. شورت با `#Shorts` و لینک به ویدیوی کامل آپلود می‌شود.
۷. **هم‌رسانی + ثبت.** `_post_ig_story()` یک کارتِ استوریِ ۱۰۸۰×۱۹۲۰ (HTML→JPEG) با استیکرِ لینکِ کلیک‌پذیرِ یوتیوب دقیقاً روی دکمهٔ کشیده‌شده می‌سازد. سرانجام `video_yt_id`/`short_yt_id`/`video_published_at` ثبت می‌شوند.

#### ۱۴.۳.۲ جزئیاتِ پایداری

* **بهداشتِ event‑loop.** تسکِ `blog_to_video` (`time_limit=4000`) از `_run()` می‌گذرد که پیش از هر job `engine.dispose(close=False)` را صدا می‌زند — رفعِ مستندِ خطای *«TCPTransport closed … handler is closed»* که وقتی engineِ سراسری به loopِ بستهٔ تسکِ قبلی گره می‌خورد رخ می‌داد.
* **fail‑soft مرحله‌به‌مرحله.** شکستِ سناریو/رندر/آپلود هرکدام `{"ok": False, "reason": …}` ساختاریافته برمی‌گرداند و فایل‌های موقت را با `_cleanup()` پاک می‌کند.

---

### ۱۴.۴ پایپلاینِ ویدیوی درسِ آکادمی (`src/publish/academy_drip.py`)

پایپلاینِ مکمل، **آکادمیِ ۱۶۰‌درسیِ فارکس** را روزی یک درس راسِ ۱۵:۰۰ تهران (`crontab(minute=30, hour=11)` UTC) در یوتیوب منتشر می‌کند.

* **ترتیبِ سخت.** درس‌ها بر اساسِ `_LEVEL_RANK` (مقدماتی → متوسط → پیشرفته → حرفه‌ای → ai → mt4 → mt5) سپس `order_in_level` سپس `id` مرتب می‌شوند. `next_target()` اولین درسِ دارای فایلِ ویدیو که در `lesson_publications` هنوز `uploaded` ثبت نشده را برمی‌گرداند — دفترِ ضدِتکرار.
* **استفادهٔ مجدد از ویدیوی واقعیِ آکادمی.** `_video_map()` همان `.mp4`ای را که سایتِ VIP سرو می‌کند (از `AcademyVideo.hls_url`، `status="ready"`) resolve می‌کند، با فالبک به `{slug}.mp4`.
* **تامبنیلِ تم‌دارِ هر جلسه.** `thumbnail.make_thumbnail()` یک JPEGِ ۱۲۸۰×۷۲۰ می‌سازد که «جلسهٔ X» + نامِ سطح + عنوان + لوگو را با **تمِ رنگیِ مجزا برای هر سطح** (`_THEME`: نارنجی/قرمز/آبی/طلایی/مشکی) نشان می‌دهد؛ JPEGِ کیفیت ۹۰ تا زیرِ سقفِ ۲ مگابایتِ یوتیوب بماند.
* **توضیحات و playlistِ غنی.** `_description()` کلِ متنِ پاک‌شدهٔ درس (≤۳۰۰۰ نویسه) + CTA + لینک‌ها را می‌گذارد؛ هر سطح یک playlistِ مجزا زیرِ نامِ آکادمی می‌شود (`_playlist_title()`).
* **دفترِ idempotent.** `_record()` روی `unique(lesson, platform)` upsert می‌کند با `status`/`external_id`/`url`/خطا — اجرای دوباره هرگز دوبار پست نمی‌کند و خطاها روزِ بعد retry می‌شوند.

#### ۱۴.۴.۱ آپلودرِ یوتیوب (`src/publish/youtube.py`)

کلاینتِ سبک (httpxِ خام، بدونِ SDKِ سنگینِ گوگل):

* **جریانِ OAuth2 با refresh‑token** — مالک یک‌بار Authorize می‌کند، `YOUTUBE_REFRESH_TOKEN` در `.env`؛ `_access_token()` هر آپلود یک توکنِ کوتاه‌عمر می‌سازد.
* **آپلودِ resumable** — سشن آغاز (`uploadType=resumable`)، خواندنِ هدرِ `Location`، PUTِ بایت‌ها؛ دستهٔ `27` (Education).
* **find‑or‑create playlist** — صفحه‌بندیِ playlistهای `mine=true`، ساختِ public اگر نبود، سپس افزودنِ ویدیو.
* **ستِ تامبنیل** به‌صورتِ فراخوانیِ احرازشدهٔ جدا.
* **هرگز throw نمی‌کند** — همیشه `{ok, id, url}` یا `{ok:false, reason, detail}`.

---

### ۱۴.۵ زیرسیستمِ خبر — دریافت، بافر، drip (`src/news/`)

موتورِ خبر RSSِ بازار/فارکسِ جهانی + ایرانی را می‌خواند، با Claude ترجمه می‌کند، به‌صورتِ Article ذخیره و **قطره‌چکانی** به کانالِ تلگرام می‌فرستد تا جریان انسانی به‌نظر برسد، نه خوشه‌ای.

#### ۱۴.۵.۱ منابع و ریتم (`sources.py`)

۱۳ فیدِ معتبر: Investing.com (فارکس/کالا/اقتصاد/بورس)، ForexLive، FXEmpire، به‌علاوهٔ دو فیدِ فارسیِ ایرانی (اقتصاد آنلاین، مهر — با `origin=iran, lang=fa` که نیازی به ترجمه ندارند). سیاست «جدیدترین‌ها، بدونِ سقفِ روزانه، با throttleِ هر‌اجرا»: `PER_RUN_INTL=6`، `PER_RUN_IRAN=3`، `PER_RUN_MAX=6`. اجرای هر ۱۵ دقیقه محتوا را به‌طورِ طبیعی در ۲۴ ساعت پخش می‌کند.

#### ۱۴.۵.۲ زنجیرهٔ فیلترِ دریافت (`ingest_once`)

| # | فیلتر | هدف |
|---|-------|-----|
| ۱ | `_exists()` با slugِ لینک | ضدتکراریِ per‑link |
| ۲ | `_iran_is_market()` | فیدهای عمومیِ ایرانی: فقط موضوعاتِ بازار، با تطبیقِ **سرِ کلمه** (نه زیررشته) |
| ۳ | `_is_non_market()` | کیل‌لیستِ جهانیِ ورزش/سلبریتی/سلامتیِ کلیک‌بیت با تطبیقِ **توکنِ کامل** (تا «مسی» در «مسیر» نیفتد) |
| ۴ | `_is_dup_title()` | ضدتکراریِ بین‌منبعی با Redis `SETNX` و TTLِ ۳‌روزه |
| ۵ | `_enrich_from_page()` | اگر بدنهٔ RSS نازک/بی‌عکس بود، غنی‌ترین محفظهٔ صفحه + `og:image` |
| ۶ | `MIN_BODY_CHARS` (۲۵۰) | گیتِ کیفیت |
| ۷ | `is_broker_ad()` | فیلترِ تبلیغِ بروکر، **دو بار** (انگلیسیِ خام + فارسیِ نهایی) |
| ۸ | ترجمه/پاک‌سازی | انگلیسی → `translate_news()`؛ فارسی → `_clean_fa_news()` |

بازماندگان با `_save_article()` به Article تبدیل می‌شوند که بدنهٔ ضدِ‌XSS، dedupِ هشِ محتوا، `word_count`، `meta_description` و تگ اضافه و سپس بلافاصله `notify_search_engines([slug])` (بخشِ ۱۴.۷) را صدا می‌زند. مرزِ ریستِ روزانه **۷ صبحِ تهران** است نه نیمه‌شبِ UTC (`day_start_utc()`).

#### ۱۴.۵.۳ بافرِ drip (ترفندِ «ریتمِ انسانی»)

به‌جای پاشیدنِ دسته‌ایِ خبر به کانال:

* `enqueue_channel_post()` یک job را به لیستِ Redisِ `news:drip_queue` (سقفِ `_DRIP_MAX=240`، `LTRIM` تازه‌ترین‌ها) RPUSH می‌کند.
* تسکِ `drip_news` هر ۱۰ دقیقه با `drip_once(batch=1)` **دقیقاً یکی** را به `telegram:events` می‌فرستد و consumerِ ربات آن را (عکس + تیتر + دکمهٔ «متن کامل») رندر می‌کند.

نتیجه: جریانِ یکنواخت و پخش‌شده در کلِ روز.

#### ۱۴.۵.۴ مقالاتِ اصیلِ سئو (`blog.py` + `keywords.py`)

`generate_blog_post` (هر ۲ ساعت، سقف ۱۰/روز) مقالاتِ **اصیلِ** فارسی می‌نویسد تا هیچ مسئلهٔ کپی‌رایتی نباشد:

* **هدف‌های کلیدواژه‌خوشه‌ای.** `keywords.py` سیزده خوشهٔ موضوعی تعریف می‌کند (آموزش فارکس، تکنیکال، پرایس اکشن، مدیریت سرمایه، طلا، بروکر، سیگنال…). هر خوشه = یک **صفحهٔ مادر** + ده‌ها مقالهٔ **اقماریِ** long‑tail. `_pick_target()` اول مادرها را می‌سازد (برای topical authority)، سپس اقماری‌ها را می‌چرخاند و هرچه در ۷ روزِ اخیر استفاده شده را رد می‌کند.
* **Claude به‌مثابهِ تحلیلگر.** promptِ `_SYSTEM` یک مقالهٔ ۸۰۰ تا ۱۱۰۰‌کلمه‌ایِ E‑E‑A‑T با `<h2>`، لیست، مثالِ عددی، هشدارِ ریسک و یک بلوکِ اجباریِ **«سوالات متداول»** با دقیقاً ۳ جفتِ `<h3>؟</h3>` سفارش می‌دهد — مادهٔ خامِ schemaِ FAQ (بخشِ ۱۴.۷).
* **لینک‌دهیِ داخلی.** مقالاتِ اقماری خودکار به مادرشان لینک می‌دهند و خوشه را برای سئو سیم‌کشی می‌کنند.
* **گیتِ کیفیت.** `MIN_WORDS=300`، dedupِ هش، دفاعِ ضدِبروکر، سپس `notify_search_engines()` + پستِ کانال (`#بلاگ`).

---

### ۱۴.۶ اکوسیستمِ سئو (`src/seo/`)

سه جابِ Celery‑beat دادهٔ خودِ گوگل را به یک بک‌لاگِ اقدام‌پذیر تبدیل می‌کنند، سرعت و دادهٔ ساختاریافته را پایش و کش‌ها را تازه نگه می‌دارند — کاملاً سمتِ‌سرور، بدونِ کارِ دستی.

#### ۱۴.۶.۱ داده‌کاویِ روزانهٔ Search Console (`mine_search_console`، ۰۶:۰۰ UTC)

`gsc_client.py` مستقیماً با RESTِ GSC صحبت می‌کند (فقط `google.oauth2` برای توکنِ Service‑Account؛ کلیدِ SA **هرگز چاپ نمی‌شود**). `_mine()` پنجرهٔ ۲۸‌روزه (با تأخیرِ ۳‌روزهٔ تثبیتِ داده) را می‌کشد و `analyzer.py` سه سیگنال استخراج می‌کند که هرکدام یک ردیفِ deduplicate‌شدهٔ `seo_actions` می‌سازند:

| سیگنال | منطق | اکشن |
|--------|------|------|
| **فرصتِ CTR** | رتبهٔ خوب (pos ≤ ۲۰) اما CTR < نصفِ انتظارِ آن رتبه (منحنیِ `_EXPECTED_CTR`) | «بازنویسیِ title/meta برای کوئری»، مرتب بر اساسِ کلیکِ ازدست‌رفته |
| **صفحاتِ بدونِ کلیک** | impression ≥ آستانه ولی **۰** کلیک | «محتوا با intent هم‌خوان نیست / snippet ضعیف» |
| **افتِ رتبه** | صفحه قبلاً top‑20 بود و positionش ≥ `SEO_RANK_DROP_THRESHOLD` بدتر شد | «رقابتِ تازه/کهنگی را بررسی کن» |

`daily_totals()` آمارِ روزانه را در `seo_metrics_daily` (upsert) برای نمودارِ روندِ ادمین ذخیره می‌کند. پس از داده‌کاوی، اکشن‌های **هدفِ‌صفحه** (افت + بدونِ‌کلیک) یک purgeِ کلودفلر می‌زنند تا رباتِ گوگل نسخهٔ اصلاح‌شده را بازخزش کند (اکشنِ CTR هدفش *کوئری* است نه URL، پس purge نمی‌شود).

#### ۱۴.۶.۲ QAِ هفتگیِ PageSpeed (`run_pagespeed`، دوشنبه ۰۴:۳۰)

برای هر URLِ تحتِ‌نظر، هر دو استراتژیِ `mobile`/`desktop` از PageSpeed Insights عبور می‌کنند. `pagespeed()` خروجیِ Lighthouse را به امتیازها + Core Web Vitals (`lcp_ms`/`cls`/`tbt_ms`/`fcp_ms`/`si_ms`) + مشکلاتِ خواناـ نرمال می‌کند. نتیجه در `seo_pagespeed`؛ امتیازِ performanceِ **موبایلِ** زیرِ `SEO_PAGESPEED_MIN_SCORE` (۸۰) یک اکشنِ deduplicate‌شده باز می‌کند (severity = high اگر < ۶۰).

#### ۱۴.۶.۳ مانیتورِ روزانهٔ سلامتِ schema (`monitor_schema_health`، ۰۶:۱۵)

`_schema_health()` صفحاتِ ثابت + ۱۵ مقالهٔ تازه را نمونه می‌گیرد و هرکدام را از **URL Inspection API** عبور می‌دهد. اکشن می‌سازد برای (الف) **خطای دادهٔ ساختاریافته** (verdictِ `FAIL`/`PARTIAL` یا `ERROR` آیتمی → اکشنِ `schema`) و (ب) **مشکلِ واقعیِ ایندکس** (لیستِ `_PROBLEM`: `noindex`/`blocked`/`redirect`/`duplicate`/`soft 404`/`crawl anomaly` → اکشنِ `index_issue`). حالتِ عادیِ «هنوز ایندکس‌نشده» عمداً نادیده گرفته می‌شود تا داشبورد پر از نویز نشود.

#### ۱۴.۶.۴ JSON‑LDِ Article/FAQ (`schema.py`)

`build_article_graph()` یک `@graph` کامل می‌سازد: نودِ `Article` (headline، image، تاریخ‌ها، authorِ Person، publisherِ Organization، `wordCount`، `keywords`) + `BreadcrumbList`ِ سه‌سطحی + `FAQPage`ِ شرطی.

**قاعدهٔ ضدِجریمه** صریح است: `extract_faq()` فقط از یک سرتیترِ *واقعیِ* «سوالات متداول» روی صفحه و جفت‌های `<h?>…؟</h?> + <p>…</p>` آن، `FAQPage` می‌سازد. اگر مقاله بخشِ FAQ نداشته باشد، **هیچ FAQPage تولید نمی‌شود** — دادهٔ ساختاریافته همیشه با آنچه کاربر می‌بیند مطابق است. به‌همین‌دلیل promptِ بلاگ *ملزم* است آن بخش را بسازد.

#### ۱۴.۶.۵ purge هوشمندِ کلودفلر (`cloudflare.py`)

`purge_urls()` بر اساسِ URLِ دقیق در دسته‌های ۳۰‌تایی (سقفِ کلودفلر) purge می‌کند. روی publish/edit/delete و از داده‌کاو فراخوانی می‌شود. کاملاً fail‑soft: اگر token/zone ست نباشد یا API خطا دهد `False` برمی‌گرداند و مسیرِ انتشار را نمی‌شکند؛ توکن **هرگز لاگ نمی‌شود**.

#### ۱۴.۶.۶ sitemapِ پویا + IndexNow (`src/core/seo_notify.py`)

فلایویلِ رشد اینجا بسته می‌شود: هر بار که مقاله‌ای ذخیره می‌شود، `notify_search_engines([slug])`:

۱. کشِ sitemapِ مقالات (`seo:sitemap:articles`) را **باطل** می‌کند تا URLِ جدید فوری در `/sitemap.xml` بیاید — sitemap پویا تولید می‌شود، پس صدها مقاله خودکار با انتشار ایندکس می‌شوند.
۲. به **IndexNow** (Bing/Yandex) با URLِ تازه ping می‌زند (ایندکسِ تقریباً آنی؛ گوگل sitemap را با ریتمِ خودش بازخزش می‌کند).

تسکِ دستیِ `indexnow_backfill` (`submit_all_to_indexnow`) می‌تواند کلِ آرشیو را در تکه‌های ۱۰۰۰‌تایی دوباره ارسال کند.

---

### ۱۴.۷ پیکربندی و خلاصهٔ عملیاتی

همه‌چیز به‌صورتِ پیش‌فرض خاموش و از طریقِ تنظیمات/`.env` (`src/core/config.py`) فعال می‌شود:

| تنظیم | پیش‌فرض | کنترل |
|-------|---------|-------|
| `LLM_ENABLED` | `False` | کلیدِ اصلیِ همهٔ Claude |
| `LLM_SERVICE_URL` | `http://claude-llm:8085` | endpointِ wrapper |
| `LLM_MODEL` | `sonnet` | مدلِ پیش‌فرض |
| `LLM_NARRATOR/NEWS/SANITY_GATE_ENABLED` | `False` | تاگلِ هر‌قابلیت |
| `BLOG_VIDEO_ENABLED` | `False` | پایپلاینِ بلاگ→ویدیو |
| `ACADEMY_DRIP_ENABLED` | `False` | dripِ درسِ آکادمی |
| `YOUTUBE_ENABLED` + client/secret/refresh | `False`/خالی | آپلودِ یوتیوب |
| `SEO_GSC_SITE` / `SEO_SA_PATH` | `sc-domain:…` | Search Console |
| `SEO_PAGESPEED_MIN_SCORE` | `80` | آستانهٔ هشدارِ سرعت |
| `SEO_RANK_DROP_THRESHOLD` | `2.0` | حساسیتِ افتِ رتبه |
| `CLOUDFLARE_API_TOKEN/ZONE_ID` | خالی | purge هوشمند |
| `CLAUDE_CODE_OAUTH_TOKEN` | خالی | توکنِ احرازِ headlessِ بلندمدت |

**ریتمِ Celery‑beat (UTC):** دریافتِ خبر `*/15`، drip `*/10`، تولیدِ بلاگ `:15 */2h`، dripِ آکادمی `11:30`، بلاگ→ویدیو `05:30` و `16:30`، داده‌کاویِ GSC `06:00`، PageSpeed `دوشنبه 04:30`، سلامتِ schema `06:15`.

فلسفهٔ طراحی در هر پنج زیرسیستم یکسان است: **موتورِ رشد، مهمانِ میزبانِ معاملاتی است.** gate‑شده، rate‑limit‌شده، fail‑soft (محتوا) / fail‑open (گیتِ معاملاتی)، و هر وابستگیِ بیرونی (Claude، یوتیوب، کلودفلر، GSC، Redis) می‌تواند ناپدید شود بدونِ آنکه حتی یک معامله را لمس کند.

---

[⬅ 13. The Instagram Automation Suite](instagram.md) · [🏠 Home · خانه](../README.md) · [15. Core Infrastructure & Security Posture ➡](core-security.md)
