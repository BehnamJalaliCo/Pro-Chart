[⬅ 9. The API Layer — FastAPI Gateway, Routing, Auth & Real‑Time](api.md) · [🏠 Home · خانه](../README.md) · [11. The Web Front‑Ends & Copy‑Trading ➡](frontends.md)

---

## 10. The Telegram Bot — aiogram Delivery, Onboarding & Gated Access

> The Telegram bot is the **public face** of CoinePro-FX. It is the surface through which every user registers, is skill-tested, receives a trial, buys VIP access, and — most importantly — receives the trading signals produced by the engine, rendered as TradingView-style chart images with rich lifecycle alerts (TP1/TP2/TP3, break-even, trailing-stop, stop-loss). It is a fully asynchronous **aiogram 3.x** application (41 files under `src/bot/`) that runs as one or more polling workers, shares state on **Redis**, and bridges to the **FastAPI** backend and the **signal engine** purely through Redis pub/sub and Redis queues — the bot process is the *only* process that owns a `Bot` token, so anything that needs to send a Telegram message routes through it.

### 10.1 Architecture at a glance

```
                          ┌──────────────────────────────────────────────┐
                          │           Telegram (Bot API)                  │
                          └───────────────▲───────────────▲──────────────┘
                                          │ long-poll      │ send_*
                                          │                │
   ┌──────────────────────────────────────┴────────────────┴───────────┐
   │                       BOT WORKER  (run_bot.py)                       │
   │                                                                      │
   │  Dispatcher (FSM storage = RedisStorage, prefix "fsm")               │
   │   ├─ outer mw: RateLimitMiddleware  → 30 msg/min/user (Redis INCR)   │
   │   ├─ outer mw: MessageLoggingMiddleware → log + ban short-circuit    │
   │   ├─ inner mw: PhoneGateMiddleware → block until phone shared        │
   │   └─ routers: onboarding▸subscription▸profile▸referral▸support▸      │
   │               settings▸broker▸ai▸admin▸menu(catch-all)               │
   │                                                                      │
   │  background tasks (asyncio):                                         │
   │   ├─ event_consumer.run(bot)   ← BLPOP telegram:{events,             │
   │   │                               direct_messages, broadcasts}       │
   │   └─ signal_publisher.run(bot) ← SUBSCRIBE new_signals,              │
   │                                   signal_updates                     │
   └───────────▲───────────────────────────────▲─────────────────────────┘
               │ Redis queues (RPUSH)           │ Redis pub/sub (PUBLISH)
               │                                 │
       ┌───────┴────────┐               ┌────────┴─────────┐
       │  FastAPI API    │               │  Signal Engine   │
       │ (payments,users)│               │ (engine/tracker) │
       └─────────────────┘               └──────────────────┘
```

Two entry points construct the **same** dispatcher:

* `run_bot.py` — the production runner. It installs `uvloop` (`src.core.fast_loop.install_uvloop`), turns on structured logging, then calls `create_bot()` / `create_dispatcher()` from `src/bot/main.py` and starts polling. (`run_bot.py:38-41`, `run_bot.py:20-32`)
* `src/bot/main.py::main()` — an equivalent standalone path used in dev/tests. (`src/bot/main.py:167-180`)

Both register **the very same** `ALLOWED_UPDATES`, which deliberately includes `chat_member` and `chat_join_request` so the bot can verify when a user actually joins or leaves the VIP channel:

```python
# src/bot/main.py:164
ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "chat_join_request"]
```

#### Bot & Dispatcher construction (`src/bot/main.py:55-96`)

* `create_bot()` builds a `Bot` with `DefaultBotProperties(parse_mode=ParseMode.HTML)` — **HTML** is the default parse mode everywhere (so every formatter emits `<b>…</b>` markup).
* `create_dispatcher()` wires an **FSM store on Redis** so finite-state-machine context (the onboarding wizard, the payment wizard, the AI chat) is **shared across all workers**:
  ```python
  storage = RedisStorage.from_url(
      settings.REDIS_URL,
      key_builder=DefaultKeyBuilder(prefix="fsm", with_destiny=True),
  )
  dp = Dispatcher(storage=storage)
  ```
  This is the cornerstone of horizontal scaling: any worker can pick up any update for any user and still see the right FSM state.

#### Middleware ordering (critical)

```python
# src/bot/main.py:75-80
dp.update.outer_middleware(RateLimitMiddleware())      # 1. flood control
dp.update.outer_middleware(MessageLoggingMiddleware()) # 2. log + ban gate
dp.message.middleware(PhoneGateMiddleware())           # 3. phone gate (inner)
dp.callback_query.middleware(PhoneGateMiddleware())
```

* **Outer** middlewares run on the raw `Update` before routing — they can short-circuit the entire pipeline cheaply.
* **Inner** middlewares (the phone gate) run *after* routing resolution, so they have access to the per-user FSM `state` injected into `data`.

#### Router order (`src/bot/main.py:83-92`)

```
onboarding → subscription → profile → referral → support → settings → broker → ai → admin → menu
```

The order is intentional: **onboarding first** so FSM states win over generic menu matching, and **menu last** as the catch-all (it owns the `fallback` handler and the education browser). Each router is a self-contained `Router(name=…)` (10 routers total, confirmed in code).

#### Startup / shutdown lifecycle (`src/bot/main.py:99-160`)

`on_startup`:
1. `redis_client.connect()` (records `redis_ok`).
2. Only the worker whose `WORKER_ID == COMMAND_WORKER_ID` calls `set_my_commands(...)` — this avoids a race where N workers all try to register the command menu.
3. Writes a `worker:{id}:heartbeat` key (60 s TTL).
4. **If and only if Redis is up**, spawns the two background tasks: `event_consumer.run(bot)` always, and `signal_publisher.run(bot)` *only* when `settings.PUBLISH_SIGNALS_TO_CHANNEL` is true.

`on_shutdown` cleanly signals both loops to stop (`event_consumer.stop()` / `signal_publisher.stop()`), cancels and awaits the tasks, deletes the heartbeat, closes Redis and the bot session.

### 10.2 The three middlewares

#### RateLimitMiddleware (`src/bot/middlewares/rate_limit.py`)

A fixed one-minute window counter implemented with Redis `INCR` + `EXPIRE`:

```python
bucket = int(time.time() // 60)
key = f"rate:{uid}:{bucket}"
count = await redis_client.client.incr(key)
if count == 1:
    await redis_client.client.expire(key, 90)
if count > LIMIT:               # LIMIT = 30
    if count == LIMIT + 1 and event.message:
        await event.message.answer(texts.RATE_LIMITED)  # warn exactly once
    return None                 # drop silently afterwards
```

Crucially it is **fail-open** — any Redis exception lets the update through rather than locking the bot (`rate_limit.py:49-50`).

#### MessageLoggingMiddleware (`src/bot/middlewares/logging.py`)

