[⬅ 14. Content, SEO & AI Growth Engine](content-seo.md) · [🏠 Home · خانه](../README.md) · [16. Observability, Operations & Deployment ➡](observability-ops.md)

---

## 15. Core Infrastructure & Security Posture

> Everything in this chapter lives under [`src/core/`](src/core/) and the security-relevant helpers under [`scripts/`](scripts/). The `core` package is the load-bearing foundation: the database layer, configuration, Redis, cryptography, the security primitives, structured logging, and the event-loop bootstrap. If `src/core` is wrong, *everything* downstream — the signal engine, the bot, the API, the copy-trade workers — is wrong with it. This chapter documents that foundation exhaustively and then turns to the project's candid **threat model and security posture**.

---

### 15.1 Map of `src/core/`

| File | Responsibility |
|------|----------------|
| `database.py` | Async SQLAlchemy 2.0 engine, `async_session_factory`, `get_session()`, ~60 ORM models, `init_db()` / `close_db()` |
| `config.py` | `pydantic-settings` `Settings` singleton — every env var, `SYMBOLS`/`TIMEFRAMES`, `TRADING_MODE`, production secret enforcement |
| `redis_client.py` | Async Redis client (cache + pub/sub), price/active-signal indices, pipeline-batched reads |
| `crypto.py` | Fernet symmetric encryption of user broker / IG credentials at rest (`USER_CREDS_ENC_KEY`) |
| `security.py` | JWT issue/verify (access + refresh, `jti`), bcrypt password hashing |
| `logger.py` | `structlog` JSON logging with an automatic **secret redactor** processor |
| `fast_loop.py` | `uvloop` install (fail-soft) for every async entrypoint |
| `html_sanitizer.py` | XSS / SSRF defence for user-saved HTML and URLs (bleach + fallback) |
| `celery_app.py` | Celery app, queue routing (`ig`, `critical`, default), beat schedule |
| `config`/`instruments`/`metrics`/`health`/`observability` | per-instrument specs, Prometheus metrics, health gauges, tracing |

The cardinal rule, repeated in code comments and in the project's `CLAUDE.md`: **secrets are never printed, never committed, and never stored in plaintext.**

---

### 15.2 The database layer — async SQLAlchemy 2.0 over TimescaleDB

#### 15.2.1 Engine and session factory

The async engine is created once, at import time, in `src/core/database.py`:

```python
engine = create_async_engine(
    settings.DATABASE_URL,            # postgresql+asyncpg://...
    echo=False,
    pool_size=getattr(settings, "DB_POOL_SIZE", 30),
    max_overflow=getattr(settings, "DB_MAX_OVERFLOW", 20),
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

Design points that matter operationally:

- **Driver:** `postgresql+asyncpg` for the app (async hot path), with a parallel `postgresql+psycopg2` sync URL (`DATABASE_URL_SYNC`) exposed for Alembic migrations and synchronous tooling.
- **Pool sizing:** default `pool_size=30` + `max_overflow=20` = up to **50 concurrent connections per process**. This is deliberately large because many processes share one Postgres: API workers, the signal engine, the tracker, and Celery workers. The values are env-overridable (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`) so the operator can keep the *aggregate* connection count under Postgres's `max_connections`.
- **`pool_pre_ping=True`** — every checkout issues a cheap liveness probe, so a connection killed by a server-side idle timeout or a TimescaleDB restart is transparently recycled instead of throwing a stale-connection error into the signal loop.
- **`pool_recycle=3600`** — connections older than an hour are discarded, defeating any intermediary (NAT/firewall) that silently drops long-lived TCP sessions.
- **`expire_on_commit=False`** — ORM objects stay usable after `commit()`, which the async code relies on heavily (no surprise lazy-load round-trips after a commit boundary).
- **Password URL-encoding:** `DATABASE_URL` runs `quote(self.DB_PASSWORD, safe='')`, so a rotated password containing `+ / @ :` cannot break the DSN. The same is done for `REDIS_URL`. This is a real bug-class that `rotate_secrets.sh` would otherwise reintroduce on every rotation.

#### 15.2.2 The `get_session()` contract

