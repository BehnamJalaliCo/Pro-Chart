[⬅ 8. Backtesting, Walk‑Forward & Live‑Readiness Gating](backtesting.md) · [🏠 Home · خانه](../README.md) · [10. The Telegram Bot — aiogram Delivery, Onboarding & Access ➡](telegram-bot.md)

---

## 9. The API Layer — FastAPI Gateway, Routing, Auth & Real-Time

> *"One process, five front-ends, a dozen identity scopes."* — CoinePro-FX exposes a **single FastAPI application** (`src/api/main.py`) that simultaneously powers the public marketing website, the admin control panel, the VIP user copy-trade panel, the VIP forex academy (with the *BazaarNama* charting clone), and the independent multi-tenant Instagram automation panel — plus machine-to-machine surfaces for the MetaTrader 5 Expert Advisor and the Telegram bot. This chapter dissects that gateway exhaustively: app composition, the full router catalogue, dependency injection, middleware, the multi-scope authentication model, WebSockets, Prometheus instrumentation, and the nginx `/api` rewrite that lets one ASGI app fan out to five origins.

---

### 9.1 Application composition & lifespan

The application object is constructed in `src/api/main.py:111-118`:

```python
app = FastAPI(
    title="CoinePro Forex Signal API",
    description="ای‌پی‌آی پلتفرم سیگنال فارکس کوین‌پرو",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)
```

Two design decisions are visible immediately and they are both security-relevant:

1. **Self-documentation is environment-gated.** `/docs` (Swagger UI) and `/redoc` resolve to `None` whenever `settings.DEBUG` is false. In production (`DEBUG=false`, mandated by `CLAUDE.md`), the OpenAPI explorer is entirely absent — there is no interactive surface advertising every route to an attacker.
2. **Lifespan replaces the deprecated `@app.on_event` hooks.** The application uses the modern `contextlib.asynccontextmanager` lifespan (`main.py:72-108`).

#### The lifespan contract

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_client.connect()                 # main.py:83
    async with async_session_factory() as session:
        await session.execute(text("SELECT 1"))  # main.py:90-92  — DB reachability probe
    yield
    await redis_client.close()                   # main.py:103  — graceful Redis shutdown