* Extracts `(telegram_id, message_type, content)` from the `Update`. Contacts are logged as `"contact"` with the phone, commands (`/…`) as `"command"`, callbacks as `"callback"` with the callback data.
* Fires the DB write as a **non-blocking** `asyncio.create_task(log_message(...))` so logging never adds latency.
* Then runs the **ban gate**: if `User.is_banned`, it replies with `texts.BANNED` (or an alert for callbacks) and returns `None`, short-circuiting everything. Note the explicit design decision in the code comment: a ban means a ban, even for `/start`.

#### PhoneGateMiddleware (`src/bot/middlewares/phone_gate.py`)

This is the **mandatory phone-capture gate**, born from a real incident (the docstring records "۸۱۳ کاربر بدونِ شماره" — 813 users had abandoned onboarding without a phone number). The rule set:

* **Admins** (`uid in settings.admin_ids`) → always pass.
* Users **currently in onboarding** (state ∈ {`waiting_name`, `waiting_phone`, `quiz`}) → pass untouched, so the wizard can run.
* Users who **already have a phone** → pass. This is cached in Redis (`bot:phone_ok:{uid}`, 7-day TTL) to avoid a DB hit on every message (`_has_phone`, lines 38-55).
* Everyone else (no phone, not onboarding) is funnelled to the phone step:
  * A `Message` is allowed only if it is `/start`, a shared `contact`, or a text that `phone.normalize_iran()` accepts — otherwise the user is pushed back into `waiting_phone` and shown `texts.PHONE_REQUIRED_GATE` with the share-contact keyboard.
  * A `CallbackQuery` is allowed only if its data starts with `ob:` or `quiz:`; anything else gets an alert "ابتدا شمارهٔ موبایلت را ثبت کن" and the share-contact prompt.

Like the others, it is **fail-open** on Redis/DB errors (lines 85-86).

### 10.3 Onboarding & the gated funnel

The funnel is encoded as `OnboardingStates` (`src/bot/states.py`):

```
waiting_name → waiting_phone → quiz → (trial activated) → main menu
```

| Step | Trigger | Handler (`onboarding.py`) | Result |
|------|---------|---------------------------|--------|
| `/start` | `CommandStart()` / `CommandStart(deep_link=True)` | `cmd_start` (`:53`) | get-or-create user; resolve referral deep-link; if already registered → main menu, else welcome + "🚀 شروع ثبت‌نام" |
| Begin | `ob:start` | `start_onboarding` (`:78`) | set state `waiting_name`, ask name |
| Name | text in `waiting_name` | `receive_name` (`:85`) | validate against `_NAME_RE` (FA/EN letters, ≥3 chars), store, ask phone |
| Phone (contact) | `F.contact` | `receive_contact` (`:99`) | `phone.normalize_iran()`, store, start quiz |
| Phone (typed) | text in `waiting_phone` | `receive_phone_text` (`:110`) | same normalization path |
| Phone (anything else) | fallback | `waiting_phone_fallback` (`:123`) | re-ask phone — prevents escaping the mandatory step |
| Quiz start | `quiz:begin` | `quiz_begin` (`:138`) | send question 0 |
| Quiz answer | `quiz:{idx}:{opt}` | `quiz_answer` (`:144`) | record answer; advance or finish |

When the last question is answered, `_finish_onboarding` (`:192`) scores the quiz (`quiz.score` → `skill_level` → `skill_score_percent`), persists the profile via `users.complete_onboarding(...)`, sends the result card, and — if the user has no active subscription — **grants the trial** and posts the channel invite link.

#### Deep-link referral capture

`/start <code>` is handled in the same `cmd_start`: if the user is brand-new (`status == "new"`), `users.resolve_referrer(code)` maps the code to a referrer and `users.set_referred_by(...)` records the relationship (`onboarding.py:60-64`). Later, when this user *completes* onboarding, `maybe_grant_referral_reward` is consulted for the referrer (see §10.7).

### 10.4 Trial creation & gated/VIP access control

Access is centralised in `src/bot/services/access.py`. The trial is created by `create_trial` (`access.py:68-113`):

1. Insert a `Subscription(plan="trial", status="active", expires_at = now + TRIAL_HOURS)`.
2. Insert a `ChannelMember(status="invited", is_active=True)`.
3. Create a **single-use, expiring invite link** for the VIP channel and store it on the membership row.
4. Schedule **exact-time expiry** with Celery: `expire_trial.apply_async(args=[sub.id], eta=expires_at)` — and the periodic `sweep_subscriptions` task acts as a safety net if that ETA task is ever lost.

The invite link is produced by `channel.create_invite` (`src/bot/services/channel.py:30-49`), which uses Telegram's `create_chat_invite_link` with `member_limit=1` and an `expire_date`. A vital truth about Telegram is captured in the channel-service docstring: **a bot cannot add a user to a channel; it can only mint an invite link**, and removal is `ban` followed by `unban` (a "kick" that still lets the user rejoin later — `remove_member`, `:51-72`).

#### The four access-granting paths

| Function | When | Plan written | Expiry |
|----------|------|--------------|--------|
| `create_trial` | onboarding completes | `trial` | `now + TRIAL_HOURS` |
| `approve_payment` | admin approves a USDT payment | the purchased plan | `compute_expiry()` (stacks on remaining days) |
| `grant_free_vip` | admin `/freevip <id>` after broker-deposit | `free_lifetime` | `now + 36500d` (~forever) |
| `grant_free_signal_days` | admin gift of N channel days | `gift_trial` | `now + N days` |
| `maybe_grant_referral_reward` | referrer hits threshold | `referral_3m` | stacks +`REFERRAL_REWARD_DAYS` |

`compute_expiry` (`subscription.py:55-67`) is careful to **stack** renewals on top of any still-valid expiry instead of resetting from "now", so a user paying early never loses remaining days. `approve_payment` (`access.py:348-441`) takes a **row lock** (`with_for_update()`) so two admins clicking "approve" simultaneously cannot double-credit a payment, and it resets the reminder/expiry-processed flags so the renewed sub is correctly re-tracked.

#### How features check the gate

Every premium feature funnels through `get_active_subscription(telegram_id)` (`access.py:24-37`), which returns the newest non-expired `active` subscription or `None`. Examples:

* `my_signals` (`menu.py:42`): no sub → "buy subscription" keyboard; else shows status, remaining hours, and the stored invite link.
* `copy_trade` (`menu.py:86`): copy-trade is VIP-only; no sub → upsell, else opens the **WebApp** user panel.
* The AI assistant uses the sub to pick the daily quota: VIP gets `AI_CHAT_DAILY_QUOTA_VIP`, everyone else `AI_CHAT_DAILY_QUOTA` (`ai.py:68-79`).

### 10.5 Signal delivery — the heart of the bot

