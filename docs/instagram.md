[⬅ 12. The VIP Academy & BazaarNama (+ NamaScript)](academy-bazaarnama.md) · [🏠 Home · خانه](../README.md) · [14. Content, SEO & AI Growth Engine ➡](content-seo.md)

---

## 13. The Instagram Automation Suite — Multi-Tenant Panel & Worker Pool

> A complete, NovinHub-class Instagram-automation product living *inside* CoinePro-FX — but engineered so that nothing it does can ever starve the trading engine. It ships its own multi-tenant SaaS panel (`ig.trade-future.ir`), its own unofficial-API worker microservice (`ig-worker`), its own Celery queue (`ig`), its own React frontend (`frontend/ig`), and an admin "IG Users" control plane. Every account, session, rule and post is owner-isolated and credential-encrypted.

### 13.1 Why a separate suite at all

Instagram has no public "auto-DM / auto-comment" API. To do keyword→link replies, scheduled reels, story link-stickers, and AI publishing you must drive the **private/unofficial** mobile API. The project uses [`instagrapi`](https://github.com/subzeroid/instagrapi) for this. Two hard constraints shaped the architecture:

1. **`instagrapi` is blocking and slow.** A single `poll_dms()` can take seconds. If that ran in the same process/queue as the trading bot, a slow Instagram call could delay closing a position or a market alert. The memory rule *"celery queue isolation"* exists precisely because this once happened.
2. **Unofficial logins get banned for bursty behaviour.** Sends must be rate-capped and spaced, sessions must be reused (not re-logged-in on every action), and 2FA/challenge must be handled gracefully.

The answer is a **three-tier split**:

| Tier | Component | Runtime | Job |
|------|-----------|---------|-----|
| Edge / UI | `frontend/ig` (React+Vite) | nginx container | Per-user panel served at `/ig` |
| Control plane | `src/api/routes/ig_panel.py` + `admin_ig_users.py` | FastAPI (`api`) | Auth, ownership, CRUD, encrypted creds |
| Orchestration | `src/instagram/*` on Celery queue `ig` | `celery-ig-worker` (concurrency 4) | detect→enqueue→drain, autopilot, publish |
| Execution | `ig-worker/app.py` (instagrapi) | `ig-worker` container | The only process that touches Instagram |

```
React /ig ──HTTP──▶ FastAPI ig_panel ──┬─ Postgres (owner-isolated rows, Fernet creds)
                                        └─ ig-worker (per-account instagrapi clients)
                                              ▲
Celery 'ig' queue (engine/publisher/autopilot) ┘   ← runs the loops, never blocks trading
```

The compose comment says it plainly: *"جدا از تریدینگ تا کندیِ instagrapi هیچ‌وقت بستنِ پوزیشن/پیامِ بازار را به تأخیر نیندازد"* — separated from trading so instagrapi slowness never delays closing a position or a market message.

### 13.2 The multi-tenant data model

Every tenant is an `IGUser` (`src/core/database.py`):

```python
class IGUser(Base):                      # the panel tenant
    username, password_hash              # own login (bcrypt)
    max_accounts: int = 3                # ≤3 IG accounts each
    enc_login_password                   # Fernet copy so admin can reveal panel pw
    permissions = JSONB                  # per-feature lock; null = all open
    is_admin_seed, is_active, login_count, last_login_ip, last_active_at
```

Each connected Instagram account is an `IgAccount` **owned** by exactly one tenant:

```python
class IgAccount(Base):
    owner_id  -> ig_users.id  ondelete="CASCADE"   # delete user → delete their accounts
    username  unique
    enc_password   # Fernet — raw IG password NEVER stored
    enc_totp       # Fernet — 2FA secret for headless self-heal
    session_path   # sessions/{id}.json  (instagrapi device/session reuse)
    status         # online/offline/challenge/error
    smart_enabled  # per-account auto-reply toggle
```

The remaining tables are all `account_id`-scoped (or `account_ids` JSONB for multi-account content):

| Table | Purpose |
|-------|---------|
| `IgMessage` | reusable message (text / button / file / product showcase) |
| `IgAutoReply` | a keyword rule (the "dastoor") |
| `IgForm` | stateful DM form (Q&A flow) |
| `IgContent` | a post/reel/story/album (manual, AI, news/blog, or autopilot) |
| `IgAutopilot` | autonomous content scheduler |
| `IgInbox` | log of every inbound comment/DM + the reply sent (stats + dedupe via `ext_id`) |

**Ownership isolation** is enforced on *every* panel route, not assumed. The two gatekeepers in `ig_panel.py`:

```python
async def _owned(db, user, account_id) -> IgAccount:
    acc = ... where(IgAccount.id == account_id, IgAccount.owner_id == user.id)
    if not acc: raise HTTPException(404, "اکانت یافت نشد یا متعلق به شما نیست.")

async def _owned_ids(db, user) -> set[int]:   # the set the tenant may touch
    return {ids of IgAccount where owner_id == user.id}
```

For content/autopilot rows that reference multiple accounts via `account_ids` JSONB, `_validate_account_ids()` rejects any id not in `_owned_ids`, and list endpoints filter in Python by set-intersection (`owned & set(c.account_ids)`), so a tenant literally cannot see — let alone publish to — another tenant's account.

### 13.3 Tenant authentication (`scope="ig"`)

The panel reuses the project's JWT helpers but stamps a **scope** so an IG token can never be replayed against admin or user-panel routes:

```python
# POST /ig/auth/login
return {"access_token": create_access_token({"sub": f"ig:{u.id}", "scope": "ig"}),
        "refresh_token": create_refresh_token({"sub": f"ig:{u.id}", "scope": "ig"}), ...}

async def current_ig_user(authorization, db):
    p = verify_access_token(token)
    if not p or p.get("scope") != "ig":      # ← scope guard
        raise HTTPException(401, "توکن نامعتبر است.")
    uid = int(sub.split(":")[1]); ...        # sub looks like "ig:42"
```

Login is **case-insensitive on username** (`func.lower(...) == username.lower()`) but case-sensitive on password, records `login_count`, `last_login_ip` (honouring `x-forwarded-for`), and `last_active_at` is bumped on every authenticated request. The frontend (`api/client.js`) stores `cp_ig_token` / `cp_ig_refresh` in `localStorage` and bounces to `/login` on any 401.

### 13.4 Encrypted credentials — Fernet everywhere

Raw secrets are **never** persisted. `src/core/crypto.py` wraps `cryptography.fernet`:

```python
def _fernet():
    key = settings.USER_CREDS_ENC_KEY or derive_from(JWT_SECRET_KEY)  # 32B → urlsafe b64
    return Fernet(key)
encrypt_secret(plaintext) -> token        # at-rest
decrypt_secret(token) -> plaintext | None # None on InvalidToken (never crashes)
```

Three secrets ride through Fernet:

* `IgAccount.enc_password` — the Instagram password, used only to (re)login the worker.
* `IgAccount.enc_totp` — the 2FA TOTP secret, so a headless worker can mint codes via `pyotp` and self-heal an expired session with no human.
* `IGUser.enc_login_password` — a reversible copy of the *panel* password so an admin can reveal it (`GET /ig-users/{uid}/password` → `decrypt_secret`). The hash (`password_hash`, bcrypt) is what actually authenticates; the Fernet copy is convenience-for-admin only.

### 13.5 The `ig-worker` microservice — the only thing that touches Instagram

`ig-worker/app.py` is a tiny FastAPI app (deps: `instagrapi==2.1.5`, `pyotp`, `moviepy`, `Pillow`). It is **internal-only** (Docker network, port 8090, no public route) and holds a **per-account client pool**:

```python
_clients: dict[str, Client] = {}     # account_id -> logged-in instagrapi Client
_locks:   dict[str, threading.Lock]  # account_id -> its own lock
_info:    dict[str, dict]            # last status/error per account
```

#### Per-account client + lock

`get_client(account_id)` is the heart. It:

1. Resolves `aid = account_id or DEFAULT_ACCOUNT or "default"`.
2. Takes **that account's** lock (`_get_lock(aid)`) so two requests for the same account serialise, but different accounts run concurrently.
3. Loads the session from `sessions/{aid}.json` (instagrapi `load_settings` — device fingerprint + cookies, so no fresh login).
4. **Validates** the session with `cl.get_timeline_feed()`. If it throws, the session is dead.
5. **Self-heals**: if creds are available (`creds` arg, or the legacy `.igkey` file for the default account), it mints a TOTP code and re-logs-in, then `dump_settings` back to disk. Otherwise it marks the account `challenge` and raises `401 session_expired:{aid}`.

```python
with _get_lock(aid):
    cl = _clients.get(aid) or _new_client_loading(spath)
    try:
        cl.get_timeline_feed()                 # cheap validity probe
    except Exception:
        code = pyotp.TOTP(c["totp_secret"]).now() if c.get("totp_secret") else ""
        cl.login(c["username"], c["password"], verification_code=code)  # self-heal
        cl.dump_settings(spath)
    return cl
```

`delay_range = [1, 3]` is set on every client so instagrapi injects 1–3s human-like jitter between private requests.

#### `DEFAULT_ACCOUNT` legacy fallback

The blog→story pipeline predates multi-tenancy and called the worker with **no** `account_id`. To keep it working, `IG_DEFAULT_ACCOUNT_ID=1` (the `coineprofx` master account) is configured in compose. Every schema field is `account_id: str | int | None = None`; when omitted it falls back to the default. There is even a one-time migration path: if `sessions/{default}.json` doesn't exist but the legacy single-account `ig_session.json` does, it's loaded and dumped into the pool path — **migrating without a relogin** (which would risk a challenge).

#### Login / 2FA / challenge handling

`POST /login` (used by the panel when a tenant adds an account):

```python
code = p.verification_code or (pyotp.TOTP(p.totp_secret).now() if p.totp_secret else "")
cl.login(p.username, p.password, verification_code=code)
# on failure, classify:
challenge = any(s in msg.lower() for s in
    ("two_factor","twofactor","challenge","verification","checkpoint"))
return {"ok": False, "challenge": challenge, "error": msg[:300]}
```

So three outcomes flow back to the panel: **ok** (account online, profile cached), **challenge** (needs a 2FA/verification code — the UI shows a code box), or **error** (bad password etc.). On success the session is dumped to `sessions/{account_id}.json` and the client cached.

#### Worker endpoint surface

| Endpoint | Used by | What it does |
|----------|---------|--------------|
| `GET /health` | compose healthcheck | `{ok, accounts_loaded, default}` |
| `GET /status` | panel "live" badge | followers/following/media_count/avatar |
| `POST /login` `POST /logout` | panel add/remove account | login (+2FA) / drop session + client |
| `POST /publish` | publisher | photo / album / video / **reel** (`clip_upload`) / **story** with link-sticker |
| `POST /delete` | auto-delete | `media_delete` |
| `POST /dm_send` `POST /dm_send_media` | engine | text(+links) / photo+video DM |
| `POST /comment_reply` | engine | reply under a comment |
| `POST /poll_comments` `POST /poll_dms` | engine detector | fetch new comments/DMs |
| `POST /user_media` | panel grid + rules | recent posts (with per-account cache) |
| `POST /is_follower` | follow-gate | friendship check |

Two production-grade touches: `_recent_media()` caches each account's post list for 90s (so polling every few seconds doesn't hammer the private API), and `/poll_comments` only inspects **relevant** posts — specific `media_pks` from rules plus the 2 most-recent — instead of the whole feed.

