[⬅ 1. Executive Summary, Vision & Design Philosophy](overview.md) · [🏠 Home · خانه](../README.md) · [3. The Data Layer — Ingestion, Time‑Series Storage & Caching ➡](data-layer.md)

---

## 2. System Architecture & Service Topology

> *"A trading platform is not a program — it is a city. The data feed is the harbour, the signal engine the foundry, the bot and the frontends the markets, and Redis the postal service that carries every letter between them. This chapter is the city map."*

CoinePro-FX is **not** a monolith with a few helper processes bolted on. It is a genuine, production-grade **microservice constellation** of **40+ independently-scheduled containers**, defined in a single authoritative file: [`docker-compose.yml`](../docker-compose.yml). Every container has exactly one job, one set of resource limits, one healthcheck, and a precisely declared set of dependencies. The whole thing runs on a *single* Hetzner host (Ubuntu 24.04, 16 GB RAM, 8 vCPU AMD, 8 GB swap) under the unprivileged `forex` user — which means the architecture is shaped as much by **scarcity** (you will see `memory:` caps on *every* service) as by separation-of-concerns.

This chapter dissects the topology service-by-service, then steps back to explain the four cross-cutting design pillars that make the whole thing hang together: **(1)** event-driven communication over Redis pub/sub, **(2)** Celery queue isolation (`critical` / `ig` / `ml_training` / default), **(3)** the dependency & startup ordering encoded in `depends_on … condition: service_healthy`, and **(4)** the edge-routing layer where a *single* TCP port 443 is demultiplexed by TLS SNI/ALPN into six subdomains plus a TURN server.

---

### 2.1 The 30,000-foot view

```
                                   ┌──────────────────────────────────────────────┐
                                   │                  INTERNET                    │
                                   └───────────────┬──────────────────────────────┘
                                            :80    │   :443 (TLS, ssl_preread)
                                                   ▼
                       ┌───────────────────────────────────────────────────────────┐
                       │  nginx (stream{}: SNI/ALPN demux)                          │
                       │   ALPN=stun.turn ─────────────► coturn:5349 (TURN/TLS)     │
                       │   else (h2/http1.1) ──────────► 127.0.0.1:8443 (http{})    │
                       └──────────┬────────────────────────────────────────────────┘
                                  │ per-subdomain server{} on :8443
        ┌────────────┬───────────┼───────────┬────────────┬───────────┬────────────┐
        ▼            ▼           ▼           ▼            ▼           ▼            ▼
   website        admin        user       academy        ig        api          mt5
  (frontend-*) (frontend-*) (frontend-*)(frontend-*) (frontend-*) (FastAPI)   (Selkies)
        └────────────┴───────────┴───────────┴────────────┴───────────┘   │
                                  │  /api/* reverse-proxied                │ WebRTC
                                  ▼                                        ▼
                          ┌───────────────┐                        ┌──────────────┐
                          │  api (uvicorn)│◄───────────┐           │  mediamtx    │
                          └───┬───────┬───┘            │           │ (WHIP/WHEP)  │
                              │       │                │ Redis     └──────────────┘
              ┌───────────────┘       └────────┐  pub/sub + broker
              ▼                                ▼       │
   ┌──────────────────┐              ┌──────────────────┐
   │  TimescaleDB     │◄────────────►│      Redis       │◄──────────────────────────┐
   │ (candles/ticks   │              │ (cache+pubsub+   │                            │
   │  hypertables)    │              │  Celery broker)  │                            │
   └──────────────────┘              └─────┬─────┬──────┘                           │
        ▲      ▲      ▲                     │     │                                  │
        │      │      │      ┌──────────────┘     └──────────────┐                  │
   data-feed signal- signal-│                                    │                  │
             engine  tracker│                                    │                  │
                            ▼                                    ▼                  │
              ┌──────────────────────────┐        ┌──────────────────────────┐     │
              │ celery-worker (celery,    │        │ celery-ig-worker (ig)    │     │
              │ critical)                 │        │ celery-ml-worker(ml_train)│    │
              │ celery-beat (scheduler)   │        │ ig-worker (instagrapi)   │     │
              └──────────────────────────┘        └──────────────────────────┘     │
                            │                                                       │
                            ▼                                                       │
              claude-llm · chart-renderer · ml-inference · bot-worker-1 ────────────┘

  Observability plane (out-of-band):  prometheus · grafana · loki · promtail · cadvisor
                                      node-exporter · flower · watchdog
  ML orchestration plane:             mlflow · prefect · flow-runner
```

Every arrow above is *either* a Redis pub/sub channel, a Celery task on a Redis-backed queue, a SQLAlchemy connection to TimescaleDB, or an HTTP call across the `coinepro-network` bridge (the single user-defined Docker network declared at the bottom of the compose file). There is **no** direct service-to-service coupling that bypasses these four transports — that discipline is what lets any single container be restarted (by the **watchdog**, by `docker compose up -d --build`, or by a crash-loop) without taking down the constellation.

---

### 2.2 The master service table

| # | Service | Image / Build | Command (entrypoint) | Depends on (gate) | Published ports | Mem / CPU cap | Healthcheck | Role |
|---|---------|---------------|----------------------|-------------------|-----------------|---------------|-------------|------|
| 1 | **timescaledb** | `timescale/timescaledb:latest-pg16` | (image default) | — | `127.0.0.1:5432` | 3G / 1.5 | `pg_isready` | Primary store; candle/tick hypertables |
| 2 | **redis** | `redis:7-alpine` | `redis-server --maxmemory 1gb --appendonly yes --requirepass …` | — | `127.0.0.1:6379` | 1G / 0.5 | `redis-cli ping` | Cache + pub/sub + Celery broker/backend |
| 3 | **data-feed** | `Dockerfile` (repo root) | `python run_data_feed.py` | tsdb✔ redis✔ | — | 1.5G / 1 | py noop | Ingests OHLCV/ticks → DB + Redis |
| 4 | **signal-engine** | `Dockerfile` | `python run_signal_engine.py` | tsdb✔ redis✔ data-feed▶ | — | 3G / 1.5 | py noop | Analysis → scoring → signal emit |
| 5 | **ml-inference** | `Dockerfile` | `python -m src.ml.ensemble` | redis✔ | — | 2G / 1 | py noop | Ensemble probability service |
| 6 | **signal-tracker** | `Dockerfile` | `python run_tracker.py` | tsdb✔ redis✔ | — | 512M / 0.25 | py noop | TP/SL/BE lifecycle, P&L |
| 7 | **bot-worker-1** | `Dockerfile` | `python run_bot.py` | redis✔ tsdb✔ | — | 1G / 0.5 | py noop | Telegram bot (aiogram polling) |
| 8 | **celery-worker** | `Dockerfile` | `celery … worker -Q celery,critical -c2` | redis✔ tsdb✔ | — | 1G / 0.5 | `celery inspect ping` | Default + critical trading tasks |
| 9 | **celery-ig-worker** | `Dockerfile` | `celery … worker -Q ig -c4 --max-tasks-per-child=200` | redis✔ tsdb✔ | — | 1G / 0.5 | `celery inspect ping` | Instagram tasks (I/O-bound) |
| 10 | **celery-ml-worker** | `Dockerfile` | `celery … worker -Q ml_training -c1 --max-tasks-per-child=1` | redis✔ tsdb✔ | — | 3G / 4 | `celery inspect ping` | Weekly heavy retrain |
| 11 | **celery-beat** | `Dockerfile` | `celery … beat` | redis✔ tsdb✔ | — | 256M / 0.25 | — | Cron scheduler (the heartbeat) |
| 12 | **api** | `Dockerfile` | `uvicorn src.api.main:app … --workers 2` | tsdb✔ redis✔ | `127.0.0.1:8000` | 1G / 0.5 | `curl /health` | FastAPI backend (REST+WS) |
| 13 | **claude-llm** | `./llm_service/Dockerfile` | (Node http server :8085) | — | — | 512M / 0.5 | http `/health` | Claude Code headless sidecar |
| 14 | **chart-renderer** | `./chart_service/Dockerfile` | (Node http server :8086) | — | — | 3500M / 4 | http `/health` | Charts → PNG, video render |
| 15 | **ig-worker** | `./ig-worker/Dockerfile` | (Python http :8090) | — | — | 1024M / 1 | http `/health` | instagrapi engine (multi-account) |
| 16 | **frontend-website** | `./frontend/website` | (nginx static :80) | — | — | 128M / 0.1 | — | Public marketing/blog SPA |
| 17 | **frontend-admin** | `./frontend/admin` | (nginx static :80) | — | — | 128M / 0.1 | — | Admin panel SPA |
| 18 | **frontend-user** | `./frontend/user` | (nginx static :80) | — | — | 128M / 0.1 | — | VIP user panel SPA |
| 19 | **frontend-academy** | `./frontend/academy` | (nginx static :80) | — | — | 128M / 0.1 | — | Academy / BazaarNama SPA |
| 20 | **frontend-ig** | `./frontend/ig` | (nginx static :80) | — | — | 128M / 0.1 | — | IG multi-tenant panel SPA |
| 21 | **nginx** | `nginx:alpine` | reload-loop + `nginx -g 'daemon off;'` | api, frontends | `80`, `443` | 256M / 0.25 | — | Edge reverse proxy + TLS demux |
| 22 | **nginx-reloader** | `docker:cli` | `sh /reloader.sh` | nginx | — | 64M / 0.1 | — | HUPs nginx on container recreate |
| 23 | **mediamtx** | `bluenviron/mediamtx:latest` | (image default) | — | `8189/udp`, local 8889/1935/8888/9997 | 512M / 1.5 | — | WebRTC/RTMP/HLS media server |
| 24 | **coturn** | `coturn/coturn:latest` | `-c /etc/coturn/turnserver.conf` | — | (via nginx 443) | 256M / 0.5 | — | TURN/STUN for live NAT traversal |
| 25 | **mt5** | `./media/mt5` | (Wine + Selkies + EA bridge) | mediamtx | (via nginx) | 3072M / 5 | — | MetaTrader 5 on server + auto-trader |
| 26 | **certbot** | `certbot/certbot` | renew loop (12h) | — | — | — | — | Let's Encrypt cert renewal |
| 27 | **prometheus** | `prom/prometheus:latest` | (image default) | — | `127.0.0.1:9090` | 512M / 0.25 | — | Metrics TSDB + scraping |
| 28 | **grafana** | `grafana/grafana:latest` | (image default) | — | `127.0.0.1:3000` | 512M / 0.25 | — | Dashboards |
| 29 | **loki** | `grafana/loki:2.9.8` | `-config.file=…` | — | `127.0.0.1:3100` | 768M / 0.5 | — | Log aggregation store |
| 30 | **promtail** | `grafana/promtail:2.9.8` | `-config.file=…` | loki | — | 256M / 0.25 | — | Ships container logs → Loki |
| 31 | **cadvisor** | `gcr.io/cadvisor/cadvisor:v0.49.1` | (image default, privileged) | — | `127.0.0.1:8088` | 256M / 0.25 | — | Per-container resource metrics |
| 32 | **node-exporter** | `prom/node-exporter:v1.8.1` | `--path.rootfs=/host` | — | `127.0.0.1:9100` | 128M / 0.1 | — | Host-level metrics |
| 33 | **flower** | `mher/flower:2.0` | `celery … flower --port=5555` | redis✔ | `127.0.0.1:5555` | 256M / 0.25 | — | Celery queue/worker dashboard |
| 34 | **watchdog** | `Dockerfile` | `python run_watchdog.py` | tsdb✔ | — | 256M / 0.25 | — | Self-healing supervisor |
| 35 | **mlflow** | `ghcr.io/mlflow/mlflow:v2.14.1` | `mlflow server …` | — | `127.0.0.1:5000` | 512M / 0.25 | — | Model registry + artifacts |
| 36 | **prefect** | `prefecthq/prefect:2.19-python3.11` | `prefect server start` | — | `127.0.0.1:4200` | 768M / 0.5 | — | Pipeline orchestration server |
| 37 | **flow-runner** | `flows/Dockerfile.flowrunner` | (Prefect deployment server) | prefect, redis | — | 384M / 0.25 | — | Serves the retrain flow |