```python
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

This is the single transactional contract for the whole codebase: **commit-on-success, rollback-on-exception, always-close.** Used both as a FastAPI dependency and directly via `async with`. Because it commits at the *end* of the `yield`, request handlers don't sprinkle `commit()` calls; they either succeed (auto-commit) or raise (auto-rollback). This is the difference between a partially-written `TradeHistory` row and a clean abort.

#### 15.2.3 ORM model overview

`Base` is a SQLAlchemy 2.0 `DeclarativeBase`; models use the typed `Mapped[...]` / `mapped_column(...)` style throughout. There are roughly **60 tables** spanning every product surface. A representative sample:

| Domain | Tables (selection) |
|--------|--------------------|
| **Signals & performance** | `signals`, `signal_performance`, `ml_model_performance`, `trade_history` |
| **Users & accounts** | `users`, `trading_accounts`, `copy_servers`, `copy_settings`, `disclaimer_acceptances` |
| **Bot funnel & billing** | `onboarding_sessions`, `payment_requests`, `subscriptions`, `channel_members`, `bot_messages` |
| **Admin & content** | `admins`, `articles`, `activity_logs`, `broadcasts` |
| **Backtest** | `backtest_runs`, `backtest_trades` |
| **Academy** | ~30 tables: `academy_students`, `academy_devices`, `academy_lessons`, `academy_videos`, `academy_subscriptions`, `academy_progress`, `academy_quizzes`, `academy_paper`, `academy_mentor_threads`, … |
| **Instagram** | `ig_users`, `ig_accounts`, `ig_messages`, `ig_auto_replies`, `ig_forms`, `ig_contents`, `ig_autopilots`, `ig_inbox` |
| **SEO** | `seo_metrics_daily`, `seo_actions`, `seo_pagespeed`, `seo_monitored_urls` |
| **BazaarNama (charting)** | `bn_layouts`, `bn_scripts`, `bn_alerts`, `bn_watchlists`, `bn_ai_signals` |
| **Analytics** | `visit_events` |

Conventions worth noting for anyone extending the schema:

- **Money is `Numeric`, never `float`.** Prices use `Numeric(20, 8)`, P&L uses `Numeric(15, 2)` / `Numeric(10, 2)`, balances `Numeric(18, 2)`. Float drift in a trading ledger is unacceptable.
- **Status fields carry both a Python `default` and a DB `server_default`** (e.g. `Signal.status = "active"` with `server_default="active"`), and are **indexed**. This was load-bearing in a real incident (see the "status-case root bug" in project memory): rows inserted by raw SQL or migrations must still get a sane status.
- **`JSONB`** (Postgres native) is used for semi-structured payloads (`mtf_confirmation`, `analysis_details`, IG `buttons`/`products`, auto-reply `keywords`). `ARRAY(Text)` for `users.preferred_symbols`.
- **Foreign keys use `ondelete="CASCADE"`** where a child cannot outlive its parent (`trading_accounts.user_id`, `ig_accounts.owner_id`), so deleting a user does not orphan linked rows.
- **Encrypted columns are typed `Text`/`String(500)` and named `*_enc` / `enc_*`** — `trading_accounts.password_enc`, `ig_accounts.enc_password`, `ig_accounts.enc_totp`. The column *type* is plain text; the *content* is a Fernet token (§15.5). **The raw secret is never a column.**

#### 15.2.4 Hypertables — the time-series spine

The ORM `Base.metadata.create_all` (`init_db()`) builds the relational tables, but the two highest-volume tables — **`candles`** and **`ticks`** — are *not* ORM models. They are created and promoted to **TimescaleDB hypertables** in `scripts/migrate_db.py`, then tuned by `scripts/timescale_perf.sql`. This is intentional: market data is append-heavy and queried by time-range, exactly TimescaleDB's sweet spot, and keeping it out of the ORM avoids accidental `SELECT *` ORM materialisation.

`candles` (composite PK `symbol, timeframe, timestamp`) and `ticks` (`symbol, timestamp`) are promoted with:

```sql
SELECT create_hypertable('candles', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ticks',   'timestamp', if_not_exists => TRUE);
```

and then governed by **lifecycle policies**:

| Policy | `candles` | `ticks` |
|--------|-----------|---------|
| **Retention** | 3 months | 7 days |
| **Compression** | on, after 7 days | — |
| **Compress segment-by** | `symbol, timeframe` | — |
| **Compress order-by** | `time DESC` | — |
| **Continuous aggregate** | `candles_daily` rollup from M15, refreshed hourly | — |

The `candles_daily` continuous aggregate (`time_bucket('1 day', time)` with `first/max/min/last/sum`) gives the backtester and analytics views instant daily OHLCV without re-scanning compressed chunks. All policy DDL is **idempotent** (`if_not_exists => TRUE`), so re-running the migration on production is safe — the scripts double as documentation of the live configuration.

`CandleBuilder` (`src/data/candle_builder.py`) writes into `candles` with a source-priority `ON CONFLICT` upsert (higher-trust data sources overwrite lower-trust ones for the same bar) — the hypertable is the single source of truth that every analysis module reads from.

---

### 15.3 The configuration system

`src/core/config.py` defines a single `Settings(BaseSettings)` class (`pydantic-settings`) and exports a module-level singleton `settings = Settings()`. Configuration is read from `.env` (`model_config = {"env_file": ".env", "extra": "ignore"}`); unknown keys are ignored rather than fatal, so the same `Settings` class tolerates a richer `.env` than it declares.

#### 15.3.1 Key environment variables

The class declares well over a hundred settings. The security- and infrastructure-relevant subset:

| Variable | Default | Purpose / notes |
|----------|---------|-----------------|
| `DEBUG` | `False` | Production must be `False`; flips the secret enforcer from warn → fatal |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | `forex_signal` / `coinepro` / `changeme` / `timescaledb` / `5432` | Composed into `DATABASE_URL` (asyncpg) and `DATABASE_URL_SYNC` (psycopg2) |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `30` / `20` | Per-process connection pool ceiling |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_MAX_CONNECTIONS` | `redis` / `6379` / `changeme` / `150` | Composed into `REDIS_URL` |
| `JWT_SECRET_KEY` | `"change-me-..."` | **Enforced ≥ 32 chars in prod**; signs all access/refresh tokens |
| `JWT_ALGORITHM` | `HS256` | Symmetric HMAC signing |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` / `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `30` / `7` | Token lifetimes |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `changeme` | Admin bootstrap; `changeme` is rejected in prod |
| `GRAFANA_PASSWORD` | `changeme` | Rejected in prod |
| `USER_CREDS_ENC_KEY` | `""` | **Fernet key** for encrypting user MT5/IG credentials at rest (§15.5) |
| `EA_TOKEN` | `""` | Shared secret authenticating the auto-trader Expert Advisor; compared in constant time |
| `COPY_ENGINE_TOKEN` | `""` | Auth for the copy engine |
| `RESEND_API_KEY` | `""` | Email-OTP delivery |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_IDS` | `""` | Bot + admin allowlist |
| `MT5_LOGIN` / `MT5_PASSWORD` / `MT5_SERVER` | `""` / `""` / `MetaQuotes-Demo` | Master account creds (from env only) |
| `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `YOUTUBE_*`, `FRED_API_KEY`, `FINNHUB_API_KEY`, `ALPHAVANTAGE_API_KEY`, `TWELVEDATA_API_KEY` | `""` | Third-party integration secrets — all default empty, set only via env |
| `LIVE_TURN_PASSWORD`, `LIVE_PUBLISH_PASSWORD`, `LIVE_DESKTOP_PASSWORD` | `""` | Live-trading stream / desktop creds — **"hرگز در سورس" (never in source)** per inline comments |

Every secret defaults to `""` or a recognisable placeholder so a missing env var fails loudly rather than silently using a real-looking value.

#### 15.3.2 `SYMBOLS`, `TIMEFRAMES`, instrument metadata

`Settings` is also the canonical instrument registry:

- **`SYMBOLS`** — the 20 tradable instruments (metals `XAUUSD`/`XAGUSD`, majors/crosses, oil `XTIUSD`, indices `US30`/`US500`/`NAS100`/`DE40`).
- **`BROKER_SYMBOL_MAP`** — internal→broker name translation (`NAS100→USTEC`, `XTIUSD→WTI`). The engine reasons in standard names; the EA executes in OneRoyal's names. A mismatch here is a "symbol not found" execution failure, so it lives in config, validated against the broker's 2074-symbol list.
- **`TIMEFRAMES`** = `M5, M15, H1, H4, D1` (candles fetched); **`SIGNAL_TIMEFRAMES`** = `M15, M5` (where signals are actually emitted). Higher TFs are MTF-confirmation only.
- Derived `@property` maps: `symbol_names_fa` (Persian display names), `pip_values` (per-symbol pip size). Keeping these as properties — not env vars — means they're versioned with the code, not the deployment.

#### 15.3.3 `TRADING_MODE` gating

```python
TRADING_MODE: str = "paper"   # "paper" | "live" | "disabled"
```

This is the master safety switch. `paper` (the safe default) forward-tests without exposing users; `live` publishes to users / drives real execution; `disabled` halts emission entirely. Project policy (in `CLAUDE.md`) is that `TRADING_MODE` stays `paper` until the divergence report proves signal quality on the live broker. Two adjacent settings — `DAILY_LOSS_BLOCKS_EMISSION` and `CORRELATION_BLOCKS_EMISSION` — are deliberately `False`: the daily-loss circuit breaker and correlation cap are *single-account portfolio* concerns, not reasons to silence the signal feed, so by default they log but do not gate emission. Turning them `True` hard-protects the master auto-trader.

#### 15.3.4 Production secret enforcement (fail-closed)

The most important security mechanism in `config.py` is a Pydantic `@model_validator(mode="after")` that **refuses to boot with default secrets in production**:

```python
@model_validator(mode="after")
def _enforce_secure_secrets_in_production(self) -> "Settings":
    issues = []
    if self.DB_PASSWORD in _INSECURE_PASSWORDS:    issues.append("DB_PASSWORD")
    if self.REDIS_PASSWORD in _INSECURE_PASSWORDS: issues.append("REDIS_PASSWORD")
    if self.ADMIN_PASSWORD in _INSECURE_PASSWORDS: issues.append("ADMIN_PASSWORD")
    if self.GRAFANA_PASSWORD in _INSECURE_PASSWORDS: issues.append("GRAFANA_PASSWORD")
    if self.JWT_SECRET_KEY in _INSECURE_JWT_SECRETS or len(self.JWT_SECRET_KEY) < 32:
        issues.append("JWT_SECRET_KEY")
    if not issues:
        return self
    # ... build message ...
    if self.DEBUG:
        warnings.warn(message, RuntimeWarning); return self   # dev: warn only
    raise ValueError(message)                                  # prod: hard fail
```

`_INSECURE_PASSWORDS` blocks `changeme`, `admin`, `password`, `123456`, `""`, etc.; `_INSECURE_JWT_SECRETS` blocks known placeholders and **anything shorter than 32 chars**. In `DEBUG=True` (local dev) it only warns so work isn't blocked; in production it raises `ValueError` and the container crash-loops until `.env` is fixed. This converts the classic "shipped with default password" disaster into an *un-bootable* configuration.

---

### 15.4 Redis client

`src/core/redis_client.py` exposes a singleton `redis_client = RedisClient()` over `redis.asyncio`. It is the cache + pub/sub backbone. The connection pool (`from_url`) is configured with `decode_responses=True`, `max_connections=REDIS_MAX_CONNECTIONS` (150), `socket_keepalive=True`, and `health_check_interval=30`.

Performance-critical patterns baked in:

- **Active-signal index as a Sorted Set.** Instead of `KEYS signal:active:*` (an O(N) *blocking* command on single-threaded Redis — measured at ~200 ms for 1000 signals), an index `signals:active_ids` (ZSET scored by creation time) is maintained, and bulk reads use `ZREVRANGE` + a pipelined `MGET` (1 RTT). Real-world: **200 ms → 15–20 ms**. `set/remove_active_signal` keep key and index in sync atomically inside a pipeline; `get_all_active_signals` lazily GCs stale index entries whose keys expired. `count_active_signals` is O(1) via `ZCARD`.
- **`get_all_prices` uses `SCAN` + pipelined `MGET`**, never `KEYS` — non-blocking, one round-trip.
- **TTL discipline:** prices live 600 s (the upstream yfinance source is rate-limited, so a long TTL keeps "market state" populated between fetches; consumers carry timestamps and judge staleness themselves). Active signals get a **14-day** TTL — a safety net only; positions are removed explicitly on close. A prior bug used a 24 h TTL, which dropped open positions out of the index so the tracker stopped checking TP/SL and the DB row stayed `active` forever.
- **`increment()` does `INCR`+`EXPIRE` in one pipeline**, so a crash between the two can't leave a key without a TTL (used for rate-limit / quota counters).
- Serialisation is `orjson` everywhere for speed.

---

### 15.5 Cryptography — credentials encrypted at rest

`src/core/crypto.py` is small but security-critical. User broker passwords (MT5) and Instagram passwords/TOTP secrets are **encrypted with Fernet (AES-128-CBC + HMAC-SHA256 authentication)** before they touch the database.

```python
def _fernet() -> Fernet:
    key = (settings.USER_CREDS_ENC_KEY or "").strip()
    if not key:
        digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
        logger.warning("creds_enc_key_missing_using_derived")
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()

def decrypt_secret(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        logger.warning("creds_decrypt_failed")
        return None
```

Properties of this design:

- **Key source:** `USER_CREDS_ENC_KEY` (env). If unset, an **emergency key is derived** from `SHA-256(JWT_SECRET_KEY)` so the app never crashes — but it logs `creds_enc_key_missing_using_derived` loudly, because in production the dedicated key *must* be set (deriving from the JWT secret couples credential confidentiality to the JWT secret's lifetime, which is undesirable when rotating JWT).
- **Authenticated encryption:** Fernet is AEAD; a tampered ciphertext fails `decrypt` rather than yielding garbage plaintext.
- **Fail-soft decrypt:** `decrypt_secret` returns `None` on any failure (wrong key after rotation, corruption, tampering) instead of throwing into a request handler. Callers treat `None` as "credential unavailable."
- **The plaintext is never persisted.** Per the module docstring: *"رمزِ خام هرگز در دیتابیس ذخیره نمی‌شود — فقط نسخهٔ رمزنگاری‌شده"* — only the ciphertext is stored, in the `*_enc` / `enc_*` columns described in §15.2.3.

This means a database dump alone — the most common breach vector — does **not** expose any user's broker or social credentials. Decryption requires the separate `USER_CREDS_ENC_KEY`, which lives only in `.env` (git-ignored) on the host.

---

### 15.6 Security primitives — JWT & password hashing

`src/core/security.py` provides the authentication primitives.

**Password hashing** uses Passlib with **bcrypt**:

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(p):   return pwd_context.hash(p)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
```

bcrypt is adaptive (per-hash salt + tunable cost), and `verify` is itself constant-time, so password verification is not a timing oracle.

**JWT** (via `python-jose`, `HS256`):

```python
def create_access_token(data, expires_delta=None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now, "jti": uuid.uuid4().hex, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
```

Design points:

- **Every token carries a unique `jti`** (UUID4 hex) — this enables precise *single-token* blacklisting/revocation rather than nuking a whole user's sessions.
- **`type` claim (`access` vs `refresh`)** is enforced: `verify_access_token` rejects a refresh token presented where an access token is required, and vice-versa. This blocks the "use the long-lived refresh token as an access token" confusion.
- **`iat` + `exp`** are explicit and timezone-aware (UTC).
- **Rotating `JWT_SECRET_KEY` invalidates every live token** — a feature, used as the emergency "log everyone out" lever (the rotation script warns about exactly this).
- `decode_token` catches `JWTError` and logs a redacted `jwt_decode_failed` rather than propagating a stack trace with the token in it.

**Scopes / role separation** are handled at the route/dependency layer (admin vs user vs academy-student vs IG-tenant), and machine-to-machine endpoints use **shared-secret tokens compared in constant time** — see §15.8.

---

### 15.7 Structured logging with automatic secret redaction

`src/core/logger.py` configures `structlog` to emit **JSON** (`JSONRenderer(ensure_ascii=False)` — Persian text stays readable) with ISO timestamps and log levels. The standout feature is a custom processor, `secret_redactor`, inserted into the pipeline *before* the final render:

- **Key-based redaction:** any field whose key matches `_SECRET_KEY_PATTERNS` — `password`, `*_password`, `*_secret`, `token`, `*_token`, `api_key`, `jwt`, `authorization`, `bearer`, `refresh_token`, `access_token`, `session`, `cookie`, `private_key` — has its value replaced with `[REDACTED]`. It recurses into nested dicts, lists, and tuples.
- **Value-based redaction:** even if a secret slips into a *value* string, regexes catch and mask it: JWTs (`eyJ…​.…​.…​` → `[JWT_REDACTED]`), `Bearer …` headers, and `sk_/pk_/api_` API-key shapes.

The net effect: a developer can `logger.info("login", **payload)` without auditing whether `payload` contains a token — the redactor is the safety net. Noisy third-party loggers (`httpx`, `sqlalchemy.engine`, `aiogram`, …) are pinned to `WARNING`. This redactor is what makes it *safe* to ship logs to Grafana/Loki and to paste them into support channels.

---

### 15.8 `fast_loop` — uvloop bootstrap

`src/core/fast_loop.py` is intentionally tiny:

```python
def install_uvloop() -> bool:
    try:
        import uvloop
        uvloop.install()
        return True
    except Exception:   # never break startup
        return False
```

Called at the top of every async entrypoint *before* `asyncio.run`, it swaps in **uvloop** (a libuv-backed event loop, up to ~2× faster than stock asyncio) for the price-feed, signal engine, tracker, and API. It is **fail-soft**: on any platform where uvloop is absent or unsupported it silently falls back to the default loop, returning `False`. A faster loop is a free win on a latency-sensitive trading hot path, but it must *never* be the reason the process won't start.

---

### 15.9 Security posture & threat model

This section is deliberately candid. The project handles **real money, real broker credentials, and real user PII (KYC)**, so the threat model is taken seriously, but it is also honest about what is and isn't mitigated.

#### 15.9.1 Threat model summary

| Asset | Primary threat | Primary control |
|-------|----------------|-----------------|
| User broker / IG credentials | DB dump, insider read | Fernet encryption at rest; key outside DB (§15.5) |
| JWT signing key | Source/git leak, brute force | git-ignored `.env`; ≥32-char enforced; HS256; rotatable |
| Admin / Grafana / DB / Redis passwords | Default-password ship | Fail-closed prod validator (§15.3.4); rotation script |
| EA / copy-engine endpoints | Forged execution commands, timing attack | Constant-time shared-secret compare (§15.8.2) |
| User-saved HTML (articles/broadcasts) | Stored XSS | bleach sanitizer + URL scheme allowlist (§15.9.3) |
| Outbound URL fetches | SSRF to cloud metadata / internal net | private/loopback/link-local IP block (§15.9.3) |
| Logs | Secret leakage to log sinks | structlog redactor (§15.7) |
| The host | SSH brute force, exposed ports | ufw default-deny + fail2ban + auto-updates (§15.9.4) |
| Dependencies / Docker images | Known CVEs, leaked secrets in history | gitleaks + trivy + bandit + pip-audit + hadolint (§15.9.5) |

#### 15.9.2 Secrets never in git — `.gitignore` coverage

The owner's stated policy is "everything goes to GitHub *except* two categories" — and the `.gitignore` enforces exactly that. Category 1 is **live keys / credentials**, whose leak equals account compromise:

```
.env  .env.local  .env.production
*.elkey  *.pexkey  *.igkey  *.tgtoken  *.key  *.session  *.secrets
ig_session.json
ig_data/.igkey  avatar_work/.elkey  avatar_work/.pexkey  avatar_work/stage/.elkey
media/        # live-trade config: TURN/stream/MT5 login
backups/      # old snapshots may contain .env/keys
/secrets/
```

Category 2 is regenerable junk (`node_modules/`, `__pycache__/`, `*.pyc`, `dist/`, video-studio outputs). Key observations:

- **`.env*` and all key/session/token file extensions are blocked** — the Fernet key, JWT secret, bot token, IG sessions, ElevenLabs/Pexels keys, and the `/secrets/` mount can never be committed.
- **`media/` and `backups/` are ignored** specifically because they have historically carried embedded secrets (live-trade config, old env snapshots) — a subtle but real exfiltration path that's been closed.
- This is *verified*, not just trusted: `gitleaks` (with a project `.gitleaks.toml`) scans both the working tree **and git history** for secret patterns (§15.9.5), so a secret committed by mistake in any past commit is caught.

#### 15.9.3 XSS & SSRF hardening (`html_sanitizer.py`)

User-authored HTML (articles, broadcast messages, any rendered user field) is run through `src/core/html_sanitizer.py`:

- **XSS:** an allowlist of safe tags (`p, h1–h6, strong, em, ul/ol/li, a, img, table…`) and per-tag safe attributes; `bleach` (Mozilla-maintained) is preferred, with a regex fallback if bleach is absent. `javascript:` and `data:` URLs are stripped; only `http/https/mailto` schemes survive (`_SAFE_PROTOCOLS`).
- **SSRF:** `validate_url()` resolves the host and **rejects private, loopback, link-local, reserved, and multicast addresses** via `ipaddress` — explicitly including `169.254.169.254` (cloud-metadata IP), `10/8`, `172.16/12`, `192.168/16`, `127.x`, `::1`, `fc00::/7`. This prevents a user-supplied URL (e.g. an article image, a webhook) from being used to pivot into the cloud metadata service or the internal Docker network.

#### 15.9.4 The 6-agent security audit & its fixes

A dedicated 6-agent security audit was run against the whole project; its concrete, code-level outcomes (recorded in project memory under *"CoinePro security hardening"*) are:

1. **Constant-time token comparison.** Every machine-to-machine shared-secret check uses `hmac.compare_digest`, not `==`, defeating timing attacks. Verified live in:
   - `src/api/routes/ea.py` → `_ea_token_ok()` (auto-trader EA token)
   - `src/api/routes/live.py` (live-stream auth)
   - `src/api/routes/user_panel.py` (Telegram login-hash verification)
   - `src/core/email_otp.py` (OTP code-hash verification)
2. **SSRF / XSS hardening** — the sanitizer and URL validator above.
3. **Dependency CVEs** — pinned/updated to clear known-vulnerable versions, continuously re-checked by `trivy` + `pip-audit`.
4. **coturn** (the TURN server for WebRTC live trading) hardened — credentialled, not open relay.
5. **OSS scanners wired in** — the repeatable `security_scan.sh` pipeline (§15.9.5).
6. **Server + Windows hardening scripts** — `server_hardening.sh` for the Linux host and equivalent hardening for the Hetzner Windows copy-trade servers.

`scripts/server_hardening.sh` (idempotent, `sudo`-guarded) is the Linux piece:

- **ufw firewall:** `default deny incoming`, opening only SSH (auto-detected port, opened *first* to avoid lockout), `80/tcp`, `443/tcp`, and `8189/udp` (WebRTC ICE). It explicitly advises adding a **Hetzner Cloud Firewall** as a second layer that Docker's iptables manipulation cannot bypass.
- **fail2ban:** jails for `sshd`, `nginx-http-auth`, `nginx-limit-req`, `nginx-botsearch`; internal/private ranges are never banned.
- **unattended-upgrades:** automatic security patching enabled.
- It deliberately **does not touch the SSH daemon config** (per owner request) — only firewall + fail2ban.

#### 15.9.5 Repeatable OSS security scanning

`scripts/security_scan.sh` runs five industry-standard scanners, all via Docker (no host installs), writing timestamped reports to `security-report/`:

| Tool | Scope |
|------|-------|
| **gitleaks** | Secret leakage in code **and git history** (uses `.gitleaks.toml`) |
| **trivy fs** | Dependency + filesystem CVEs + misconfig (`HIGH,CRITICAL`, `--ignore-unfixed`) |
| **pip-audit** | Python dependency CVEs from `requirements.txt` |
| **bandit** | Python static security analysis (SAST) over `src` |
| **hadolint** + **trivy config** | Dockerfile / compose best-practice & misconfig |

Invocation is selective — `bash scripts/security_scan.sh [all|secrets|deps|sast|docker]` — so secret-scan can gate every commit while the heavier CVE scan runs on a schedule.

#### 15.9.6 Operational secret rotation

`scripts/rotate_secrets.sh` generates a fresh `.env.new` with cryptographically strong values (`openssl rand -base64 32` for passwords, `openssl rand -hex 32` for the JWT secret and backup passphrase), `sed`-replacing `DB_PASSWORD`, `REDIS_PASSWORD`, `ADMIN_PASSWORD`, `GRAFANA_PASSWORD`, `JWT_SECRET_KEY`, and `BACKUP_PASSPHRASE`. It `chmod 600`s the output and prints the safe cut-over runbook (backup current `.env` → diff → `mv` → `docker compose down && up -d` → health-check). It **loudly warns that rotating `JWT_SECRET_KEY` logs every user out** — turning that side effect into a deliberate, documented operational lever rather than a surprise.

#### 15.9.7 Honest limitations (residual risk)

A rigorous chapter names what is *not* fully solved:

- **`USER_CREDS_ENC_KEY` derivation fallback:** if the dedicated key is unset, confidentiality degrades to `SHA-256(JWT_SECRET_KEY)`. The warning is logged, but nothing *forces* the dedicated key the way the config validator forces the JWT secret. Production deployments must set it explicitly.
- **JWT is HS256 (symmetric):** the API and any verifier share the signing secret. This is fine for a single-trust-domain monolith but means there is no public-key verification boundary; protecting the secret is paramount.
- **Single Postgres / single Redis:** there's no secret-manager (Vault/KMS) in the loop — secrets live in a `chmod 600` `.env` on the host. This is a pragmatic posture for a single-owner deployment, with host hardening + git hygiene as the compensating controls.
- **Self-custody of broker passwords:** storing user MT5 passwords at all (even encrypted) is an inherent risk accepted to enable server-side copy-trading; it is mitigated by Fernet-at-rest, KYC gating, the `COPY_LIVE_ENABLED=False` default, and the copy-validation gate, but it remains the project's single highest-value asset to protect.

The guiding principle, end to end: **fail closed on missing/weak secrets, encrypt anything sensitive at rest, compare secrets in constant time, never write a secret to git or a log, and keep the blast radius of any one leak as small as the architecture allows.**

---
---

## ۱۵. زیرساختِ هسته و وضعیتِ امنیتی

> هرچه در این فصل می‌آید زیرِ [`src/core/`](src/core/) و کمک‌اسکریپت‌های امنیتیِ [`scripts/`](scripts/) است. بستهٔ `core` پایهٔ باربرِ کل سیستم است: لایهٔ دیتابیس، پیکربندی، Redis، رمزنگاری، اولیه‌های امنیتی، لاگینگِ ساختاریافته و راه‌اندازیِ حلقهٔ رویداد. اگر `src/core` اشتباه باشد، *همه‌چیزِ* پایین‌دست — موتورِ سیگنال، ربات، API، ورکرهای کپی‌ترید — با آن اشتباه می‌شود. این فصل آن پایه را مو به مو مستند می‌کند و سپس به **مدلِ تهدید و وضعیتِ امنیتیِ** پروژه می‌پردازد — صادقانه و بی‌تعارف.

---

### ۱۵.۱ نقشهٔ `src/core/`

| فایل | مسئولیت |
|------|---------|
| `database.py` | موتورِ async SQLAlchemy 2.0، `async_session_factory`، `get_session()`، ~۶۰ مدلِ ORM، `init_db()` / `close_db()` |
| `config.py` | سینگلتونِ `Settings` با `pydantic-settings` — همهٔ env varها، `SYMBOLS`/`TIMEFRAMES`، `TRADING_MODE`، الزامِ سکرتِ امن در production |
| `redis_client.py` | کلاینتِ async Redis (کش + pub/sub)، ایندکسِ قیمت/سیگنالِ فعال، خواندنِ pipeline-batch |
| `crypto.py` | رمزنگاریِ متقارنِ Fernet برای کردنشالِ بروکر/IG کاربر (`USER_CREDS_ENC_KEY`) در حالتِ سکون |
| `security.py` | صدور/تأییدِ JWT (access + refresh با `jti`)، هشِ پسوردِ bcrypt |
| `logger.py` | لاگینگِ JSON با `structlog` + پردازندهٔ خودکارِ **حذفِ سکرت** |
| `fast_loop.py` | نصبِ `uvloop` (fail-soft) برای هر entrypointِ async |
| `html_sanitizer.py` | دفاعِ XSS / SSRF برای HTML و URLِ ذخیره‌شدهٔ کاربر (bleach + fallback) |
| `celery_app.py` | اپِ Celery، مسیریابیِ صف (`ig`، `critical`، پیش‌فرض)، زمان‌بندیِ beat |

قاعدهٔ سرلوحه که در کامنت‌های کد و در `CLAUDE.md` تکرار می‌شود: **سکرت‌ها هرگز چاپ نمی‌شوند، هرگز commit نمی‌شوند، و هرگز به‌صورتِ متنِ خام ذخیره نمی‌شوند.**

---

### ۱۵.۲ لایهٔ دیتابیس — async SQLAlchemy 2.0 روی TimescaleDB

#### ۱۵.۲.۱ موتور و کارخانهٔ سشن

موتورِ async یک‌بار، در زمانِ import، در `database.py` ساخته می‌شود:

```python
engine = create_async_engine(
    settings.DATABASE_URL,            # postgresql+asyncpg://...
    echo=False,
    pool_size=getattr(settings, "DB_POOL_SIZE", 30),
    max_overflow=getattr(settings, "DB_MAX_OVERFLOW", 20),
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

نکاتِ مهمِ عملیاتی:

- **درایور:** `postgresql+asyncpg` برای اپ (مسیرِ داغِ async)، به‌همراه URLِ همگامِ موازی `postgresql+psycopg2` (`DATABASE_URL_SYNC`) برای مهاجرت‌های Alembic و ابزارِ همگام.
- **اندازهٔ Pool:** پیش‌فرض `pool_size=30` + `max_overflow=20` = تا **۵۰ اتصالِ هم‌زمان در هر پروسه**. این عمداً بزرگ است چون چند پروسه یک Postgres را share می‌کنند: ورکرهای API، موتورِ سیگنال، tracker، و ورکرهای Celery. مقادیر با env قابلِ override است تا اپراتور جمعِ کلِ اتصال‌ها را زیرِ `max_connections` نگه دارد.
- **`pool_pre_ping=True`** — هر checkout یک پروبِ ارزانِ زنده‌بودن می‌فرستد، پس اتصالی که با idle-timeoutِ سمتِ سرور یا ری‌استارتِ TimescaleDB کشته شده، به‌جای پرتابِ خطای اتصالِ کهنه به حلقهٔ سیگنال، شفاف بازیافت می‌شود.
- **`pool_recycle=3600`** — اتصال‌های بیش از یک‌ساعت دور انداخته می‌شوند تا واسطه‌ای (NAT/فایروال) که TCPِ طولانی را بی‌صدا قطع می‌کند، خنثی شود.
- **`expire_on_commit=False`** — اشیاءِ ORM پس از `commit()` قابلِ‌استفاده می‌مانند؛ کدِ async به‌شدت روی این تکیه دارد (بدونِ lazy-loadِ غافل‌گیرکننده پس از مرزِ commit).
- **URL-encodeِ پسورد:** `DATABASE_URL` از `quote(self.DB_PASSWORD, safe='')` استفاده می‌کند، پس پسوردِ چرخش‌یافته‌ای که `+ / @ :` دارد DSN را نمی‌شکند. همین برای `REDIS_URL` هم انجام می‌شود — وگرنه `rotate_secrets.sh` این باگ را هر بار باز تولید می‌کرد.

#### ۱۵.۲.۲ قراردادِ `get_session()`

```python
async def get_session():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

این تنها قراردادِ تراکنشیِ کلِ کدبیس است: **commit در موفقیت، rollback در خطا، همیشه close.** هم به‌عنوانِ dependencyِ FastAPI و هم مستقیم با `async with`. چون commit در *انتهای* `yield` انجام می‌شود، هندلرها `commit()` پراکنده نمی‌زنند؛ یا موفق می‌شوند (auto-commit) یا خطا می‌دهند (auto-rollback). این تفاوتِ یک ردیفِ `TradeHistory` نیم‌نوشته با یک abortِ تمیز است.

#### ۱۵.۲.۳ مرورِ مدل‌های ORM

`Base` یک `DeclarativeBase`ی SQLAlchemy 2.0 است؛ مدل‌ها سراسر سبکِ تایپ‌دارِ `Mapped[...]` / `mapped_column(...)` را به‌کار می‌برند. حدودِ **۶۰ جدول** همهٔ سطوحِ محصول را پوشش می‌دهد:

| حوزه | جداول (نمونه) |
|------|---------------|
| **سیگنال و عملکرد** | `signals`, `signal_performance`, `ml_model_performance`, `trade_history` |
| **کاربر و حساب** | `users`, `trading_accounts`, `copy_servers`, `copy_settings`, `disclaimer_acceptances` |
| **قیفِ ربات و پرداخت** | `onboarding_sessions`, `payment_requests`, `subscriptions`, `channel_members`, `bot_messages` |
| **ادمین و محتوا** | `admins`, `articles`, `activity_logs`, `broadcasts` |
| **بک‌تست** | `backtest_runs`, `backtest_trades` |
| **آکادمی** | ~۳۰ جدول: `academy_students`, `academy_lessons`, `academy_videos`, `academy_progress`, `academy_quizzes`, `academy_paper`, `academy_mentor_threads`, … |
| **اینستاگرام** | `ig_users`, `ig_accounts`, `ig_messages`, `ig_auto_replies`, `ig_forms`, `ig_autopilots`, `ig_inbox` |
| **SEO** | `seo_metrics_daily`, `seo_actions`, `seo_pagespeed`, `seo_monitored_urls` |
| **بازارنما** | `bn_layouts`, `bn_scripts`, `bn_alerts`, `bn_watchlists`, `bn_ai_signals` |

قواعدِ مهمِ هرکس که schema را گسترش دهد:

- **پول `Numeric` است، هرگز `float` نیست.** قیمت `Numeric(20, 8)`، P&L `Numeric(15, 2)`/`Numeric(10, 2)`، موجودی `Numeric(18, 2)`. لغزشِ float در دفترِ معاملاتی پذیرفتنی نیست.
- **فیلدهای status هم `default`ِ پایتون و هم `server_default`ِ DB دارند** (مثلاً `Signal.status="active"` با `server_default="active"`) و **ایندکس‌شده‌اند**. این در یک حادثهٔ واقعی باربر بود (باگِ «حالتِ حروفِ status» در حافظهٔ پروژه): ردیف‌هایی که با SQLِ خام یا مهاجرت درج می‌شوند هم باید statusِ معقول بگیرند.
- **`JSONB`** (بومیِ Postgres) برای payloadِ نیمه‌ساختاریافته (`mtf_confirmation`، `analysis_details`، `buttons`/`products`ِ IG، `keywords`ِ auto-reply). `ARRAY(Text)` برای `users.preferred_symbols`.
- **کلیدهای خارجی `ondelete="CASCADE"`** جایی که فرزند نباید از والد بیشتر بماند (`trading_accounts.user_id`، `ig_accounts.owner_id`)، پس حذفِ کاربر ردیف‌های متصل را یتیم نمی‌گذارد.
- **ستون‌های رمزنگاری‌شده تایپِ `Text`/`String(500)` و نامِ `*_enc` / `enc_*` دارند** — `trading_accounts.password_enc`، `ig_accounts.enc_password`، `ig_accounts.enc_totp`. *نوعِ* ستون متنِ ساده است؛ *محتوا* یک توکنِ Fernet است (§۱۵.۵). **سکرتِ خام هرگز یک ستون نیست.**

#### ۱۵.۲.۴ Hypertableها — ستونِ فقراتِ سری‌زمانی

`init_db()` با `Base.metadata.create_all` جداولِ رابطه‌ای را می‌سازد، اما دو جدولِ پرحجم — **`candles`** و **`ticks`** — مدلِ ORM *نیستند*. آن‌ها در `scripts/migrate_db.py` ساخته و به **hypertableِ TimescaleDB** ارتقا می‌یابند، سپس با `scripts/timescale_perf.sql` تنظیم می‌شوند. این عمدی است: دادهٔ بازار append-سنگین است و بازه‌ای کوئری می‌شود — دقیقاً نقطهٔ قوتِ TimescaleDB — و بیرون‌نگه‌داشتنش از ORM مانعِ materializeِ تصادفی می‌شود.

`candles` (PKِ مرکب `symbol, timeframe, timestamp`) و `ticks` (`symbol, timestamp`) با این ارتقا می‌یابند:

```sql
SELECT create_hypertable('candles', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ticks',   'timestamp', if_not_exists => TRUE);
```

و با **سیاست‌های چرخهٔ‌عمر** اداره می‌شوند:

| سیاست | `candles` | `ticks` |
|-------|-----------|---------|
| **نگهداری** | ۳ ماه | ۷ روز |
| **فشرده‌سازی** | روشن، پس از ۷ روز | — |
| **segment-by** | `symbol, timeframe` | — |
| **order-by** | `time DESC` | — |
| **Continuous aggregate** | رول‌آپِ `candles_daily` از M15، هرساعت تازه | — |

`candles_daily` (با `time_bucket('1 day', time)` و `first/max/min/last/sum`) به بک‌تست و آنالیتیکس OHLCVِ روزانهٔ فوری می‌دهد بدونِ اسکنِ مجددِ chunkهای فشرده. تمامِ DDLِ سیاست‌ها **idempotent** است (`if_not_exists => TRUE`)، پس اجرای مجددِ مهاجرت روی production امن است — اسکریپت‌ها هم‌زمان مستندِ پیکربندیِ زنده‌اند.

`CandleBuilder` در `candles` با upsertِ `ON CONFLICT`ِ اولویت‌محورِ منبع می‌نویسد (منبعِ معتبرتر بارِ کم‌اعتبارتر را برای همان کندل بازنویسی می‌کند) — این hypertable تنها منبعِ حقیقتی است که هر ماژولِ تحلیل از آن می‌خواند.

---

### ۱۵.۳ سیستمِ پیکربندی

`config.py` یک کلاسِ `Settings(BaseSettings)` (با `pydantic-settings`) تعریف و سینگلتونِ `settings = Settings()` را صادر می‌کند. پیکربندی از `.env` خوانده می‌شود (`extra="ignore"`)؛ کلیدِ ناشناخته نادیده گرفته می‌شود نه fatal، پس همان کلاس `.env`ِ غنی‌تر را تحمل می‌کند.

#### ۱۵.۳.۱ متغیرهای کلیدیِ محیط

| متغیر | پیش‌فرض | کاربرد |
|-------|---------|--------|
| `DEBUG` | `False` | در production باید `False`؛ الزام‌گرِ سکرت را از هشدار → fatal می‌چرخاند |
| `DB_*` | `forex_signal`/`coinepro`/`changeme`/`timescaledb`/`5432` | ساختِ `DATABASE_URL` و `DATABASE_URL_SYNC` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `30` / `20` | سقفِ pool هر پروسه |
| `REDIS_*` | `redis`/`6379`/`changeme`/`150` | ساختِ `REDIS_URL` |
| `JWT_SECRET_KEY` | `"change-me-..."` | **در prod ≥۳۲ کاراکتر الزامی**؛ امضای همهٔ توکن‌ها |
| `JWT_ALGORITHM` | `HS256` | امضای متقارنِ HMAC |
| `JWT_ACCESS_..._MINUTES` / `..._REFRESH_..._DAYS` | `30` / `7` | عمرِ توکن |
| `ADMIN_PASSWORD` / `GRAFANA_PASSWORD` | `changeme` | در prod رد می‌شود |
| `USER_CREDS_ENC_KEY` | `""` | **کلیدِ Fernet** برای رمزِ کردنشالِ MT5/IG در سکون (§۱۵.۵) |
| `EA_TOKEN` | `""` | سکرتِ مشترکِ احرازِ EAِ اتو-تریدر؛ مقایسهٔ constant-time |
| `COPY_ENGINE_TOKEN` / `RESEND_API_KEY` | `""` | احرازِ کپی‌انجین / ارسالِ ایمیلِ OTP |
| `MT5_LOGIN` / `MT5_PASSWORD` | `""` | کردنشالِ حسابِ مستر (فقط از env) |
| `HETZNER_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `YOUTUBE_*`, `FRED/FINNHUB/ALPHAVANTAGE/TWELVEDATA_*` | `""` | سکرتِ یکپارچه‌سازیِ شخصِ‌ثالث — همه پیش‌فرض خالی |
| `LIVE_TURN_PASSWORD`, `LIVE_PUBLISH_PASSWORD`, `LIVE_DESKTOP_PASSWORD` | `""` | کردنشالِ استریم/دسکتاپِ لایو — طبقِ کامنت «هرگز در سورس» |

هر سکرت پیش‌فرض `""` یا placeholderِ قابل‌تشخیص دارد تا متغیرِ غایب با صدای بلند fail کند نه با مقداری واقعی‌نما.

#### ۱۵.۳.۲ `SYMBOLS`، `TIMEFRAMES`، متادیتای نماد

`Settings` رجیستریِ کانونیِ نمادهاست:

- **`SYMBOLS`** — ۲۰ نمادِ معاملاتی (طلا/نقره، میجرها/کراس‌ها، نفت `XTIUSD`، شاخص‌ها).
- **`BROKER_SYMBOL_MAP`** — ترجمهٔ نامِ داخلی↔بروکر (`NAS100→USTEC`، `XTIUSD→WTI`). انجین با نامِ استاندارد فکر می‌کند؛ EA با نامِ OneRoyal اجرا می‌کند. ناهماهنگی اینجا = خطای «نماد یافت نشد».
- **`TIMEFRAMES`** = `M5, M15, H1, H4, D1` (کندل گرفته‌شده)؛ **`SIGNAL_TIMEFRAMES`** = `M15, M5` (جای صدورِ سیگنال). TFهای بالاتر فقط تأییدِ MTF.
- پراپرتی‌های مشتق: `symbol_names_fa` (نام‌های فارسی)، `pip_values` (اندازهٔ پیپ). پراپرتی‌بودن یعنی با کد نسخه می‌خورند نه با استقرار.

#### ۱۵.۳.۳ گیتِ `TRADING_MODE`

```python
TRADING_MODE: str = "paper"   # "paper" | "live" | "disabled"
```

کلیدِ اصلیِ ایمنی. `paper` (پیش‌فرضِ امن) بدونِ قراردادنِ کاربر در معرض، forward-test می‌کند؛ `live` به کاربر منتشر/اجرای واقعی می‌راند؛ `disabled` صدور را متوقف می‌کند. سیاستِ پروژه (`CLAUDE.md`): `paper` بماند تا گزارشِ divergence کیفیت را روی بروکرِ زنده ثابت کند. دو تنظیمِ مجاور — `DAILY_LOSS_BLOCKS_EMISSION` و `CORRELATION_BLOCKS_EMISSION` — عمداً `False`اند: مدارشکنِ زیانِ روزانه و سقفِ همبستگی دغدغهٔ *سبدِ تک‌حساب*اند، نه دلیلِ خاموش‌کردنِ فید؛ پس پیش‌فرض فقط ثبت می‌کنند نه گیت. `True`کردنشان اتو-تریدِ مستر را سخت محافظت می‌کند.

#### ۱۵.۳.۴ الزامِ سکرتِ امن در production (fail-closed)

مهم‌ترین مکانیزمِ امنیتیِ `config.py` یک `@model_validator(mode="after")` است که **با سکرتِ پیش‌فرض در production از بوت سر باز می‌زند**:

```python
if self.JWT_SECRET_KEY in _INSECURE_JWT_SECRETS or len(self.JWT_SECRET_KEY) < 32:
    issues.append("JWT_SECRET_KEY")
...
if self.DEBUG:
    warnings.warn(message); return self   # dev: فقط هشدار
raise ValueError(message)                  # prod: شکستِ سخت
```

`_INSECURE_PASSWORDS` مقادیرِ `changeme`/`admin`/`password`/`123456`/`""` را می‌بندد؛ `_INSECURE_JWT_SECRETS` placeholderهای شناخته‌شده و **هرچه کوتاه‌تر از ۳۲ کاراکتر** را. در `DEBUG=True` فقط هشدار می‌دهد؛ در production `ValueError` می‌اندازد و کانتینر تا اصلاحِ `.env` crash-loop می‌کند. این فاجعهٔ کلاسیکِ «با پسوردِ پیش‌فرض شیپ شد» را به یک پیکربندیِ *غیرقابلِ‌بوت* تبدیل می‌کند.

---

### ۱۵.۴ کلاینتِ Redis

`redis_client.py` سینگلتونِ `redis_client = RedisClient()` را روی `redis.asyncio` می‌سازد — ستونِ کش + pub/sub. Pool با `decode_responses=True`، `max_connections=150`، `socket_keepalive=True` و `health_check_interval=30` پیکربندی می‌شود.

الگوهای پرفورمنسیِ تعبیه‌شده:

- **ایندکسِ سیگنالِ فعال به‌صورتِ Sorted Set.** به‌جای `KEYS signal:active:*` (دستورِ O(N)ِ *مسدودکننده* روی Redisِ تک‌نخی — ~۲۰۰ms برای ۱۰۰۰ سیگنال)، ایندکسِ `signals:active_ids` (ZSET با scoreِ زمانِ ساخت) نگه‌داری و خواندنِ انبوه با `ZREVRANGE` + `MGET`ِ pipeline (۱ RTT) انجام می‌شود. در عمل: **۲۰۰ms → ۱۵–۲۰ms**. `count_active_signals` با `ZCARD` و O(1) است.
- **`get_all_prices` از `SCAN` + `MGET`ِ pipeline** استفاده می‌کند، هرگز `KEYS` — غیرمسدودکننده، یک round-trip.
- **انضباطِ TTL:** قیمت ۶۰۰ ثانیه (منبعِ بالادستی rate-limit می‌شود، TTLِ بلند «وضعیتِ بازار» را بینِ فچ‌ها پر نگه می‌دارد؛ مصرف‌کننده‌ها timestamp دارند). سیگنالِ فعال TTLِ **۱۴ روزه** — فقط شبکهٔ ایمنی؛ پوزیشن‌ها صریحاً هنگامِ بسته‌شدن حذف می‌شوند. باگِ قبلیِ TTLِ ۲۴ساعته پوزیشن‌های باز را از ایندکس می‌انداخت و tracker دیگر TP/SL را چک نمی‌کرد.
- **`increment()` کارِ `INCR`+`EXPIRE` را در یک pipeline** می‌کند تا crashِ میانی کلید را بی‌TTL رها نکند (شمارنده‌های rate-limit/quota).
- سریال‌سازی همه‌جا `orjson` برای سرعت.

---

### ۱۵.۵ رمزنگاری — کردنشال در سکون رمز می‌شود

`crypto.py` کوچک اما امنیتی-حیاتی است. پسوردِ بروکرِ کاربر (MT5) و پسورد/سکرتِ TOTPِ اینستاگرام **با Fernet (AES-128-CBC + احرازِ HMAC-SHA256)** رمز می‌شوند پیش از آنکه به دیتابیس برسند.

```python
def _fernet() -> Fernet:
    key = (settings.USER_CREDS_ENC_KEY or "").strip()
    if not key:
        digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
        logger.warning("creds_enc_key_missing_using_derived")
    return Fernet(key.encode() if isinstance(key, str) else key)
```

ویژگی‌ها:

- **منبعِ کلید:** `USER_CREDS_ENC_KEY` (env). اگر تنظیم نباشد، کلیدِ اضطراری از `SHA-256(JWT_SECRET_KEY)` مشتق می‌شود تا اپ نشکند — اما `creds_enc_key_missing_using_derived` با صدای بلند لاگ می‌شود، چون در production کلیدِ اختصاصی *باید* ست شود (اتصالِ محرمانگیِ کردنشال به عمرِ JWT secret نامطلوب است).
- **رمزنگاریِ احرازشده:** Fernet نوعِ AEAD است؛ ciphertextِ دستکاری‌شده در `decrypt` fail می‌کند نه plaintextِ آشغال.
- **decryptِ fail-soft:** `decrypt_secret` در هر خطا (کلیدِ اشتباه پس از چرخش، خرابی، دستکاری) `None` می‌دهد نه پرتاب به هندلر. caller آن را «کردنشال در دسترس نیست» می‌گیرد.
- **plaintext هرگز ذخیره نمی‌شود.** طبقِ docstring: «رمزِ خام هرگز در دیتابیس ذخیره نمی‌شود — فقط نسخهٔ رمزنگاری‌شده» در ستون‌های `*_enc` / `enc_*`.

یعنی یک dumpِ خالیِ دیتابیس — رایج‌ترین بردارِ نشت — هیچ کردنشالی را لو **نمی‌دهد**. رمزگشایی به `USER_CREDS_ENC_KEY`ی جدا نیاز دارد که فقط در `.env` (git-ignored) روی هاست است.

---

### ۱۵.۶ اولیه‌های امنیتی — JWT و هشِ پسورد

`security.py` اولیه‌های احراز را فراهم می‌کند.

**هشِ پسورد** با Passlib و **bcrypt**:

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

bcrypt تطبیقی است (saltِ هر-هش + costِ قابل‌تنظیم)، و `verify` خود constant-time است، پس تأییدِ پسورد اوراکلِ زمانی نیست.

**JWT** (با `python-jose`، `HS256`):

```python
to_encode.update({"exp": expire, "iat": now, "jti": uuid.uuid4().hex, "type": "access"})
```

نکات:

- **هر توکن `jti`ِ یکتا** (UUID4) دارد — بلاک‌لیست/ابطالِ *تک‌توکنیِ* دقیق ممکن می‌شود نه نابودیِ همهٔ سشن‌های کاربر.
- **claimِ `type` (`access` vs `refresh`)** الزام می‌شود: `verify_access_token` توکنِ refresh را که جای access آمده رد می‌کند و برعکس. این سردرگمیِ «refreshِ بلندعمر را به‌جای access استفاده کن» را می‌بندد.
- **`iat` + `exp`** صریح و timezone-aware (UTC).
- **چرخشِ `JWT_SECRET_KEY` همهٔ توکن‌های زنده را باطل می‌کند** — یک قابلیت، اهرمِ اضطراریِ «همه را log out کن».
- `decode_token` خطای `JWTError` را می‌گیرد و `jwt_decode_failed`ِ redact‌شده لاگ می‌کند نه stack-traceِ حاویِ توکن.

**Scope/جداسازیِ نقش** در لایهٔ route/dependency است (ادمین vs کاربر vs دانش‌آموزِ آکادمی vs مستأجرِ IG)، و اندپوینت‌های ماشین‌به‌ماشین از **توکنِ سکرتِ مشترک با مقایسهٔ constant-time** استفاده می‌کنند (§۱۵.۸).

---

### ۱۵.۷ لاگینگِ ساختاریافته با حذفِ خودکارِ سکرت

`logger.py` آرایشِ `structlog` را برای خروجیِ **JSON** (`ensure_ascii=False` — فارسی خوانا می‌ماند) با timestampِ ISO و سطحِ لاگ می‌چیند. ویژگیِ شاخص پردازندهٔ `secret_redactor` است که *پیش از* renderِ نهایی درج می‌شود:

- **حذفِ کلیدمحور:** هر فیلدی که کلیدش با `_SECRET_KEY_PATTERNS` بخورد — `password`، `*_password`، `*_secret`، `token`، `*_token`، `api_key`، `jwt`، `authorization`، `bearer`، `refresh_token`، `access_token`، `session`، `cookie`، `private_key` — مقدارش `[REDACTED]` می‌شود. بازگشتی روی dict/list/tuple.
- **حذفِ مقدارمحور:** حتی اگر سکرت در یک *مقدارِ* رشته‌ای بلغزد، regexها می‌گیرند: JWT (`eyJ…` → `[JWT_REDACTED]`)، هدرِ `Bearer …`، و شکلِ `sk_/pk_/api_`.

نتیجه: توسعه‌دهنده می‌تواند `logger.info("login", **payload)` بزند بدونِ بازرسیِ اینکه `payload` توکن دارد یا نه — redactor شبکهٔ ایمنی است. لاگرهای پرسروصدای ثالث (`httpx`، `sqlalchemy.engine`، `aiogram`) به `WARNING` پین‌اند. همین redactor است که ارسالِ لاگ به Grafana/Loki و چسباندنش در کانالِ پشتیبانی را *امن* می‌کند.

---

### ۱۵.۸ `fast_loop` — راه‌اندازیِ uvloop

`fast_loop.py` عمداً ریز است:

```python
def install_uvloop() -> bool:
    try:
        import uvloop
        uvloop.install()
        return True
    except Exception:   # هرگز استارت را نشکند
        return False
```

در ابتدای هر entrypointِ async *پیش از* `asyncio.run` صدا زده می‌شود و **uvloop** (حلقهٔ libuv، تا ~۲× سریع‌تر) را جای asyncioِ پیش‌فرض می‌گذارد. **fail-soft** است: روی هر پلتفرمی که uvloop نباشد بی‌صدا به حلقهٔ پیش‌فرض برمی‌گردد و `False` می‌دهد. حلقهٔ سریع‌تر بُردِ رایگانی روی مسیرِ داغِ معاملاتی است، اما هرگز نباید دلیلِ بالا‌نیامدنِ پروسه باشد.

---

### ۱۵.۹ وضعیتِ امنیتی و مدلِ تهدید

این بخش عمداً بی‌تعارف است. پروژه **پولِ واقعی، کردنشالِ واقعیِ بروکر، و PIIِ واقعیِ کاربر (KYC)** را مدیریت می‌کند، پس مدلِ تهدید جدی گرفته می‌شود — اما صادقانه دربارهٔ آنچه کاهش‌یافته و نیافته.

#### ۱۵.۹.۱ خلاصهٔ مدلِ تهدید

| دارایی | تهدیدِ اصلی | کنترلِ اصلی |
|--------|-------------|-------------|
| کردنشالِ بروکر/IG کاربر | dumpِ DB، خواندنِ داخلی | رمزنگاریِ Fernet در سکون؛ کلید بیرونِ DB |
| کلیدِ امضای JWT | نشتِ سورس/گیت، brute force | `.env`ِ git-ignored؛ ≥۳۲ کاراکترِ الزامی؛ قابلِ‌چرخش |
| پسوردهای ادمین/Grafana/DB/Redis | شیپِ پسوردِ پیش‌فرض | الزام‌گرِ fail-closedِ prod؛ اسکریپتِ چرخش |
| اندپوینتِ EA/کپی‌انجین | فرمانِ اجرای جعلی، حملهٔ زمانی | مقایسهٔ constant-time |
| HTMLِ ذخیرهٔ کاربر | XSSِ ذخیره‌شده | sanitizerِ bleach + allowlistِ scheme |
| فچِ URLِ خروجی | SSRF به metadataِ ابر/شبکهٔ داخلی | بلاکِ IPِ private/loopback/link-local |
| لاگ‌ها | نشتِ سکرت به sink | redactorِ structlog |
| هاست | brute forceِ SSH، پورتِ باز | ufw default-deny + fail2ban + auto-update |
| وابستگی/ایمیجِ Docker | CVE شناخته‌شده، سکرت در تاریخچه | gitleaks + trivy + bandit + pip-audit + hadolint |

#### ۱۵.۹.۲ سکرت‌ها هرگز در گیت — پوششِ `.gitignore`

سیاستِ مالک «همه‌چیز می‌رود گیت‌هاب *جز* دو دسته» است و `.gitignore` دقیقاً همان را اعمال می‌کند. دستهٔ ۱ **کلید/کردنشالِ زنده** است که نشتش = تسخیرِ اکانت:

```
.env  .env.local  .env.production
*.elkey  *.pexkey  *.igkey  *.tgtoken  *.key  *.session  *.secrets
ig_session.json    /secrets/
media/        # کانفیگِ لایو: TURN/استریم/لاگینِ MT5
backups/      # اسنپ‌شاتِ قدیمی با env/کلید
```

دستهٔ ۲ آشغالِ بازتولیدشدنی است (`node_modules/`، `__pycache__/`، `*.pyc`، `dist/`). مشاهدات:

- **`.env*` و همهٔ پسوندهای key/session/token بلاک‌اند** — کلیدِ Fernet، JWT secret، توکنِ ربات، سشنِ IG، کلیدهای ElevenLabs/Pexels، و مونتِ `/secrets/` هرگز commit نمی‌شوند.
- **`media/` و `backups/` عمداً ignore شده‌اند** چون تاریخی سکرتِ تعبیه‌شده داشته‌اند (کانفیگِ لایو، اسنپ‌شاتِ env) — یک بردارِ ظریفِ exfiltration که بسته شده.
- این *تأیید* می‌شود نه فقط اعتماد: `gitleaks` (با `.gitleaks.toml`ِ پروژه) هم working tree و هم **تاریخچهٔ گیت** را اسکن می‌کند، پس سکرتی که اشتباهی در هر commitِ گذشته آمده گرفته می‌شود.

#### ۱۵.۹.۳ سخت‌سازیِ XSS و SSRF

HTMLِ نوشتهٔ کاربر (مقالات، broadcastها) از `html_sanitizer.py` عبور می‌کند:

- **XSS:** allowlistِ tagهای امن (`p, h1–h6, strong, ul/ol/li, a, img, table…`) و attributeهای امنِ per-tag؛ `bleach` (نگه‌داشتِ Mozilla) ترجیح، با fallbackِ regex. URLهای `javascript:` و `data:` حذف؛ فقط `http/https/mailto` می‌مانند.
- **SSRF:** `validate_url()` آدرس‌های private/loopback/link-local/reserved/multicast را با `ipaddress` **رد می‌کند** — صریحاً `169.254.169.254` (metadataِ ابر)، `10/8`، `172.16/12`، `192.168/16`، `127.x`، `::1`، `fc00::/7`. مانعِ pivotِ URLِ کاربر به سرویسِ metadata یا شبکهٔ داخلیِ Docker.

#### ۱۵.۹.۴ ممیزیِ امنیتیِ ۶-ایجنتی و رفع‌ها

یک ممیزیِ امنیتیِ ۶-ایجنتی روی کلِ پروژه اجرا شد؛ خروجی‌های کدسطحیِ آن (در حافظهٔ پروژه «CoinePro security hardening»):

1. **مقایسهٔ constant-time توکن.** هر چکِ سکرتِ مشترکِ ماشین‌به‌ماشین از `hmac.compare_digest` استفاده می‌کند نه `==`، تا حملهٔ زمانی خنثی شود. تأییدشده در:
   - `src/api/routes/ea.py` → `_ea_token_ok()` (توکنِ EAِ اتو-تریدر)
   - `src/api/routes/live.py` (احرازِ استریمِ لایو)
   - `src/api/routes/user_panel.py` (تأییدِ login-hashِ تلگرام)
   - `src/core/email_otp.py` (تأییدِ هشِ کدِ OTP)
2. **سخت‌سازیِ SSRF / XSS** — sanitizer و validatorِ بالا.
3. **CVEهای وابستگی** — پین/آپدیت تا پاک‌سازیِ نسخه‌های آسیب‌پذیر، با بازچکِ مداومِ `trivy`+`pip-audit`.
4. **coturn** (سرورِ TURNِ WebRTC) سخت شد — اعتبارنامه‌دار، نه رله‌ی باز.
5. **اسکنرهای OSS سیم‌کشی شد** — خطِ `security_scan.sh`.
6. **اسکریپتِ سخت‌سازیِ سرور + ویندوز** — `server_hardening.sh` برای هاستِ لینوکس و معادلش برای سرورهای ویندوزِ کپیِ Hetzner.

`server_hardening.sh` (idempotent، `sudo`-guard) بخشِ لینوکس است:

- **فایروالِ ufw:** `default deny incoming`، فقط SSH (پورتِ خودتشخیص، *اول* باز تا قفل نشوی)، `80/tcp`، `443/tcp`، `8189/udp` (WebRTC ICE). صریحاً توصیه می‌کند یک **Hetzner Cloud Firewall** به‌عنوانِ لایهٔ دوم که iptablesِ Docker دورش نمی‌زند.
- **fail2ban:** جیلِ `sshd`، `nginx-http-auth`، `nginx-limit-req`، `nginx-botsearch`؛ رنجِ داخلی هرگز بن نمی‌شود.
- **unattended-upgrades:** وصلهٔ امنیتیِ خودکار.
- عمداً **به کانفیگِ SSH دست نمی‌زند** (به‌خواستِ مالک) — فقط فایروال + fail2ban.

#### ۱۵.۹.۵ اسکنِ امنیتیِ تکرارپذیرِ OSS

`security_scan.sh` پنج اسکنرِ استانداردِ صنعتی را همه از طریقِ Docker (بدونِ نصبِ هاست) اجرا و گزارشِ timestamp‌دار در `security-report/` می‌نویسد:

| ابزار | دامنه |
|-------|-------|
| **gitleaks** | نشتِ سکرت در کد **و تاریخچهٔ گیت** (`.gitleaks.toml`) |
| **trivy fs** | CVEِ وابستگی + فایل‌سیستم + misconfig (`HIGH,CRITICAL`، `--ignore-unfixed`) |
| **pip-audit** | CVEِ وابستگیِ پایتون از `requirements.txt` |
| **bandit** | SASTِ پایتون روی `src` |
| **hadolint** + **trivy config** | best-practice و misconfigِ Dockerfile/compose |

فراخوانی گزینشی است — `bash scripts/security_scan.sh [all|secrets|deps|sast|docker]` — تا اسکنِ سکرت هر commit را گیت کند و اسکنِ سنگینِ CVE زمان‌بندی‌شده اجرا شود.

#### ۱۵.۹.۶ چرخشِ عملیاتیِ سکرت

`rotate_secrets.sh` یک `.env.new`ِ تازه با مقادیرِ قویِ رمزنگاری‌شده می‌سازد (`openssl rand -base64 32` برای پسوردها، `openssl rand -hex 32` برای JWT secret و passphraseِ بکاپ)، با `sed` مقادیرِ `DB_PASSWORD`/`REDIS_PASSWORD`/`ADMIN_PASSWORD`/`GRAFANA_PASSWORD`/`JWT_SECRET_KEY`/`BACKUP_PASSPHRASE` را جایگزین می‌کند. خروجی را `chmod 600` و runbookِ امنِ cut-over را چاپ می‌کند (بکاپِ `.env` فعلی → diff → `mv` → `docker compose down && up -d` → health-check). با **صدای بلند هشدار می‌دهد که چرخشِ `JWT_SECRET_KEY` همهٔ کاربران را log out می‌کند** — این اثرِ جانبی را به اهرمی عمدی و مستند تبدیل می‌کند نه غافل‌گیری.

#### ۱۵.۹.۷ محدودیت‌های صادقانه (ریسکِ باقیمانده)

یک فصلِ دقیق آنچه را *کاملاً* حل نشده نام می‌برد:

- **fallbackِ مشتقِ `USER_CREDS_ENC_KEY`:** اگر کلیدِ اختصاصی ست نباشد، محرمانگی به `SHA-256(JWT_SECRET_KEY)` تنزل می‌یابد. هشدار لاگ می‌شود، اما چیزی کلیدِ اختصاصی را *مجبور* نمی‌کند آن‌طور که validator کلیدِ JWT را. استقرارِ production باید آن را صریح ست کند.
- **JWT متقارن (HS256):** API و هر verifier سکرتِ امضا را share می‌کنند. برای مونولیتِ تک‌دامنه‌ای خوب است اما مرزِ تأییدِ کلیدِ عمومی ندارد؛ محافظت از سکرت حیاتی است.
- **Postgres/Redis تکی:** secret-manager (Vault/KMS) در حلقه نیست — سکرت‌ها در `.env`ِ `chmod 600` روی هاست‌اند. این پوزیشنِ عمل‌گرایانهٔ یک استقرارِ تک‌مالکی است، با سخت‌سازیِ هاست + بهداشتِ گیت به‌عنوانِ کنترلِ جبرانی.
- **خود-حضانتِ پسوردِ بروکر:** ذخیرهٔ پسوردِ MT5ِ کاربر (حتی رمزشده) ریسکِ ذاتیِ پذیرفته‌شده برای کپی‌ترایدِ سمتِ‌سرور است؛ با Fernet در سکون، گیتِ KYC، پیش‌فرضِ `COPY_LIVE_ENABLED=False` و گیتِ اعتبارسنجیِ کپی کاهش یافته، اما باارزش‌ترین داراییِ پروژه برای محافظت باقی می‌ماند.

اصلِ راهنما، سرتاسر: **در غیابِ/ضعفِ سکرت fail-closed، هر چیزِ حساس را در سکون رمز کن، سکرت‌ها را constant-time مقایسه کن، هرگز سکرت را به گیت یا لاگ ننویس، و شعاعِ انفجارِ هر نشت را تا جایی که معماری اجازه می‌دهد کوچک نگه دار.**

---

[⬅ 14. Content, SEO & AI Growth Engine](content-seo.md) · [🏠 Home · خانه](../README.md) · [16. Observability, Operations & Deployment ➡](observability-ops.md)