`signal_publisher.run(bot)` (`src/bot/services/signal_publisher.py:395-432`) subscribes to two Redis channels the engine publishes on — `new_signals` and `signal_updates` — and dispatches by payload `type`:

* `new_signal` → `_post_signal`
* `tp1_hit | tp2_hit | tp3_hit | signal_closed` → `_handle_update`

A single bad payload never kills the loop (`:422-423`).

#### Posting a new signal (`_post_signal`, `:156-263`)

1. **Dedup**: `SET signal:posting:{id} NX EX 120` (so two workers can't both post) plus an existence check on `signal:posted:{id}`. The "posted" flag is only set *after* a successful send, so a failed attempt never permanently blocks a signal.
2. **Freshness gate** (`_is_signal_still_fresh`, `:118-154`): a critical guard. Between the engine creating the signal and this moment (chart render + queue latency), the live price may already have hit the SL, or moved ≥ 60 % of the entry→SL distance (a stale entry with ruined R/R). If so, the signal is dropped and the active key removed. It is **fail-open**: missing price data never blocks a valid signal.
3. **Format** the caption with `format_channel_signal` (`:56-115`) — direction label + emoji, symbol + Persian name, timeframe, score /100, entry (zone or single price), SL, up to three TPs each with their R/R, and an analysis summary line (technical / pattern / ML scores, MTF confluence).
4. **Render the chart**: `render_signal_chart(signal)` (`chart_client.py:48-94`) pulls the last ~80 candles via `feed_manager.get_candles`, converts to lightweight-charts format, and POSTs to the `chart-renderer` service (`CHART_RENDERER_URL`, default `http://chart-renderer:8086/render`) with the entry/SL/TP overlay lines. Returns a PNG, or `None` on any error (**fail-soft** — text still goes out).
5. **Send**: if a chart exists and the caption ≤ 1024 chars → `send_photo(channel, photo, caption=text)`. If the text is longer, send the photo first then the text as a reply (avoids "caption too long"). `TelegramRetryAfter` is honoured by sleeping and retrying.
6. On success, store `signal:posted:{id}` and `signal:msg:{id}` (the message id) with a **14-day TTL** matched to `signal:active`, because `/ea/signals` only hands *posted* signals to the EA — the flag must outlive the signal.
7. **Expert narration**: unless `SIGNAL_NARRATION_ENABLED=False`, `narrate_signal` produces a Claude analysis posted as a *reply* to the signal. It is fully optional and wrapped so it can never break the signal post.

##### Example channel message (formatted by `format_channel_signal`)

```
🟢 سیگنال خرید | XAUUSD (طلا)
⏱ تایم‌فریم: H1  |  ⭐️ امتیاز: 78/100
━━━━━━━━━━━━━━━━━━━━
🔵 ورود: 2358.20 - 2359.10
🛑 حد ضرر: 2353.00
🎯 هدف ۱: 2364.50  (R/R 1.2)
🎯 هدف ۲: 2370.00  (R/R 2.1)
🎯 هدف ۳: 2378.00  (R/R 3.4)
━━━━━━━━━━━━━━━━━━━━
📊 تکنیکال 72 | الگو 65 | هوش مصنوعی 80
🔗 تأیید چند تایم‌فریم: H1+H4
⚠️ مدیریت ریسک و حجم معامله بر عهده‌ی شماست.
💎 CoinePro FX VIP
```
…attached as the caption of a TradingView-style chart PNG, with the Claude analysis arriving as a threaded reply.

#### Lifecycle updates (`_handle_update` + `format_update`, `:284-392`)

`format_update` produces **professionally worded** Persian alerts per `type`/`close_reason`, each carrying a result line (`_result_line`) showing pips and the dollar P/L per 1 standard lot:

| Event | Headline | Note |
|-------|----------|------|
| `tp1_hit` | ✅ هدف اول (TP1) تاچ شد! | "stop moved to entry — trade is now risk-free" |
| `tp2_hit` | ✅ هدف دوم (TP2) تاچ شد! 🚀 | "bank part, ride the rest to TP3" |
| `signal_closed` + `hit=TP3` | 🏆 هدف سوم — بسته شد! 🎉 | full win, duration shown |
| `signal_closed` + `TRAILING_SL` | 🔒 تریلینگ استاپ — سود قفل شد! | profit locked after TP1, **not** framed as a loss |
| `signal_closed` + `BREAKEVEN` | ⚖️ سربه‌سر — بدونِ ضرر بسته شد | zero loss at entry, not framed as a stop |
| `signal_closed` + `SL` | 🛑 حد ضرر فعال شد | controlled loss, risk-management framing |

Each update is sent as a **reply** to the original signal message (looked up via `signal:msg:{sid}`), falling back to a standalone message if the reply target is gone (`:364-392`).

### 10.6 The event consumer — bridging API → bot

The API has no `Bot` token, so anything user-facing it needs to do is pushed onto a Redis list and consumed here. `event_consumer.run(bot)` (`event_consumer.py:265-300`) does a `BLPOP` over three queues and **re-queues on failure** so events are never lost:

```python
_QUEUES = ("telegram:events", "telegram:direct_messages", "telegram:broadcasts")
```

| Queue | Producer | Action |
|-------|----------|--------|
| `telegram:direct_messages` | `routes/users.py` (admin DM) | `_handle_direct_message` → HTML-escape + `messaging.send` |
| `telegram:broadcasts` | admin panel | `_handle_broadcast` → fan-out to a target plan, write delivered/failed/total to DB + Redis |
| `telegram:events` | `routes/payments.py`, admin, referral | `_handle_event` dispatched on `action` |

`_handle_event` (`:190-262`) handles the access lifecycle end-to-end:

* `news_post` → `_post_news_to_channel` (title + clean summary + hashtag + 3 inline buttons; image or text fallback) on the **public** news channel.
* `subscription_approved` → mint invite link + DM the user "payment approved, here's your link".
* `referral_reward` → mint link + DM "you earned N months free".
* `subscription_rejected` → DM with the admin note.
* `subscription_cancelled` → `channel.remove_member` (kick) + mark membership removed + DM.

Outbound DMs go through `messaging.send` (`messaging.py:42-71`), which retries on `TelegramRetryAfter`, returns `False` on `TelegramForbiddenError` (user blocked the bot), and logs every outbound message into `bot_messages`.

### 10.7 Referrals, AI assistant, and other menu features

* **Referral** (`referral.py`): builds `https://t.me/<bot>?start=<code>`, shows a progress bar toward `REFERRAL_REWARD_THRESHOLD`, and on each *completed* referral `maybe_grant_referral_reward` (`access.py:116-190`) checks the threshold, dedups against an existing `referral_3m` sub, **stacks** the reward on the current expiry, and enqueues a `referral_reward` event so the consumer sends the link.
* **AI assistant** (`ai.py`): an `AIChatStates.chatting` FSM. It enforces a per-user **daily token quota** in Redis (`ai:quota:{uid}:{YYYYMMDD}`), a max input length, injects a live market snapshot only when `needs_market_data(text)` is true (token thrift), and calls `llm_client.complete(...)` with `system_replace=True` so Claude's identity is fully replaced by the market-analyst persona. Replies are sent as **plain text** to dodge parse errors.
* **Education** (`menu.py:161-248`): a 3-level browser (beginner / intermediate / advanced) reading published `Article` rows, with prev/next navigation and optional diagram cover images.
* **Market status** (`menu.py:120`): reads `redis_client.get_all_prices()` for the majors.
* **Channel membership tracking** (`menu.py:262-291`): the `chat_member` update handler flips `ChannelMember.status` to `active`/`removed` as users join/leave the VIP channel.

### 10.8 Admin controls & Celery-driven channel posts

Admin actions live in `admin.py`: the `/freevip <id>` command and the inline **approve/reject** buttons (`adm:pay:approve:{id}` / `adm:pay:reject:{id}`) attached to the payment-review card that `subscription.py::_forward_to_admins` sends to every `admin_id`. Each admin action verifies `_is_admin`, mutates state via `access.py`, then enqueues a `telegram:events` payload so the consumer delivers the user-facing result.

Scheduled channel content is driven by Celery tasks in `src/bot/tasks.py`, each spinning up a throwaway `Bot`:

* `expire_trial` / `sweep_subscriptions` — expire subs, send 3-day/1-day renewal reminders, and **kick orphan channel members** (active channel member with no active sub) as a safety net.
* `post_market_closed` — weekend "market closed" post.
* `post_weekly_report` — a Claude-authored weekly performance report posted to the VIP channel.
* `assess_news` — Claude news-risk assessment.

### 10.9 Backup delivery

Project backups are delivered over Telegram by a **dedicated backup bot** (separate `BACKUP_BOT_TOKEN` / `BACKUP_CHAT_ID`, not the user-facing token), driven by `scripts/hourly_backup.py`. It zips the core project plus a gzipped DB dump, **splits the archive into ≤ 48 MB parts** to fit Telegram's document limit, and `send_document`s each part to the owner's chat with a caption summarising part-count and size (`hourly_backup.py:86-110`). This complements the hourly `rclone` Google-Drive backup; the owner simply `/start`s the backup bot and receives the latest parts.

### 10.10 Command & handler reference

| Command / trigger | Router | Handler | Effect |
|-------------------|--------|---------|--------|
| `/start [code]` | onboarding | `cmd_start` | register / resume; capture referral deep-link |
| `/menu` | menu | `cmd_menu` | re-show main menu (requires completed onboarding) |
| `/help` | (registered command) | support | open support hub |
| `/freevip <id>` | admin | `cmd_free_vip` | grant lifetime VIP (admin only) |
| `ob:start` | onboarding | `start_onboarding` | begin name step |
| `quiz:begin`, `quiz:{i}:{opt}` | onboarding | `quiz_begin`, `quiz_answer` | run the skill quiz |
| `📊 سیگنال‌های من` | menu | `my_signals` | subscription status + channel link |
| `🔁 کپی‌ترید` | menu | `copy_trade` | open WebApp panel (VIP) |
| `💎 اشتراک VIP` → `sub:*` | subscription | plans / pay flow | choose plan, submit TxID |
| `adm:pay:approve|reject:{id}` | admin | `cb_approve` / `cb_reject` | approve/reject payment |
| `🤖 هوش مصنوعی فارکس` | ai | `ai_enter` / `ai_chat` | gated AI market chat |
| `🎓 آموزش فارکس` → `edu:*` | menu | education browser | lessons by level |
| `🤝 معرفی به دوستان` | referral | `show_referral` | referral link + progress |
| `chat_member` (VIP channel) | menu | `on_chat_member` | track join/leave |

---

## ۱۰. رباتِ تلگرام — تحویلِ سیگنال با aiogram، آن‌بوردینگ و دسترسیِ گِی‌ت‌شده

> رباتِ تلگرام **چهره‌ی عمومیِ** CoinePro-FX است. هر کاربر از همین‌جا ثبت‌نام می‌کند، آزمونِ سطح‌سنجی می‌دهد، دوره‌ی آزمایشی می‌گیرد، اشتراکِ VIP می‌خرد و — از همه مهم‌تر — سیگنال‌های تولیدشده توسطِ موتور را دریافت می‌کند: به‌صورتِ عکسِ چارتِ سبکِ TradingView به‌همراهِ هشدارهای کاملِ چرخه‌ی حیات (TP1/TP2/TP3، سربه‌سر، تریلینگ‌استاپ، حد ضرر). این یک اپلیکیشنِ کاملاً ناهمگامِ **aiogram 3.x** است (۴۱ فایل زیرِ `src/bot/`) که به‌صورتِ یک یا چند workerِ polling اجرا می‌شود، state را روی **Redis** به اشتراک می‌گذارد و فقط از طریقِ pub/sub و صف‌های Redis به بک‌اندِ **FastAPI** و **موتورِ سیگنال** پل می‌خورد — پروسه‌ی ربات **تنها** پروسه‌ای است که توکنِ `Bot` را در اختیار دارد، پس هر چیزی که نیاز به ارسالِ پیامِ تلگرامی داشته باشد از مسیرِ آن می‌گذرد.

### ۱۰.۱ نمای کلیِ معماری

```
                          ┌──────────────────────────────────────────────┐
                          │              تلگرام (Bot API)                 │
                          └───────────────▲───────────────▲──────────────┘
                                          │ long-poll      │ send_*
   ┌──────────────────────────────────────┴────────────────┴───────────┐
   │                       بات‌ ورکر  (run_bot.py)                        │
   │  Dispatcher (ذخیره‌سازِ FSM = RedisStorage، پیشوندِ "fsm")           │
   │   ├─ outer: RateLimitMiddleware  → ۳۰ پیام/دقیقه/کاربر (Redis INCR) │
   │   ├─ outer: MessageLoggingMiddleware → لاگ + قطعِ کاربرِ مسدود       │
   │   ├─ inner: PhoneGateMiddleware → تا شماره ندهد عبور نمی‌کند         │
   │   └─ routerها: onboarding▸subscription▸…▸admin▸menu (catch-all)      │
   │  تسک‌های پس‌زمینه (asyncio):                                         │
   │   ├─ event_consumer.run(bot)   ← BLPOP صف‌های telegram:*             │
   │   └─ signal_publisher.run(bot) ← SUBSCRIBE new_signals/updates       │
   └───────────▲───────────────────────────────▲─────────────────────────┘
               │ صف‌های Redis (RPUSH)            │ pub/sub رِدیس (PUBLISH)
       ┌───────┴────────┐               ┌────────┴─────────┐
       │  FastAPI API    │               │  موتورِ سیگنال    │
       └─────────────────┘               └──────────────────┘
```

دو نقطه‌ی ورود همان دیسپچرِ یکسان را می‌سازند:

* `run_bot.py` — اجراکننده‌ی production. `uvloop` را نصب می‌کند (`install_uvloop`)، لاگِ ساخت‌یافته را روشن می‌کند، سپس `create_bot()`/`create_dispatcher()` را از `src/bot/main.py` صدا می‌زند و polling را آغاز می‌کند. (`run_bot.py:38-41`)
* `src/bot/main.py::main()` — مسیرِ مستقلِ معادل برای dev/تست. (`main.py:167-180`)

هر دو همان `ALLOWED_UPDATES` را ثبت می‌کنند که عمداً `chat_member` و `chat_join_request` را شامل می‌شود تا ربات بتواند پیوستن/ترکِ واقعیِ کانالِ VIP را تأیید کند:

```python
# src/bot/main.py:164
ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "chat_join_request"]
```

#### ساختِ Bot و Dispatcher (`main.py:55-96`)

* `create_bot()` یک `Bot` با `parse_mode=HTML` می‌سازد — **HTML** پیش‌فرضِ همه‌جاست (پس همه‌ی فرمترها `<b>…</b>` تولید می‌کنند).
* `create_dispatcher()` یک **ذخیره‌سازِ FSM روی Redis** سیم‌کشی می‌کند تا کانتکستِ ماشینِ حالت (ویزاردِ ثبت‌نام، ویزاردِ پرداخت، چتِ AI) **بینِ همه‌ی workerها مشترک** باشد:
  ```python
  storage = RedisStorage.from_url(
      settings.REDIS_URL,
      key_builder=DefaultKeyBuilder(prefix="fsm", with_destiny=True),
  )
  ```
  این سنگ‌بنای مقیاس‌پذیریِ افقی است: هر worker می‌تواند هر آپدیتِ هر کاربری را بردارد و باز هم state درست را ببیند.

#### ترتیبِ میان‌افزارها (حیاتی)

```python
# main.py:75-80
dp.update.outer_middleware(RateLimitMiddleware())      # ۱. کنترلِ سیل
dp.update.outer_middleware(MessageLoggingMiddleware()) # ۲. لاگ + گیتِ مسدودیت
dp.message.middleware(PhoneGateMiddleware())           # ۳. گیتِ شماره (inner)
dp.callback_query.middleware(PhoneGateMiddleware())
```

* **outer**ها روی `Update`ِ خام پیش از مسیریابی اجرا می‌شوند و می‌توانند کلِ pipeline را ارزان قطع کنند.
* **inner** (گیتِ شماره) پس از مسیریابی اجرا می‌شود و به `state`ِ FSMِ کاربر در `data` دسترسی دارد.

#### ترتیبِ routerها (`main.py:83-92`)

```
onboarding → subscription → profile → referral → support → settings → broker → ai → admin → menu
```

ترتیب عمدی است: **onboarding اول** تا stateهای FSM بر منو اولویت بگیرند، و **menu آخر** به‌عنوان catch-all (مالکِ `fallback` و مرورگرِ آموزش). در مجموع ۱۰ routerِ مستقلِ `Router(name=…)`.

#### چرخه‌ی startup/shutdown (`main.py:99-160`)

`on_startup`:
1. `redis_client.connect()`.
2. تنها worker با `WORKER_ID == COMMAND_WORKER_ID` دستورات را با `set_my_commands` ثبت می‌کند تا raceِ ثبتِ هم‌زمانِ N worker رخ ندهد.
3. کلیدِ `worker:{id}:heartbeat` (TTL=۶۰ث) را می‌نویسد.
4. **فقط اگر Redis بالا باشد** دو تسکِ پس‌زمینه را می‌سازد: همیشه `event_consumer`، و `signal_publisher` را *فقط* وقتی `PUBLISH_SIGNALS_TO_CHANNEL` روشن است.

`on_shutdown` تمیز خاموش می‌کند: `stop()` هر دو حلقه، cancel و await تسک‌ها، حذفِ heartbeat، بستنِ Redis و سشنِ ربات.

### ۱۰.۲ سه میان‌افزار

#### RateLimitMiddleware (`rate_limit.py`)

شمارنده‌ی پنجره‌ی ثابتِ یک‌دقیقه‌ای با `INCR`+`EXPIRE`:

```python
bucket = int(time.time() // 60)
key = f"rate:{uid}:{bucket}"
count = await redis_client.client.incr(key)
if count == 1:
    await redis_client.client.expire(key, 90)
if count > LIMIT:               # LIMIT = 30
    if count == LIMIT + 1 and event.message:
        await event.message.answer(texts.RATE_LIMITED)  # هشدار فقط یک‌بار
    return None
```

حیاتی است که **fail-open** است — هر خطای Redis آپدیت را عبور می‌دهد تا ربات قفل نشود.

#### MessageLoggingMiddleware (`logging.py`)

* `(telegram_id, message_type, content)` را از `Update` استخراج می‌کند: مخاطب → `"contact"`+شماره، دستور (`/…`) → `"command"`، کال‌بک → `"callback"`.
* لاگِ DB را به‌صورتِ **غیرمسدودکننده** با `asyncio.create_task(...)` می‌نویسد تا تأخیری اضافه نشود.
* سپس **گیتِ مسدودیت**: اگر `User.is_banned` باشد، با `texts.BANNED` پاسخ می‌دهد و `None` برمی‌گرداند. طبقِ کامنتِ کد، مسدود یعنی مسدود — حتی برای `/start`.

#### PhoneGateMiddleware (`phone_gate.py`)

این **گیتِ اجباریِ ثبتِ شماره** است که از یک رخدادِ واقعی متولد شد (داک‌استرینگ: «۸۱۳ کاربر بدونِ شماره» آن‌بوردینگ را نیمه‌کاره رها کرده بودند). قوانین:

* **ادمین‌ها** → همیشه عبور.
* کاربرانِ **در حالِ onboarding** (state ∈ {`waiting_name`,`waiting_phone`,`quiz`}) → دست‌نخورده عبور.
* کاربرانِ **دارای شماره** → عبور؛ با کشِ Redis (`bot:phone_ok:{uid}`، TTL=۷روز) برای جلوگیری از کوئریِ هر پیام (`_has_phone`).
* بقیه به مرحله‌ی شماره هدایت می‌شوند:
  * `Message` فقط اگر `/start`، `contact`ِ شیرشده، یا متنی که `normalize_iran` بپذیرد، عبور می‌کند؛ وگرنه به `waiting_phone` برمی‌گردد و `PHONE_REQUIRED_GATE` + کیبوردِ ارسالِ مخاطب نشان داده می‌شود.
  * `CallbackQuery` فقط با دیتای `ob:`/`quiz:` عبور می‌کند؛ بقیه آلرت می‌گیرند.

این هم روی خطای Redis/DB **fail-open** است.

### ۱۰.۳ آن‌بوردینگ و قیفِ گِی‌ت‌شده

قیف در `OnboardingStates` کدگذاری شده:

```
waiting_name → waiting_phone → quiz → (فعال‌سازیِ trial) → منوی اصلی
```

| مرحله | تریگر | هندلر | نتیجه |
|------|------|-------|------|
| `/start` | `CommandStart()` | `cmd_start` (`:53`) | ساخت/بازیابیِ کاربر؛ resolve رفرالِ deep-link؛ اگر قبلاً ثبت‌نام کرده → منوی اصلی، وگرنه welcome |
| شروع | `ob:start` | `start_onboarding` (`:78`) | state=`waiting_name`، پرسشِ نام |
| نام | متن | `receive_name` (`:85`) | اعتبارسنجی با `_NAME_RE` (≥۳ کاراکتر)، پرسشِ شماره |
| شماره (مخاطب) | `F.contact` | `receive_contact` (`:99`) | `normalize_iran`، شروعِ آزمون |
| شماره (تایپی) | متن | `receive_phone_text` (`:110`) | همان مسیرِ نرمال‌سازی |
| هر چیزِ دیگر | fallback | `waiting_phone_fallback` (`:123`) | دوباره شماره بخواه — مانعِ فرار از مرحله‌ی اجباری |
| شروعِ آزمون | `quiz:begin` | `quiz_begin` (`:138`) | سوالِ ۰ |
| پاسخ | `quiz:{idx}:{opt}` | `quiz_answer` (`:144`) | ثبتِ پاسخ؛ بعدی یا پایان |

با پاسخِ آخرین سوال، `_finish_onboarding` (`:192`) آزمون را امتیازدهی می‌کند (`score`→`skill_level`→`skill_score_percent`)، پروفایل را با `users.complete_onboarding(...)` ذخیره می‌کند، کارتِ نتیجه را می‌فرستد و — اگر اشتراکِ فعالی نباشد — **trial** را می‌سازد و لینکِ دعوتِ کانال را پست می‌کند.

#### گرفتنِ رفرالِ deep-link

`/start <code>` در همان `cmd_start`: اگر کاربر کاملاً جدید باشد (`status=="new"`)، `resolve_referrer(code)` معرف را پیدا و `set_referred_by(...)` رابطه را ثبت می‌کند (`:60-64`). بعداً وقتی این کاربر ثبت‌نام را *کامل* کند، `maybe_grant_referral_reward` برای معرف بررسی می‌شود (§۱۰.۷).

### ۱۰.۴ ساختِ trial و کنترلِ دسترسیِ گِی‌ت‌شده/VIP

دسترسی در `src/bot/services/access.py` متمرکز است. `create_trial` (`:68-113`):

1. درجِ `Subscription(plan="trial", status="active", expires_at = now + TRIAL_HOURS)`.
2. درجِ `ChannelMember(status="invited", is_active=True)`.
3. ساختِ **لینکِ دعوتِ تک‌مصرفه‌ی منقضی‌شونده** و ذخیره‌ی آن روی رکوردِ عضویت.
4. زمان‌بندیِ **انقضای دقیق** با Celery: `expire_trial.apply_async(args=[sub.id], eta=expires_at)` — و تسکِ دوره‌ایِ `sweep_subscriptions` به‌عنوانِ تورِ امنیتی عمل می‌کند.

لینک را `channel.create_invite` (`channel.py:30-49`) با `member_limit=1` و `expire_date` می‌سازد. حقیقتِ فنیِ مهم در داک‌استرینگ: **ربات نمی‌تواند کاربر را مستقیم به کانال add کند؛ فقط لینکِ دعوت می‌سازد**، و حذف = `ban` سپس `unban` (kick) است (`remove_member`).

#### چهار مسیرِ اعطای دسترسی

| تابع | چه‌وقت | پلن | انقضا |
|------|------|------|------|
| `create_trial` | پایانِ آن‌بوردینگ | `trial` | `now + TRIAL_HOURS` |
| `approve_payment` | تأییدِ ادمینِ پرداختِ USDT | پلنِ خریداری‌شده | `compute_expiry()` (روی روزهای باقی‌مانده انباشته) |
| `grant_free_vip` | `/freevip <id>` پس از واریزِ بروکر | `free_lifetime` | `now + 36500d` (~همیشگی) |
| `grant_free_signal_days` | هدیه‌ی N روزه‌ی کانال | `gift_trial` | `now + N days` |
| `maybe_grant_referral_reward` | رسیدنِ معرف به آستانه | `referral_3m` | انباشته +`REFERRAL_REWARD_DAYS` |

`compute_expiry` (`subscription.py:55-67`) تمدید را روی هر انقضای هنوز معتبر **انباشته** می‌کند تا کاربری که زود می‌خرد، روزهای باقی‌مانده را از دست ندهد. `approve_payment` (`:348-441`) یک **قفلِ ردیف** (`with_for_update()`) می‌گیرد تا دو ادمین با کلیکِ هم‌زمان یک پرداخت را دوبار اعتبار ندهند.

#### چگونه فیچرها گیت را چک می‌کنند

هر فیچرِ پولی از `get_active_subscription(telegram_id)` (`:24-37`) عبور می‌کند که جدیدترین اشتراکِ `active`ِ منقضی‌نشده یا `None` را برمی‌گرداند:

* `my_signals` (`menu.py:42`): بدونِ اشتراک → کیبوردِ «تهیه اشتراک»؛ وگرنه وضعیت، ساعتِ باقی‌مانده و لینکِ دعوت.
* `copy_trade` (`menu.py:86`): کپی‌ترید فقط VIP؛ بدونِ اشتراک → upsell، وگرنه بازکردنِ **WebApp** پنلِ کاربری.
* دستیارِ AI سهمیه را از روی اشتراک انتخاب می‌کند: VIP → `AI_CHAT_DAILY_QUOTA_VIP`، بقیه → `AI_CHAT_DAILY_QUOTA` (`ai.py:68-79`).

### ۱۰.۵ تحویلِ سیگنال — قلبِ ربات

`signal_publisher.run(bot)` (`signal_publisher.py:395-432`) روی دو کانالِ Redisِ موتور — `new_signals` و `signal_updates` — subscribe می‌کند و بر اساسِ `type` توزیع می‌کند:

* `new_signal` → `_post_signal`
* `tp1_hit | tp2_hit | tp3_hit | signal_closed` → `_handle_update`

یک payloadِ خراب هرگز حلقه را نمی‌کشد (`:422-423`).

#### پستِ سیگنالِ جدید (`_post_signal`، `:156-263`)

1. **Dedup**: `SET signal:posting:{id} NX EX 120` (تا دو worker هم‌زمان پست نکنند) + چکِ `signal:posted:{id}`. فلگِ posted فقط *پس از* ارسالِ موفق ست می‌شود تا تلاشِ ناموفق سیگنال را برای همیشه بلاک نکند.
2. **گیتِ تازگی** (`_is_signal_still_fresh`، `:118-154`): محافظِ حیاتی. بینِ ساختِ سیگنال و این لحظه (رندرِ چارت + تأخیرِ صف)، اگر قیمتِ زنده SL را زده باشد یا ≥۶۰٪ مسیرِ ورود→SL نامساعد رفته باشد (ورودِ بیات، R/R خراب)، سیگنال دراپ می‌شود. **fail-open**: نبودِ قیمت هرگز سیگنالِ معتبر را بلاک نمی‌کند.
3. **فرمت** کپشن با `format_channel_signal` (`:56-115`): برچسبِ جهت + ایموجی، نماد + نامِ فارسی، تایم‌فریم، امتیاز /۱۰۰، ورود (زون یا تک‌قیمت)، SL، تا سه TP هرکدام با R/R، و خطِ خلاصه‌ی تحلیل (تکنیکال/الگو/ML، تأییدِ MTF).
4. **رندرِ چارت**: `render_signal_chart(signal)` (`chart_client.py:48-94`) آخرین ~۸۰ کندل را با `feed_manager.get_candles` می‌گیرد، به فرمتِ lightweight-charts تبدیل و به سرویسِ `chart-renderer` (`CHART_RENDERER_URL`، پیش‌فرض `http://chart-renderer:8086/render`) با خطوطِ Entry/SL/TP پست می‌کند. PNG یا `None` (**fail-soft**).
5. **ارسال**: اگر چارت باشد و کپشن ≤۱۰۲۴ کاراکتر → `send_photo(caption=text)`. اگر متن بلندتر بود، اول عکس بعد متن به‌صورتِ reply. `TelegramRetryAfter` با sleep+retry رعایت می‌شود.
6. در موفقیت، `signal:posted:{id}` و `signal:msg:{id}` با **TTLِ ۱۴روزه** (هم‌اندازه‌ی `signal:active`) ذخیره می‌شوند، چون `/ea/signals` فقط سیگنالِ *posted* را به EA می‌دهد.
7. **تحلیلِ کارشناسی**: مگر `SIGNAL_NARRATION_ENABLED=False`، `narrate_signal` یک تحلیلِ Claude به‌صورتِ *reply* به سیگنال پست می‌کند؛ کاملاً اختیاری و طوری wrap شده که هرگز سیگنال را خراب نکند.

##### نمونه‌ی پیامِ کانال

```
🟢 سیگنال خرید | XAUUSD (طلا)
⏱ تایم‌فریم: H1  |  ⭐️ امتیاز: 78/100
━━━━━━━━━━━━━━━━━━━━
🔵 ورود: 2358.20 - 2359.10
🛑 حد ضرر: 2353.00
🎯 هدف ۱: 2364.50  (R/R 1.2)
🎯 هدف ۲: 2370.00  (R/R 2.1)
🎯 هدف ۳: 2378.00  (R/R 3.4)
━━━━━━━━━━━━━━━━━━━━
📊 تکنیکال 72 | الگو 65 | هوش مصنوعی 80
🔗 تأیید چند تایم‌فریم: H1+H4
⚠️ مدیریت ریسک و حجم معامله بر عهده‌ی شماست.
💎 CoinePro FX VIP
```
…که به‌عنوان کپشنِ یک PNGِ چارتِ سبکِ TradingView می‌چسبد و تحلیلِ Claude به‌صورتِ replyِ نخ‌دار می‌آید.

#### آپدیت‌های چرخه‌ی حیات (`_handle_update` + `format_update`، `:284-392`)

`format_update` هشدارهای فارسیِ **حرفه‌ای** بر اساسِ `type`/`close_reason` می‌سازد، هرکدام با خطِ نتیجه (`_result_line`) شاملِ پیپ و سود/ضررِ دلاری به‌ازای هر ۱ لاتِ استاندارد:

| رویداد | تیتر | نکته |
|------|------|------|
| `tp1_hit` | ✅ هدف اول تاچ شد! | «حد ضرر به ورود منتقل شد — بدونِ ریسک» |
| `tp2_hit` | ✅ هدف دوم تاچ شد! 🚀 | «بخشی ذخیره، باقی تا TP3» |
| `signal_closed`+`TP3` | 🏆 هدف سوم — بسته شد! 🎉 | بردِ کامل، مدت نمایش داده می‌شود |
| `signal_closed`+`TRAILING_SL` | 🔒 تریلینگ استاپ — سود قفل شد! | سود قفل پس از TP1، **نه** به‌عنوانِ ضرر |
| `signal_closed`+`BREAKEVEN` | ⚖️ سربه‌سر — بدونِ ضرر | صفر ضرر در ورود |
| `signal_closed`+`SL` | 🛑 حد ضرر فعال شد | ضررِ کنترل‌شده، قابِ مدیریتِ سرمایه |

هر آپدیت به‌صورتِ **reply** به پیامِ اصلی (با `signal:msg:{sid}`) فرستاده می‌شود و در نبودِ هدفِ reply به پیامِ مستقل برمی‌گردد (`:364-392`).

### ۱۰.۶ مصرف‌کننده‌ی رویداد — پلِ API → ربات

API توکنِ `Bot` ندارد؛ پس هر کارِ کاربرپسندی را در یک لیستِ Redis می‌گذارد و این‌جا مصرف می‌شود. `event_consumer.run(bot)` (`:265-300`) روی سه صف `BLPOP` می‌زند و **در خطا requeue** می‌کند تا رویداد گم نشود:

```python
_QUEUES = ("telegram:events", "telegram:direct_messages", "telegram:broadcasts")
```

| صف | تولیدکننده | عمل |
|------|------|------|
| `telegram:direct_messages` | `routes/users.py` (DMِ ادمین) | `_handle_direct_message` → escape + `messaging.send` |
| `telegram:broadcasts` | پنلِ ادمین | `_handle_broadcast` → فن‌اوت به target_plan، ثبتِ delivered/failed/total در DB+Redis |
| `telegram:events` | payments/admin/referral | `_handle_event` بر اساسِ `action` |

`_handle_event` (`:190-262`) چرخه‌ی دسترسی را سرتاسر مدیریت می‌کند:

* `news_post` → `_post_news_to_channel` (تیتر + خلاصه‌ی تمیز + هشتگ + ۳ دکمه‌ی inline) روی کانالِ **عمومیِ** خبر.
* `subscription_approved` → ساختِ لینک + DMِ «پرداختت تأیید شد، این لینک».
* `referral_reward` → ساختِ لینک + DMِ «N ماه رایگان گرفتی».
* `subscription_rejected` → DM با یادداشتِ ادمین.
* `subscription_cancelled` → `channel.remove_member` (kick) + علامتِ removed + DM.

DMهای خروجی از `messaging.send` (`messaging.py:42-71`) می‌گذرند که روی `TelegramRetryAfter` retry می‌کند، روی `TelegramForbiddenError` (بلاک‌شدن) `False` برمی‌گرداند و هر خروجی را در `bot_messages` لاگ می‌کند.

### ۱۰.۷ معرفی، دستیارِ AI و سایرِ فیچرهای منو

* **معرفی** (`referral.py`): `https://t.me/<bot>?start=<code>` می‌سازد، نوارِ پیشرفت تا `REFERRAL_REWARD_THRESHOLD` نشان می‌دهد، و در هر معرفیِ *کامل‌شده* `maybe_grant_referral_reward` (`access.py:116-190`) آستانه را چک، با اشتراکِ `referral_3m`ِ موجود dedup، پاداش را روی انقضای فعلی **انباشته** و رویدادِ `referral_reward` را enqueue می‌کند.
* **دستیارِ AI** (`ai.py`): یک FSMِ `AIChatStates.chatting`. **سهمیه‌ی روزانه‌ی توکن** را در Redis (`ai:quota:{uid}:{YYYYMMDD}`) اعمال می‌کند، سقفِ طولِ ورودی دارد، snapshotِ زنده‌ی بازار را فقط وقتی `needs_market_data(text)` تزریق می‌کند (صرفه‌جوییِ توکن)، و `llm_client.complete(...)` را با `system_replace=True` صدا می‌زند تا هویتِ Claude کاملاً با نقشِ تحلیل‌گرِ بازار جایگزین شود. پاسخ‌ها **plain-text** ارسال می‌شوند.
* **آموزش** (`menu.py:161-248`): مرورگرِ سه‌سطحی (مقدماتی/متوسط/پیشرفته) از روی `Article`های منتشرشده، با ناوبریِ قبلی/بعدی و عکسِ دیاگرامِ اختیاری.
* **وضعیتِ بازار** (`menu.py:120`): `redis_client.get_all_prices()` برای majorها.
* **ردیابیِ عضویتِ کانال** (`menu.py:262-291`): هندلرِ `chat_member` با پیوستن/ترکِ کاربر، `ChannelMember.status` را به `active`/`removed` می‌برد.

### ۱۰.۸ کنترل‌های ادمین و پست‌های کانال با Celery

اکشن‌های ادمین در `admin.py`: دستورِ `/freevip <id>` و دکمه‌های inlineِ **تأیید/رد** (`adm:pay:approve:{id}`/`adm:pay:reject:{id}`) که به کارتِ بررسیِ پرداختِ `_forward_to_admins` چسبیده‌اند و به هر `admin_id` فرستاده می‌شوند. هر اکشن `_is_admin` را چک، state را با `access.py` تغییر و سپس یک payloadِ `telegram:events` enqueue می‌کند.

محتوای زمان‌بندی‌شده‌ی کانال با تسک‌های Celery در `src/bot/tasks.py` رانده می‌شود (هرکدام یک `Bot`ِ یک‌بارمصرف می‌سازند):

* `expire_trial` / `sweep_subscriptions` — انقضای اشتراک‌ها، یادآوریِ ۳روزه/۱روزه، و **کیکِ orphanها** (عضوِ فعالِ کانال بدونِ اشتراکِ فعال) به‌عنوانِ تورِ امنیتی.
* `post_market_closed` — پستِ «بازار بسته شد» آخرِ هفته.
* `post_weekly_report` — گزارشِ هفتگیِ عملکردِ نوشته‌ی Claude روی کانالِ VIP.
* `assess_news` — ارزیابیِ ریسکِ خبریِ Claude.

### ۱۰.۹ تحویلِ بکاپ

بکاپِ پروژه روی تلگرام توسطِ یک **رباتِ بکاپِ اختصاصی** تحویل می‌شود (توکنِ جدا `BACKUP_BOT_TOKEN`/`BACKUP_CHAT_ID`، نه توکنِ کاربری)، توسطِ `scripts/hourly_backup.py`. هسته‌ی پروژه + دامپِ gz‌شده‌ی DB را زیپ، آرشیو را به **قطعاتِ ≤۴۸MB** تقسیم (سقفِ سندِ تلگرام) و هر قطعه را با `send_document` و کپشنِ خلاصه (تعدادِ قطعات | حجم) به چتِ مالک می‌فرستد (`hourly_backup.py:86-110`). این مکملِ بکاپِ ساعتیِ `rclone` به Google Drive است؛ مالک کافی است رباتِ بکاپ را `/start` کند.

### ۱۰.۱۰ مرجعِ دستور و هندلر

| دستور / تریگر | Router | هندلر | اثر |
|------|------|------|------|
| `/start [code]` | onboarding | `cmd_start` | ثبت‌نام/ادامه؛ گرفتنِ رفرالِ deep-link |
| `/menu` | menu | `cmd_menu` | نمایشِ مجددِ منو (نیازمندِ آن‌بوردینگِ کامل) |
| `/help` | (دستورِ ثبت‌شده) | support | بازکردنِ هابِ پشتیبانی |
| `/freevip <id>` | admin | `cmd_free_vip` | اعطای VIPِ همیشگی (فقط ادمین) |
| `ob:start` | onboarding | `start_onboarding` | شروعِ مرحله‌ی نام |
| `quiz:begin`, `quiz:{i}:{opt}` | onboarding | `quiz_begin`, `quiz_answer` | اجرای آزمونِ سطح‌سنجی |
| `📊 سیگنال‌های من` | menu | `my_signals` | وضعیتِ اشتراک + لینکِ کانال |
| `🔁 کپی‌ترید` | menu | `copy_trade` | بازکردنِ پنلِ WebApp (VIP) |
| `💎 اشتراک VIP` → `sub:*` | subscription | پلن/پرداخت | انتخابِ پلن، ثبتِ TxID |
| `adm:pay:approve|reject:{id}` | admin | `cb_approve`/`cb_reject` | تأیید/ردِ پرداخت |
| `🤖 هوش مصنوعی فارکس` | ai | `ai_enter`/`ai_chat` | چتِ گِی‌ت‌شده‌ی AI |
| `🎓 آموزش فارکس` → `edu:*` | menu | مرورگرِ آموزش | جلسات بر اساسِ سطح |
| `🤝 معرفی به دوستان` | referral | `show_referral` | لینکِ معرفی + پیشرفت |
| `chat_member` (کانالِ VIP) | menu | `on_chat_member` | ردیابیِ پیوستن/ترک |

— پایانِ فصلِ ۱۰.

---

[⬅ 9. The API Layer — FastAPI Gateway, Routing, Auth & Real‑Time](api.md) · [🏠 Home · خانه](../README.md) · [11. The Web Front‑Ends & Copy‑Trading ➡](frontends.md)