> **Legend:** ✔ = `condition: service_healthy` (the dependant will not start until the dependency passes its healthcheck). ▶ = `condition: service_started` (only waits for the container to *start*, not to be healthy). "py noop" = `python -c 'import os; exit(0)'` (a liveness-only probe — it proves the container's Python can execute, which combined with `restart: always` is enough for the watchdog and Docker to detect a dead container).

A few structural facts jump out of this table:

* **Almost everything that touches money or candles is built from the *same* root `Dockerfile`** (services 3–12, 34). The repository ships *one* Python image and varies behaviour purely via the `command:`. This is deliberate: one image to build, one image to cache, one dependency surface to audit, and trivial horizontal cloning (e.g. `bot-worker-1` is named with a `WORKER_ID` so a `bot-worker-2` can be added with zero code change).
* **Every database/cache port is bound to `127.0.0.1`.** TimescaleDB (5432), Redis (6379), Prometheus (9090), Grafana (3000), Loki (3100), MLflow (5000), Prefect (4200), Flower (5555), cAdvisor (8088), node-exporter (9100) and the API (8000) are **never** exposed to the internet. The *only* publicly bound ports in the entire system are `80`, `443` (nginx) and `8189/udp` (WebRTC ICE). The attack surface from the outside is therefore a single hardened nginx plus a UDP media path.
* **Resource caps are total and intentional.** Summing the `memory:` limits exceeds 16 GB, but the design relies on the fact that the heavy consumers are *temporally disjoint*: `celery-ml-worker` (3 G / 4 CPU) is idle ~167 hours a week and only spikes during the Sunday 02:00–03:00 UTC retrain; `mt5` (3 G / 5 CPU) and `chart-renderer` (3.5 G / 4 CPU) burst only when rendering. The caps are guardrails against a single runaway process OOM-killing the trading core, not a steady-state budget.

---

### 2.3 Data & stateful core

#### 2.3.1 `timescaledb` — the system of record

The bottom of the dependency graph. A PostgreSQL 16 instance with the TimescaleDB extension, storing **candles** and **ticks** as hypertables (time-partitioned tables that make range queries over millions of OHLCV rows tractable) plus all relational state: users, subscriptions, signals, positions, P&L, copy-trade mappings, Instagram accounts, academy students, blog articles, SEO mining results, and BazaarNama alerts.

* **How it starts:** image default `postgres` entrypoint; database/user/password injected from `.env` (`DB_NAME`, `DB_USER`, and a *mandatory* `DB_PASSWORD` — note the `:?DB_PASSWORD must be set` guard that makes `docker compose up` *fail loudly* if the secret is absent, rather than booting an unprotected DB).
* **Talks to:** nothing outbound; it is talked-*to* by every Python service via SQLAlchemy 2.0 async (`async_session_factory`). Persistence on named volume `tsdb_data`.
* **Why it exists:** a trading system must never lose a closed position or a P&L row. Hypertables give time-series ergonomics without leaving the relational world, so the same engine serves both "latest M15 candle for EURUSD" and "all open positions for user 4172".
* **Healthcheck:** `pg_isready` every 10 s, 5 retries. This is the gate (`service_healthy`) for **nine** downstream services — TimescaleDB being healthy is the precondition for the entire trading and API plane to boot.
* **Failure behaviour:** `restart: always`. If it dies, every dependant's healthcheck/connection fails and they back off; the watchdog's candle-freshness probe (which itself queries `max(time) FROM candles`) will *not* fire data-feed restarts blindly because a DB read failure is caught and logged, not acted upon.

#### 2.3.2 `redis` — the nervous system

The single most connected node in the topology. Redis 7 (alpine) wears **three hats simultaneously**:

1. **Cache** — latest prices, instrument specs, rate-limit counters, dedup sets (e.g. "news already posted"), session/feature caches.
2. **Pub/Sub bus** — the event backbone (see §2.7). Channels like `signals:new`, `prices:tick`, position updates, and live-chat fan-out flow here.
3. **Celery broker *and* result backend** — every queued task and its result lives in Redis (`settings.REDIS_URL`).

* **Hardening:** `--requirepass` (mandatory `REDIS_PASSWORD`, again with the `:?` guard), `--maxmemory 1gb`, `--maxmemory-policy allkeys-lru` (so cache pressure evicts cold keys rather than OOM-ing), and `--appendonly yes` (AOF persistence on `redis_data` so the Celery queue survives a restart — directly relevant to the queue-isolation incident below). The healthcheck authenticates via `REDISCLI_AUTH` env var so the password never appears in `docker inspect` or process args.
* **Failure behaviour:** `restart: always`. A Redis outage is the worst single failure in the system — it severs pub/sub *and* the task queue *and* the cache at once. This is precisely why the AOF and the queue isolation matter: when Redis comes back, pending critical tasks (e.g. an un-run weekend close) are still on disk.

---

### 2.4 The trading pipeline (the reason the system exists)

These five services form the **hot path** from raw market data to a delivered signal. They are chained `data-feed → signal-engine → (ml-inference) → signal-tracker`, with the bot and frontends as consumers.

#### 2.4.1 `data-feed` — the harbour

* **Entrypoint:** [`run_data_feed.py`](../run_data_feed.py) → installs `uvloop` (via `src.core.fast_loop.install_uvloop`, a measurable async speed-up) → `asyncio.run` → `DataFeedManager().start()`.
* **Role:** the *only* service that ingests external market data. It writes OHLCV candles and ticks into TimescaleDB hypertables and publishes fresh ticks/candles onto Redis so downstream services react without polling the DB.
* **Depends on:** `timescaledb` (healthy) and `redis` (healthy) — it cannot meaningfully start without somewhere to write and something to publish to.
* **Failure behaviour:** if it stalls, the freshest candle ages. The **watchdog** independently queries `max(time) FROM candles WHERE timeframe='M15'` every 60 s and, if the latest M15 candle is older than 20 minutes, issues a `docker restart data-feed` over the Docker socket (subject to a 10-minute per-service cooldown and a 6-actions/hour global cap to avoid restart storms). This makes the harbour self-healing.

#### 2.4.2 `signal-engine` — the foundry

* **Entrypoint:** [`run_signal_engine.py`](../run_signal_engine.py) → `SignalEngine().start()` under uvloop.
* **Role:** the analytical heart. Consumes candles, runs the full `src/analysis` stack (technical indicators, candlestick & chart patterns, smart-money concepts, volume profile, multi-timeframe confluence, support/resistance), scores candidates (`src/signals/scorer`), passes risk gates (`src/risk`), and — when a setup clears the bar — emits a signal onto Redis and persists it.
* **Depends on:** `timescaledb`✔, `redis`✔, **and `data-feed`** — but only `condition: service_started` (▶), not `service_healthy`. The reasoning: data-feed's healthcheck is a liveness noop, so "healthy" would add no real guarantee; the engine just needs data-feed to have begun so candles start flowing, and it tolerates an empty initial window.
* **Resources:** the joint-heaviest of the Python core (3 G / 1.5 CPU) because the analysis stack and feature engineering are CPU-bound. Mounts `ml_models` (read) to load trained artefacts.
* **Failure behaviour:** watched by the watchdog's container-health loop; an `unhealthy`/`exited` engine is restarted.

#### 2.4.3 `ml-inference` — the oracle

* **Entrypoint:** `python -m src.ml.ensemble` (note: this is the *inference* role of the same `ensemble` module whose `recalibrate_weights` task runs weekly on the ML worker).
* **Role:** serves ensemble probabilities (XGBoost + LightGBM, with LSTM gated behind RAM availability — the CLAUDE.md rule "no GPU; if RAM tight, only XGBoost+LightGBM") so the engine's score can be fused with a calibrated win-probability.
* **Depends on:** `redis`✔ only — it consults Redis for work and publishes results; it deliberately does **not** hard-depend on the DB, keeping the inference path lean.
* **Failure behaviour:** if `ml_models/` ends up empty (e.g. a botched retrain wiped artefacts), the watchdog's `_check_ml_models()` restarts `ml-inference` to force a reload.

#### 2.4.4 `signal-tracker` — the accountant

* **Entrypoint:** [`run_tracker.py`](../run_tracker.py) → explicitly `await redis_client.connect()` first (it is a heavy pub/sub consumer), then `SignalTracker().start()`, with a `finally: await redis_client.close()` for clean shutdown.
* **Role:** owns the *lifecycle* of every live signal — watches price against TP1/TP2/TP3, stop-loss, break-even and trailing logic, records hit-targets, computes real-deal P&L (commission/swap/net), and enforces no-reopen semantics. It is also the home of Celery tasks `calculate_performance` (daily/weekly/monthly) and the `critical`-queued `close_positions_weekend`.
* **Resources:** the lightest core service (512 M / 0.25 CPU) — it is mostly I/O-bound event handling.

#### 2.4.5 `bot-worker-1` — the megaphone

* **Entrypoint:** [`run_bot.py`](../run_bot.py) → `setup_logging()` (structured logs + secret redactor) → reads `WORKER_ID` (defaults `1`) → aiogram `create_bot()`/`create_dispatcher()` → `dp.start_polling(... allowed_updates=ALLOWED_UPDATES, drop_pending_updates=True)`. `ALLOWED_UPDATES` includes `chat_member` so the bot can verify channel membership for VIP gating.
* **Role:** the Telegram delivery and interaction surface — pushes signals/alerts to channels, handles subscriptions, KYC flows, the AI-assistant button, gifting signal-channel access, and broadcasts.
* **The `WORKER_ID` design:** the `-1` suffix and the `WORKER_ID: "1"` env are forward-compat scaffolding for sharding the bot across multiple polling workers; today there is one, but the naming and the watchdog's hard-coded `bot-worker-1` watch entry assume that identity.
* **Mounts:** `edu_assets` so it can attach academy diagrams/media directly to messages.

---

### 2.5 The Celery plane — asynchronous work, isolated by criticality

Celery is configured once in [`src/core/celery_app.py`](../src/core/celery_app.py) and consumed by **four** containers. The configuration is hardened for a financial workload: `task_acks_late=True` + `task_reject_on_worker_lost=True` (a task is only acknowledged *after* it completes, so a crashed worker's in-flight task is redelivered rather than lost), `worker_prefetch_multiplier=1` (no greedy prefetching that would let one slow task hog a reserved batch), `task_time_limit=600`/`soft=300`, and `result_expires=3600`.

#### 2.5.1 `celery-beat` — the heartbeat

`celery … beat`. A single scheduler (256 M / 0.25 CPU, no healthcheck because beat has no inspectable worker pool) that fires the entire `beat_schedule`: daily/weekly/monthly performance rollups, Sunday 02:00 ML retrain + 03:00 ensemble recalibration, **the Friday 20:30 market-closed message and 20:31 weekend close-all**, news ingest/drip every 10–15 min, blog & academy video generation, copy-sync every minute, IG fast-path polls every 2–3 s, SEO mining, and BazaarNama alert checks. Beat *enqueues*; it never *executes*. If beat dies, nothing scheduled runs — which is exactly the failure that caused the 2026-06-19 incident's weekend-close to be missed, and is why beat is now isolated from the worker that drains its tasks.

#### 2.5.2 `celery-worker` — default + `critical`

`celery … worker -Q celery,critical --concurrency=2`. Drains the **default** queue (copy-trade, news, blog, academy, SEO, BazaarNama) *and* the **`critical`** queue (`close_positions_weekend`, `post_market_closed`). It carries the richest volume mount set — `ml_models`, `edu_assets:ro` (lesson videos for YouTube/Aparat upload), `ig_media` (blog videos to publish), and `secrets:ro` (Search Console / PageSpeed keys) — and sets `MLFLOW_TRACKING_URI` so training tasks can log models.

#### 2.5.3 `celery-ig-worker` — the `ig` quarantine

`celery … worker -Q ig --concurrency=4 --max-tasks-per-child=200`. Consumes **only** the Instagram queue. Higher concurrency because `instagrapi` calls are I/O-bound; `--max-tasks-per-child=200` recycles workers to bound memory creep from the unofficial client.

#### 2.5.4 `celery-ml-worker` — the `ml_training` heavyweight

`celery … worker -Q ml_training --concurrency=1 --max-tasks-per-child=1`. Drains **only** the weekly retrain queue. `concurrency=1` + `max-tasks-per-child=1` means each heavy training job runs in a *fresh* process that is torn down afterwards — no leaked tensors, no fragmented heap. It is granted 3 G / 4 CPU and `OMP_NUM_THREADS=4`, but since retrain runs ~once a week, those resources sit free 99% of the time.

#### 2.5.5 Why the queues are split (the 2026-06-19 incident)

This is the single most important architectural decision in the Celery plane, and it is documented in-code as a comment block. Before the split, **all** tasks shared one default queue. Instagram fast-path tasks (`ig_dm`, `ig_detect`, `ig_drain`) fire every 2–3 seconds; a bug in `poll_dms` caused each to *block for 6–7 seconds*. The queue grew faster than it drained, ballooning to **~240,000 tasks**, and the genuinely time-critical trading tasks — closing positions, posting the market-closed message — were **buried behind a quarter-million Instagram jobs** and effectively starved. The Friday weekend auto-close did not run.

The fix is `task_routes` plus dedicated workers:

```python
task_routes = {
    "src.ml.trainer.retrain_all_models":   {"queue": "ml_training"},
    "src.ml.ensemble.recalibrate_weights": {"queue": "ml_training"},
    "src.instagram.tasks.*":               {"queue": "ig"},
    "src.signals.tracker.close_positions_weekend": {"queue": "critical"},
    "src.bot.tasks.post_market_closed":            {"queue": "critical"},
}
```

Now trading tasks land on `critical` (drained by the always-available `celery-worker`), Instagram is sandboxed on `ig` (its own worker, whose latency *cannot* touch trading), and heavy ML is on `ml_training` (its own worker, whose CPU spikes *cannot* throttle anything else). The `expires` option on the IG fast-path beats (`expires: 8`/`10`) is the second layer of defence: if an IG task hasn't run within 8–10 s it is *discarded* rather than allowed to pile up. **Queue isolation by criticality is the load-bearing lesson of this codebase.**

#### 2.5.6 `flower` — the queue X-ray

`mher/flower:2.0`, bound to `127.0.0.1:5555`, broker = `REDIS_URL`. A read-mostly dashboard over the *same* broker, so an operator can see per-queue depth, worker liveness, and task success/failure in real time — the exact instrument that would have made the 240k pile-up obvious in seconds.

---

### 2.6 Edge, media & live-trading plane

#### 2.6.1 `api` — FastAPI backend

`uvicorn src.api.main:app --workers 2`, bound to `127.0.0.1:8000` (reachable only via nginx). Two uvicorn workers (RAM-budgeted). It is the REST + WebSocket brain for *all five* frontends and the EA bridge. Its volume mounts reveal its breadth: `scripts`, `alembic` (migrations run via `docker compose exec api alembic upgrade head`), `edu_assets:ro` (serve academy diagrams), `ig_media` (serve/publish IG media), `deploy/windows:ro` (serve the Windows copy-server bootstrap/agent/EA), `secrets:ro` (SEO keys), and — notably — `/var/run/docker.sock:ro` so the admin panel can show **real** container status/stats. The healthcheck is a real HTTP probe (`curl /health`), so the api's "healthy" gate is meaningful.

#### 2.6.2 `claude-llm` — Claude Code headless sidecar

Built from `./llm_service`, runs a Node HTTP server on `:8085`. Runs as `user 1000:1000` with `HOME=/creds` mapped to a host volume holding a **dedicated long-lived `CLAUDE_CODE_OAUTH_TOKEN`** (from `claude setup-token`) so it is independent of the host's interactive `/login` session and never goes stale. `LLM_MODEL=sonnet`, `LLM_MAX_CONCURRENCY=3`. It powers blog/news translation & generation, weekly reports, news-risk assessment, the academy "pro" level, and the admin/user AI assistants. Failure is graceful: LLM-gated beat tasks are no-ops when it is down.

#### 2.6.3 `chart-renderer` — visual factory

Built from `./chart_service`, Node HTTP on `:8086`. The heaviest non-trading service (3.5 G / 4 CPU) because it runs a headless browser to render TradingView lightweight-charts into PNGs with TP/SL lines, *and* drives the video pipelines: `avatar_work` (voice-clone `.elkey`, music, `ig_video.py`) and `video_studio` (Remotion cinematic blog videos). Output lands in the shared `ig_media` volume consumed by `api` and `ig-worker` for publishing.

#### 2.6.4 `ig-worker` — Instagram engine

Built from `./ig-worker`, Python HTTP on `:8090`. The `instagrapi`-based unofficial-login engine for the multi-tenant IG panel (per-user login, ≤3 accounts, multi-account worker pool). State on `ig_data`, media on shared `ig_media`. `IG_DEFAULT_ACCOUNT_ID=1` keeps legacy blog→story routing working. This is the *runtime* IG engine; the *scheduling/orchestration* lives in `celery-ig-worker` — a clean split between "decide when" and "do the IG call".

#### 2.6.5 The five frontends

`frontend-website`, `frontend-admin`, `frontend-user`, `frontend-academy`, `frontend-ig` are each a tiny nginx-served React/Vite/Tailwind SPA built from its own context under `frontend/`. Each is capped at a near-symbolic 128 M / 0.1 CPU because a static-file server needs almost nothing. nginx fans the six public subdomains onto these five plus the api.

#### 2.6.6 `mediamtx`, `coturn`, `mt5` — the live-trading triangle

* **`mediamtx`** (`bluenviron/mediamtx`) is the WebRTC/RTMP/HLS media server. It accepts the owner's webcam via **WHIP** and the MT5 screen capture via **RTMP ingest** (1935, internal), and serves viewers via **WHEP** (8889, proxied by nginx) with HLS fallback (8888). The only externally-bound port is `8189/udp` (WebRTC ICE), which *must* be opened on the cloud firewall.
* **`coturn`** is the TURN/STUN relay for clients behind symmetric NAT. It runs as `root` to read the Let's Encrypt cert and shares port 443 with the website via nginx's `ssl_preread` ALPN trick (§2.8). It reads the mt5 TLS cert from `certbot/conf`.
* **`mt5`** (built from `./media/mt5`) runs MetaTrader 5 under Wine with Selkies-GStreamer WebRTC, plus the **auto-trader EA bridge**: it polls `http://api:8000` with an `EA_TOKEN`, auto-attaches a chart for `EA_START_SYMBOL`, and executes the master's signals. Its Wine prefix persists on `mt5_wine` so login/install survive restarts. Heaviest single service (3 G / 5 CPU). It depends on `mediamtx` so the capture target exists before it starts publishing.

#### 2.6.7 `nginx` & `nginx-reloader` — the edge

* **`nginx`** (`nginx:alpine`) terminates `80`/`443`, redirects HTTP→HTTPS, reverse-proxies `/api/*` to `api_backend`, serves each subdomain's SPA, proxies WebSockets (live chat, price feed) and the WHIP/WHEP media paths (with a *dynamic* `resolver 127.0.0.11` so a recreated `mediamtx`/`mt5` IP is re-resolved rather than cached at load time). Its `command` is a shell loop that `nginx -s reload`s every 12 h to pick up renewed certbot certificates without manual intervention.
* **`nginx-reloader`** (`docker:cli`) is the root-cause fix for "502 after a rebuild": when `docker compose up -d --build` recreates `api` or a frontend, its container IP changes, but nginx had cached the old one. The reloader listens to Docker `start` events on the socket and sends nginx a `HUP` so it re-resolves upstreams immediately and seamlessly. 64 M / 0.1 CPU — a tiny but critical glue service.

#### 2.6.8 `certbot`

`certbot/certbot` with an entrypoint loop that runs `certbot renew` every 12 h, sharing `certbot/www` (ACME http-01 challenge webroot, served by nginx's `/.well-known/acme-challenge/`) and `certbot/conf` (the live certs, mounted read-only into nginx and coturn). No restart policy — it is a periodic batch job, not a long-lived server.

---

### 2.7 Observability & ML-orchestration planes (out-of-band)

These services never touch the trading hot path; they observe it or feed it models. Crucially, every one of them binds to `127.0.0.1` only.

* **`prometheus`** scrapes metrics (config mounted read-only) into `prometheus_data`; **`grafana`** visualises them (provisioned datasources + dashboards, admin password from `.env`); **`loki`** + **`promtail`** form the log pipeline — promtail tails the Docker socket and ships every container's stdout to Loki, where structured logs (including watchdog self-heal actions and the secret-redacted bot logs) are queryable; **`cadvisor`** (privileged, for cgroup access) gives per-container CPU/mem, and **`node-exporter`** (`pid: host`) gives host-level metrics. Together: metrics (Prometheus/Grafana) + logs (Loki/Promtail) + container telemetry (cAdvisor/node-exporter) = a full SRE stack on one box.
* **`watchdog`** (built from the root `Dockerfile`, `run_watchdog.py`) is the **self-healing supervisor** — described in §2.4.1/§2.4.3. It performs three checks every 60 s (candle freshness → restart data-feed; container health → restart any of eight watched services that are `unhealthy`/`exited`; ML-model presence → restart ml-inference) and acts via the Docker socket, *guarded* by a per-service 10-minute cooldown and a global 6-actions/hour cap so it can never enter a restart loop. It depends only on `timescaledb` and waits 30 s on boot for peers to come up. It is the reason this single-host system can survive a transient failure at 3 a.m. without a human.
* **`mlflow`** (`v2.14.1`) is the model registry — SQLite backend + filesystem artifact root on `mlflow_data`. Both `celery-worker` and `celery-ml-worker` point `MLFLOW_TRACKING_URI` at it so every trained model is versioned.
* **`prefect`** (`2.19`) + **`flow-runner`** orchestrate the retrain *pipeline* (`RETRAIN_CRON: 0 3 * * 0`). Note the deliberate redundancy: the Sunday retrain is reachable *both* via Celery beat (`retrain-ml-models` at 02:00) *and* via the Prefect flow — Celery for the lightweight scheduled trigger, Prefect for richer DAG orchestration/observability of the heavy pipeline. flow-runner serves the deployment and depends on `prefect` + `redis`.

---

### 2.8 Cross-cutting design — how it all coheres

#### 2.8.1 Event-driven communication via Redis pub/sub

The Python core is **reactive, not poll-based**. `data-feed` publishes ticks/candles; `signal-engine` subscribes and reacts; emitted signals are published and `signal-tracker`, `bot-worker-1`, and the `api` (which fans them to WebSocket clients) subscribe. This is why `signal-engine` can depend on data-feed with merely `service_started`: it doesn't *call* data-feed, it *listens* to a channel. The benefits are classic event-driven ones — temporal decoupling (a slow consumer never blocks the producer), fan-out (one signal reaches the tracker, the bot, and N browsers at once), and crash-resilience (restart any consumer and it simply re-subscribes). Redis is therefore the *single point* whose loss is catastrophic — which is exactly why it has AOF persistence and is the most-guarded container.

#### 2.8.2 Dependency & startup ordering

The startup wave is encoded entirely in `depends_on … condition`:

```
Wave 0:  timescaledb,  redis            (no deps → start immediately, must pass healthcheck)
Wave 1:  data-feed, signal-tracker, bot-worker-1, api, celery-* , watchdog, flower
         (gated on tsdb✔ / redis✔ being HEALTHY, not merely started)
Wave 2:  signal-engine                  (also waits for data-feed to have STARTED ▶)
Independent: ml-inference (redis✔ only), mediamtx, mt5 (▶mediamtx), coturn, certbot,
             claude-llm, chart-renderer, ig-worker, all five frontends,
             nginx (▶api+frontends), nginx-reloader (▶nginx), prefect, flow-runner,
             mlflow, prometheus/grafana/loki/promtail/cadvisor/node-exporter
```

The key distinction is **`service_healthy` vs `service_started`**: the trading core refuses to boot until the DB and Redis are *actually accepting connections* (healthy), eliminating the classic race where an app starts before its database is ready and crash-loops. Where a true health signal adds nothing (data-feed's noop probe), only `service_started` is required, avoiding artificial serialisation. The observability and media planes are intentionally *un-gated* so a slow Grafana or a missing cert can never delay the money-making services.

#### 2.8.3 Edge routing — one port 443, six subdomains, plus TURN

The cleverest piece of the topology lives in `nginx.conf`'s `stream {}` block. Port 443 is shared between normal HTTPS and TURN-over-TLS **without terminating TLS at the stream layer**, using `ssl_preread` to peek only at the ClientHello:

```nginx
stream {
  map $ssl_preread_server_name $tls443_upstream {
    turn.fx.trade-future.ir  coturn:5349;     # TURN-over-TLS → coturn
    default                  127.0.0.1:8443;   # everything else → internal https
  }
  server { listen 443; ssl_preread on; proxy_pass $tls443_upstream; }
}
```

So a packet to `turn.fx.trade-future.ir:443` is relayed (still encrypted) to coturn, while everything else is handed to the **internal** HTTPS vhosts on `:8443`, where the `http {}` block terminates TLS and routes by `server_name`:

| Subdomain | Frontend upstream | API route prefix |
|-----------|-------------------|------------------|
| `FX.trade-future.ir` | `website_frontend` | `/api/*` (+ `/live/*`, `/ws/*`) |
| `api.FX.trade-future.ir` | — (api only) | `/` |
| `Panel.FX.trade-future.ir` | `admin_frontend` | `/api(/v1)?/*` (+ `/mt5-desktop/`, `/live/*`) |
| `user.fx.trade-future.ir` | `user_frontend` | `/api(/v1)?/user/auth/`, `/api(/v1)?/*` |
| `academy.fx.trade-future.ir` | `academy_frontend` | `/api(/v1)?/user/auth/`, `/api(/v1)?/*` |
| `ig.trade-future.ir`, `ig-hub.ir` | `ig_frontend` | `/api(/v1)?/ig/auth/`, `/api(/v1)?/*` |
| `mt5.fx.trade-future.ir` | `mt5:8080` (Selkies) | — (HTTP-Basic gated, except WS signalling) |

Defence-in-depth is layered in at the edge: per-zone `limit_req` rate limits (`auth` at 5 req/min to stop brute-force on login/refresh, `api` 60 r/s, `general` 120 r/s), HSTS + `X-Frame-Options` + `X-Content-Type-Options` + `Referrer-Policy` headers, `server_tokens off`, and HTTP-Basic auth on the raw MT5 desktop (lifted only for the WebSocket signalling path, because browsers won't send Basic creds over WS).

#### 2.8.4 End-to-end: the life of a signal, and of a request

**A signal's journey (machine-initiated):**

```
data-feed ──candle──► TimescaleDB
        └──publish──► Redis chan:candles
                          │
        signal-engine ◄───┘  analyse → score → (ml-inference probability) → risk gates
                          │
                          └──publish──► Redis chan:signals:new ──┬──► signal-tracker (persist, watch TP/SL/BE)
                                                                 ├──► bot-worker-1 ──► Telegram VIP channel
                                                                 ├──► api ──WS──► browser dashboards
                                                                 └──► mt5 EA bridge (polls api) ──► real order
```

When the trade later closes, `signal-tracker` records real-deal P&L; the Friday-20:31 `critical` Celery task `close_positions_weekend` (enqueued by beat, drained by `celery-worker`) force-closes everything; and `calculate_performance` rolls up the numbers nightly.

**A user request's journey (human-initiated):** browser → DNS to one of six subdomains → nginx `:443` `ssl_preread` (default → `:8443`) → TLS terminate + `server_name` match → either the SPA (static frontend) or `/api/*` rewritten and proxied to `api:8000` → FastAPI authenticates, reads/writes TimescaleDB, optionally enqueues a Celery task or calls `claude-llm`/`chart-renderer` over the Docker network → JSON/WS response back through nginx. Every hop is rate-limited, header-hardened, and — for any DB/cache touch — gated behind a service that only started once TimescaleDB and Redis were healthy.

This is the city. Forty-odd specialised districts, one postal service (Redis), one record office (TimescaleDB), one gatehouse (nginx), one night-watchman (watchdog) — each able to fall and be rebuilt without the city going dark.

---
---

## ۲. معماریِ سامانه و توپولوژیِ سرویس‌ها

> *«یک پلتفرمِ تریدینگ یک برنامه نیست — یک شهر است. data-feed بندرگاه است، signal-engine کارگاهِ ذوب، ربات و فرانت‌اندها بازارها، و Redis سامانهٔ پستی‌ای که هر نامه را میانِ آن‌ها می‌برد. این فصل، نقشهٔ آن شهر است.»*

CoinePro-FX یک مونولیت با چند فرایندِ کمکی نیست؛ یک **منظومهٔ راستینِ میکروسرویسِ سطح-تولید** از **بیش از ۴۰ کانتینرِ مستقلاً زمان‌بندی‌شده** است که در یک فایلِ مرجع تعریف شده‌اند: [`docker-compose.yml`](../docker-compose.yml). هر کانتینر دقیقاً یک وظیفه، یک مجموعه سقفِ منابع، یک healthcheck و مجموعه‌ای دقیقاً اعلام‌شده از وابستگی‌ها دارد. همهٔ این‌ها روی یک هاستِ Hetzner (اوبونتو ۲۴.۰۴، ۱۶ گیگ رم، ۸ vCPU، ۸ گیگ swap) و زیرِ کاربرِ غیرروتِ `forex` اجرا می‌شود — و همین یعنی معماری به همان اندازه که با **جداسازیِ مسئولیت‌ها** شکل گرفته، با **کمبودِ منابع** هم شکل گرفته است (روی *هر* سرویس یک سقفِ `memory:` می‌بینید).

این فصل توپولوژی را سرویس‌به‌سرویس کالبدشکافی می‌کند، سپس عقب می‌رود تا چهار ستونِ طراحیِ عرضی را توضیح دهد که همه‌چیز را به‌هم می‌چسبانند: **(۱)** ارتباطِ رویدادمحور روی Redis pub/sub، **(۲)** جداسازیِ صف‌های Celery (`critical` / `ig` / `ml_training` / پیش‌فرض)، **(۳)** ترتیبِ وابستگی و راه‌اندازیِ کدگذاری‌شده در `depends_on … condition: service_healthy`، و **(۴)** لایهٔ مسیریابیِ لبه که در آن یک *تک* پورتِ ۴۴۳ بر اساسِ TLS SNI/ALPN به شش زیردامنه به‌اضافهٔ یک سرورِ TURN تفکیک می‌شود.

---

### ۲.۱ نمای از ۱۰٬۰۰۰ متری

هر فلش در دیاگرامِ بخشِ انگلیسی *یا* یک کانالِ Redis pub/sub است، *یا* یک تسکِ Celery روی صفی که broker آن Redis است، *یا* یک اتصالِ SQLAlchemy به TimescaleDB، *یا* یک فراخوانِ HTTP روی شبکهٔ `coinepro-network` (تنها شبکهٔ کاربرتعریفِ داکر که در انتهای فایلِ compose اعلام شده). **هیچ** جفت‌شدنِ مستقیمِ سرویس‌به‌سرویسی که این چهار حامل را دور بزند وجود ندارد — همین انضباط است که اجازه می‌دهد هر کانتینرِ منفرد (توسطِ **watchdog**، با `docker compose up -d --build`، یا در یک crash-loop) ری‌استارت شود بی‌آنکه منظومه از کار بیفتد.

```
                اینترنت ── :80 / :443(TLS, ssl_preread) ──► nginx (stream{} : تفکیکِ SNI/ALPN)
                   ALPN=stun.turn ─► coturn:5349            بقیه ─► 127.0.0.1:8443 (http{})
                                                                  │ هر زیردامنه یک server{}
   website · admin · user · academy · ig · api(FastAPI) · mt5(Selkies/WebRTC)
                                  │ /api/* پراکسیِ معکوس
                                  ▼
   TimescaleDB ◄──► Redis(cache+pubsub+broker) ◄──► data-feed/signal-engine/signal-tracker
                                  │                       claude-llm · chart-renderer · ml-inference · bot-worker-1
                       celery-worker(celery,critical) · celery-ig-worker(ig) · celery-ml-worker(ml_training) · celery-beat
   صفحهٔ رصد: prometheus · grafana · loki · promtail · cadvisor · node-exporter · flower · watchdog
   صفحهٔ ML: mlflow · prefect · flow-runner ;   لایو: mediamtx · coturn · mt5
```

---

### ۲.۲ جدولِ مرجعِ سرویس‌ها

| # | سرویس | ایمیج/بیلد | فرمان | وابسته به | پورت | سقفِ RAM/CPU | Healthcheck | نقش |
|---|-------|-----------|-------|-----------|------|--------------|-------------|-----|
| ۱ | **timescaledb** | `timescale/timescaledb:pg16` | پیش‌فرض | — | ‎127.0.0.1:5432 | 3G/1.5 | `pg_isready` | انباره؛ هایپرتیبلِ کندل/تیک |
| ۲ | **redis** | `redis:7-alpine` | `redis-server …requirepass` | — | ‎127.0.0.1:6379 | 1G/0.5 | `redis-cli ping` | کش + pub/sub + brokerِ Celery |
| ۳ | **data-feed** | `Dockerfile` | `python run_data_feed.py` | tsdb✔ redis✔ | — | 1.5G/1 | py-noop | دریافتِ OHLCV/تیک → DB+Redis |
| ۴ | **signal-engine** | `Dockerfile` | `python run_signal_engine.py` | tsdb✔ redis✔ data-feed▶ | — | 3G/1.5 | py-noop | تحلیل→امتیاز→صدورِ سیگنال |
| ۵ | **ml-inference** | `Dockerfile` | `python -m src.ml.ensemble` | redis✔ | — | 2G/1 | py-noop | سرویسِ احتمالِ ensemble |
| ۶ | **signal-tracker** | `Dockerfile` | `python run_tracker.py` | tsdb✔ redis✔ | — | 512M/0.25 | py-noop | چرخهٔ TP/SL/BE و P&L |
| ۷ | **bot-worker-1** | `Dockerfile` | `python run_bot.py` | redis✔ tsdb✔ | — | 1G/0.5 | py-noop | رباتِ تلگرام (aiogram) |
| ۸ | **celery-worker** | `Dockerfile` | `worker -Q celery,critical -c2` | redis✔ tsdb✔ | — | 1G/0.5 | `inspect ping` | صفِ پیش‌فرض + تریدینگِ حیاتی |
| ۹ | **celery-ig-worker** | `Dockerfile` | `worker -Q ig -c4` | redis✔ tsdb✔ | — | 1G/0.5 | `inspect ping` | تسک‌های اینستاگرام |
| ۱۰ | **celery-ml-worker** | `Dockerfile` | `worker -Q ml_training -c1` | redis✔ tsdb✔ | — | 3G/4 | `inspect ping` | آموزشِ سنگینِ هفتگی |
| ۱۱ | **celery-beat** | `Dockerfile` | `beat` | redis✔ tsdb✔ | — | 256M/0.25 | — | زمان‌بندِ کرون (ضربانِ قلب) |
| ۱۲ | **api** | `Dockerfile` | `uvicorn … --workers 2` | tsdb✔ redis✔ | ‎127.0.0.1:8000 | 1G/0.5 | `curl /health` | بک‌اندِ FastAPI (REST+WS) |
| ۱۳ | **claude-llm** | `./llm_service` | سرورِ Node :8085 | — | — | 512M/0.5 | http `/health` | سایدکارِ headless Claude Code |
| ۱۴ | **chart-renderer** | `./chart_service` | سرورِ Node :8086 | — | — | 3500M/4 | http `/health` | چارت→PNG و رندرِ ویدیو |
| ۱۵ | **ig-worker** | `./ig-worker` | سرورِ Python :8090 | — | — | 1024M/1 | http `/health` | موتورِ instagrapi |
| ۱۶–۲۰ | **frontend-{website,admin,user,academy,ig}** | `./frontend/*` | nginxِ استاتیک :80 | — | — | 128M/0.1 هرکدام | — | پنج SPA |
| ۲۱ | **nginx** | `nginx:alpine` | حلقهٔ reload + `daemon off` | api+فرانت‌ها | ‎80, 443 | 256M/0.25 | — | پراکسیِ لبه + تفکیکِ TLS |
| ۲۲ | **nginx-reloader** | `docker:cli` | `sh /reloader.sh` | nginx | — | 64M/0.1 | — | HUP به nginx پس از recreate |
| ۲۳ | **mediamtx** | `bluenviron/mediamtx` | پیش‌فرض | — | ‎8189/udp + لوکال | 512M/1.5 | — | سرورِ WebRTC/RTMP/HLS |
| ۲۴ | **coturn** | `coturn/coturn` | `-c turnserver.conf` | — | (از طریقِ nginx 443) | 256M/0.5 | — | TURN/STUN برای عبور از NAT |
| ۲۵ | **mt5** | `./media/mt5` | Wine+Selkies+EA | mediamtx | (از طریقِ nginx) | 3072M/5 | — | متاتریدر۵ روی سرور + اتو-تریدر |
| ۲۶ | **certbot** | `certbot/certbot` | حلقهٔ renew ۱۲h | — | — | — | تمدیدِ گواهیِ Let's Encrypt |
| ۲۷ | **prometheus** | `prom/prometheus` | پیش‌فرض | — | ‎127.0.0.1:9090 | 512M/0.25 | — | TSDBِ متریک |
| ۲۸ | **grafana** | `grafana/grafana` | پیش‌فرض | — | ‎127.0.0.1:3000 | 512M/0.25 | — | داشبورد |
| ۲۹ | **loki** | `grafana/loki:2.9.8` | `-config.file` | — | ‎127.0.0.1:3100 | 768M/0.5 | — | انبارهٔ لاگ |
| ۳۰ | **promtail** | `grafana/promtail:2.9.8` | `-config.file` | loki | — | 256M/0.25 | — | ارسالِ لاگِ کانتینرها→Loki |
| ۳۱ | **cadvisor** | `cadvisor:v0.49.1` | پیش‌فرض (privileged) | — | ‎127.0.0.1:8088 | 256M/0.25 | — | متریکِ هر کانتینر |
| ۳۲ | **node-exporter** | `node-exporter:v1.8.1` | `--path.rootfs=/host` | — | ‎127.0.0.1:9100 | 128M/0.1 | — | متریکِ هاست |
| ۳۳ | **flower** | `mher/flower:2.0` | `flower --port=5555` | redis✔ | ‎127.0.0.1:5555 | 256M/0.25 | — | داشبوردِ Celery |
| ۳۴ | **watchdog** | `Dockerfile` | `python run_watchdog.py` | tsdb✔ | — | 256M/0.25 | — | ناظرِ خوداصلاح‌گر |
| ۳۵ | **mlflow** | `mlflow:v2.14.1` | `mlflow server` | — | ‎127.0.0.1:5000 | 512M/0.25 | — | رجیستریِ مدل |
| ۳۶ | **prefect** | `prefect:2.19` | `prefect server start` | — | ‎127.0.0.1:4200 | 768M/0.5 | — | ارکستریشنِ خط‌لوله |
| ۳۷ | **flow-runner** | `Dockerfile.flowrunner` | سرورِ deploymentِ Prefect | prefect, redis | — | 384M/0.25 | — | سرو کردنِ فلوِ retrain |

> **راهنما:** ✔ یعنی `condition: service_healthy` (وابسته تا سالم‌شدنِ وابستگی شروع نمی‌شود). ▶ یعنی `service_started` (فقط منتظرِ *شروعِ* کانتینر است، نه سالم‌شدنش). «py-noop» همان `python -c 'import os; exit(0)'` است — یک پروبِ صرفاً-زنده‌بودن که اثبات می‌کند پایتونِ کانتینر اجرا می‌شود؛ همراهِ `restart: always` برای تشخیصِ کانتینرِ مرده کافی است.

سه نکتهٔ ساختاری از این جدول بیرون می‌زند:

* **تقریباً هرچه به پول یا کندل دست می‌زند از *یک* `Dockerfile`ِ ریشه ساخته می‌شود** (سرویس‌های ۳ تا ۱۲ و ۳۴). مخزن *یک* ایمیجِ پایتون می‌سازد و رفتار را صرفاً با `command:` تغییر می‌دهد: یک ایمیج برای بیلد، یک سطحِ وابستگی برای ممیزی، و کلون‌سازیِ افقیِ بدیهی (مثلاً `bot-worker-1` با `WORKER_ID` نام‌گذاری شده تا `bot-worker-2` بدونِ تغییرِ کد افزوده شود).
* **هر پورتِ دیتابیس/کش به `127.0.0.1` بسته شده است.** تنها پورت‌های عمومیِ کلِ سامانه `80`، `443` (nginx) و `8189/udp` (ICEِ WebRTC) هستند. سطحِ حملهٔ بیرونی = یک nginxِ سخت‌شده + یک مسیرِ مدیاییِ UDP.
* **سقفِ منابع عمدی و کامل است.** جمعِ سقف‌ها از ۱۶ گیگ فراتر می‌رود، اما طراحی بر این متکی است که مصرف‌کننده‌های سنگین *در زمان از هم جدا* هستند: `celery-ml-worker` (۳G/۴CPU) حدودِ ۱۶۷ ساعت از هفته بی‌کار است و فقط در retrainِ یکشنبه ۲–۳ بامداد اوج می‌گیرد؛ `mt5` و `chart-renderer` فقط هنگامِ رندر. سقف‌ها نردهٔ محافظ‌اند نه بودجهٔ حالتِ پایا — تا یک فرایندِ یاغی هستهٔ تریدینگ را با OOM نکُشد.

---

### ۲.۳ هستهٔ داده و حالت‌دار

#### ۲.۳.۱ `timescaledb` — مرجعِ ثبت

پایینِ گرافِ وابستگی. PostgreSQL 16 با افزونهٔ TimescaleDB که **کندل‌ها** و **تیک‌ها** را به‌صورتِ هایپرتیبل (جدول‌های زمان‌پارتیشن‌بندی‌شده که پرس‌وجوی بازه‌ای روی میلیون‌ها ردیفِ OHLCV را شدنی می‌کنند) ذخیره می‌کند، به‌علاوهٔ همهٔ حالتِ رابطه‌ای: کاربر، اشتراک، سیگنال، پوزیشن، P&L، نگاشتِ کپی‌ترید، اکانتِ اینستاگرام، دانشجوی آکادمی، مقالهٔ بلاگ، نتایجِ داده‌کاویِ SEO و آلارم‌های بازارنما.

* **چطور بالا می‌آید:** entrypointِ پیش‌فرضِ postgres؛ نام/کاربر/رمز از `.env`. توجه به گاردِ `:?DB_PASSWORD must be set` که اگر رمز نباشد `up` را *با صدای بلند* fail می‌کند تا هرگز دیتابیسِ بی‌حفاظ بالا نیاید.
* **با چه حرف می‌زند:** هیچ خروجی‌ای ندارد؛ همهٔ سرویس‌های پایتون با SQLAlchemy 2.0 async با آن حرف می‌زنند. ماندگاری روی ولومِ `tsdb_data`.
* **چرا هست:** یک سامانهٔ تریدینگ هرگز نباید پوزیشنِ بسته یا ردیفِ P&L را گم کند. هایپرتیبل ارگونومیِ سری‌زمانی می‌دهد بی‌آنکه از دنیای رابطه‌ای خارج شویم.
* **Healthcheck:** `pg_isready` هر ۱۰ ثانیه، ۵ تلاش. این گِیتِ (`service_healthy`) **نُه** سرویسِ پایین‌دستی است — سالم‌بودنِ آن پیش‌شرطِ بوتِ کلِ صفحهٔ تریدینگ و API است.
* **رفتارِ خرابی:** `restart: always`. پروبِ تازگیِ کندلِ watchdog (که خودش `max(time) FROM candles` را می‌خواند) در صورتِ خطای خواندنِ DB کورکورانه data-feed را ری‌استارت نمی‌کند، چون خطا گرفته و فقط لاگ می‌شود.

#### ۲.۳.۲ `redis` — سامانهٔ عصبی

پُرارتباط‌ترین گرهِ توپولوژی. Redis 7 هم‌زمان **سه کلاه** بر سر دارد:

۱. **کش** — آخرین قیمت‌ها، مشخصاتِ ابزار، شمارنده‌های rate-limit، مجموعه‌های dedup، کش‌های session/feature.
۲. **باسِ pub/sub** — ستونِ رویدادها (بخشِ ۲.۷)؛ کانال‌هایی مثلِ `signals:new`، تیک‌ها، به‌روزرسانیِ پوزیشن و پخشِ چتِ زنده.
۳. **broker و backendِ Celery** — هر تسکِ صف‌شده و نتیجه‌اش در Redis زندگی می‌کند.

* **سخت‌سازی:** `--requirepass` (رمزِ اجباری با گاردِ `:?`)، `--maxmemory 1gb`، `--maxmemory-policy allkeys-lru` (فشارِ کش به‌جای OOM، کلیدهای سرد را evict می‌کند) و `--appendonly yes` (ماندگاریِ AOF روی `redis_data` تا صفِ Celery از ری‌استارت جان به‌در ببرد — مستقیماً مرتبط با حادثهٔ صف در ادامه). Healthcheck با env varِ `REDISCLI_AUTH` احراز می‌کند تا رمز در `docker inspect` لو نرود.
* **رفتارِ خرابی:** `restart: always`. قطعیِ Redis بدترین خرابیِ منفردِ سامانه است — هم‌زمان pub/sub *و* صفِ تسک *و* کش را قطع می‌کند. دقیقاً به‌همین‌خاطر AOF و جداسازیِ صف اهمیت دارند: وقتی Redis برگردد، تسک‌های حیاتیِ معلق (مثلِ یک weekend-closeِ اجرانشده) هنوز روی دیسک‌اند.

---

### ۲.۴ خط‌لولهٔ تریدینگ (دلیلِ وجودِ سامانه)

این پنج سرویس **مسیرِ داغ** از دادهٔ خام تا سیگنالِ تحویل‌داده‌شده را می‌سازند: `data-feed → signal-engine → (ml-inference) → signal-tracker` و ربات و فرانت‌اندها مصرف‌کننده‌اند.

#### ۲.۴.۱ `data-feed` — بندرگاه

* **Entrypoint:** [`run_data_feed.py`](../run_data_feed.py) → نصبِ `uvloop` → `DataFeedManager().start()`.
* **نقش:** تنها سرویسی که دادهٔ بازارِ بیرونی را دریافت می‌کند. کندل/تیک را در هایپرتیبل می‌نویسد و روی Redis منتشر می‌کند تا پایین‌دستی‌ها بی‌نیاز به polling واکنش دهند.
* **وابسته به:** `timescaledb`✔ و `redis`✔.
* **رفتارِ خرابی:** اگر گیر کند، تازه‌ترین کندل کهنه می‌شود. **watchdog** مستقلاً هر ۶۰ث `max(time) … M15` را می‌سنجد و اگر >۲۰ دقیقه کهنه شد، `docker restart data-feed` می‌زند (با کول‌داونِ ۱۰دقیقه‌ای هر سرویس و سقفِ ۶ اقدام/ساعت). بندرگاه خوداصلاح‌گر می‌شود.

#### ۲.۴.۲ `signal-engine` — کارگاهِ ذوب

* **Entrypoint:** [`run_signal_engine.py`](../run_signal_engine.py) → `SignalEngine().start()` روی uvloop.
* **نقش:** قلبِ تحلیلی. کندل‌ها را مصرف می‌کند، کلِ پشتهٔ `src/analysis` را اجرا می‌کند (اندیکاتورِ تکنیکال، الگوهای کندلی و چارتی، smart-money، volume profile، تأییدِ چندتایم‌فریم، حمایت/مقاومت)، امتیاز می‌دهد، از گیت‌های ریسک (`src/risk`) عبور می‌کند و سیگنال را روی Redis منتشر و ذخیره می‌کند.
* **وابسته به:** `timescaledb`✔، `redis`✔، **و `data-feed`** اما فقط `service_started` (▶) نه `service_healthy`. دلیل: healthcheckِ data-feed یک noop است؛ «سالم» تضمینی اضافه نمی‌کند؛ موتور فقط به *شروعِ* جریانِ کندل نیاز دارد و پنجرهٔ اولیهٔ خالی را تحمل می‌کند.
* **منابع:** سنگین‌ترینِ هستهٔ پایتون (۳G/۱.۵CPU) چون تحلیل و feature engineering مصرفِ CPU بالایی دارند.

#### ۲.۴.۳ `ml-inference` — اوراکل

* **Entrypoint:** `python -m src.ml.ensemble` (نقشِ *استنتاجِ* همان ماژولِ ensemble که `recalibrate_weights`اش هفتگی روی ML worker اجرا می‌شود).
* **نقش:** احتمالِ ensemble (XGBoost+LightGBM، با LSTM پشتِ گِیتِ RAM طبقِ قاعدهٔ «GPU نداریم؛ در کمبودِ رم فقط XGBoost+LightGBM») را سرو می‌کند تا امتیازِ موتور با احتمالِ بُردِ کالیبره‌شده ادغام شود.
* **وابسته به:** فقط `redis`✔؛ عمداً به DB سخت وابسته نیست تا مسیرِ استنتاج سبک بماند.
* **رفتارِ خرابی:** اگر `ml_models/` خالی شود، `_check_ml_models()`ِ watchdog آن را برای لودِ مجدد ری‌استارت می‌کند.

#### ۲.۴.۴ `signal-tracker` — حسابدار

* **Entrypoint:** [`run_tracker.py`](../run_tracker.py) → ابتدا صریحاً `await redis_client.connect()`، سپس `SignalTracker().start()`، با `finally: await redis_client.close()`.
* **نقش:** مالکِ *چرخهٔ عمرِ* هر سیگنالِ زنده — TP1/2/3، حدِ ضرر، سربه‌سر و تریلینگ را در برابرِ قیمت می‌پاید، hit-target ثبت می‌کند، P&Lِ واقعی (کمیسیون/سواپ/خالص) محاسبه می‌کند و قاعدهٔ no-reopen را اعمال می‌کند. خانهٔ تسک‌های `calculate_performance` و `close_positions_weekend`ِ صفِ `critical` هم هست.
* **منابع:** سبک‌ترینِ هسته (512M/0.25CPU) — عمدتاً I/O.

#### ۲.۴.۵ `bot-worker-1` — بلندگو

* **Entrypoint:** [`run_bot.py`](../run_bot.py) → `setup_logging()` (لاگِ ساختارمند + ردکتورِ راز) → خواندنِ `WORKER_ID` (پیش‌فرض ۱) → aiogram → `dp.start_polling(... allowed_updates=ALLOWED_UPDATES, drop_pending_updates=True)`. `ALLOWED_UPDATES` شاملِ `chat_member` است تا عضویتِ کانال برای VIP تأیید شود.
* **نقش:** سطحِ تحویل و تعاملِ تلگرام — push سیگنال/هشدار، اشتراک، KYC، دکمهٔ دستیارِ AI، هدیهٔ دسترسیِ کانال، و broadcast.
* **طراحیِ `WORKER_ID`:** پسوندِ `-1` و env داربستِ آینده‌نگرِ شاردینگِ ربات روی چند workerِ polling است؛ امروز یکی است و ورودیِ ثابتِ `bot-worker-1` در watchdog همین هویت را فرض می‌کند.

---

### ۲.۵ صفحهٔ Celery — کارِ ناهمگام، جداشده بر اساسِ حیاتی‌بودن

Celery یک‌بار در [`src/core/celery_app.py`](../src/core/celery_app.py) پیکربندی و توسطِ **چهار** کانتینر مصرف می‌شود. پیکربندی برای بارِ مالی سخت‌شده است: `task_acks_late=True` + `task_reject_on_worker_lost=True` (تسک فقط *پس از* اتمام ack می‌شود، پس تسکِ در-جریانِ workerِ کرش‌شده دوباره تحویل می‌شود نه گم)، `worker_prefetch_multiplier=1` (بدونِ prefetchِ حریصانه که یک تسکِ کند بتواند دسته‌ای را قبضه کند)، `task_time_limit=600`/`soft=300` و `result_expires=3600`.

#### ۲.۵.۱ `celery-beat` — ضربانِ قلب

`celery … beat`. یک زمان‌بندِ تنها (256M/0.25CPU، بدونِ healthcheck چون pool ندارد) که کلِ `beat_schedule` را شلیک می‌کند: رول‌آپِ عملکردِ روزانه/هفتگی/ماهانه، retrainِ یکشنبه ۲ + recalibrationِ ۳، **پیامِ بسته‌شدنِ بازارِ جمعه ۲۰:۳۰ و close-allِ ۲۰:۳۱**، ingest/dripِ خبر هر ۱۰–۱۵ دقیقه، تولیدِ بلاگ/ویدیو، copy-sync هر دقیقه، poll‌های مسیرِ سریعِ IG هر ۲–۳ ثانیه، داده‌کاویِ SEO و چکِ آلارمِ بازارنما. beat فقط *صف می‌کند*، هرگز *اجرا نمی‌کند*. اگر beat بمیرد هیچ زمان‌بندی‌شده‌ای اجرا نمی‌شود — همان خرابی‌ای که در حادثهٔ ۲۰۲۶-۰۶-۱۹ سببِ ازدست‌رفتنِ weekend-close شد و چرا حالا beat از workerی که تسک‌هایش را می‌کِشد جداست.

#### ۲.۵.۲ `celery-worker` — پیش‌فرض + `critical`

`worker -Q celery,critical --concurrency=2`. صفِ **پیش‌فرض** (کپی، خبر، بلاگ، آکادمی، SEO، بازارنما) *و* صفِ **`critical`** (`close_positions_weekend`، `post_market_closed`) را می‌کِشد. غنی‌ترین ولوم‌ها را دارد — `ml_models`، `edu_assets:ro`، `ig_media`، `secrets:ro` — و `MLFLOW_TRACKING_URI` را ست می‌کند.

#### ۲.۵.۳ `celery-ig-worker` — قرنطینهٔ `ig`

`worker -Q ig --concurrency=4 --max-tasks-per-child=200`. **فقط** صفِ اینستاگرام. concurrency بالاتر چون فراخوان‌های `instagrapi` ‏I/O-bound‌اند؛ `--max-tasks-per-child=200` workerها را بازیافت می‌کند تا نشتِ حافظهٔ کلاینتِ غیررسمی محدود بماند.

#### ۲.۵.۴ `celery-ml-worker` — سنگین‌وزنِ `ml_training`

`worker -Q ml_training --concurrency=1 --max-tasks-per-child=1`. **فقط** صفِ retrainِ هفتگی. `concurrency=1` + `max-tasks-per-child=1` یعنی هر جابِ سنگین در یک فرایندِ *تازه* اجرا و بعد نابود می‌شود — بدونِ tensorِ نشتی و heapِ تکه‌تکه. ۳G/۴CPU و `OMP_NUM_THREADS=4` دارد اما چون هفته‌ای یک‌بار اجرا می‌شود، ۹۹٪ وقت آزاد است.

#### ۲.۵.۵ چرا صف‌ها جدا شدند (حادثهٔ ۲۰۲۶-۰۶-۱۹)

مهم‌ترین تصمیمِ معماریِ صفحهٔ Celery، که در خودِ کد به‌صورتِ کامنت مستند است. پیش از جداسازی، **همهٔ** تسک‌ها یک صفِ مشترک داشتند. تسک‌های مسیرِ سریعِ اینستاگرام (`ig_dm`/`ig_detect`/`ig_drain`) هر ۲–۳ ثانیه شلیک می‌شوند؛ باگی در `poll_dms` باعث می‌شد هرکدام *۶–۷ ثانیه قفل* شوند. صف سریع‌تر از تخلیه رشد کرد و به **~۲۴۰٬۰۰۰ تسک** رسید، و تسک‌های واقعاً حیاتیِ تریدینگ — بستنِ پوزیشن، پیامِ بسته‌شدنِ بازار — **زیرِ ربعِ میلیون جابِ اینستاگرام دفن** و گرسنه شدند. close-allِ جمعه اجرا نشد.

راه‌حل: `task_routes` به‌اضافهٔ workerهای اختصاصی:

```python
task_routes = {
    "src.ml.trainer.retrain_all_models":   {"queue": "ml_training"},
    "src.ml.ensemble.recalibrate_weights": {"queue": "ml_training"},
    "src.instagram.tasks.*":               {"queue": "ig"},
    "src.signals.tracker.close_positions_weekend": {"queue": "critical"},
    "src.bot.tasks.post_market_closed":            {"queue": "critical"},
}
```

حالا تسک‌های تریدینگ روی `critical` فرود می‌آیند (که workerِ همیشه-دردسترسِ `celery-worker` می‌کِشد)، اینستاگرام روی `ig` سندباکس می‌شود (workerِ خودش، که تأخیرش *نمی‌تواند* تریدینگ را لمس کند)، و ML سنگین روی `ml_training` (workerِ خودش، که اوجِ CPUاش *نمی‌تواند* چیزِ دیگری را خفه کند). گزینهٔ `expires` روی beatهای سریعِ IG (`expires: 8`/`10`) لایهٔ دومِ دفاع است: اگر تا ۸–۱۰ث اجرا نشد، *دور ریخته* می‌شود نه تلنبار. **جداسازیِ صف بر اساسِ حیاتی‌بودن، درسِ نگه‌دارندهٔ این کدبیس است.**

#### ۲.۵.۶ `flower` — عکسِ رادیولوژیِ صف

`mher/flower:2.0` روی `127.0.0.1:5555` با broker = `REDIS_URL`. داشبوردی اغلب-خواندنی روی *همان* broker تا اپراتور عمقِ هر صف، زنده‌بودنِ worker و موفقیت/شکستِ تسک را زنده ببیند — دقیقاً ابزاری که تلنبارِ ۲۴۰هزارتایی را در ثانیه آشکار می‌کرد.

---

### ۲.۶ صفحهٔ لبه، مدیا و لایو-ترید

#### ۲.۶.۱ `api` — بک‌اندِ FastAPI

`uvicorn src.api.main:app --workers 2` روی `127.0.0.1:8000` (فقط از طریقِ nginx). دو workerِ uvicorn. مغزِ REST+WSِ *هر پنج* فرانت‌اند و پلِ EA. ولوم‌هایش گستره‌اش را لو می‌دهند: `scripts`، `alembic` (مهاجرت با `docker compose exec api alembic upgrade head`)، `edu_assets:ro`، `ig_media`، `deploy/windows:ro` (سرو bootstrap/agent/EAِ سرورِ ویندوز)، `secrets:ro`، و — مهم — `/var/run/docker.sock:ro` تا پنلِ ادمین وضعیتِ *واقعیِ* کانتینرها را نشان دهد. Healthcheck یک پروبِ واقعیِ HTTP است (`curl /health`)، پس گِیتِ «سالم»ِ api معنادار است.

#### ۲.۶.۲ `claude-llm` — سایدکارِ headless Claude Code

از `./llm_service`، سرورِ Node روی `:8085`. به‌صورتِ `user 1000:1000` با `HOME=/creds` که به ولومی روی هاست با **توکنِ اختصاصیِ بلندمدتِ `CLAUDE_CODE_OAUTH_TOKEN`** (از `claude setup-token`) نگاشت شده، تا مستقل از sessionِ `/login`ِ هاست باشد و stale نشود. `LLM_MODEL=sonnet`، `LLM_MAX_CONCURRENCY=3`. ترجمه/تولیدِ بلاگ و خبر، گزارشِ هفتگی، ارزیابیِ ریسکِ خبری، سطحِ proِ آکادمی و دستیارهای AI را قدرت می‌دهد. خرابی graceful است: تسک‌های LLM-گِیت‌شده هنگامِ down بودن no-op می‌شوند.

#### ۲.۶.۳ `chart-renderer` — کارخانهٔ بصری

از `./chart_service`، Node روی `:8086`. سنگین‌ترین سرویسِ غیرتریدینگ (۳.۵G/۴CPU) چون مرورگرِ headless اجرا می‌کند تا چارتِ lightweight را با خطوطِ TP/SL به PNG برساند، *و* خط‌لوله‌های ویدیو را می‌راند: `avatar_work` (`.elkey` کلونِ صدا، موزیک، `ig_video.py`) و `video_studio` (Remotionِ بلاگ‌ویدیوی سینمایی). خروجی در ولومِ مشترکِ `ig_media` که api و ig-worker برای انتشار مصرف می‌کنند.

#### ۲.۶.۴ `ig-worker` — موتورِ اینستاگرام

از `./ig-worker`، Python روی `:8090`. موتورِ لاگینِ غیررسمیِ مبتنی بر `instagrapi` برای پنلِ چندمستأجریِ IG (لاگینِ هر کاربر، ≤۳ اکانت، poolِ چنداکانتی). حالت روی `ig_data`، مدیا روی `ig_media`ِ مشترک. `IG_DEFAULT_ACCOUNT_ID=1` مسیرِ legacyِ بلاگ→استوری را زنده نگه می‌دارد. این موتورِ *اجراییِ* IG است؛ *زمان‌بندی/ارکستریشن* در `celery-ig-worker` است — جداسازیِ تمیزِ «کِی» از «انجامِ فراخوانِ IG».

#### ۲.۶.۵ پنج فرانت‌اند

`frontend-{website,admin,user,academy,ig}` هرکدام یک SPAِ کوچکِ React/Vite/Tailwindِ سرو-شده-با-nginx از contextِ خودشان زیرِ `frontend/`اند. هرکدام به ۱۲۸M/۰.۱CPUِ نمادین محدودند چون سرورِ فایلِ استاتیک تقریباً هیچ نمی‌خواهد. nginx شش زیردامنهٔ عمومی را روی این پنج به‌اضافهٔ api پخش می‌کند.

#### ۲.۶.۶ مثلثِ لایو: `mediamtx` · `coturn` · `mt5`

* **`mediamtx`** سرورِ مدیاییِ WebRTC/RTMP/HLS است. وبکمِ مالک را با **WHIP** و کپچرِ صفحهٔ MT5 را با **RTMP ingest** (۱۹۳۵ داخلی) می‌گیرد و به بیننده‌ها با **WHEP** (۸۸۸۹، پراکسیِ nginx) و fallbackِ HLS (۸۸۸۸) سرو می‌کند. تنها پورتِ بیرونی `8189/udp` (ICE) است که *باید* روی فایروالِ ابری باز باشد.
* **`coturn`** رلهٔ TURN/STUN برای کلاینت‌های پشتِ NATِ متقارن. به‌صورتِ root اجرا می‌شود تا گواهیِ Let's Encrypt را بخواند و پورتِ ۴۴۳ را با سایت از طریقِ ترفندِ `ssl_preread` ‏ALPNِ nginx به‌اشتراک می‌گذارد (بخشِ ۲.۸).
* **`mt5`** (از `./media/mt5`) متاتریدر۵ را زیرِ Wine با Selkies-GStreamer WebRTC اجرا می‌کند، به‌اضافهٔ **پلِ EAِ اتو-تریدر**: `http://api:8000` را با `EA_TOKEN` poll می‌کند، چارتِ `EA_START_SYMBOL` را اتچ می‌کند و سیگنال‌های مَستر را اجرا می‌کند. prefixِ Wine روی `mt5_wine` ماندگار است تا لاگین/نصب از ری‌استارت جان به‌در ببرد. سنگین‌ترین سرویسِ منفرد (۳G/۵CPU). به `mediamtx` وابسته است تا هدفِ کپچر پیش از انتشار وجود داشته باشد.

#### ۲.۶.۷ `nginx` و `nginx-reloader` — لبه

* **`nginx`** پورتِ ۸۰/۴۴۳ را ترمینال می‌کند، HTTP→HTTPS ریدایرکت می‌کند، `/api/*` را به `api_backend` پراکسی می‌کند، SPAِ هر زیردامنه را سرو می‌کند، WebSocketها (چتِ زنده، فیدِ قیمت) و مسیرهای WHIP/WHEP را پراکسی می‌کند (با `resolver 127.0.0.11`ِ *پویا* تا IPِ recreate‌شدهٔ `mediamtx`/`mt5` دوباره resolve شود نه کش). `command`اش حلقه‌ای است که هر ۱۲ساعت `nginx -s reload` می‌زند تا گواهیِ تازه‌تمدیدشدهٔ certbot بی‌دخالتِ دستی بارگذاری شود.
* **`nginx-reloader`** (`docker:cli`) رفعِ ریشه‌ایِ «۵۰۲ بعد از rebuild» است: وقتی `up -d --build` کانتینرِ `api` یا فرانت را recreate می‌کند، IPاش عوض می‌شود اما nginx قدیمی را کش کرده. reloader به رویدادهای `start`ِ داکر روی socket گوش می‌دهد و به nginx سیگنالِ `HUP` می‌فرستد تا فوری و بی‌قطعی upstream را دوباره resolve کند. ۶۴M/۰.۱CPU — سرویسِ چسبِ کوچک اما حیاتی.

#### ۲.۶.۸ `certbot`

`certbot/certbot` با entrypointِ حلقه‌ای که هر ۱۲ساعت `certbot renew` می‌زند، با اشتراکِ `certbot/www` (وب‌روتِ چالشِ ACME http-01 که nginx از `/.well-known/acme-challenge/` سرو می‌کند) و `certbot/conf` (گواهی‌های زنده، read-only در nginx و coturn). بدونِ restart policy — یک جابِ دوره‌ای است نه سرورِ بلندعمر.

---

### ۲.۷ صفحهٔ رصد و ارکستریشنِ ML (خارج از باند)

این سرویس‌ها هرگز مسیرِ داغِ تریدینگ را لمس نمی‌کنند؛ آن را رصد می‌کنند یا مدل می‌دهند. حیاتی است که هرکدام فقط به `127.0.0.1` بسته‌اند.

* **`prometheus`** متریک‌ها را scrape می‌کند (config فقط-خواندنی) در `prometheus_data`؛ **`grafana`** آن‌ها را بصری می‌کند (datasource/dashboardِ provision‌شده، رمزِ ادمین از `.env`)؛ **`loki`** + **`promtail`** خط‌لولهٔ لاگ‌اند — promtail روی socketِ داکر دنبال می‌کند و stdoutِ هر کانتینر را به Loki می‌فرستد، جایی که لاگ‌های ساختارمند (شاملِ اقدامِ خوداصلاحیِ watchdog و لاگ‌های راز-حذف‌شدهٔ ربات) قابلِ پرس‌وجواند؛ **`cadvisor`** (privileged برای cgroup) متریکِ هر کانتینر و **`node-exporter`** (`pid: host`) متریکِ هاست. مجموعاً: متریک + لاگ + تله‌متریِ کانتینر = پشتهٔ کاملِ SRE روی یک ماشین.
* **`watchdog`** (از `Dockerfile`ِ ریشه، `run_watchdog.py`) **ناظرِ خوداصلاح‌گر** است (بخشِ ۲.۴.۱/۲.۴.۳). هر ۶۰ث سه چک انجام می‌دهد (تازگیِ کندل → ری‌استارتِ data-feed؛ سلامتِ کانتینر → ری‌استارتِ هر یک از هشت سرویسِ پایش‌شده که `unhealthy`/`exited` است؛ حضورِ مدلِ ML → ری‌استارتِ ml-inference) و از طریقِ Docker socket اقدام می‌کند، *محدود* به کول‌داونِ ۱۰دقیقه‌ایِ هر سرویس و سقفِ ۶ اقدام/ساعت تا هرگز در لوپِ ری‌استارت نیفتد. فقط به `timescaledb` وابسته است و در بوت ۳۰ث صبر می‌کند. دلیلِ این است که این سامانهٔ تک‌هاست می‌تواند یک خرابیِ گذرا در ۳ بامداد را بی‌دخالتِ انسان رد کند.
* **`mlflow`** رجیستریِ مدل — backendِ SQLite + ریشهٔ آرتیفکت روی `mlflow_data`. هم `celery-worker` و هم `celery-ml-worker` ‏`MLFLOW_TRACKING_URI` را به آن می‌چرخانند تا هر مدلِ آموزش‌دیده نسخه‌بندی شود.
* **`prefect`** + **`flow-runner`** خط‌لولهٔ *retrain* را ارکستره می‌کنند (`RETRAIN_CRON: 0 3 * * 0`). به افزونگیِ عمدی توجه کنید: retrainِ یکشنبه *هم* از طریقِ Celery beat (`retrain-ml-models` در ۲:۰۰) *و هم* از طریقِ فلوِ Prefect دسترس‌پذیر است — Celery برای تریگرِ سبکِ زمان‌بندی، Prefect برای ارکستریشن/رصدِ غنی‌ترِ DAGِ خط‌لولهٔ سنگین. flow-runner deployment را سرو می‌کند و به `prefect`+`redis` وابسته است.

---

### ۲.۸ طراحیِ عرضی — چطور همه‌چیز منسجم می‌شود

#### ۲.۸.۱ ارتباطِ رویدادمحور با Redis pub/sub

هستهٔ پایتون **واکنشی است نه polling-محور**. `data-feed` تیک/کندل منتشر می‌کند؛ `signal-engine` subscribe و واکنش می‌دهد؛ سیگنال‌های صادرشده منتشر می‌شوند و `signal-tracker`، `bot-worker-1` و `api` (که به کلاینت‌های WebSocket پخش می‌کند) subscribe‌اند. به‌همین‌خاطر `signal-engine` می‌تواند با صرفاً `service_started` به data-feed وابسته باشد: آن را *صدا نمی‌زند*، به یک کانال *گوش می‌دهد*. مزایا کلاسیک‌اند — جداییِ زمانی (مصرف‌کنندهٔ کند هرگز تولیدکننده را بلاک نمی‌کند)، fan-out (یک سیگنال هم‌زمان به tracker، ربات و N مرورگر می‌رسد) و تاب‌آوریِ کرش (هر مصرف‌کننده را ری‌استارت کن، دوباره subscribe می‌کند). پس Redis تنها *نقطه‌ای* است که از دست رفتنش فاجعه است — دقیقاً چرا AOF دارد و محافظت‌شده‌ترین کانتینر است.

#### ۲.۸.۲ ترتیبِ وابستگی و راه‌اندازی

موجِ راه‌اندازی کاملاً در `depends_on … condition` کدگذاری شده:

```
موجِ ۰:  timescaledb, redis            (بی‌وابستگی → فوری شروع، باید healthcheck را پاس کنند)
موجِ ۱:  data-feed, signal-tracker, bot-worker-1, api, celery-*, watchdog, flower
         (گِیت‌شده روی سالم‌بودنِ tsdb✔/redis✔، نه صرفاً شروع‌شدن)
موجِ ۲:  signal-engine                  (به‌علاوه منتظرِ شروع‌شدنِ data-feed ▶)
مستقل:   ml-inference(فقط redis✔), mediamtx, mt5(▶mediamtx), coturn, certbot,
         claude-llm, chart-renderer, ig-worker, پنج فرانت,
         nginx(▶api+فرانت‌ها), nginx-reloader(▶nginx), prefect, flow-runner,
         mlflow, prometheus/grafana/loki/promtail/cadvisor/node-exporter
```

تمایزِ کلیدی **`service_healthy` در برابرِ `service_started`** است: هستهٔ تریدینگ تا *واقعاً پذیرفتنِ اتصالِ* DB و Redis (سالم) بالا نمی‌آید و رقابتِ کلاسیکِ «اپ پیش از آماده‌شدنِ دیتابیس شروع و crash-loop می‌شود» را حذف می‌کند. جایی که سیگنالِ سلامتِ واقعی چیزی اضافه نمی‌کند (noopِ data-feed)، فقط `service_started` لازم است تا سریالیزه‌سازیِ مصنوعی نشود. صفحه‌های رصد و مدیا عمداً بی‌گِیت‌اند تا Grafanaِ کند یا گواهیِ نبوده هرگز سرویس‌های پول‌ساز را عقب نیندازد.

#### ۲.۸.۳ مسیریابیِ لبه — یک پورتِ ۴۴۳، شش زیردامنه، به‌اضافهٔ TURN

هوشمندانه‌ترین قطعهٔ توپولوژی در بلوکِ `stream {}`ِ `nginx.conf` است. پورتِ ۴۴۳ بینِ HTTPSِ معمولی و TURN-over-TLS **بدونِ ترمینال‌کردنِ TLS در لایهٔ stream** به‌اشتراک گذاشته می‌شود، با `ssl_preread` که فقط ClientHello را نگاه می‌کند:

```nginx
stream {
  map $ssl_preread_server_name $tls443_upstream {
    turn.fx.trade-future.ir  coturn:5349;     # TURN-over-TLS → coturn
    default                  127.0.0.1:8443;   # بقیه → httpsِ داخلی
  }
  server { listen 443; ssl_preread on; proxy_pass $tls443_upstream; }
}
```

پس بسته‌ای به `turn.fx.trade-future.ir:443` (همچنان رمزشده) به coturn رله می‌شود، و بقیه به vhostهای HTTPSِ **داخلی** روی `:8443` تحویل می‌شوند که `http {}` آنجا TLS را ترمینال و بر اساسِ `server_name` مسیر می‌دهد:

| زیردامنه | upstreamِ فرانت | پیشوندِ مسیرِ API |
|----------|-----------------|------------------|
| `FX.trade-future.ir` | `website_frontend` | `/api/*` (+`/live/*`,`/ws/*`) |
| `api.FX.trade-future.ir` | — (فقط api) | `/` |
| `Panel.FX.trade-future.ir` | `admin_frontend` | `/api(/v1)?/*` (+`/mt5-desktop/`,`/live/*`) |
| `user.fx.trade-future.ir` | `user_frontend` | `/api(/v1)?/user/auth/`، `/api(/v1)?/*` |
| `academy.fx.trade-future.ir` | `academy_frontend` | `/api(/v1)?/user/auth/`، `/api(/v1)?/*` |
| `ig.trade-future.ir`، `ig-hub.ir` | `ig_frontend` | `/api(/v1)?/ig/auth/`، `/api(/v1)?/*` |
| `mt5.fx.trade-future.ir` | `mt5:8080` (Selkies) | — (HTTP-Basic، به‌جزِ سیگنالینگِ WS) |

دفاعِ لایه‌لایه در لبه: `limit_req`ِ هر زون (auth با ۵ req/min ضدِ brute-force روی login/refresh، api با ۶۰ r/s، general با ۱۲۰ r/s)، هدرهای HSTS + `X-Frame-Options` + `X-Content-Type-Options` + `Referrer-Policy`، `server_tokens off`، و HTTP-Basic روی دسکتاپِ خامِ MT5 (که فقط برای مسیرِ سیگنالینگِ WebSocket برداشته می‌شود، چون مرورگر رمزِ Basic را روی WS نمی‌فرستد).

#### ۲.۸.۴ سرتاسر: زندگیِ یک سیگنال و یک درخواست

**سفرِ یک سیگنال (ماشین-آغاز):**

```
data-feed ──کندل──► TimescaleDB
        └──انتشار──► کانالِ Redis:candles
                          │
        signal-engine ◄───┘  تحلیل → امتیاز → (احتمالِ ml-inference) → گیت‌های ریسک
                          │
                          └──انتشار──► Redis:signals:new ──┬──► signal-tracker (ذخیره، پایشِ TP/SL/BE)
                                                           ├──► bot-worker-1 ──► کانالِ VIPِ تلگرام
                                                           ├──► api ──WS──► داشبوردِ مرورگر
                                                           └──► پلِ EAِ mt5 (api را poll می‌کند) ──► سفارشِ واقعی
```

هنگامِ بسته‌شدنِ معامله، `signal-tracker` ‏P&Lِ واقعی را ثبت می‌کند؛ تسکِ `critical`ِ جمعه-۲۰:۳۱ یعنی `close_positions_weekend` (که beat صف کرده و `celery-worker` کشیده) همه را می‌بندد؛ و `calculate_performance` شبانه رول‌آپ می‌کند.

**سفرِ یک درخواستِ کاربر (انسان-آغاز):** مرورگر → DNS به یکی از شش زیردامنه → nginx ‏`:443` ‏`ssl_preread` (پیش‌فرض → `:8443`) → ترمینالِ TLS + تطبیقِ `server_name` → یا SPA (فرانتِ استاتیک) یا `/api/*`ِ بازنویسی‌شده و پراکسی به `api:8000` → FastAPI احراز می‌کند، TimescaleDB می‌خواند/می‌نویسد، اختیاراً تسکِ Celery صف می‌کند یا روی شبکهٔ داکر `claude-llm`/`chart-renderer` را صدا می‌زند → پاسخِ JSON/WS از طریقِ nginx بازمی‌گردد. هر گام rate-limit و هدر-سخت‌شده است و — برای هر لمسِ DB/کش — پشتِ سرویسی است که فقط پس از سالم‌شدنِ TimescaleDB و Redis شروع شده.

این، آن شهر است. حدودِ چهل ناحیهٔ تخصصی، یک سامانهٔ پستی (Redis)، یک دفترِ ثبت (TimescaleDB)، یک دروازه‌بان (nginx)، یک شب‌گردِ نگهبان (watchdog) — هرکدام می‌توانند بیفتند و بازساخته شوند بی‌آنکه شهر به تاریکی فرو رود.

---

[⬅ 1. Executive Summary, Vision & Design Philosophy](overview.md) · [🏠 Home · خانه](../README.md) · [3. The Data Layer — Ingestion, Time‑Series Storage & Caching ➡](data-layer.md)