```

The startup sequence is **fail-fast**: if Redis cannot be reached (`main.py:85-87`) or the database `SELECT 1` probe fails (`main.py:94-96`), the exception is *re-raised*, which aborts boot. The container therefore never reaches a "running but broken" state where it would accept traffic it cannot serve. Conversely, shutdown is **fail-soft** — a failure to close Redis (`main.py:105-106`) is logged at `warning` and swallowed, because a half-closed connection should not block a clean process exit.

#### Middleware registration order (this matters)

Middleware in Starlette executes **outermost-first on the way in, innermost-first on the way out**, and the *last* `add_middleware` call becomes the *outermost* layer. The ordering in `main.py:120-129` is deliberate and commented:

```python
app.add_middleware(SecurityHeadersMiddleware, enable_hsts=not settings.DEBUG)  # 1st added
app.add_middleware(RateLimitMiddleware)                                        # 2nd added
setup_cors(app)   # CORS added LAST → becomes the OUTERMOST layer
```

The inline comment (`main.py:126-128`) explains the non-obvious reason CORS must be outermost: *if `RateLimitMiddleware` returns a 429 from an inner layer, that response must still pass back out through the CORS layer so the browser receives `Access-Control-*` headers.* If CORS were inner, a rate-limited browser request would surface as an opaque CORS error instead of an honest "429 Too Many Requests", confusing both users and front-end error handling. HSTS being innermost means **every** response (including 429s and 401s emitted by inner middleware) is still stamped with security headers.

The Prometheus middleware is registered separately via the `@app.middleware("http")` decorator (`main.py:132`), which places it *inside* the three `add_middleware` layers but still wrapping every route handler — so latency/count metrics include handler time but exclude rate-limit rejection cost.

---

### 9.2 Prometheus instrumentation

Two metric families are declared at module scope (`main.py:60-69`):

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `http_requests_total` | `Counter` | `method`, `endpoint`, `status_code` | request volume & error-rate slicing |
| `http_request_duration_seconds` | `Histogram` | `method`, `endpoint` | latency distribution / p95-p99 |

The middleware (`main.py:132-159`) times each request with `time.perf_counter()` and records both metrics. The subtle correctness detail is **cardinality control** (`main.py:146-150`):

```python
route = request.scope.get("route")
endpoint = getattr(route, "path", None) or request.url.path
```

Rather than labelling by the *raw* URL path (`/signals/4711`), it labels by the **route template** (`/signals/{signal_id}`). The matched `route` object only appears in the ASGI `scope` *after* `call_next` has dispatched, which is why the metric is recorded post-dispatch. Without this, every signal ID, article slug, and user ID would mint a new time-series and explode Prometheus memory. The fallback to `request.url.path` covers 404s where no route matched.

Metrics are exposed at **`GET /metrics`** (`main.py:199-207`) — and crucially, the endpoint is `include_in_schema=False` *and* guarded by `Depends(get_current_admin)`. Internal operational telemetry is not anonymously scrapable; a Prometheus server must present an admin bearer token.

---

### 9.3 The `/health` endpoint

`GET /health` (`main.py:162-196`) is the orchestration liveness/readiness probe. It independently pings the database (`SELECT 1`) and Redis (`redis_client.client.ping()`), then returns:

- **`200` + `{"status":"healthy"}`** only if *both* succeed;
- **`503` + `{"status":"degraded"}`** if either dependency is down, with per-dependency `"connected"`/`"disconnected"` fields.

It is intentionally listed in `RateLimitMiddleware.EXCLUDED_PATHS` (`rate_limit.py:86`) so health probes are never throttled.

---

### 9.4 The router catalogue

The single app mounts **34 routers** (`main.py:210-243`). They are organised here by *front-end surface* rather than registration order. Every prefix below is the **server-side** prefix; recall (§9.10) that nginx strips a leading `/api` before proxying, so the browser calls e.g. `/api/academy/me` while FastAPI sees `/academy/me`.

#### 9.4.1 Website (public, unauthenticated) surface

| Router | Prefix | Representative routes | Notes |
|---|---|---|---|
| `public` | `/public` | `/auth/config`, `/auth/telegram`, `/signals/active`, `/signals/recent`, `/signals/stats`, `/backtest/simulate`, `/prices/live`, `/go/{code}`, `/track`, `/edu-asset/{f}`, `/edu-video/{f}`, `/ig-media/{f}`, `/icon` | The marketing site's read-only data + asset proxy + click-tracking |
| `seo` | *(none — domain root)* | `/sitemap.xml`, `/sitemap-pages.xml`, `/sitemap-articles.xml`, `/rss.xml`, `/robots.txt`, `/indexnow-key.txt`, `/seo/render/{path}` | Mounted with **no prefix** (`main.py:217`) so files live at the domain root, as crawlers require |
| `articles` | `/articles` | `GET /`, `GET /{slug}`, `GET /{slug}/related`, `POST /`, `PUT /{id}`, `DELETE /{id}` | Blog/SEO content; reads are public, writes admin-gated |
| `live_prices` | `/ws` | `WS /prices` | Public WebSocket price stream |
| `performance` | `/performance` | win-rate / equity stats | Public KPI surface |

The `seo` router is the only one mounted at the bare domain root. Its `/seo/render/{full_path:path}` route (`seo.py:468-469`) is the **dynamic-rendering** endpoint nginx routes crawler user-agents to, returning pre-rendered HTML for SPA routes so Googlebot indexes article pages.

#### 9.4.2 Admin panel surface (`Admin` JWT, RBAC)

| Router | Prefix | Scope of responsibility |
|---|---|---|
| `auth` | `/auth` | login / refresh / logout / me (the admin identity provider) |
| `admin` | `/admin` | `/stats`, `/services`, `/services/{name}/restart` |
| `panel` | `/admin` | **The mega-router** — dashboard, signals CRUD, users, EA config, articles, broadcasts, settings, performance, monitoring, ML models, panel-users, trailing-monitor (≈80 endpoints) |
| `bot_admin` | `/admin` | Telegram-bot dashboard |
| `signals` | `/signals` | `GET /`, `/active`, `/{id}`, `POST /{id}/close`, `POST /manual`, `PATCH /{id}` |
| `users` | `/users` | user roster, export, plan/ban/unban, message, grant-signal-access |
| `risk` | `/admin/risk` | risk-manager controls |
| `launch` | `/admin/launch` | paper→live launch gate |
| `reports` | `/admin/reports` | advanced reporting |
| `payments` | `/admin/payments` | payment approvals |
| `subscriptions` | `/admin/subscriptions` | subscription management |
| `analytics` | `/admin/analytics` | visitor analytics (`/overview`, `/live`, `/online`) |
| `trade_history` | `/admin/trade-history` | real P&L history (`GET /`, `/daily`, `/stats`, `/export`, `/performance`, `/validation`) |
| `seo_admin` | `/admin/seo` | Search-Console + PageSpeed dashboard |
| `monitoring` | `/monitoring` | system monitoring |
| `settings` | `/settings` | global settings |
| `backtest` | `/backtest` | backtest runs (`/runs` CRUD, `202 Accepted` async kickoff) |

Note the **multiple routers sharing the `/admin` prefix** (`admin`, `panel`, `bot_admin`). FastAPI merges them into one path space; `panel.py` is the canonical data source that returns payloads in the exact **camelCase** shape the React admin front-end expects (`main.py:233-235` comment), while the leaner Python-native routers (`signals`, `users`) serve snake-case API consumers.

#### 9.4.3 User panel surface (`user` scope JWT)

| Router | Prefix | Representative routes |
|---|---|---|
| `user_panel` | `/user` | `/auth/config`, `/auth/telegram`, `/auth/webapp`, `/auth/request-otp`, `/auth/verify-otp`, `/me`, `/disclaimer`, `/kyc`, `/account/link`, `/copy-config`, `/copy-status`, `/copy/stop`, `/copy/close-all`, `/history`, `/subscription`, `/economic-calendar`, `/ai/chat`, `/trade-history*`, `/notifications` |

This is the VIP copy-trade panel — Telegram login → email-OTP confirmation → KYC → broker-account link → paper/live copy engine.

#### 9.4.4 Academy surface (`academy` scope JWT)

| Router | Prefix | Highlights |
|---|---|---|
| `academy` | `/academy` | `/auth/login`, `/auth/register/request`, `/auth/register/verify`, `/devices`, `/catalog`, `/lesson/{slug}`, `/video/{id}`, `/progress`, `/quiz`, `/journal`, `/community`, `/leaderboard`, `/streak`, `/achievements`, `/backtest`, `/chart/*`, `/paper/*`, `/practice/*` (≈90 endpoints) |
| `bazaarnama` | `/academy/bn` | `/prices`, `/layouts`, `/scripts` (NamaScript), `/watchlist`, `/alerts`, `/ai-signal*` — the Iranian TradingView clone, nested *under* the academy auth scope |
| `admin_academy` | `/admin/academy` | admin CRUD for students/lessons/payments/community |

`bazaarnama` lives at `/academy/bn` precisely because every BazaarNama route sits **behind the student (`scope=academy`) auth** (`bazaarnama.py` header comment) — it is not a separate auth domain, just a feature module of the academy.

#### 9.4.5 Instagram surface (`ig` scope JWT)

| Router | Prefix | Highlights |
|---|---|---|
| `ig_panel` | `/ig` | `/auth/login`, `/auth/refresh`, `/me`, `/accounts*` (≤3 per user), `/messages`, `/auto-replies`, `/inbox`, `/forms`, `/contents`, `/ai/*`, `/cover/*`, `/autopilots*` — the multi-tenant NovinHub-style panel |
| `admin_ig_users` | `/admin/ig-users` | owner-side management of IG tenants (`GET /`, `/overview`, `/{uid}`, `/{uid}/activity`, `POST /`, permissions) |

#### 9.4.6 Machine-to-machine & real-time surfaces

| Router | Prefix | Auth | Purpose |
|---|---|---|---|
| `ea` | `/ea` | static `EA_TOKEN` (HMAC const-time) | The MT5 Expert Advisor reads `/signals`, posts `/heartbeat`, `/deals`, `/specs`, `/symbols` |
| `live` | `/live` | Telegram-login token **or** admin token | Live-trading stream: `/config`, `/auth/telegram`, **`WS /ws/chat`**, `/admin/*` controls |
| `broadcasts` | `/broadcasts` | admin | message broadcasting |

---

### 9.5 Dependency injection

CoinePro-FX leans heavily on FastAPI's `Depends` to keep handlers thin and to centralise cross-cutting concerns. The shared dependencies live in `src/api/deps.py`.

#### `get_db` — the session-per-request unit of work

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:   # deps.py:27-48
    async with async_session_factory() as session:
        try:
            yield session
            if session.in_transaction():
                await session.commit()
        except Exception:
            if session.in_transaction():
                await session.rollback()
            raise
        finally:
            await session.close()
```

The contract documented in the docstring is strict and unusual: **handlers must not commit themselves** — the dependency commits at the end of the request *only if a transaction is still open* (`deps.py:41-42`). The `in_transaction()` guard prevents the classic "commit after commit" error when a handler has already committed (e.g. the academy login flow that calls `await db.commit()` explicitly at `academy.py:183`). Any exception triggers an automatic rollback, giving every request transactional all-or-nothing semantics.

#### `get_redis` — fail-loud connection accessor

`get_redis` (`deps.py:51-65`) returns the live client or raises **`503 Service Unavailable`** if Redis is not connected. Handlers that need Redis declare `redis=Depends(get_redis)` and never touch the global directly, so a Redis outage surfaces as a clean 503 rather than an `AttributeError` 500.

#### `get_current_admin` — the admin identity guard

`get_current_admin` (`deps.py:82-148`) is the workhorse for the entire admin surface. Its pipeline:

1. Extract bearer credentials via `HTTPBearer()` (`deps.py:24`).
2. `verify_access_token(token)` → must decode *and* be `type=access` (else `401`).
3. Extract `sub` (admin id); missing → `401`.
4. **Token-blacklist check (fail-secure)** — if the token's `jti` is present and `token_blacklist:{jti}` exists in Redis, reject with `401` (revoked). The critical hardening (`deps.py:121-130`): if the Redis lookup itself *throws*, the request is rejected with **`503`, not allowed through**. The comment is explicit — this stops an attacker from using a Redis outage to bypass logout/revocation.
5. Load the `Admin` row; not found → `401`; `is_active=False` → `403`.

#### `require_role` — RBAC factory

The role hierarchy (`deps.py:69-79`) is a totally-ordered ladder:

```python
_ROLE_HIERARCHY = {"viewer": 1, "analyst": 2, "admin": 3, "superadmin": 4}
```

`require_role("superadmin")` returns a dependency (`deps.py:151-178`) that builds on `get_current_admin` and asserts the caller's role *satisfies-or-exceeds* the requirement via `_role_satisfies` (`deps.py:77-79`). A `superadmin` therefore implicitly passes every `admin`/`analyst`/`viewer` gate. Denials are logged with `rbac_denied` structured fields for audit.

#### Per-surface identity dependencies

Each non-admin front-end has its own lightweight `current_*` dependency rather than reusing `get_current_admin`, because each carries a **different scope** and resolves a **different DB model**:

| Dependency | File:line | Scope checked | Model resolved | Extra checks |
|---|---|---|---|---|
| `current_student` | `academy.py:90-110` | `academy` | `AcademyStudent` | status `active`; **device validity** via `did` claim vs `AcademyDevice` |
| `require_vip` | `academy.py:142-147` | (wraps `current_student`) | — | tier rank ≥ 1 (active VIP/premium), else `403` |
| `current_user` | `user_panel.py:~129` | `user` | `User` (by `telegram_id`) | VIP/paid gating |
| `current_ig_user` | `ig_panel.py:62-67` | `ig` | `IGUser` | ownership guard |

The academy's `current_student` is the most elaborate: tokens minted after the device-tracking feature carry a `did` (device id) claim, and the dependency re-validates that the device still exists for the student (`academy.py:104-109`). If an admin (or the user) removed that device, the token is rejected with a "this device was removed" message — enabling true remote logout per device while honouring the 2-device concurrency cap (`MAX_DEVICES`).

---

### 9.6 Authentication & JWT — one secret, many scopes

All tokens are HS256 JWTs minted from a single `JWT_SECRET_KEY` (`config.py:225-228`; `JWT_ALGORITHM=HS256`, access TTL 30 min, refresh TTL 7 days). What differentiates the front-ends is **not** separate keys but the **`scope` claim** baked into each token. `src/core/security.py` is the single mint/verify authority.

#### Token creation

```python
def create_access_token(data, expires_delta=None):       # security.py:32-45
    to_encode.update({
        "exp": expire, "iat": now,
        "jti": uuid.uuid4().hex,   # ← unique id → precise blacklist
        "type": "access",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
```

Every token gets a unique **`jti`** (`security.py:42`), which is the linchpin of the per-token revocation model: logout/rotation blacklists the *specific* `jti` with a TTL equal to the token's remaining lifetime, so other sessions on other devices survive. Both access and refresh tokens carry a `type` claim (`access`/`refresh`).

#### Token verification & type-confusion defence

```python
def verify_access_token(token):    # security.py:72-77
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None
```

`verify_access_token` and `verify_refresh_token` (`security.py:80-85`) both decode *and* assert the `type` claim. This closes the **type-confusion** class of bugs — a refresh token can never be replayed as an access token, and vice-versa. The auth-router refresh flow's comment (`auth.py:116-119`) records that this was a deliberate Phase-8 fix (bug "S-1").

#### The scope namespace

| Scope | Issued by | `sub` format | Front-end |
|---|---|---|---|
| `role: admin/superadmin/analyst/viewer` | `auth.py:90` | `str(admin.id)` | Admin panel |
| `user` | `user_panel.py:257-258` | `user:{tg_id}` | VIP user panel |
| `academy` | `academy.py:184` | `student:{id}` (+`sid`,`did`) | Academy |
| `academy_manage` | `academy.py:168` | `student:{id}` | 15-min device-management token |
| `academy_video` | `user_panel`/academy video routes | `sid`,`vid` | signed video access (`academy.py:467`) |
| `ig` | `ig_panel.py:132-133` | `ig:{id}` | Instagram panel |

Each `current_*` dependency rejects any token whose `scope` does not match (e.g. `academy.py:97`, `ig_panel.py:67`, `user_panel.py:130`). A student token is structurally unusable against the IG panel even though both were signed with the same secret — the scope check is the wall between tenants.

#### Admin login (`auth.py:63-104`)

The admin login deliberately defends against an **account-enumeration oracle** (`auth.py:77-88`): invalid username, wrong password, and *inactive account* all return an **identical `401`** with the same message. An attacker cannot distinguish "no such user" from "user exists but disabled" from "wrong password", because the status code and body are uniform. On success it mints access+refresh and updates `last_login`.

#### Refresh-token rotation (`auth.py:107-209`)

The refresh flow is a textbook **rotating refresh token with replay detection**:

1. `verify_refresh_token` (not access — type safety).
2. Require a `jti`; tokens without one are refused (`auth.py:138-143`) — un-revocable tokens are not honoured.
3. **Replay detection**: if the old refresh `jti` is already blacklisted, log `refresh_token_replay_attempt` and reject (`auth.py:146-155`).
4. **Blacklist the old token *before* issuing the new one** (`auth.py:178-185`), TTL = remaining lifetime. If this `setex` fails, return `503` (fail-secure) — never issue a new pair while the old one is still live.
5. Re-issue with the **role re-read from the DB** (`auth.py:197`), so a demoted admin's new tokens reflect the demotion immediately.

Every Redis-dependent step is fail-secure: a Redis outage yields `503`, never a silent bypass (`auth.py:158-165`).

#### Logout (`auth.py:212-287`)

Logout blacklists the current access token's `jti` (TTL = remaining life) and, if the client supplies its paired `refresh_token`, blacklists that `jti` too (`auth.py:264-273`). The comment (`auth.py:261-263`) explains why both are needed: the access token expires in minutes, but without revoking the refresh token an attacker who captured it could mint fresh access tokens for up to 7 days. Other devices' sessions remain untouched — this is per-session logout, not global.

#### Constant-time comparisons & HMAC identity proofs

Several surfaces authenticate **without** JWTs, and each uses constant-time comparison to defeat timing attacks:

- **EA token** (`ea.py:26-31`): `hmac.compare_digest(token, settings.EA_TOKEN)` — the MT5 robot presents a static shared secret; the comparison is constant-time so an attacker cannot incrementally guess it byte-by-byte by measuring response latency. Empty token/secret short-circuits to `False`.
- **Telegram Login Widget** (`live.py:93-105`): reconstructs the official Telegram verification — sorts the data pairs, builds the check-string, derives `secret_key = sha256(bot_token)`, computes `HMAC-SHA256`, and compares with `hmac.compare_digest`. This cryptographically proves the login payload genuinely came from Telegram and was not forged.
- **Telegram WebApp `initData`** (`user_panel.py:281-293`): the WebApp variant uses the `WebAppData`-keyed HMAC per Telegram's official algorithm, again finalised with `hmac.compare_digest`.

#### OTP / Telegram identity flows

The user panel chains **two** proofs of identity (`user_panel.py` header): Telegram login (cryptographic, above) establishes *who you are*, then an **email OTP** (`/auth/request-otp` → `/auth/verify-otp`, `user_panel.py:317-339`, backed by `src/core/email_otp`) confirms *contactability* before panel access. The academy offers a parallel free-signup path via email-OTP register (`/auth/register/request` + `/auth/register/verify`, `academy.py:224-272`).

---

### 9.7 Middleware deep-dive

#### 9.7.1 CORS (`middleware/cors.py`)

`setup_cors` (`cors.py:47-100`) picks the allowed-origins list with a three-tier precedence:

1. **Explicit** `CORS_ORIGINS` env (comma-separated) if set;
2. else, in `DEBUG` → a localhost dev allow-list (`cors.py:30-37`);
3. else (production) → an explicit production allow-list built from `WEBSITE_DOMAIN`/`ADMIN_DOMAIN`/`API_DOMAIN` (`cors.py:20-27`).

The hard rule, stated in the module docstring: **never `"*"`, even when the config is empty.** This is doubly important because `allow_credentials=True` (`cors.py:73`) is incompatible with a wildcard origin per the CORS spec — a `"*"` would silently disable credentialed requests. `expose_headers` (`cors.py:83-91`) surfaces pagination (`X-Total-Count`, `X-Page`) and rate-limit (`X-RateLimit-*`) headers to the SPA, and `max_age=600` caches preflights for 10 minutes.

#### 9.7.2 Rate limiting (`middleware/rate_limit.py`)

The active limiter is a **per-IP, per-path sliding-window** counter backed by a Redis sorted set. Each request runs a 4-command pipeline (`rate_limit.py:115-120`): `ZREMRANGEBYSCORE` (evict the window), `ZADD` (record now), `ZCARD` (count), `EXPIRE` (self-cleaning key). Zone configuration (`rate_limit.py:23-36`):

| Zone | Limit / window | Rationale |
|---|---|---|
| **default** | 240 / 60 s | Generous — SPAs fire dozens of requests on load; real abuse is caught by the auth zone |
| `/auth/login` | **5 / 60 s** | Anti-brute-force |
| `/auth/refresh` | 10 / 60 s | Anti-token-grinding |
| `/signals/manual` | 10 / 60 s | Protects manual signal creation |
| `/broadcasts` | 5 / 60 s | Expensive fan-out |
| `/ea/` | **600 / 60 s** | The EA polls frequently and is already authenticated |
| `/admin/panel-users` | 300 / 60 s | Dashboard polling |
| `/user/copy-status` | 300 / 60 s | Copy-engine polling |

Three correctness details stand out:

- **Client IP is anti-spoof** (`rate_limit.py:39-58`): it trusts `X-Real-IP` first (nginx sets it from `$remote_addr`, which a client cannot forge), then falls back to the **last** entry of `X-Forwarded-For` (the nearest proxy), never the client-controlled first entry.
- **Limit is checked *before* `call_next`** (`rate_limit.py:127-129`): a flood is rejected *before* the handler runs, so bcrypt/JWT/DB work is never spent on requests that will 429.
- **Fail-open on Redis loss** (`rate_limit.py:101-105`, `123-125`): if Redis is unreachable, the limiter logs a warning and *allows* the request — availability is favoured here, the opposite of the auth blacklist's fail-secure stance, because a public read should not go dark just because the limiter's backing store hiccuped.

Every allowed response is stamped with `X-RateLimit-Limit/Remaining/Reset` (`rate_limit.py:154-157`); 429s additionally carry `Retry-After`.

> **Sidebar — the per-user limiter.** `middleware/per_user_rate_limit.py` implements a more sophisticated **per-user (JWT `sub`) tiered** limiter (`anonymous` 20→burst 30, `free` 60→100, `premium` 300→500, `admin` 600→1000) with the same sliding-window algorithm. It identifies the caller from the JWT and falls back to IP for anonymous traffic — solving the "thousands of users behind one Cloudflare IP share a quota" problem. It is implemented and available; the per-IP `RateLimitMiddleware` is the one wired into `main.py`.

#### 9.7.3 Security headers (`middleware/security_headers.py`)

Stamped on **every** response (`security_headers.py:41-71`): `Strict-Transport-Security` (1-year, `includeSubDomains`, only when `enable_hsts` — i.e. not in DEBUG), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` disabling geolocation/camera/mic/payment/usb/etc., and a deliberately **locked-down API CSP** (`default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `security_headers.py:34-39`) — appropriate because this process serves JSON/API responses, not the HTML front-ends (which nginx serves with their own CSP).

#### 9.7.4 The standalone JWT middleware

`middleware/auth.py` provides a `JWTAuthMiddleware` that pre-validates tokens and stashes the payload on `request.state.admin_payload`, with `EXCLUDED_PATHS`/`EXCLUDED_PREFIXES` (e.g. `/ws/`, `/articles`). The production app relies on **per-route `Depends`** (`get_current_admin`, `current_student`, …) for authorization rather than this blanket middleware — dependency-based auth gives per-endpoint granularity and self-documents in OpenAPI, whereas a global middleware cannot express "this route is public, that one is admin-only."

---

### 9.8 WebSockets

Two WebSocket endpoints exist, with sharply different auth postures.

#### Public price stream — `WS /ws/prices` (`live_prices.py:116-191`)

Unauthenticated. A `ConnectionManager` (`live_prices.py:27-75`) tracks active sockets and broadcasts. On connect, the server pushes default symbols and then **a 1-second loop** reads `price:{SYMBOL}` keys from Redis via pipeline (`live_prices.py:80-113`) and streams `{"type":"prices","data":{…}}`. A concurrent `receive_messages` task (`live_prices.py:132-162`) lets the client `subscribe` to a custom symbol list (capped at 50, upper-cased) or `ping`/`pong`. Disconnects cancel the receive task cleanly (`live_prices.py:184-189`).

#### Live-trading chat — `WS /live/ws/chat` (`live.py:349-…`)

Authenticated via a **`token` query parameter** (WebSockets cannot send `Authorization` headers from browsers). The handler (`live.py:357-…`) accepts either:

- a **Telegram chat token** (`_decode_live`) → resolves a viewer identity with `tg`, `name`, `photo`, `vip`;
- or an **admin access token** (`verify_access_token` with role ∈ {admin, superadmin, analyst}) → connects as the broadcast host;
- or **none** → a read-only *guest* who may watch but not write.

Write permission is computed (`live.py:~386`): admins always; logged-in users in `public` mode; only VIPs in `subscribers` mode. This single socket thus serves three privilege tiers off one endpoint. The admin-only REST companions (`/live/admin/start|stop|mode|ban|mute|pin|slowmode|clear`, `live.py:519-643`) drive the room state.

---

### 9.9 EA & machine surfaces

The `/ea` router (`ea.py`) is the contract between the server and the MetaTrader 5 Expert Advisor. It authenticates with the static `EA_TOKEN` (const-time, §9.6) rather than a JWT, because the EA is a long-running native robot, not a session-based user. Endpoints: `GET /ea/signals` (active live signals in EA-friendly shape), `GET /ea/config` (risk/lot/trailing settings, sourced from Redis key `ea:settings`, admin-tunable from the panel), `POST /ea/heartbeat`, `POST /ea/deals` (real fills → P&L history), `POST /ea/specs` and `POST /ea/symbols` (broker instrument metadata). It carries the **highest rate-limit zone** (600/min) because it polls aggressively.

---

### 9.10 One API, five front-ends: the nginx `/api` rewrite

The single FastAPI process is fronted by nginx vhosts — one per origin — in `nginx/conf.d/`: `website.conf`, `admin.conf`, `user.conf`, `academy.conf`, `ig.conf` (plus `mt5.conf` for the MT5 web surface). The unifying trick is a **path rewrite** that lets each SPA call a same-origin `/api/...` URL (avoiding CORS preflights and cookie/origin headaches) while the backend sees prefix-clean paths:

```nginx
# nginx/conf.d/website.conf:48-49 / user.conf:44-45 / academy.conf:44-45
rewrite ^/api(/v1)?/(.*)$ /$2 break;
proxy_pass http://api_backend;
```

So the browser requests `https://academy.fx/api/academy/me`; nginx strips `/api` and proxies `GET /academy/me` to the shared `api_backend` upstream. **This is why every prefix in §9.4 is written *without* `/api`** — and why CoinePro memory notes "routes have no `/api` prefix": the prefix is an nginx-layer convention, invisible to FastAPI. WebSocket locations get dedicated blocks (`website.conf:57-59`, `:101`, `:156`) that additionally pass the `Upgrade`/`Connection` headers and proxy to `…/ws/` for the price stream and `/live/ws/` for chat.

The consequences of this architecture:

1. **One deployable, one auth secret, one DB pool** — operationally simple; the §9.6 scope claims provide the tenant isolation that separate services would otherwise enforce at the network layer.
2. **CORS is mostly moot for same-origin SPA traffic** — each SPA talks to its *own* origin's `/api`; the CORS allow-list (§9.7.1) primarily guards genuine cross-origin callers (e.g. the API subdomain).
3. **Per-vhost TLS, headers, and crawler routing** live in nginx, keeping the Python app transport-agnostic.

In short: a *modular monolith* at the API tier, sharded into five product surfaces by **JWT scope + nginx vhost**, not by process boundaries — the right trade-off for a 16 GB single-server deployment where spawning five microservices would waste RAM the project cannot spare.

---
---

## ۹. لایهٔ API — درگاهِ FastAPI، مسیریابی، احراز هویت و بلادرنگ

> *«یک پردازه، پنج فرانت‌اند، دوجین اسکوپِ هویتی.»* — کوین‌پرو-اف‌ایکس یک **اپلیکیشن واحدِ FastAPI** (`src/api/main.py`) را عرضه می‌کند که هم‌زمان وب‌سایتِ بازاریابیِ عمومی، پنلِ کنترلِ ادمین، پنلِ کپی-تریدِ کاربرِ VIP، آکادمیِ فارکسِ VIP (به‌همراهِ کلونِ نمودارگیریِ *بازارنما*) و پنلِ مستقلِ چنداجاره‌ایِ اتوماسیونِ اینستاگرام را تغذیه می‌کند — به‌علاوهٔ سطوحِ ماشین-به-ماشین برای Expert Advisorِ متاتریدر ۵ و رباتِ تلگرام. این فصل آن درگاه را به‌صورتِ جامع کالبدشکافی می‌کند: ترکیبِ اپ، فهرستِ کاملِ روترها، تزریقِ وابستگی، میان‌افزارها، مدلِ احراز هویتِ چنداسکوپی، وب‌سوکت‌ها، ابزاردقیقِ Prometheus، و بازنویسیِ `/api` در nginx که اجازه می‌دهد یک اپِ ASGI به پنج origin پخش شود.

---

### ۹.۱ ترکیبِ اپلیکیشن و چرخهٔ حیات (lifespan)

شیءِ اپلیکیشن در `src/api/main.py:111-118` ساخته می‌شود. دو تصمیمِ طراحی فوراً دیده می‌شوند و هر دو از منظرِ امنیتی مهم‌اند:

۱. **مستندسازیِ خودکار وابسته به محیط است.** آدرس‌های `/docs` (Swagger UI) و `/redoc` هرگاه `settings.DEBUG` نادرست باشد به `None` می‌رسند. در production (`DEBUG=false` که `CLAUDE.md` الزام کرده) کاوشگرِ OpenAPI کاملاً غایب است — هیچ سطحِ تعاملی‌ای وجود ندارد که هر مسیر را به مهاجم تبلیغ کند.

۲. **lifespan جایگزینِ هوک‌های منسوخِ `@app.on_event` شده است** (`main.py:72-108`).

#### قراردادِ lifespan

دنبالهٔ راه‌اندازی **fail-fast** است: اگر اتصال به Redis برقرار نشود (`main.py:85-87`) یا کاوشِ `SELECT 1` روی دیتابیس شکست بخورد (`main.py:94-96`)، استثناء *دوباره پرتاب* می‌شود و boot را لغو می‌کند. بنابراین کانتینر هرگز به وضعیتِ «درحالِ اجرا اما خراب» نمی‌رسد که ترافیکی را بپذیرد که نمی‌تواند سرویس‌دهی کند. برعکس، خاموشی **fail-soft** است — شکست در بستنِ Redis (`main.py:105-106`) در سطحِ `warning` لاگ و نادیده گرفته می‌شود، چون یک اتصالِ نیمه‌بسته نباید خروجِ تمیزِ پردازه را مسدود کند.

#### ترتیبِ ثبتِ میان‌افزار (این مهم است)

در Starlette، میان‌افزار **بیرونی‌ترین در ورود، درونی‌ترین در خروج** اجرا می‌شود، و *آخرین* فراخوانیِ `add_middleware` به *بیرونی‌ترین* لایه تبدیل می‌شود. ترتیبِ `main.py:120-129` عمدی و کامنت‌گذاری‌شده است:

```python
app.add_middleware(SecurityHeadersMiddleware, enable_hsts=not settings.DEBUG)  # اولین
app.add_middleware(RateLimitMiddleware)                                        # دومین
setup_cors(app)   # CORS آخر اضافه می‌شود → بیرونی‌ترین لایه
```

کامنتِ درون‌خطی (`main.py:126-128`) دلیلِ غیربدیهیِ بیرونی‌بودنِ CORS را شرح می‌دهد: *اگر `RateLimitMiddleware` از یک لایهٔ درونی پاسخِ ۴۲۹ برگرداند، آن پاسخ باید همچنان از لایهٔ CORS عبور کند تا مرورگر هدرهای `Access-Control-*` را دریافت کند.* اگر CORS درونی بود، یک درخواستِ throttle-شدهٔ مرورگر به‌جای «۴۲۹ صادقانه» به‌صورتِ خطای مبهمِ CORS ظاهر می‌شد. درونی‌بودنِ HSTS یعنی **هر** پاسخ (حتی ۴۲۹ و ۴۰۱ که میان‌افزارهای درونی صادر می‌کنند) همچنان با هدرهای امنیتی مهر می‌خورد.

میان‌افزارِ Prometheus جداگانه با دکوراتورِ `@app.middleware("http")` ثبت می‌شود (`main.py:132`) که آن را *درونِ* سه لایهٔ `add_middleware` قرار می‌دهد اما همچنان دورِ هر هندلر می‌پیچد.

---

### ۹.۲ ابزاردقیقِ Prometheus

دو خانوادهٔ متریک در سطحِ ماژول اعلام می‌شوند (`main.py:60-69`):

| متریک | نوع | برچسب‌ها | هدف |
|---|---|---|---|
| `http_requests_total` | `Counter` | `method`, `endpoint`, `status_code` | حجمِ درخواست و برش‌بندیِ نرخِ خطا |
| `http_request_duration_seconds` | `Histogram` | `method`, `endpoint` | توزیعِ تأخیر / p95-p99 |

نکتهٔ ظریفِ درستی، **کنترلِ cardinality** است (`main.py:146-150`): به‌جای برچسب‌زدن با مسیرِ *خام* (`/signals/4711`)، با **الگوی مسیر** (`/signals/{signal_id}`) برچسب می‌زند. شیءِ `route`ِ مطابقت‌یافته فقط *پس از* dispatch (یعنی پس از `call_next`) در `scope` ظاهر می‌شود، به همین دلیل متریک پس از dispatch ثبت می‌شود. بدونِ این کار، هر signal id، هر slugِ مقاله و هر user id یک time-series جدید می‌ساخت و حافظهٔ Prometheus را منفجر می‌کرد. fallback به `request.url.path` حالتِ ۴۰۴ (که هیچ مسیری مطابقت نکرده) را پوشش می‌دهد.

متریک‌ها در **`GET /metrics`** عرضه می‌شوند (`main.py:199-207`) — و مهم اینکه این اندپوینت هم `include_in_schema=False` است و هم با `Depends(get_current_admin)` محافظت می‌شود. تله‌متریِ عملیاتیِ داخلی به‌صورتِ ناشناس قابلِ scrape نیست؛ سرورِ Prometheus باید توکنِ بِیرِرِ ادمین ارائه دهد.

---

### ۹.۳ اندپوینتِ `/health`

`GET /health` (`main.py:162-196`) کاوشگرِ liveness/readinessِ ارکستراسیون است. مستقلاً دیتابیس (`SELECT 1`) و Redis (`ping`) را بررسی می‌کند و سپس برمی‌گرداند:

- **`200` + `{"status":"healthy"}`** تنها اگر *هر دو* موفق شوند؛
- **`503` + `{"status":"degraded"}`** اگر هرکدام down باشد، با فیلدهای `connected`/`disconnected` به‌ازای هر وابستگی.

این مسیر عمداً در `EXCLUDED_PATHS`ِ محدودکنندهٔ نرخ است (`rate_limit.py:86`) تا کاوش‌های سلامت هرگز throttle نشوند.

---

### ۹.۴ فهرستِ روترها

اپِ واحد **۳۴ روتر** را mount می‌کند (`main.py:210-243`). در اینجا بر اساسِ *سطحِ فرانت‌اند* مرتب شده‌اند نه ترتیبِ ثبت. هر prefix زیر، prefixِ **سمتِ سرور** است؛ به‌یاد داشته باشید (§۹.۱۰) که nginx پیش از پراکسی یک `/api`ِ ابتدایی را حذف می‌کند، پس مرورگر `/api/academy/me` را صدا می‌زند درحالی‌که FastAPI `/academy/me` را می‌بیند.

#### ۹.۴.۱ سطحِ وب‌سایت (عمومی، بدونِ احراز)

| روتر | prefix | مسیرهای نمونه | یادداشت |
|---|---|---|---|
| `public` | `/public` | `/auth/config`, `/auth/telegram`, `/signals/active`, `/signals/recent`, `/signals/stats`, `/backtest/simulate`, `/prices/live`, `/go/{code}`, `/track`, `/edu-asset/{f}`, `/edu-video/{f}`, `/ig-media/{f}`, `/icon` | دادهٔ فقط-خواندنیِ سایت + پراکسیِ asset + ردیابیِ کلیک |
| `seo` | *(بدونِ prefix — ریشهٔ دامنه)* | `/sitemap.xml`, `/sitemap-pages.xml`, `/sitemap-articles.xml`, `/rss.xml`, `/robots.txt`, `/indexnow-key.txt`, `/seo/render/{path}` | بدونِ prefix mount شده (`main.py:217`) تا فایل‌ها در ریشهٔ دامنه باشند |
| `articles` | `/articles` | `GET /`, `/{slug}`, `/{slug}/related`, `POST /`, `PUT /{id}`, `DELETE /{id}` | محتوای بلاگ/SEO؛ خواندن عمومی، نوشتن ادمین‌گِیتد |
| `live_prices` | `/ws` | `WS /prices` | استریمِ عمومیِ قیمتِ وب‌سوکت |
| `performance` | `/performance` | آمارِ نرخِ بُرد / منحنیِ سرمایه | سطحِ KPIِ عمومی |

مسیرِ `/seo/render/{full_path:path}` (`seo.py:468-469`) اندپوینتِ **رندرِ پویا** است که nginx، user-agentهای خزنده را به آن هدایت می‌کند تا HTMLِ پیش‌رندرشده برای مسیرهای SPA بازگردد و گوگل‌بات صفحاتِ مقاله را ایندکس کند.

#### ۹.۴.۲ سطحِ پنلِ ادمین (توکنِ `Admin`، RBAC)

| روتر | prefix | حوزهٔ مسئولیت |
|---|---|---|
| `auth` | `/auth` | login / refresh / logout / me (ارائه‌دهندهٔ هویتِ ادمین) |
| `admin` | `/admin` | `/stats`, `/services`, `/services/{name}/restart` |
| `panel` | `/admin` | **مگا-روتر** — داشبورد، سیگنال‌ها، کاربران، تنظیماتِ EA، مقالات، broadcastها، تنظیمات، عملکرد، مانیتورینگ، مدل‌های ML، panel-users، trailing-monitor (≈۸۰ اندپوینت) |
| `bot_admin` | `/admin` | داشبوردِ رباتِ تلگرام |
| `signals` | `/signals` | `GET /`, `/active`, `/{id}`, `POST /{id}/close`, `POST /manual`, `PATCH /{id}` |
| `users` | `/users` | فهرست/خروجی کاربران، plan/ban/unban، پیام، grant-signal-access |
| `risk` | `/admin/risk` | کنترل‌های مدیریتِ ریسک |
| `launch` | `/admin/launch` | گِیتِ launchِ paper→live |
| `reports` | `/admin/reports` | گزارش‌های پیشرفته |
| `payments` | `/admin/payments` | تأییدِ پرداخت |
| `subscriptions` | `/admin/subscriptions` | مدیریتِ اشتراک |
| `analytics` | `/admin/analytics` | آنالیتیکسِ بازدید (`/overview`, `/live`, `/online`) |
| `trade_history` | `/admin/trade-history` | تاریخچهٔ سود/زیانِ واقعی (`/`, `/daily`, `/stats`, `/export`, `/performance`, `/validation`) |
| `seo_admin` | `/admin/seo` | داشبوردِ Search-Console + PageSpeed |
| `monitoring` | `/monitoring` | مانیتورینگِ سیستم |
| `settings` | `/settings` | تنظیماتِ سراسری |
| `backtest` | `/backtest` | اجراهای بک‌تست (`/runs` CRUD، شروعِ ناهمگامِ `202 Accepted`) |

به **چند روترِ هم‌prefixِ `/admin`** توجه کنید (`admin`، `panel`، `bot_admin`). FastAPI آن‌ها را در یک فضای-مسیرِ واحد ادغام می‌کند؛ `panel.py` منبعِ دادهٔ قانونی است که پاسخ‌ها را دقیقاً به شکلِ **camelCase**ی که فرانتِ React انتظار دارد برمی‌گرداند (کامنتِ `main.py:233-235`)، درحالی‌که روترهای ساده‌ترِ بومیِ پایتون (`signals`, `users`) به مصرف‌کنندگانِ snake-case سرویس می‌دهند.

#### ۹.۴.۳ سطحِ پنلِ کاربری (توکنِ اسکوپِ `user`)

| روتر | prefix | مسیرهای نمونه |
|---|---|---|
| `user_panel` | `/user` | `/auth/config`, `/auth/telegram`, `/auth/webapp`, `/auth/request-otp`, `/auth/verify-otp`, `/me`, `/disclaimer`, `/kyc`, `/account/link`, `/copy-config`, `/copy-status`, `/copy/stop`, `/copy/close-all`, `/history`, `/subscription`, `/economic-calendar`, `/ai/chat`, `/trade-history*`, `/notifications` |

این پنلِ کپی-تریدِ VIP است — ورودِ تلگرام ← تأییدِ ایمیلِ OTP ← KYC ← لینکِ حسابِ بروکر ← موتورِ کپیِ paper/live.

#### ۹.۴.۴ سطحِ آکادمی (توکنِ اسکوپِ `academy`)

| روتر | prefix | نکات |
|---|---|---|
| `academy` | `/academy` | `/auth/login`, `/auth/register/request`, `/auth/register/verify`, `/devices`, `/catalog`, `/lesson/{slug}`, `/video/{id}`, `/progress`, `/quiz`, `/journal`, `/community`, `/leaderboard`, `/streak`, `/achievements`, `/backtest`, `/chart/*`, `/paper/*`, `/practice/*` (≈۹۰ اندپوینت) |
| `bazaarnama` | `/academy/bn` | `/prices`, `/layouts`, `/scripts` (NamaScript), `/watchlist`, `/alerts`, `/ai-signal*` — کلونِ TradingViewِ ایرانی، تودرتو *زیرِ* اسکوپِ احرازِ آکادمی |
| `admin_academy` | `/admin/academy` | CRUDِ ادمینِ دانش‌آموزان/درس‌ها/پرداخت‌ها/انجمن |

`bazaarnama` دقیقاً به این دلیل در `/academy/bn` قرار دارد که هر مسیرِ آن **پشتِ احرازِ دانش‌آموز (`scope=academy`)** است — یک دامنهٔ احرازِ جدا نیست، بلکه یک ماژولِ ویژگیِ آکادمی است.

#### ۹.۴.۵ سطحِ اینستاگرام (توکنِ اسکوپِ `ig`)

| روتر | prefix | نکات |
|---|---|---|
| `ig_panel` | `/ig` | `/auth/login`, `/auth/refresh`, `/me`, `/accounts*` (≤۳ به‌ازای کاربر)، `/messages`, `/auto-replies`, `/inbox`, `/forms`, `/contents`, `/ai/*`, `/cover/*`, `/autopilots*` — پنلِ چنداجاره‌ایِ سبکِ NovinHub |
| `admin_ig_users` | `/admin/ig-users` | مدیریتِ سمتِ مالکِ اجاره‌دارهای IG (`GET /`, `/overview`, `/{uid}`, `/{uid}/activity`, `POST /`, مجوزها) |

#### ۹.۴.۶ سطوحِ ماشین-به-ماشین و بلادرنگ

| روتر | prefix | احراز | هدف |
|---|---|---|---|
| `ea` | `/ea` | `EA_TOKEN`ِ ثابت (HMAC ثابت‌زمان) | EAِ متاتریدر ۵، `/signals` می‌خواند، `/heartbeat`,`/deals`,`/specs`,`/symbols` می‌فرستد |
| `live` | `/live` | توکنِ ورودِ تلگرام **یا** توکنِ ادمین | استریمِ لایو-ترید: `/config`, `/auth/telegram`, **`WS /ws/chat`**, `/admin/*` |
| `broadcasts` | `/broadcasts` | ادمین | پیام‌رسانیِ broadcast |

---

### ۹.۵ تزریقِ وابستگی

کوین‌پرو-اف‌ایکس به‌شدت بر `Depends`ِ FastAPI تکیه می‌کند تا هندلرها لاغر بمانند و دغدغه‌های عرضی متمرکز شوند. وابستگی‌های مشترک در `src/api/deps.py` هستند.

#### `get_db` — واحدِ کارِ سشن-به-ازای-درخواست

قراردادِ مستندشده سخت‌گیرانه و غیرمعمول است: **هندلرها نباید خودشان commit کنند** — وابستگی در پایانِ درخواست commit می‌کند، آن‌هم *فقط اگر تراکنشی هنوز باز باشد* (`deps.py:41-42`). گاردِ `in_transaction()` از خطای کلاسیکِ «commit پس از commit» جلوگیری می‌کند زمانی‌که هندلر قبلاً خودش commit کرده (مثلاً جریانِ ورودِ آکادمی که در `academy.py:183` صریحاً `await db.commit()` می‌زند). هر استثناء یک rollbackِ خودکار را راه‌می‌اندازد و به هر درخواست معناشناسیِ همه‌یا-هیچِ تراکنشی می‌دهد.

#### `get_redis` — دسترسیِ fail-loud

`get_redis` (`deps.py:51-65`) کلاینتِ زنده را برمی‌گرداند یا اگر Redis متصل نباشد **`503`** پرتاب می‌کند. هندلرهایی که به Redis نیاز دارند `redis=Depends(get_redis)` را اعلام می‌کنند و هرگز به global دست نمی‌زنند، پس قطعیِ Redis به‌صورتِ یک ۵۰۳ تمیز ظاهر می‌شود نه یک ۵۰۰ مبهم.

#### `get_current_admin` — گاردِ هویتِ ادمین

`get_current_admin` (`deps.py:82-148`) موتورِ کلِ سطحِ ادمین است. خط‌لوله‌اش:

۱. استخراجِ اعتبارِ بِیرِر با `HTTPBearer()`.
۲. `verify_access_token(token)` → باید decode شود *و* `type=access` باشد (وگرنه ۴۰۱).
۳. استخراجِ `sub`؛ نبودش → ۴۰۱.
۴. **بررسیِ لیستِ سیاهِ توکن (fail-secure)** — اگر `jti` در `token_blacklist:{jti}` در Redis باشد، با ۴۰۱ رد می‌شود. سخت‌سازیِ حیاتی (`deps.py:121-130`): اگر خودِ جست‌وجوی Redis *استثناء بدهد*، درخواست با **۵۰۳، نه عبور** رد می‌شود. این جلوی مهاجم را می‌گیرد که از قطعیِ Redis برای دورزدنِ logout/ابطال سوءاستفاده کند.
۵. بارگذاریِ ردیفِ `Admin`؛ نیافتن → ۴۰۱؛ `is_active=False` → ۴۰۳.

#### `require_role` — کارخانهٔ RBAC

سلسله‌مراتبِ نقش (`deps.py:69-79`) یک نردبانِ کاملاً مرتب است: `viewer(1) < analyst(2) < admin(3) < superadmin(4)`. `require_role("superadmin")` وابستگی‌ای برمی‌گرداند که بر پایهٔ `get_current_admin` ساخته شده و تأیید می‌کند نقشِ فراخوان *برابر-یا-بالاتر* از نیاز است. یک `superadmin` بنابراین به‌طورِ ضمنی از هر گِیتِ پایین‌تر می‌گذرد. ردها با فیلدهای ساختاریافتهٔ `rbac_denied` برای ممیزی لاگ می‌شوند.

#### وابستگی‌های هویتِ هر سطح

هر فرانت‌اندِ غیرادمین وابستگیِ سبکِ `current_*` خودش را دارد، چون هرکدام **اسکوپِ متفاوت** حمل می‌کند و **مدلِ DBِ متفاوتی** را resolve می‌کند:

| وابستگی | فایل:خط | اسکوپ | مدل | بررسیِ اضافه |
|---|---|---|---|---|
| `current_student` | `academy.py:90-110` | `academy` | `AcademyStudent` | status فعال؛ **اعتبارِ دستگاه** با claimِ `did` |
| `require_vip` | `academy.py:142-147` | (روی `current_student`) | — | رتبهٔ tier ≥ ۱، وگرنه ۴۰۳ |
| `current_user` | `user_panel.py` | `user` | `User` (با `telegram_id`) | گِیتِ VIP/پرداخت |
| `current_ig_user` | `ig_panel.py:62-67` | `ig` | `IGUser` | گاردِ مالکیت |

پیچیده‌ترین، `current_student`ِ آکادمی است: توکن‌هایی که پس از ویژگیِ ردیابیِ دستگاه ساخته شده‌اند یک claimِ `did` حمل می‌کنند و وابستگی دوباره تأیید می‌کند آن دستگاه هنوز برای دانش‌آموز موجود است (`academy.py:104-109`). اگر آن دستگاه حذف شده باشد، توکن با پیامِ «این دستگاه از حسابِ شما حذف شده» رد می‌شود — که logout از راهِ دور به‌ازای هر دستگاه را ممکن می‌کند، ضمنِ رعایتِ سقفِ هم‌زمانیِ ۲ دستگاه (`MAX_DEVICES`).

---

### ۹.۶ احراز هویت و JWT — یک راز، چندین اسکوپ

همهٔ توکن‌ها JWTهای HS256 هستند که از یک `JWT_SECRET_KEY` واحد ساخته می‌شوند (`config.py:225-228`؛ `HS256`، TTLِ access ۳۰ دقیقه، refresh ۷ روز). آنچه فرانت‌اندها را متمایز می‌کند **کلیدهای جدا نیست** بلکه **claimِ `scope`** است که در هر توکن پخته می‌شود. `src/core/security.py` مرجعِ واحدِ ساخت/تأیید است.

#### ساختِ توکن

هر توکن یک **`jti`** یکتا می‌گیرد (`security.py:42`) که محورِ مدلِ ابطالِ هر-توکن است: logout/rotation همان `jti`ِ *مشخص* را با TTLِ برابرِ عمرِ باقی‌مانده لیست‌سیاه می‌کند، پس سشن‌های دیگر روی دستگاه‌های دیگر زنده می‌مانند. هر دو توکنِ access و refresh یک claimِ `type` حمل می‌کنند.

#### تأییدِ توکن و دفاع از type-confusion

`verify_access_token` و `verify_refresh_token` (`security.py:72-85`) هر دو decode می‌کنند *و* claimِ `type` را تأیید می‌کنند. این کلاسِ باگِ **سردرگمیِ نوع** را می‌بندد — یک refresh token هرگز نمی‌تواند به‌جای access token replay شود و بالعکس. کامنتِ جریانِ refresh (`auth.py:116-119`) ثبت می‌کند که این یک رفعِ عمدیِ فاز ۸ بود (باگِ «S-1»).

#### فضای‌نامِ اسکوپ

| اسکوپ | صادرکننده | شکلِ `sub` | فرانت‌اند |
|---|---|---|---|
| `role: admin/superadmin/analyst/viewer` | `auth.py:90` | `str(admin.id)` | پنلِ ادمین |
| `user` | `user_panel.py:257-258` | `user:{tg_id}` | پنلِ کاربری VIP |
| `academy` | `academy.py:184` | `student:{id}` (+`sid`,`did`) | آکادمی |
| `academy_manage` | `academy.py:168` | `student:{id}` | توکنِ ۱۵-دقیقه‌ایِ مدیریتِ دستگاه |
| `academy_video` | مسیرهای ویدئو | `sid`,`vid` | دسترسیِ امضاشدهٔ ویدئو (`academy.py:467`) |
| `ig` | `ig_panel.py:132-133` | `ig:{id}` | پنلِ اینستاگرام |

هر وابستگیِ `current_*` هر توکنی را که `scope`ـش مطابقت نکند رد می‌کند (مثلاً `academy.py:97`, `ig_panel.py:67`, `user_panel.py:130`). یک توکنِ دانش‌آموز به‌لحاظِ ساختاری روی پنلِ IG غیرقابل‌استفاده است هرچند هر دو با همان رازِ واحد امضا شده‌اند — بررسیِ اسکوپ، دیوارِ بینِ اجاره‌دارهاست.

#### ورودِ ادمین (`auth.py:63-104`)

ورودِ ادمین عمداً در برابرِ **اوراکلِ شمارشِ حساب** دفاع می‌کند (`auth.py:77-88`): نام‌کاربریِ نامعتبر، رمزِ غلط، و *حسابِ غیرفعال* همگی یک **۴۰۱ یکسان** با پیامِ یکسان برمی‌گردانند. مهاجم نمی‌تواند «کاربر وجود ندارد» را از «کاربر هست اما غیرفعال» از «رمز غلط» تشخیص دهد. در صورتِ موفقیت access+refresh می‌سازد و `last_login` را به‌روزرسانی می‌کند.

#### چرخشِ refresh token (`auth.py:107-209`)

جریانِ refresh یک **refreshِ چرخشی با تشخیصِ replay** کتابِ درسی است:

۱. `verify_refresh_token` (نه access — ایمنیِ نوع).
۲. الزامِ `jti`؛ توکن‌های بدونِ آن رد می‌شوند (`auth.py:138-143`).
۳. **تشخیصِ replay**: اگر `jti`ِ قدیمی قبلاً لیست‌سیاه باشد، `refresh_token_replay_attempt` لاگ و رد می‌شود (`auth.py:146-155`).
۴. **لیست‌سیاه‌کردنِ توکنِ قدیمی *پیش از* صدورِ جدید** (`auth.py:178-185`)، TTL = عمرِ باقی‌مانده. اگر این `setex` شکست بخورد، ۵۰۳ (fail-secure) — هرگز جفتِ جدید صادر نمی‌شود تا قدیمی هنوز زنده است.
۵. صدورِ مجدد با **نقشِ از-DB-خوانده‌شده** (`auth.py:197`)، پس توکن‌های جدیدِ یک ادمینِ تنزل‌یافته فوراً تنزل را منعکس می‌کنند.

هر گامِ وابسته به Redis، fail-secure است: قطعیِ Redis ۵۰۳ می‌دهد، نه دورزدنِ خاموش (`auth.py:158-165`).

#### Logout (`auth.py:212-287`)

Logout، `jti`ِ توکنِ accessِ فعلی را لیست‌سیاه می‌کند (TTL = عمرِ باقی‌مانده) و اگر کلاینت `refresh_token`ِ جفتش را بفرستد، آن `jti` را هم لیست‌سیاه می‌کند (`auth.py:264-273`). کامنت (`auth.py:261-263`) توضیح می‌دهد چرا هر دو لازم‌اند: توکنِ access در چند دقیقه منقضی می‌شود، اما بدونِ ابطالِ refresh، مهاجمی که آن را گرفته می‌تواند تا ۷ روز توکنِ accessِ تازه بسازد. سشن‌های دستگاه‌های دیگر دست‌نخورده می‌مانند — این logoutِ هر-سشن است، نه سراسری.

#### مقایسه‌های ثابت‌زمان و اثباتِ هویتِ HMAC

چند سطح **بدونِ** JWT احراز می‌کنند و هرکدام از مقایسهٔ ثابت‌زمان برای شکستِ حملاتِ timing بهره می‌برند:

- **توکنِ EA** (`ea.py:26-31`): `hmac.compare_digest(token, settings.EA_TOKEN)` — رباتِ MT5 یک رازِ مشترکِ ثابت ارائه می‌دهد؛ مقایسه ثابت‌زمان است تا مهاجم نتواند بایت‌به‌بایت با اندازه‌گیریِ تأخیر آن را حدس بزند. توکن/رازِ خالی به `False` کوتاه می‌شود.
- **ویجتِ ورودِ تلگرام** (`live.py:93-105`): تأییدِ رسمیِ تلگرام را بازسازی می‌کند — جفت‌ها را مرتب می‌کند، check-string می‌سازد، `secret_key = sha256(bot_token)` مشتق می‌کند، `HMAC-SHA256` محاسبه می‌کند و با `hmac.compare_digest` مقایسه می‌کند. این به‌صورتِ رمزنگارانه ثابت می‌کند payloadِ ورود واقعاً از تلگرام آمده.
- **`initData`ِ WebAppِ تلگرام** (`user_panel.py:281-293`): نسخهٔ WebApp از HMACِ کلیدشده با `WebAppData` طبقِ الگوریتمِ رسمی استفاده می‌کند، باز با `hmac.compare_digest`.

#### جریان‌های OTP / تلگرام

پنلِ کاربری **دو** اثباتِ هویت را زنجیر می‌کند: ورودِ تلگرام (رمزنگارانه) ثابت می‌کند *که هستید*، سپس یک **OTPِ ایمیل** (`/auth/request-otp` ← `/auth/verify-otp`، `user_panel.py:317-339`، با پشتیبانیِ `src/core/email_otp`) *قابلیتِ تماس* را پیش از دسترسی به پنل تأیید می‌کند. آکادمی یک مسیرِ موازیِ ثبت‌نامِ رایگان با OTPِ ایمیل دارد (`academy.py:224-272`).

---

### ۹.۷ کالبدشکافیِ میان‌افزار

#### ۹.۷.۱ CORS (`middleware/cors.py`)

`setup_cors` (`cors.py:47-100`) فهرستِ originهای مجاز را با تقدمِ سه‌لایه انتخاب می‌کند: ۱) `CORS_ORIGINS`ِ صریحِ env؛ ۲) وگرنه در `DEBUG` ← فهرستِ localhost؛ ۳) وگرنه (production) ← فهرستِ صریحِ production ساخته‌شده از `WEBSITE_DOMAIN`/`ADMIN_DOMAIN`/`API_DOMAIN`. قاعدهٔ سخت: **هرگز `"*"`، حتی وقتی config خالی است.** این دوچندان مهم است چون `allow_credentials=True` (`cors.py:73`) با originِ wildcard ناسازگار است — `"*"` بی‌صدا درخواست‌های credentialed را غیرفعال می‌کند. `expose_headers` (`cors.py:83-91`) هدرهای صفحه‌بندی (`X-Total-Count`) و محدودیتِ نرخ (`X-RateLimit-*`) را به SPA نمایان می‌کند، و `max_age=600` preflightها را ۱۰ دقیقه کش می‌کند.

#### ۹.۷.۲ محدودیتِ نرخ (`middleware/rate_limit.py`)

محدودکنندهٔ فعال یک شمارندهٔ **پنجره‌لغزانِ هر-IP، هر-مسیر** با پشتیبانِ sorted setِ Redis است. هر درخواست یک خط‌لولهٔ ۴-دستوری اجرا می‌کند (`rate_limit.py:115-120`): `ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `EXPIRE`. پیکربندیِ zoneها (`rate_limit.py:23-36`):

| zone | حد / پنجره | منطق |
|---|---|---|
| **پیش‌فرض** | ۲۴۰ / ۶۰ث | سخاوتمند — SPAها هنگامِ لود ده‌ها درخواست می‌فرستند |
| `/auth/login` | **۵ / ۶۰ث** | ضدِ brute-force |
| `/auth/refresh` | ۱۰ / ۶۰ث | ضدِ token-grinding |
| `/signals/manual` | ۱۰ / ۶۰ث | حفاظت از ساختِ سیگنالِ دستی |
| `/broadcasts` | ۵ / ۶۰ث | fan-outِ گران |
| `/ea/` | **۶۰۰ / ۶۰ث** | EA پُرتکرار poll می‌کند و احرازشده است |
| `/admin/panel-users` | ۳۰۰ / ۶۰ث | pollingِ داشبورد |
| `/user/copy-status` | ۳۰۰ / ۶۰ث | pollingِ موتورِ کپی |

سه نکتهٔ درستی برجسته است:

- **IPِ کلاینت ضدِ جعل است** (`rate_limit.py:39-58`): اول به `X-Real-IP` (که nginx از `$remote_addr` می‌نویسد و کلاینت نمی‌تواند جعل کند) اعتماد می‌کند، سپس به **آخرین** ورودیِ `X-Forwarded-For` (نزدیک‌ترین پراکسی)، هرگز اولینِ کلاینت-کنترل.
- **حد *پیش از* `call_next` بررسی می‌شود** (`rate_limit.py:127-129`): یک سیل *پیش از* اجرای هندلر رد می‌شود، پس کارِ bcrypt/JWT/DB هرگز روی درخواست‌هایی که ۴۲۹ می‌شوند صرف نمی‌شود.
- **fail-open در قطعیِ Redis** (`rate_limit.py:101-105`, `123-125`): اگر Redis در دسترس نباشد، محدودکننده warning لاگ و درخواست را *اجازه* می‌دهد — اینجا در دسترس‌بودن ترجیح دارد، برخلافِ موضعِ fail-secureِ لیستِ سیاهِ احراز، چون یک خواندنِ عمومی نباید فقط به‌خاطرِ سکسکهٔ ذخیره‌سازِ محدودکننده خاموش شود.

هر پاسخِ مجاز با `X-RateLimit-Limit/Remaining/Reset` مهر می‌خورد (`rate_limit.py:154-157`)؛ ۴۲۹ها علاوه‌براین `Retry-After` حمل می‌کنند.

> **حاشیه — محدودکنندهٔ هر-کاربر.** `middleware/per_user_rate_limit.py` یک محدودکنندهٔ **هر-کاربرِ (با `sub`ِ JWT) رتبه‌بندی‌شده** پیچیده‌تر را پیاده می‌کند (`anonymous` ۲۰←۳۰، `free` ۶۰←۱۰۰، `premium` ۳۰۰←۵۰۰، `admin` ۶۰۰←۱۰۰۰) با همان الگوریتمِ پنجره‌لغزان. کاربر را از JWT تشخیص می‌دهد و برای ترافیکِ ناشناس به IP fallback می‌کند — مشکلِ «هزاران کاربر پشتِ یک IPِ Cloudflare quota مشترک دارند» را حل می‌کند. پیاده‌سازی و در دسترس است؛ `RateLimitMiddleware`ِ هر-IP همان است که در `main.py` سیم‌کشی شده.

#### ۹.۷.۳ هدرهای امنیتی (`middleware/security_headers.py`)

روی **هر** پاسخ مهر می‌شود (`security_headers.py:41-71`): `Strict-Transport-Security` (یک‌ساله، `includeSubDomains`، فقط وقتی `enable_hsts` یعنی نه در DEBUG)، `X-Frame-Options: DENY`، `X-Content-Type-Options: nosniff`، `Referrer-Policy`، یک `Permissions-Policy`ِ محدودکننده (غیرفعال‌سازیِ geolocation/camera/mic/payment/usb)، و یک **CSPِ کاملاً قفل‌شدهٔ API** (`default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`) — مناسب چون این پردازه پاسخ‌های JSON/API می‌دهد نه فرانت‌اندهای HTML (که nginx با CSPِ خودشان سرو می‌کند).

#### ۹.۷.۴ میان‌افزارِ مستقلِ JWT

`middleware/auth.py` یک `JWTAuthMiddleware` فراهم می‌کند که توکن‌ها را پیش‌اعتبارسنجی و payload را روی `request.state.admin_payload` می‌گذارد، با `EXCLUDED_PATHS`/`EXCLUDED_PREFIXES` (مثلِ `/ws/`، `/articles`). اپِ production برای مجوزدهی به **`Depends`ِ هر-مسیر** تکیه می‌کند نه این میان‌افزارِ سراسری — احرازِ مبتنی‌بر-وابستگی، granularityِ هر-اندپوینت می‌دهد و در OpenAPI خود-مستند است، حال‌آنکه یک میان‌افزارِ سراسری نمی‌تواند «این مسیر عمومی است، آن یکی فقط-ادمین» را بیان کند.

---

### ۹.۸ وب‌سوکت‌ها

دو اندپوینتِ WebSocket وجود دارد، با مواضعِ احرازِ کاملاً متفاوت.

#### استریمِ عمومیِ قیمت — `WS /ws/prices` (`live_prices.py:116-191`)

بدونِ احراز. یک `ConnectionManager` (`live_prices.py:27-75`) سوکت‌های فعال را ردیابی و broadcast می‌کند. هنگامِ اتصال، سرور نمادهای پیش‌فرض را push می‌کند و سپس **یک حلقهٔ ۱-ثانیه‌ای** کلیدهای `price:{SYMBOL}` را از Redis با pipeline می‌خواند (`live_prices.py:80-113`) و `{"type":"prices","data":{…}}` استریم می‌کند. یک taskِ هم‌زمانِ `receive_messages` (`live_prices.py:132-162`) به کلاینت اجازه می‌دهد به فهرستِ نمادِ دلخواه (سقفِ ۵۰، بزرگ‌حرف) `subscribe` کند یا `ping`/`pong` بزند. قطع‌ها taskِ دریافت را تمیز cancel می‌کنند.

#### چتِ لایو-ترید — `WS /live/ws/chat` (`live.py:349-…`)

احراز با **پارامترِ کوئریِ `token`** (مرورگرها نمی‌توانند هدرِ `Authorization` روی WebSocket بفرستند). هندلر (`live.py:357-…`) هرکدام را می‌پذیرد:

- یک **توکنِ چتِ تلگرام** (`_decode_live`) ← هویتِ بیننده با `tg`,`name`,`photo`,`vip`؛
- یا یک **توکنِ accessِ ادمین** (با نقشِ admin/superadmin/analyst) ← اتصال به‌عنوانِ میزبانِ پخش؛
- یا **هیچ** ← *مهمانِ* فقط-خواندنی که می‌بیند اما نمی‌نویسد.

اجازهٔ نوشتن محاسبه می‌شود (`live.py:~386`): ادمین همیشه؛ کاربرِ واردشده در حالتِ `public`؛ فقط VIP در حالتِ `subscribers`. این تک‌سوکت بنابراین سه ردهٔ امتیاز را از یک اندپوینت سرو می‌کند. همراهانِ RESTیِ فقط-ادمین (`/live/admin/start|stop|mode|ban|mute|pin|slowmode|clear`، `live.py:519-643`) وضعیتِ اتاق را می‌رانند.

---

### ۹.۹ سطوحِ EA و ماشین

روترِ `/ea` (`ea.py`) قراردادِ بینِ سرور و Expert Advisorِ متاتریدر ۵ است. با `EA_TOKEN`ِ ثابت (ثابت‌زمان، §۹.۶) احراز می‌کند نه با JWT، چون EA یک رباتِ بومیِ بلندمدت است نه کاربرِ مبتنی‌بر-سشن. اندپوینت‌ها: `GET /ea/signals` (سیگنال‌های فعالِ live به شکلِ EA-پسند)، `GET /ea/config` (تنظیماتِ ریسک/لات/trailing از کلیدِ Redisِ `ea:settings` که از پنل قابلِ تنظیم است)، `POST /ea/heartbeat`، `POST /ea/deals` (fillهای واقعی ← تاریخچهٔ P&L)، `POST /ea/specs` و `POST /ea/symbols` (متادیتای ابزارِ بروکر). بالاترین zoneِ محدودیتِ نرخ (۶۰۰/دقیقه) را حمل می‌کند چون پُرتکرار poll می‌کند.

---

### ۹.۱۰ یک API، پنج فرانت‌اند: بازنویسیِ `/api`ِ nginx

پردازهٔ واحدِ FastAPI پشتِ vhostهای nginx — یکی به‌ازای هر origin — در `nginx/conf.d/` قرار دارد: `website.conf`، `admin.conf`، `user.conf`، `academy.conf`، `ig.conf` (به‌علاوهٔ `mt5.conf`). ترفندِ یکپارچه‌کننده یک **بازنویسیِ مسیر** است که اجازه می‌دهد هر SPA یک URLِ هم-originِ `/api/...` صدا بزند (اجتنابِ preflightهای CORS و دردسرهای کوکی/origin) درحالی‌که backend مسیرهای prefix-تمیز می‌بیند:

```nginx
# nginx/conf.d/website.conf:48-49 / user.conf:44-45 / academy.conf:44-45
rewrite ^/api(/v1)?/(.*)$ /$2 break;
proxy_pass http://api_backend;
```

پس مرورگر `https://academy.fx/api/academy/me` را درخواست می‌کند؛ nginx، `/api` را حذف و `GET /academy/me` را به upstreamِ مشترکِ `api_backend` پراکسی می‌کند. **به همین دلیل هر prefix در §۹.۴ *بدونِ* `/api` نوشته شده** — و به همین دلیل حافظهٔ پروژه یادداشت می‌کند «مسیرها prefixِ `/api` ندارند»: این prefix یک قراردادِ لایهٔ nginx است، نامرئی برای FastAPI. مکان‌های WebSocket بلوک‌های اختصاصی می‌گیرند (`website.conf:57-59`, `:101`, `:156`) که افزون‌براین هدرهای `Upgrade`/`Connection` را پاس می‌دهند و به `…/ws/` (استریمِ قیمت) و `/live/ws/` (چت) پراکسی می‌کنند.

پیامدهای این معماری:

۱. **یک واحدِ استقرار، یک رازِ احراز، یک استخرِ DB** — عملیاتی ساده؛ claimهای اسکوپِ §۹.۶ همان جداسازیِ اجاره‌داری را فراهم می‌کنند که سرویس‌های جدا در لایهٔ شبکه اعمال می‌کردند.
۲. **CORS برای ترافیکِ هم-originِ SPA عمدتاً بلاموضوع است** — هر SPA با `/api`ِ origin خودش حرف می‌زند؛ فهرستِ مجازِ CORS (§۹.۷.۱) عمدتاً فراخوان‌های واقعاً cross-origin را گارد می‌کند.
۳. **TLS، هدرها و مسیریابیِ خزنده‌ی هر-vhost** در nginx زندگی می‌کنند و اپِ پایتون را transport-agnostic نگه می‌دارند.

به‌طورِ خلاصه: یک *مونولیتِ ماژولار* در لایهٔ API، که با **اسکوپِ JWT + vhostِ nginx** به پنج سطحِ محصول شارد می‌شود، نه با مرزهای پردازه — مصالحهٔ درست برای یک استقرارِ تک‌سرورِ ۱۶ گیگابایتی که در آن راه‌اندازیِ پنج میکروسرویس، RAMی را که پروژه ندارد هدر می‌داد.

---

[⬅ 8. Backtesting, Walk‑Forward & Live‑Readiness Gating](backtesting.md) · [🏠 Home · خانه](../README.md) · [10. The Telegram Bot — aiogram Delivery, Onboarding & Access ➡](telegram-bot.md)