#### Story link-stickers (clickable links)

`/publish` with `kind="story"` builds a real Instagram **link sticker** (instagrapi `StorySticker`), pre-validates the URL via the private `media/validate_reel_url/` request, and positions it (`link_x/y/w/h`) so stories can carry a tappable CTA — something the official Graph API gates behind 10k-follower / verified accounts.

### 13.6 The smart auto-reply engine — "detect → queue → rate-limited send"

`src/instagram/engine.py` is the brain, designed so **nothing is lost** even under a comment storm, and **nothing gets the account banned**. Architecture in three Celery beats:

```
ig_dm     every 2s  → detect_and_enqueue(scope="dm")      fast path: DMs sent instantly
ig_detect every 3s  → detect_and_enqueue(scope="comment") comments → Redis queue
ig_drain  every 2s  → drain_queue()                       send from queue under hourly cap
```

#### Fresh-loop hygiene

Each Celery task runs in a brand-new event loop (`tasks._run`) with a fresh `NullPool` SQLAlchemy engine (`_task_db()`) and a fresh keepalive Redis connection (`_ensure_redis()`). This is deliberate — it dodges the classic "Future attached to a different loop" crash that plagues async code re-entered by Celery, and avoids stale idle-closed sockets during long polls.

#### Concurrency lock (anti-overlap)

Beats fire every 2–3s but a poll may take longer. A Redis `SET NX EX` lock prevents two detectors of the same scope from racing; it's **fail-open** (if Redis is down, don't halt). Beat tasks also carry `expires` (8–10s) so a backed-up scheduler discards stale jobs instead of piling them up — the same anti-pileup lesson from the queue-explosion incident.

```python
async def _acquire(name, ttl=25):
    return bool(await redis.set(f"ig:lock:{name}", "1", nx=True, ex=ttl))  # fail-open on error
```

#### Matching

`match(rule, text)` supports `equal` / `contains` / `any`, and — uniquely — **per-keyword mode override**: a keyword can be a plain string (uses the rule's mode) *or* a `{"mode": "...", "value": "..."}` dict with its own mode. `any` matches everything (a catch-all auto-responder).

#### Dedup + backlog guard

`IgInbox.ext_id` (`c:{comment_pk}` or `d:{msg_id}`) is the idempotency key — `_seen()` checks it before acting, so the same comment is never answered twice across overlapping polls. A timestamp gate (`ts ≥ rule.created_at`) ensures a brand-new rule doesn't suddenly reply to months-old comments.

#### Fast DM path vs. queued comments

* **DMs and forms send instantly** inside `detect_and_enqueue` (forms are a live conversation; DMs feel like a real person answering in ~2–3s). Only if the hourly cap is exhausted does a DM fall back into the queue.
* **Comments** are sent instantly *if* under cap, otherwise enqueued — guaranteeing that a viral post dropping hundreds of comments at once never overruns the safe send rate; the overflow drains gradually.

#### Rate limiting (anti-ban)

A per-hour counter `ig:sent:YYYYMMDDHH` (TTL ~1h) is compared against a configurable cap `ig:rate_cap` (default `60/hour`). `drain_queue` computes `budget = cap - used`, sends at most `min(batch, budget)`, and leaves the rest queued for the next tick. Every successful send calls `_rate_inc()`.

#### Link-as-card DMs

Unofficial Instagram won't render rich button cards, so the engine uses two complementary tricks:

1. `_compose_with_links()` inlines `🔗 {label}\n{url}` into one message — title + clickable link in the same DM.
2. `_make_go_link()` mints an **OG-redirect** link: it stores `{label, url}` in Redis under `ig:go:{code}` and returns `{PUBLIC_SITE}/api/public/go/{code}`. That public endpoint (`routes/public.py:go_link`) serves an Open-Graph HTML page whose **title is the button label**, so Instagram renders a real link *card* with your chosen wording when the link unfurls.

Each reply is a list of **parts** (`_build_parts`): an optional AI-written text part first (Claude via `llm_client.complete(..., system_replace=True)`, scoped to "you are the Coinepro forex page assistant"), then each selected `IgMessage` (text+links or media) in order. `_send_parts` walks them: media via `/dm_send_media`, text via `/dm_send`.

#### Follow-gate ("follow first, then I'll send")

If a rule has `require_follow`, the engine checks `is_follower()` (120s Redis-cached). If not following, it sends the follow message + sets a 24h Redis gate `ig:fg:{acc}:{user}`. When the user later DMs "فالو دارم"/"done"/"follow", the gate detector re-checks **fresh**; if now following, it releases the real payload, else it re-prompts. This is a complete state machine that even polls DMs for comment-only rules that need the gate release.

#### Stateful forms

`handle_form()` is a Redis-backed Q&A flow: `start_trigger` opens it (`ig:form:{acc}:{user}` holds `{form_id, idx, answers}`, 1h TTL), each reply advances the index, `cancel_trigger` aborts, and the final answer fires `end_message`. Forms always reply instantly (live chat feel).

#### Reminders

If a rule has `reminder/reminder_hours/reminder_message_id`, a due-time is scored into a Redis ZSET `ig:reminders`; the `ig_reminders` beat pops due payloads and sends the follow-up DM — a built-in drip/nurture.

### 13.7 AI publishing — topic → reel → live link

`src/instagram/publisher.py` + `autopilot.py` + `video_gen.py` form a content factory.

**Captions / full content.** `gen_caption()` and `gen_full_content()` call Claude with a forex-brand system prompt and parse strict JSON: `{title, video_prompt, caption, hashtags, keyword, reply_text}`. `suggest_topics()` returns a list of `{topic, keyword}` ideas. All are `system_replace=True` so the model is fully re-roled as the Coinepro content strategist.

**Branded covers.** `render_cover()` delegates to the locked pro engine `src/instagram/cover.py` (orange base, Archivo-Black back-text, Lalezar Persian, `#FFF600` yellow) so every panel-made cover matches the canonical "Real-Cover".

**Auto reels with voice + footage.** `video_gen.py`: Claude writes a 4–6 scene JSON storyboard (each scene has `spoken` narration, a `bg_query` for cinematic *forex* stock footage — crypto explicitly banned — and optional stat `count/unit`). A QC critic (`_qc_scenes`, "Oscar director + CapCut engineer") scores it 0–100 and triggers one revision if <70. The storyboard goes to the **chart-renderer** service (`CHART_RENDERER_BASE:8086`) which composes the vertical reel with **ElevenLabs voice** (the owner's cloned voice), subtitles and music, then writes `media_urls` back onto the `IgContent`.

**Publish.** `publish_content()` picks the upload kind from `post_type`/media (`story`→story, `reel`→`clip_upload`, >1 media→album, .mp4→video, else photo), loops over `account_ids` calling `/publish` per account, records `{media_pk, code, url}` (or error) per account into `result`, posts an optional `first_comment`, and supports **per-account custom captions** (`captions_custom`) plus appended hashtags.

**Self-wiring keyword→link.** This is the magic close-the-loop step. After a successful publish, `_wire_auto_reply()` reads `auto_reply_keyword/link/text`, creates an `IgMessage` (with a `🔗 دریافتِ لینک` link button) **and** an `IgAutoReply` bound to that exact post's `media_pk` (`specific_media`, `comment_after_dm=True`). So a reel that ends "comment ACADEMY to get the link" automatically gains a live rule that DMs the link to every commenter — generated and attached with zero manual steps.

**Scheduling + auto-delete.** `publish_due()` (beat `ig_publish_due`, every 60s) publishes `scheduled` content whose `scheduled_at` has passed (waiting if its `gen_video` isn't `ready` yet), and deletes posts whose `auto_delete_at` elapsed (story-like ephemerality for feed posts).

**Autopilot.** `IgAutopilot` + `run_due()` (beat every 120s): when `next_run_at` (computed in Tehran time, list of daily hours) is due, it rotates through **campaigns** (`{topic, keyword, link, cta}`) — falling back to legacy `topics`, and finally to 8 built-in forex content pillars (daily brief, trade autopsy, risk management, psychology, indicator myth-busting, news trading, basics, beginner mistakes) — picks a post type round-robin, calls `gen_full_content`, and creates a scheduled `IgContent` with video pending. The existing pipeline (generate video → publish → wire auto-reply) does the rest. Cursors (`topic_cursor`, `type_cursor`) guarantee variety. A daily `ig_learn` beat reweights winning styles from post performance.

### 13.8 The panel API surface (`/ig`)

All routes require `current_ig_user`, are owner-scoped, and honour the **per-feature permission lock**. `_require_perm(u, key)` blocks a feature the admin disabled (`accounts, smart_reply, content, autopilot, forms, inbox, ai`).

| Group | Routes |
|-------|--------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /me` |
| Accounts | `GET/POST /accounts`, `DELETE /accounts/{id}`, `POST .../smart-toggle`, `GET .../media`, `GET .../live` |
| Dashboard | `GET /dashboard` (7-day scoped stats) |
| Messages | CRUD `/messages` (account-scoped) |
| Auto-replies | CRUD + `toggle` `/auto-replies` |
| Forms | CRUD + `toggle` `/forms` |
| Inbox | `GET /accounts/{id}/inbox?kind=comment|direct` |
| Content | CRUD `/contents`, `POST .../publish`, `POST .../generate-video` |
| AI | `/ai/caption`, `/ai/cover`, `/ai/full-content`, `/ai/suggest-topics` |
| Cover studio | `/cover/fonts`, `/cover/search`, `/cover/render` |
| Autopilot | CRUD + `toggle` + `run-now` |
| Upload | `POST /upload` (≤30MB, png/jpg/webp/mp4 → `/api/public/ig-media/...`) |

Adding an account (`POST /accounts`) is the choreography that ties it all together: enforce `max_accounts`, normalise username, reject another tenant's handle (409), **encrypt** password+TOTP, call the worker `/login`, and on `challenge` return a flag so the UI asks for a code; on success cache profile (`ig_pk, full_name, avatar, followers`) and `session_path`. The `_call()` helper auto-injects `account_id` into every worker request and **self-heals**: on a `401 session_expired` it re-logins from the Fernet creds and retries once.

### 13.9 The admin "IG Users" control plane (`admin_ig_users.py`)

A separate, `require_role("admin")` section gives the operator total oversight:

* **`GET /` / `GET /overview`** — every tenant with a deep `_analytics()` rollup: posts published/scheduled/draft, DM & comment counts (30-day), total inbox, rules total/active, messages, forms, autopilots total/on, and online-account count — all attributed **per owner** by walking `account_id → owner_id` and JSONB `account_ids`.
* **`GET /{uid}/activity`** — a merged, time-sorted activity timeline (content sent, rules created, inbox handled, autopilot runs) with icons.
* **`GET /{uid}/password`** — reveal the tenant's panel password (Fernet decrypt).
* **CRUD** — create/update/delete tenants, set `max_accounts` (1–20), `is_active`, `notes`, and the **permission lock** (`PUT /{uid}/permissions`). The admin-seed user can't be renamed or deleted; deleting a user CASCADEs their IG accounts.

### 13.10 The frontend (`frontend/ig`, NovinHub-style)

A React 18 + Vite + Tailwind SPA (zustand store, TanStack Query, axios, lucide icons, Vazirmatn RTL fonts) served by nginx. Routes mirror the API: `Dashboard, Accounts, SmartReply, Content, Inbox, Forms, Autopilot, Cover`, behind a `/login` guard. `store.js` holds `me`, the active `account`, and token/refresh in `localStorage`; the axios client auto-attaches the bearer and redirects to `/login` on 401. It's the familiar NovinHub layout — account switcher, rule builder, content composer, inbox, autopilot — but multi-tenant and wired to the project's own worker.

### 13.11 How the main automation stays alive

The throughline of the whole suite: **isolation guarantees liveness of trading.**

* **Dedicated queue + worker.** IG tasks run only on the `ig` Celery queue via `celery-ig-worker` (concurrency 4, `--max-tasks-per-child=200`, 1 GB cap). Trading runs on its own `critical`/default queues. A slow `instagrapi` poll cannot delay a position close.
* **Dedicated execution container.** All Instagram I/O is funnelled through one `ig-worker` (1 vCPU / 1 GB, internal-only). If it wedges, it restarts in isolation; the trading bot never imports `instagrapi`.
* **Fresh loop + NullPool per task** prevents async/DB cross-contamination.
* **Fail-open Redis locks + `expires` on beats** prevent the queue-pileup failure mode that historically broke weekend auto-close.
* **Rate caps + spacing + session reuse** keep accounts un-banned without bursts.

The result is a genuinely separable product: a multi-tenant Instagram automation SaaS that shares only Postgres, Redis, the LLM client and the chart-renderer with the trading platform — and is firewalled, by design, from ever slowing the thing that actually moves money.

---

## ۱۳. سوئیتِ اتوماسیونِ اینستاگرام — پنلِ چنداکانتی و استخرِ ورکر

> یک محصولِ کاملِ اتوماسیونِ اینستاگرام در کلاسِ NovinHub که *درونِ* CoinePro-FX زندگی می‌کند — اما طوری مهندسی شده که هیچ کاری که می‌کند نتواند موتورِ تریدینگ را گرسنه بگذارد. این سوئیت پنلِ SaaSِ چنداکانتیِ خودش (`ig.trade-future.ir`)، میکروسرویسِ ورکرِ APIِ غیررسمیِ خودش (`ig-worker`)، صفِ Celeryِ مستقلِ خودش (`ig`)، فرانت‌اندِ React خودش (`frontend/ig`) و بخشِ مدیریتیِ «کاربران IG» را دارد. هر اکانت، سشن، قاعده و پستْ ایزولهٔ مالک و رمزنگاری‌شده است.

### ۱۳.۱ چرا اصلاً یک سوئیتِ جدا؟

اینستاگرام هیچ APIِ عمومی برای «اتو-دایرکت / اتو-کامنت» ندارد. برای پاسخِ کلیدواژه→لینک، ریلزِ زمان‌بندی‌شده، استیکرِ لینکِ استوری و انتشارِ AI باید APIِ **خصوصی/غیررسمیِ** موبایل را راند. پروژه از [`instagrapi`](https://github.com/subzeroid/instagrapi) استفاده می‌کند. دو محدودیتِ سختْ معماری را شکل داد:

۱. **`instagrapi` بلاکینگ و کند است.** یک `poll_dms()` می‌تواند چند ثانیه طول بکشد. اگر در همان پروسه/صفِ رباتِ تریدینگ اجرا می‌شد، یک تماسِ کندِ اینستاگرام می‌توانست بستنِ پوزیشن یا آلارمِ بازار را به تأخیر بیندازد. قاعدهٔ حافظهٔ *«ایزولاسیونِ صفِ celery»* دقیقاً به‌خاطرِ همین وجود دارد.

۲. **لاگین‌های غیررسمی به‌خاطرِ رفتارِ انفجاری بن می‌شوند.** ارسال‌ها باید نرخ‌دار و فاصله‌دار باشند، سشن‌ها باید بازاستفاده شوند (نه لاگینِ مجدد در هر اکشن)، و ۲FA/چالش باید با ظرافت مدیریت شود.

پاسخ، یک **تفکیکِ سه‌لایه** است:

| لایه | مؤلفه | رانتایم | کار |
|------|-------|---------|-----|
| لبه / UI | `frontend/ig` (React+Vite) | کانتینرِ nginx | پنلِ هر کاربر روی `/ig` |
| کنترل‌پلِین | `ig_panel.py` + `admin_ig_users.py` | FastAPI (`api`) | احراز، مالکیت، CRUD، کرِدِنشیالِ رمزنگاری‌شده |
| ارکستراسیون | `src/instagram/*` روی صفِ `ig` | `celery-ig-worker` (concurrency 4) | detect→enqueue→drain، خلبان، انتشار |
| اجرا | `ig-worker/app.py` (instagrapi) | کانتینرِ `ig-worker` | تنها پروسه‌ای که به اینستاگرام دست می‌زند |

```
React /ig ──HTTP──▶ FastAPI ig_panel ──┬─ Postgres (ردیف‌های ایزولهٔ مالک، کرِدِ Fernet)
                                        └─ ig-worker (کلاینت‌های instagrapi per-account)
                                              ▲
صفِ 'ig' در Celery (engine/publisher/autopilot) ┘   ← حلقه‌ها را می‌چرخاند، هرگز تریدینگ را بلاک نمی‌کند
```

کامنتِ compose صریح است: *«جدا از تریدینگ تا کندیِ instagrapi هیچ‌وقت بستنِ پوزیشن/پیامِ بازار را به تأخیر نیندازد»*.

### ۱۳.۲ مدلِ دادهٔ چنداکانتی

هر مستأجر یک `IGUser` است:

```python
class IGUser(Base):                      # مستأجرِ پنل
    username, password_hash              # لاگینِ خودش (bcrypt)
    max_accounts: int = 3                # حداکثر ۳ اکانتِ IG
    enc_login_password                   # نسخهٔ Fernet تا ادمین بتواند رمزِ پنل را ببیند
    permissions = JSONB                  # قفلِ per-feature؛ null = همه باز
    is_admin_seed, is_active, login_count, last_login_ip, last_active_at
```

هر اکانتِ متصل یک `IgAccount` است که دقیقاً **به یک** مستأجر تعلق دارد:

```python
class IgAccount(Base):
    owner_id  -> ig_users.id  ondelete="CASCADE"   # حذفِ کاربر → حذفِ اکانت‌هایش
    username  unique
    enc_password   # Fernet — رمزِ خامِ IG هرگز ذخیره نمی‌شود
    enc_totp       # Fernet — سکرتِ ۲FA برای self-healِ headless
    session_path   # sessions/{id}.json  (بازاستفادهٔ سشن/دیوایسِ instagrapi)
    status         # online/offline/challenge/error
    smart_enabled  # تاگلِ پاسخِ هوشمندِ همین اکانت
```

بقیهٔ جداول همگی `account_id`-اسکوپ‌اند (یا `account_ids` به‌صورتِ JSONB برای محتوای چنداکانتی):

| جدول | کاربرد |
|------|--------|
| `IgMessage` | پیامِ قابلِ‌استفادهٔ مجدد (متن/دکمه/فایل/ویترینِ محصول) |
| `IgAutoReply` | قاعدهٔ کلیدواژه («دستور») |
| `IgForm` | فرمِ دایرکتِ حالت‌دار (جریانِ پرسش‌وپاسخ) |
| `IgContent` | پست/ریلز/استوری/آلبوم (دستی، AI، خبر/بلاگ، یا خلبان) |
| `IgAutopilot` | زمان‌بندِ خودمختارِ محتوا |
| `IgInbox` | لاگِ هر کامنت/دایرکتِ ورودی + پاسخِ ارسالی (آمار + ضدِ تکرار با `ext_id`) |

**ایزولاسیونِ مالکیت** روی *هر* مسیرِ پنل اجبار می‌شود، نه فرض. دو دروازه‌بان:

```python
async def _owned(db, user, account_id) -> IgAccount:
    acc = ... where(IgAccount.id == account_id, IgAccount.owner_id == user.id)
    if not acc: raise HTTPException(404, "اکانت یافت نشد یا متعلق به شما نیست.")

async def _owned_ids(db, user) -> set[int]:   # مجموعه‌ای که مستأجر مجاز است لمس کند
    return {idهای IgAccount where owner_id == user.id}
```

برای محتوا/خلبان که از طریقِ `account_ids` (JSONB) به چند اکانت ارجاع می‌دهند، `_validate_account_ids()` هر idِ خارج از `_owned_ids` را رد می‌کند و فهرست‌ها با اشتراکِ مجموعه (`owned & set(c.account_ids)`) در پایتون فیلتر می‌شوند — پس یک مستأجر عملاً نمی‌تواند اکانتِ مستأجرِ دیگر را *ببیند*، چه برسد به انتشار رویِ آن.

### ۱۳.۳ احرازِ مستأجر (`scope="ig"`)

پنل از JWTِ پروژه استفاده می‌کند اما یک **scope** مهر می‌زند تا توکنِ IG هرگز روی مسیرهای ادمین یا پنلِ کاربری بازپخش نشود:

```python
# POST /ig/auth/login
return {"access_token": create_access_token({"sub": f"ig:{u.id}", "scope": "ig"}), ...}

async def current_ig_user(...):
    p = verify_access_token(token)
    if not p or p.get("scope") != "ig":      # ← گاردِ scope
        raise HTTPException(401, "توکن نامعتبر است.")
```

لاگین **روی یوزرنیم بی‌حساسیت به بزرگ/کوچک** است (`func.lower`) اما رمز حساس می‌ماند، و `login_count`، `last_login_ip` (با احترام به `x-forwarded-for`) و `last_active_at` ثبت/به‌روز می‌شوند. فرانت‌اند توکن را در `localStorage` (`cp_ig_token`) نگه می‌دارد و در هر ۴۰۱ به `/login` می‌پرد.

### ۱۳.۴ کرِدِنشیالِ رمزنگاری‌شده — Fernet در همه‌جا

سکرت‌های خام **هرگز** ذخیره نمی‌شوند. `src/core/crypto.py` رویِ `cryptography.fernet`:

```python
def _fernet():
    key = settings.USER_CREDS_ENC_KEY or derive_from(JWT_SECRET_KEY)  # 32B → urlsafe b64
    return Fernet(key)
encrypt_secret(plaintext) -> token
decrypt_secret(token) -> plaintext | None   # روی InvalidToken: None (هرگز کرش نمی‌کند)
```

سه سکرت از Fernet عبور می‌کنند:

* `IgAccount.enc_password` — رمزِ اینستاگرام، فقط برای (ری)لاگینِ ورکر.
* `IgAccount.enc_totp` — سکرتِ TOTPِ ۲FA تا ورکرِ headless با `pyotp` کد بسازد و سشنِ منقضی را بدونِ انسان self-heal کند.
* `IGUser.enc_login_password` — نسخهٔ برگشت‌پذیرِ رمزِ *پنل* تا ادمین بتواند آن را ببیند (`GET /ig-users/{uid}/password`). احرازِ واقعی با hash (bcrypt) است؛ نسخهٔ Fernet فقط راحتیِ ادمین است.

### ۱۳.۵ میکروسرویسِ `ig-worker` — تنها چیزی که به اینستاگرام دست می‌زند

`ig-worker/app.py` یک اپِ کوچکِ FastAPI است (`instagrapi==2.1.5`، `pyotp`، `moviepy`، `Pillow`). **فقط داخلی** است (شبکهٔ داکر، پورت 8090، بدونِ مسیرِ عمومی) و یک **استخرِ کلاینتِ per-account** دارد:

```python
_clients: dict[str, Client] = {}     # account_id -> کلاینتِ لاگین‌شدهٔ instagrapi
_locks:   dict[str, threading.Lock]  # account_id -> قفلِ مخصوصِ خودش
_info:    dict[str, dict]            # آخرین وضعیت/خطا per account
```

#### کلاینت + قفلِ per-account

`get_client(account_id)` قلبِ کار است:

۱. `aid = account_id or DEFAULT_ACCOUNT or "default"`.
۲. **قفلِ همان اکانت** را می‌گیرد (`_get_lock(aid)`) تا دو درخواست برای یک اکانت سریالایز شوند، اما اکانت‌های مختلف موازی بمانند.
۳. سشن را از `sessions/{aid}.json` بار می‌کند (`load_settings` — اثرِ دیوایس + کوکی، پس بدونِ لاگینِ تازه).
۴. سشن را با `cl.get_timeline_feed()` **اعتبارسنجی** می‌کند. اگر throw کرد، سشن مرده است.
۵. **Self-heal**: اگر کرِد در دسترس باشد (آرگ `creds`، یا فایلِ legacyِ `.igkey` برای اکانتِ پیش‌فرض)، یک کدِ TOTP می‌سازد، relogin و دوباره `dump_settings` می‌کند. وگرنه اکانت را `challenge` علامت می‌زند و `401 session_expired` می‌دهد.

```python
with _get_lock(aid):
    cl = _clients.get(aid) or _new_client_loading(spath)
    try:
        cl.get_timeline_feed()                 # پروبِ ارزانِ اعتبار
    except Exception:
        code = pyotp.TOTP(c["totp_secret"]).now() if c.get("totp_secret") else ""
        cl.login(c["username"], c["password"], verification_code=code)  # self-heal
        cl.dump_settings(spath)
    return cl
```

`delay_range = [1, 3]` روی هر کلاینت ست می‌شود تا instagrapi بینِ درخواست‌های خصوصی jitterِ انسانیِ ۱ تا ۳ ثانیه بزند.

#### فالبکِ legacyِ `DEFAULT_ACCOUNT`

خطِ بلاگ→استوری پیش از چنداکانتی بود و ورکر را **بدونِ** `account_id` صدا می‌زد. برای زنده‌نگه‌داشتنش، `IG_DEFAULT_ACCOUNT_ID=1` (اکانتِ مَسترِ `coineprofx`) در compose ست است. هر فیلدِ schema برابرِ `account_id: str | int | None = None` است؛ در نبودِ آن به پیش‌فرض می‌افتد. حتی یک مسیرِ مهاجرتِ یک‌باره وجود دارد: اگر `sessions/{default}.json` نباشد ولی `ig_session.json`ِ تک‌اکانتیِ قدیمی باشد، بار و در مسیرِ استخر dump می‌شود — **مهاجرت بدونِ relogin** (که ریسکِ چالش دارد).

#### لاگین / ۲FA / چالش

`POST /login` (وقتی مستأجر اکانت اضافه می‌کند):

```python
code = p.verification_code or (pyotp.TOTP(p.totp_secret).now() if p.totp_secret else "")
cl.login(p.username, p.password, verification_code=code)
# روی شکست، طبقه‌بندی:
challenge = any(s in msg.lower() for s in
    ("two_factor","twofactor","challenge","verification","checkpoint"))
return {"ok": False, "challenge": challenge, "error": msg[:300]}
```

پس سه خروجی به پنل برمی‌گردد: **ok** (آنلاین، پروفایل کش)، **challenge** (نیاز به کدِ ۲FA — UI باکسِ کد نشان می‌دهد)، یا **error** (رمزِ غلط). در موفقیت، سشن در `sessions/{account_id}.json` ذخیره و کلاینت کش می‌شود.

#### سطحِ endpointهای ورکر

| Endpoint | مصرف‌کننده | کار |
|----------|------------|-----|
| `GET /health` | healthcheckِ compose | `{ok, accounts_loaded, default}` |
| `GET /status` | بَجِ «live»ِ پنل | followers/following/media_count/avatar |
| `POST /login` `POST /logout` | افزودن/حذفِ اکانت | لاگین(+۲FA) / حذفِ سشن+کلاینت |
| `POST /publish` | publisher | عکس/آلبوم/ویدیو/**ریلز** (`clip_upload`)/**استوری** با استیکرِ لینک |
| `POST /delete` | حذفِ خودکار | `media_delete` |
| `POST /dm_send` `POST /dm_send_media` | engine | متن(+لینک) / عکس‌وویدیوی دایرکت |
| `POST /comment_reply` | engine | پاسخ زیرِ کامنت |
| `POST /poll_comments` `POST /poll_dms` | آشکارساز | دریافتِ کامنت/دایرکتِ جدید |
| `POST /user_media` | گریدِ پنل + قواعد | پست‌های اخیر (با کشِ per-account) |
| `POST /is_follower` | گیتِ فالو | چکِ دوستی |

دو ظرافتِ پروداکشنی: `_recent_media()` فهرستِ پستِ هر اکانت را ۹۰ ثانیه کش می‌کند (تا pollِ هرچندثانیه APIِ خصوصی را نکوبد)، و `/poll_comments` فقط پست‌های **مرتبط** را بررسی می‌کند (نه کلِ فید).

#### استیکرِ لینکِ استوری (لینکِ کلیک‌شونده)

`/publish` با `kind="story"` یک **استیکرِ لینکِ** واقعی (`StorySticker`) می‌سازد، URL را با درخواستِ خصوصیِ `media/validate_reel_url/` پیش‌اعتبارسنجی و با `link_x/y/w/h` جای‌گذاری می‌کند — قابلیتی که Graph APIِ رسمی پشتِ شرطِ ۱۰هزار فالوور/تأیید قفل کرده است.

### ۱۳.۶ موتورِ پاسخِ هوشمند — «آشکارساز → صف → فرستندهٔ نرخ‌دار»

`src/instagram/engine.py` مغز است، طوری که **هیچ‌چیز گم نشود** حتی زیرِ طوفانِ کامنت، و **هیچ اکانتی بن نشود**. سه beat:

```
ig_dm     هر ۲s  → detect_and_enqueue(scope="dm")      مسیرِ سریع: دایرکتِ فوری
ig_detect هر ۳s  → detect_and_enqueue(scope="comment") کامنت → صفِ Redis
ig_drain  هر ۲s  → drain_queue()                       ارسال از صف زیرِ سقفِ ساعتی
```

#### بهداشتِ loop

هر تسکِ Celery در یک event loopِ کاملاً تازه (`tasks._run`) با engineِ تازهٔ `NullPool` (`_task_db()`) و اتصالِ تازهٔ keepaliveِ Redis (`_ensure_redis()`) اجرا می‌شود. این عمدی است — کرشِ کلاسیکِ «Future attached to a different loop» را که کدِ asyncِ بازواردشده توسطِ Celery را آزار می‌دهد دور می‌زند، و از سوکت‌های idle-closedِ کهنه در pollهای طولانی جلوگیری می‌کند.

#### قفلِ ضدِ هم‌پوشانی

beatها هر ۲ تا ۳ ثانیه شلیک می‌کنند اما poll می‌تواند بیشتر طول بکشد. یک قفلِ `SET NX EX` در Redis از مسابقهٔ دو آشکارسازِ هم‌scope جلوگیری می‌کند؛ **fail-open** است (اگر Redis قطع بود، متوقف نکن). تسک‌ها `expires` (۸ تا ۱۰ ثانیه) دارند تا زمان‌بندِ شلوغ به‌جای تلنبار، تسکِ کهنه را دور بیندازد — همان درسِ ضدِ-تلنبار از حادثهٔ انفجارِ صف.

#### تطبیق

`match(rule, text)` از `equal`/`contains`/`any` پشتیبانی می‌کند و — به‌طورِ منحصربه‌فرد — **اوررایدِ مودِ per-keyword**: هر کلمه می‌تواند رشتهٔ ساده باشد (از مودِ قاعده) یا یک dictِ `{"mode","value"}` با مودِ خودش. `any` همه‌چیز را می‌گیرد (پاسخگوی فراگیر).

#### ضدِ تکرار + گاردِ بک‌لاگ

`IgInbox.ext_id` (`c:{comment_pk}` یا `d:{msg_id}`) کلیدِ idempotency است — `_seen()` پیش از اقدام چکش می‌کند، پس یک کامنت هرگز دوبار پاسخ نمی‌گیرد. گیتِ زمانی (`ts ≥ rule.created_at`) تضمین می‌کند قاعدهٔ نوساخته ناگهان به کامنت‌های ماه‌ها پیش پاسخ ندهد.

#### مسیرِ سریعِ دایرکت در برابرِ کامنتِ صف‌گذاری‌شده

* **دایرکت و فرم فوری ارسال می‌شوند** درونِ `detect_and_enqueue` (فرم گفتگوی زنده است؛ دایرکت مثلِ انسانی که در ~۲ تا ۳ ثانیه جواب می‌دهد). فقط اگر سقفِ ساعتی تمام شد، دایرکت به صف می‌افتد.
* **کامنت‌ها** اگر زیرِ سقف باشند فوری، وگرنه صف‌گذاری می‌شوند — تضمین می‌کند پستِ وایرال با صدها کامنتِ هم‌زمان هرگز از نرخِ امن نگذرد؛ سرریز تدریجی drain می‌شود.

#### نرخ‌دهی (ضدِ بن)

شمارندهٔ ساعتیِ `ig:sent:YYYYMMDDHH` (TTL ~۱h) با سقفِ قابلِ‌تنظیمِ `ig:rate_cap` (پیش‌فرض `۶۰/ساعت`) مقایسه می‌شود. `drain_queue` بودجه = `cap - used` را حساب می‌کند، حداکثر `min(batch, budget)` می‌فرستد و بقیه را برای تیکِ بعد در صف می‌گذارد. هر ارسالِ موفق `_rate_inc()` می‌کند.

#### دایرکتِ لینک-به‌صورتِ-کارت

اینستاگرامِ غیررسمی کارتِ دکمه رندر نمی‌کند، پس موتور دو ترفند دارد:

۱. `_compose_with_links()` با `🔗 {label}\n{url}` متن و لینک را در یک پیام چسبیده می‌کند.
۲. `_make_go_link()` یک لینکِ **OG-redirect** می‌سازد: `{label, url}` را در `ig:go:{code}` ذخیره و `{PUBLIC_SITE}/api/public/go/{code}` را برمی‌گرداند. آن endpointِ عمومی (`routes/public.py:go_link`) صفحهٔ HTMLِ Open-Graph می‌دهد که **عنوانش = متنِ دکمه** است، پس اینستاگرام هنگامِ unfurl یک کارتِ لینکِ واقعی با همان عبارتِ شما رندر می‌کند.

هر پاسخ فهرستی از **بخش‌ها** است (`_build_parts`): اول یک متنِ AI اختیاری (Claude با `system_replace=True`، اسکوپ‌شده به «دستیارِ پیجِ فارکسِ Coinepro»)، سپس هر `IgMessage`ِ انتخابی به‌ترتیب. `_send_parts` آن‌ها را می‌پیماید: رسانه با `/dm_send_media`، متن با `/dm_send`.

#### گیتِ فالو («اول فالو کن، بعد می‌فرستم»)

اگر قاعده `require_follow` داشته باشد، موتور `is_follower()` را چک می‌کند (کشِ ۱۲۰ ثانیه). اگر فالو نکرده، پیامِ فالو می‌فرستد + گیتِ ۲۴ساعتهٔ `ig:fg:{acc}:{user}` می‌گذارد. وقتی کاربر بعداً «فالو دارم/done/follow» می‌فرستد، آشکارساز **تازه** دوباره چک می‌کند؛ اگر حالا فالو کرده، محتوای واقعی آزاد می‌شود، وگرنه دوباره می‌پرسد. این یک ماشینِ حالتِ کامل است که حتی برای قواعدِ فقط‌کامنتی هم دایرکت را poll می‌کند تا آزادسازی را بگیرد.

#### فرم‌های حالت‌دار

`handle_form()` یک جریانِ پرسش‌وپاسخِ مبتنی‌بر Redis است: `start_trigger` بازش می‌کند (`ig:form:{acc}:{user}` شاملِ `{form_id, idx, answers}` با TTLِ ۱h)، هر پاسخ idx را جلو می‌برد، `cancel_trigger` لغو می‌کند و آخرین پاسخ `end_message` را شلیک. فرم همیشه فوری پاسخ می‌دهد.

#### یادآوری‌ها

اگر قاعده `reminder/reminder_hours/reminder_message_id` داشته باشد، زمانِ سررسید در ZSETِ `ig:reminders` score می‌خورد؛ beatِ `ig_reminders` سررسیده‌ها را pop و دایرکتِ پیگیری می‌فرستد — drip/پرورشِ توکار.

### ۱۳.۷ انتشارِ AI — موضوع → ریلز → لینکِ زنده

`publisher.py` + `autopilot.py` + `video_gen.py` یک کارخانهٔ محتوا می‌سازند.

**کپشن/محتوای کامل.** `gen_caption()` و `gen_full_content()` با system-promptِ برندِ فارکس Claude را صدا و JSONِ سخت پارس می‌کنند: `{title, video_prompt, caption, hashtags, keyword, reply_text}`. `suggest_topics()` فهرستِ `{topic, keyword}` می‌دهد. همه `system_replace=True`اند تا مدل کاملاً به استراتژیستِ محتوای Coinepro تبدیل شود.

**کاورِ برنددار.** `render_cover()` به موتورِ proِ قفل‌شدهٔ `cover.py` می‌سپارد (پس‌زمینهٔ نارنجی، نوشتهٔ پشتِ Archivo Black، فارسیِ Lalezar، زردِ `#FFF600`) تا هر کاوری عینِ Real-Cover باشد.

**ریلزِ خودکار با صدا + فوتیج.** `video_gen.py`: Claude یک storyboardِ JSONِ ۴ تا ۶ صحنه می‌نویسد (هر صحنه `spoken`، یک `bg_query` برای فوتیجِ سینماییِ *فارکس* — کریپتو صراحتاً ممنوع — و `count/unit`ِ اختیاری). یک منتقدِ QC (`_qc_scenes`، «کارگردانِ اسکار + مهندسِ کپ‌کات») آن را ۰ تا ۱۰۰ نمره می‌دهد و زیرِ ۷۰ یک اصلاح می‌زند. storyboard به سرویسِ **chart-renderer** (`:8086`) می‌رود که ریلزِ عمودی را با **صدای ElevenLabs** (صدای کلون‌شدهٔ مالک)، زیرنویس و موزیک می‌سازد و `media_urls` را روی `IgContent` می‌نویسد.

**انتشار.** `publish_content()` نوعِ آپلود را از `post_type`/رسانه انتخاب می‌کند (`story`→استوری، `reel`→`clip_upload`، >۱→آلبوم، .mp4→ویدیو، وگرنه عکس)، روی `account_ids` حلقه می‌زند و per-account `/publish` می‌کند، `{media_pk, code, url}` (یا خطا) را در `result` ثبت، `first_comment`ِ اختیاری می‌گذارد و **کپشنِ سفارشیِ per-account** (`captions_custom`) را پشتیبانی می‌کند.

**خود-اتصالِ کلیدواژه→لینک.** گامِ جادوییِ بستنِ حلقه. پس از انتشارِ موفق، `_wire_auto_reply()` فیلدهای `auto_reply_keyword/link/text` را می‌خواند، یک `IgMessage` (با دکمهٔ `🔗 دریافتِ لینک`) **و** یک `IgAutoReply`ِ متصل به `media_pk`ِ همان پست (`specific_media`، `comment_after_dm=True`) می‌سازد. پس ریلزی که با «کلمهٔ آکادمی را کامنت کن» تمام می‌شود، خودکار قاعده‌ای می‌گیرد که به هر کامنت‌گذار لینک را دایرکت می‌کند — بدونِ هیچ گامِ دستی.

**زمان‌بندی + حذفِ خودکار.** `publish_due()` (beatِ هر ۶۰s) محتوای `scheduled`ِ سررسیده را منتشر می‌کند (اگر `gen_video` هنوز `ready` نیست صبر می‌کند) و پست‌هایی که `auto_delete_at`شان گذشته را حذف می‌کند.

**خلبان.** `IgAutopilot` + `run_due()` (هر ۱۲۰s): وقتی `next_run_at` (به وقتِ تهران، فهرستِ ساعت‌های روزانه) سررسید، بینِ **کمپین‌ها** (`{topic, keyword, link, cta}`) می‌چرخد — با فالبک به `topics`ِ قدیمی و در نهایت ۸ ستونِ توکارِ محتوای فارکس (بریفِ روزانه، کالبدشکافیِ ترید، مدیریتِ ریسک، روان‌شناسی، افسانه‌زدایی، تریدِ خبری، مبانی، اشتباهاتِ تازه‌کار) — نوعِ پست را round-robin انتخاب، `gen_full_content` را صدا و یک `IgContent`ِ زمان‌بندی‌شده می‌سازد. خطِ تولیدِ موجود بقیه را انجام می‌دهد. مکان‌نماها (`topic_cursor`, `type_cursor`) تنوع را تضمین. beatِ روزانهٔ `ig_learn` سبک‌های برنده را بازوزن‌دهی می‌کند.

### ۱۳.۸ سطحِ APIِ پنل (`/ig`)

همهٔ مسیرها `current_ig_user` می‌خواهند، owner-scoped‌اند و **قفلِ per-feature** را رعایت می‌کنند. `_require_perm(u, key)` فیچرِ غیرفعال‌شده توسطِ ادمین را بلاک می‌کند (`accounts, smart_reply, content, autopilot, forms, inbox, ai`).

| گروه | مسیرها |
|------|--------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /me` |
| Accounts | `GET/POST /accounts`, `DELETE`, `smart-toggle`, `media`, `live` |
| Dashboard | `GET /dashboard` (آمارِ ۷روزهٔ اسکوپ‌شده) |
| Messages | CRUD `/messages` |
| Auto-replies | CRUD + `toggle` |
| Forms | CRUD + `toggle` |
| Inbox | `GET /accounts/{id}/inbox?kind=comment|direct` |
| Content | CRUD، `publish`، `generate-video` |
| AI | `caption`, `cover`, `full-content`, `suggest-topics` |
| Cover studio | `fonts`, `search`, `render` |
| Autopilot | CRUD + `toggle` + `run-now` |
| Upload | `POST /upload` (≤۳۰MB → `/api/public/ig-media/...`) |

افزودنِ اکانت (`POST /accounts`) رقصِ اتصال‌دهنده است: اعمالِ `max_accounts`، نرمال‌سازیِ یوزرنیم، ردِ هندلِ مستأجرِ دیگر (۴۰۹)، **رمزنگاریِ** رمز+TOTP، صدای ورکر `/login`، و روی `challenge` فلگ برمی‌گرداند تا UI کد بخواهد؛ روی موفقیت پروفایل کش می‌شود. هِلپرِ `_call()` خودکار `account_id` را به هر درخواست تزریق و **self-heal** می‌کند: روی `401 session_expired` از کرِدِ Fernet relogin و یک‌بار retry می‌کند.

### ۱۳.۹ کنترل‌پلِینِ «کاربران IG» در ادمین (`admin_ig_users.py`)

بخشی جدا با `require_role("admin")` به اپراتور اشرافِ کامل می‌دهد:

* **`GET /` / `GET /overview`** — هر مستأجر با rollupِ عمیقِ `_analytics()`: پست‌های منتشر/زمان‌بندی/پیش‌نویس، شمارشِ دایرکت و کامنت (۳۰روز)، کلِ اینباکس، قواعدِ کل/فعال، پیام‌ها، فرم‌ها، خلبان‌ها، و اکانت‌های آنلاین — همه **per owner** با پیمایشِ `account_id → owner_id` و JSONBِ `account_ids`.
* **`GET /{uid}/activity`** — تایم‌لاینِ ادغام‌شده و مرتب‌شدهٔ فعالیت (محتوا، قواعد، اینباکس، اجرای خلبان) با آیکن.
* **`GET /{uid}/password`** — نمایشِ رمزِ پنلِ مستأجر (decryptِ Fernet).
* **CRUD** — ساخت/ویرایش/حذفِ مستأجر، ستِ `max_accounts` (۱ تا ۲۰)، `is_active`، `notes` و **قفلِ دسترسی** (`PUT /{uid}/permissions`). کاربرِ admin-seed قابلِ تغییرِ نام/حذف نیست؛ حذفِ کاربر اکانت‌هایش را CASCADE می‌کند.

### ۱۳.۱۰ فرانت‌اند (`frontend/ig`، سبکِ NovinHub)

یک SPAِ React 18 + Vite + Tailwind (storeِ zustand، TanStack Query، axios، آیکن‌های lucide، فونتِ RTLِ Vazirmatn) که با nginx سرو می‌شود. مسیرها آینهٔ API: `Dashboard, Accounts, SmartReply, Content, Inbox, Forms, Autopilot, Cover`، پشتِ گاردِ `/login`. `store.js`، `me`، اکانتِ فعال و توکن/refresh را در `localStorage` نگه می‌دارد؛ کلاینتِ axios خودکار bearer می‌چسباند و روی ۴۰۱ به `/login` می‌برد. چیدمانِ آشنای NovinHub — سوییچرِ اکانت، سازندهٔ قاعده، آهنگسازِ محتوا، اینباکس، خلبان — اما چنداکانتی و متصل به ورکرِ اختصاصیِ پروژه.

### ۱۳.۱۱ چطور اتوماسیونِ اصلی زنده می‌ماند

محورِ کلِ سوئیت: **ایزولاسیون، زنده‌بودنِ تریدینگ را تضمین می‌کند.**

* **صف + ورکرِ اختصاصی.** تسک‌های IG فقط روی صفِ `ig` در `celery-ig-worker` (concurrency 4، `--max-tasks-per-child=200`، سقفِ ۱GB) اجرا می‌شوند. تریدینگ روی صف‌های `critical`/پیش‌فرضِ خودش است. pollِ کندِ `instagrapi` نمی‌تواند بستنِ پوزیشن را به تأخیر اندازد.
* **کانتینرِ اجرای اختصاصی.** کلِ I/Oِ اینستاگرام از یک `ig-worker` (۱ vCPU / ۱ GB، فقط داخلی) عبور می‌کند. اگر گیر کند، ایزوله ری‌استارت می‌شود؛ رباتِ تریدینگ هرگز `instagrapi` را import نمی‌کند.
* **loopِ تازه + NullPool per task** آلودگیِ متقاطعِ async/DB را می‌گیرد.
* **قفل‌های fail-openِ Redis + `expires` روی beatها** مودِ شکستِ تلنبارِ صف را — که تاریخاً auto-closeِ آخرِ هفته را شکست — می‌گیرند.
* **سقفِ نرخ + فاصله + بازاستفادهٔ سشن** اکانت‌ها را بدونِ انفجار از بن دور نگه می‌دارد.

نتیجه یک محصولِ واقعاً جداشدنی است: یک SaaSِ اتوماسیونِ اینستاگرامِ چنداکانتی که فقط Postgres، Redis، کلاینتِ LLM و chart-renderer را با پلتفرمِ تریدینگ به‌اشتراک می‌گذارد — و با طراحی، از کندکردنِ چیزی که واقعاً پول جابه‌جا می‌کند، فایروال شده است.

---

[⬅ 12. The VIP Academy & BazaarNama (+ NamaScript)](academy-bazaarnama.md) · [🏠 Home · خانه](../README.md) · [14. Content, SEO & AI Growth Engine ➡](content-seo.md)
