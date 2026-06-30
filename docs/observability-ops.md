[⬅ 15. Core Infrastructure & Security Posture](core-security.md) · [🏠 Home · خانه](../README.md)

---

## 16. Observability, Operations & Deployment

> *Running CoinePro-FX is not "start a container and hope". It is a self-instrumenting, self-healing, self-backing-up system that runs on a single Hetzner box yet behaves like a small SRE team. This chapter documents — exhaustively, with real config — how the platform is observed, operated, backed up, and shipped to production.*

CoinePro-FX bundles a **full observability + operations stack inside the same `docker-compose.yml`** that runs the trading engine. There is no external Datadog, no managed Prometheus, no cloud logging bill. Everything — metrics, logs, dashboards, alerting, self-healing, backups, TLS, orchestration — is co-located and version-controlled. The design constraint that shapes every decision is brutal honesty about the host: **a single Hetzner server, Ubuntu 24.04, 16 GB RAM, 8 vCPU AMD, 8 GB swap, no GPU** (per `CLAUDE.md`). Every service carries an explicit `deploy.resources.limits` memory/CPU cap so the box never OOM-kills the trading engine to feed Grafana.

---

### 16.1 The observability stack at a glance

| Layer | Service | Image | Internal port | Bound to | RAM cap |
|---|---|---|---|---|---|
| Metrics DB | `prometheus` | `prom/prometheus:latest` | 9090 | `127.0.0.1:9090` | 512 M |
| Dashboards | `grafana` | `grafana/grafana:latest` | 3000 | `127.0.0.1:3000` | 512 M |
| Log store | `loki` | `grafana/loki:2.9.8` | 3100 | `127.0.0.1:3100` | 768 M |
| Log shipper | `promtail` | `grafana/promtail:2.9.8` | 9080 | — (push) | 256 M |
| Container metrics | `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | 8080 | `127.0.0.1:8088` | 256 M |
| Host metrics | `node-exporter` | `prom/node-exporter:v1.8.1` | 9100 | `127.0.0.1:9100` | 128 M |
| Celery monitor | `flower` | `mher/flower:2.0` | 5555 | `127.0.0.1:5555` | 256 M |
| Self-healing | `watchdog` | (project image) | — | — | 256 M |
| Model registry | `mlflow` | `ghcr.io/mlflow/mlflow:v2.14.1` | 5000 | `127.0.0.1:5000` | 512 M |
| Orchestrator | `prefect` | `prefecthq/prefect:2.19-python3.11` | 4200 | `127.0.0.1:4200` | 768 M |
| Flow runner | `flow-runner` | (project image) | — | — | 384 M |

**Security note that is easy to miss:** every observability port is published on `127.0.0.1:*` only — never `0.0.0.0`. Prometheus (9090), Grafana (3000), Loki (3100), Flower (5555), MLflow (5000), Prefect (4200), cAdvisor (8088), node-exporter (9100) are all loopback-bound. The only externally exposed ports in the whole stack are `nginx` (`80`/`443`) and the WebRTC ICE UDP port `8189/udp`. To reach Grafana you SSH-tunnel: `ssh -L 3000:127.0.0.1:3000 forex@host`. This is a deliberate "no dashboard exposed to the internet" posture.

---

### 16.2 Metrics — Prometheus & the FastAPI instrumentation

#### Scrape configuration

Prometheus is configured by `monitoring/prometheus.yml`. It scrapes a small, deliberate set of targets:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'forex-api'         # the FastAPI app — business + HTTP metrics
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s          # tighter cadence for the most important target
  - job_name: 'prometheus'        # self-scrape
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'node-exporter'     # host CPU/RAM/disk/network
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s
  - job_name: 'cadvisor'          # per-container CPU/RAM/IO
    static_configs:
      - targets: ['cadvisor:8080']
    scrape_interval: 30s
```

| Target | Job | What it answers |
|---|---|---|
| `api:8000/metrics` | `forex-api` | Signals generated, win-rate, risk rejections, P&L, data-feed status, ML inference latency, HTTP latency |
| `node-exporter:9100` | `node-exporter` | Host RAM/swap (the 16 GB constraint), disk fill, load average, network |
| `cadvisor:8080` | `cadvisor` | Per-container memory vs. its `deploy.limits` cap — catches the container that is about to be OOM-killed |
| `localhost:9090` | `prometheus` | Prometheus' own scrape health, TSDB head series |

#### The application metrics — `src/core/metrics.py`

The FastAPI app does **not** use a generic auto-instrumentator that only emits HTTP histograms. Instead, `src/core/metrics.py` defines a **domain-specific metric catalogue** using `prometheus_client` `Counter`/`Gauge`/`Histogram` — these are the metrics that actually tell you whether the *trading business* is healthy, not just whether the web server is up. Highlights:

- **Signals:** `forex_signals_generated_total{symbol,direction,signal_type}`, `forex_signals_active`, `forex_signal_score` (histogram bucketed `50…100`).
- **Performance:** `forex_signal_pnl_pips`, `forex_win_rate{period}`.
- **Data feed:** `forex_data_feed_status{source}` (1/0), `forex_data_feed_latency_seconds`, `forex_data_feed_errors_total`.
- **ML:** `forex_ml_inference_seconds{model}`, `forex_ml_model_accuracy{model}`, and a subtle but important one — `forex_ml_fallback_total{symbol,reason}` which fires every time the ML layer silently returns the neutral score `50` because a model failed to load. Without it, model rot would be invisible.
- **Risk:** `forex_risk_rejections_total{symbol,reason}`, `forex_daily_pnl_dollar`, `forex_daily_consecutive_losses`, `forex_system_locked` (the circuit-breaker gauge), `forex_market_regime{symbol}`.
- **Paper-vs-live launch metrics:** `forex_trading_mode` (0=paper, 1=live), `forex_paper_signals_generated_total`, `forex_paper_vs_live_divergence{metric}` — this is the metric the launch alerts key off (see §16.10).

#### The `/metrics` endpoint and its auth quirk

`src/api/main.py` exposes:

```python
@app.get("/metrics", include_in_schema=False)
async def metrics(admin: Admin = Depends(get_current_admin)):
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

The endpoint is **admin-authenticated** — it is not an open metrics port. Because Prometheus and the API share the private `coinepro-network` Docker bridge and `/metrics` is never published externally, the threat model treats the bridge as trusted; if you later want Prometheus to scrape an auth-gated endpoint you would add a `bearer_token`/`authorization` block to the `forex-api` job. This is the one place where the README and code can drift, so it is called out explicitly here.

#### Recording rules & SLOs — `monitoring/recording_rules.yml`

Rather than recomputing `histogram_quantile(...)` on every dashboard refresh, Prometheus pre-computes SLIs every 30 s:

- `sli:api_availability:5m` / `:30d` — fraction of non-5xx responses.
- `sli:api_latency_seconds:p95:5m` / `:p99:5m` — request latency quantiles per endpoint.
- `sli:signal_latency_seconds:p95:1h` — how long analysis takes per symbol.
- `sli:rejection_rate:5m` — share of signals killed by RiskGuard.
- `sli:data_feed_up:ratio` — live data-feed fraction.
- `slo:api_error_budget_burn_rate:1h` / `:6h` — error-budget burn against a **99.5 % availability SLO**. A burn-rate > 1 means you are eating the monthly budget faster than allowed.

---

### 16.3 Alerting — Prometheus rules → Alertmanager → Telegram

`monitoring/alerts.yml` defines two rule groups. The critical group (`forex_signal_critical`, evaluated every 30 s):

| Alert | Expr (essence) | For | Severity |
|---|---|---|---|
| `AllDataFeedsDown` | `sum(forex_data_feed_status) == 0` | 2 m | critical |
| `APIDown` | `up{job="forex_api"} == 0` | 1 m | critical |
| `SystemLockedDueToDailyLoss` | `forex_system_locked == 1` | 1 m | high |
| `HighConsecutiveLosses` | `forex_daily_consecutive_losses >= 3` | 1 m | warning |
| `NoSignalsForOneHour` | `rate(forex_signals_generated_total[1h]) == 0` | 1 h | warning |
| `HighRejectionRate` | rejections/signals `> 0.8` | 10 m | warning |
| `MLModelStale` | model not retrained in 7 days | 5 m | warning |
| `HighAPILatency` | `p95(http_request_duration_seconds) > 1.5` | 5 m | warning |
| `HighRejectedRateLimits` | `rate(http_requests_total{status_code="429"}) > 5` | 5 m | info |

The second group (`forex_paper_trading`) watches `PaperVsBacktestDegradation` (paper win-rate ≥15 % below backtest) and `PaperTradeVolumeLow` — these gate the live launch.

**Routing** (`monitoring/alertmanager.yml`): a tree groups by `alertname/severity/category` and routes to Telegram receivers — `telegram_critical` (5 s wait, repeats every 15 m, `continue: true` so it *also* hits the default channel), `telegram_risk`, `telegram_infra`, `telegram_launch`. Persian-language message templates live in `monitoring/templates/telegram.tmpl`. The bot token is read from a **file** (`bot_token_file: /etc/alertmanager/secrets/bot_token`) — never inline. `inhibit_rules` suppress noise: if `AllDataFeedsDown` is firing, individual stale-data alerts in the same `category` are muted, and `APIDown` inhibits downstream `api` alerts.

---

### 16.4 Dashboards — Grafana provisioning

Grafana is fully provisioned-as-code (no click-ops). `monitoring/grafana/provisioning/`:

- **Datasources** — `prometheus.yml` wires `http://prometheus:9090` as the default, `editable: false`; `loki.yml` wires `http://loki:3100` with `maxLines: 1000`. So Grafana queries **both** metrics and logs.
- **Dashboard provider** — `dashboards.yml` loads every JSON in `monitoring/grafana/dashboards/` into a `CoinePro` folder.

Two dashboards ship:

1. **`forex_dashboard.json` — "Forex Signal Bot Dashboard":** Active Signals, Win Rate (30d), Total Signals Today, Bot Users, Signals Generated (24h), Signal Score Distribution, Data Feed Status, ML Inference Duration, API Response Time, Messages Sent.
2. **`risk_overview.json` — "CoinePro FX — Risk Overview":** وضعیت سیستم (system locked), P&L روز ($), زیان متوالی (consecutive losses), Trading mode, rejections per reason (rate/5m), signals per symbol (rate/5m), per-symbol market regime, data feed status.

`GF_SECURITY_ADMIN_PASSWORD` comes from `${GRAFANA_PASSWORD}` (a required `.env` var — compose refuses to start without it).

---

### 16.5 Logging — structured JSON → Promtail → Loki

#### Structured logs at the source — `src/core/logger.py`

Every Python service logs through **structlog** configured with `structlog.processors.JSONRenderer(ensure_ascii=False)` — so logs are machine-parseable JSON *and* preserve Persian text. Critically, the logger installs **secret-redaction processors**: a list of key patterns (`*_password`, `*_token`, `*_secret`, `authorization`, `cookie`, `private_key`, …) whose values are replaced with `[REDACTED]`, plus value-regex scrubbers that catch JWTs (`eyJ…`), `Bearer …` headers, and `sk_/pk_/api_` keys anywhere in a string. This means even an accidental `logger.info("got", token=jwt)` cannot leak a credential into Loki.

Calls look like `logger.warning("watchdog_self_heal", action="restart", service=service, reason=reason, ...)` — event name + structured fields, never f-string soup. That makes Loki/LogQL queries like `{container="coinepro-fx-watchdog-1"} | json | action="restart"` trivial.

#### Shipping — `monitoring/promtail-config.yml`

Promtail discovers containers **dynamically via the Docker socket** (`docker_sd_configs`, refresh 15 s), relabels `__meta_docker_container_name` → `container`, captures the `stream` (stdout/stderr), and — importantly — **keeps only this project's containers** with `regex: '/coinepro-fx-.*'`. It pushes to `http://loki:3100/loki/api/v1/push`. No log files to rotate; logs flow straight from container stdout.

#### Storage — `monitoring/loki-config.yml`

Single-node, filesystem-backed Loki (`tsdb`/`schema v13`), `auth_enabled: false` (loopback-only anyway), `replication_factor: 1`, **7-day retention** (`retention_period: 168h`) with the compactor's `retention_enabled: true`. Ingestion is rate-limited (8 MB/s, 16 MB burst) so a log storm can't fill the disk. `analytics.reporting_enabled: false` — no phone-home.

Services also bind-mount `./logs:/app/logs` for an on-disk copy, but the primary query path is Loki via Grafana's Explore tab.

---

### 16.6 Celery observability — Flower + queue isolation

Celery runs across **four isolated queues** on three worker services — a hard-won design after the 2026-06-19 incident where a single shared queue exploded to 240 k tasks and the weekend auto-close never ran:

| Service | Command (queues) | Concurrency | Purpose |
|---|---|---|---|
| `celery-worker` | `-Q celery,critical` | 2 | Default + **time-critical trading** tasks |
| `celery-ig-worker` | `-Q ig` `--max-tasks-per-child=200` | 4 | Instagram I/O (slow `instagrapi`) — isolated so it never starves trading |
| `celery-ml-worker` | `-Q ml_training` `--max-tasks-per-child=1` | 1 | Heavy weekly retrain only; idle most of the week |
| `celery-beat` | `beat` | — | Scheduler |

**Flower** (`flower` service, `mher/flower:2.0`) connects to the Redis broker (`--broker=${REDIS_URL}`) and exposes a live view of workers, queue depth, task success/failure, and per-task runtime at `127.0.0.1:5555`. `FLOWER_UNAUTHENTICATED_API: "true"` is safe precisely because the port is loopback-bound. Every worker also has a compose healthcheck of `celery -A src.core.celery_app inspect ping`, so an unresponsive worker shows `unhealthy` and the watchdog will restart it.

---

### 16.7 The self-healing watchdog — `run_watchdog.py`

The `watchdog` service is the system's autonomic nervous system: it doesn't *alert* a human and wait — it **takes corrective action** via the Docker socket (mounted read-write only here, for `docker restart`). Loop cadence is `WATCHDOG_INTERVAL_SECONDS=60`. Three checks run each tick:

1. **Candle freshness** — queries `SELECT max(time) FROM candles WHERE timeframe='M15'`. If the newest M15 candle is older than `WATCHDOG_CANDLE_STALE_MIN=20` minutes → restart `data-feed`. This is the single most important auto-heal: a frozen feed means signals on stale prices.
2. **Container health** — inspects `signal-engine, signal-tracker, data-feed, bot-worker-1, ml-inference, claude-llm, celery-worker, api`. Any container whose Docker state is `exited` or whose healthcheck is `unhealthy` → restart.
3. **ML models present** — if `ml_models/` contains no `*.joblib`, restart `ml-inference` to force a reload.

**Anti-loop safety** (this is what makes it production-safe rather than a restart bomb):

- **Per-service cooldown** `COOLDOWN_SECONDS=600` — a given service won't be restarted more than once per 10 minutes.
- **Global action cap** `MAX_ACTIONS_PER_HOUR=6` — across all services; once exceeded it logs `watchdog_action_capped` and refuses to act, so a genuinely broken dependency surfaces as a *human-investigate* situation instead of an infinite restart loop.
- The loop itself is wrapped so the watchdog **never dies** (`watchdog_loop_error` is logged and the loop continues).

Every action emits a structured `watchdog_self_heal` log line (visible in Loki), giving a clean audit trail of what self-healed and why.

---

### 16.8 Backups — three independent layers

CoinePro-FX runs **three orthogonal backup mechanisms** so that a single failure (disk, Telegram outage, Google API quota) never means data loss. Two are cron-driven on the host:

```
# crontab -l
0  * * * * /usr/bin/python3 /home/forex/CoinePro-FX/scripts/hourly_backup.py  >> backup-logs/hourly_backup.log 2>&1
30 * * * * /bin/bash      /home/forex/CoinePro-FX/scripts/gdrive_backup.sh    >> backup-logs/gdrive_backup.log 2>&1
```

| Script | Cadence | Destination | Scope | Retention |
|---|---|---|---|---|
| `scripts/hourly_backup.py` | hourly :00 | **Telegram** (owner DM via `@CoineProFXBot`) | DB dump + code/config/keys zip (no video/models/node_modules), split into ≤48 MB parts | Telegram history |
| `scripts/gdrive_backup.sh` | hourly :30 | **Google Drive** (`rclone`) | **100 % of project** mirror + DB/Redis/crontab/certs snapshot | mirror = live; `db/<TS>` = 14 days |
| `scripts/backup.sh` | manual / daily cron | local `./backups` | DB + ML models + configs + **encrypted** `.env` | 30 days |

**`gdrive_backup.sh`** is the disaster-recovery backbone. It (1) `pg_dump`s the DB through `docker compose exec -T timescaledb`, `redis-cli SAVE` + copies `dump.rdb`, captures `crontab`, the **resolved** `docker compose config`, and the volume list; (2) tars the root-owned `certbot/conf` *through an alpine container* (the `forex` user can't read them directly); (3) `rclone sync`s the whole project to `gdrive:CoinePro-FX-Backups/project-mirror` with trailing-slash *folder excludes* (`node_modules/`, `dist/`, `__pycache__/`, `/logs/`, `/certbot/conf/`, render-frame dirs) so rclone never even descends into them — keeping the scan fast; (4) uploads the timestamped DB snapshot to `db/<TS>`; (5) prunes `db/` snapshots older than 14 days.

**`backup.sh`** is the policy-grade local backup with real safety rails:
- It **refuses** to back up `.env` in plaintext — `BACKUP_PASSPHRASE` must be set, otherwise it hard-exits (only `ALLOW_UNENCRYPTED_BACKUP=true` overrides, and only for dev). The `.env` is encrypted with `openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt` → `env_<TS>.enc` (chmod 600).
- After dumping, it **verifies integrity** (`gunzip -t`) and aborts if the dump is corrupt — a backup you can't restore is not a backup.
- It prunes everything older than `RETENTION_DAYS=30`.

**Restore** (`scripts/restore.sh <db.sql.gz> [models.tar.gz] [env.enc]`): pre-checks the dump (`gunzip -t`), takes a **safety backup of the current DB first** (so a bad restore is reversible), `DROP`/`CREATE`s the database, restores with `ON_ERROR_STOP=1`, optionally decrypts `.env` → `.env.restored` (never auto-overwrites), runs **post-restore verification** (counts `signals`, `users`, `admins`), and restarts the core services. `DRY_RUN=true` prints every action without touching anything. The full bare-metal recovery runbook lives in `RESTORE_GDRIVE.md` (download mirror → bring up `timescaledb`/`redis` → restore dump → `docker compose build && up` → `alembic upgrade head` → restore crontab). `scripts/dr_drill.sh` exists to *rehearse* this.

---

### 16.9 Deployment model — single Hetzner host, baked images

The deploy model is deliberately simple and reproducible:

- **Host:** one Hetzner server, Ubuntu 24.04, 16 GB / 8 vCPU / 8 GB swap. Work user `forex` (in the `docker` group → no `sudo` needed for Docker). Project at `/home/forex/CoinePro-FX`.
- **Everything is Docker.** `docker-compose.yml` is the single source of truth; `networks.default.name: coinepro-network`.
- **Images are baked, not bind-mounted.** The `Dockerfile` `COPY`s `src/`, `alembic/`, `scripts/`, `run_*.py` *into the image* (and compiles TA-Lib 0.4.0 from source + pins numpy 2.2.6, pandas-ta, TA-Lib 0.4.32). The operational consequence — emphasised across the project memories — **editing a `.py` file does nothing until you rebuild**:

```bash
docker compose build api signal-engine    # rebuild the affected services
docker compose up -d                       # recreate them from the new image
```

A plain `docker compose restart` re-runs the **old** baked code. This is the #1 footgun and is called out in `coinepro-deploy-rebuild` memory.

#### Zero-downtime nginx & the "502 after rebuild" fix

When a service like `api` is recreated, it gets a new container IP, and a long-lived nginx that cached the old IP would serve 502s. Two mechanisms fix this:

1. **`nginx-reloader`** (`docker:cli` container running `scripts/nginx_reloader.sh`) listens to Docker `start` events; when `*-api-*` / `*-frontend-website-*` / `*-frontend-admin-*` (re)start, it waits 3 s and sends `nginx -s HUP` (graceful reload, no dropped connections) so nginx re-resolves the new IP. This is the root-cause fix for "502 after rebuild" without touching routing config.
2. **nginx itself** runs `while :; do sleep 12h; nginx -s reload; done & exec nginx -g 'daemon off;'` — a built-in 12-hourly reload so freshly-renewed certbot certs are picked up automatically.

#### TLS — certbot, the 443 split, and ACME

- **`certbot`** container loops `certbot renew; sleep 12h` forever, sharing `./certbot/conf` (certs) and `./certbot/www` (ACME webroot) with nginx.
- nginx `conf.d/*.conf` serve `/.well-known/acme-challenge/` from `/var/www/certbot` over **port 80** and `return 301 https` for everything else. TLS terminates on an internal `8443 ssl` server using `…/live/fx.trade-future.ir/fullchain.pem`.
- The clever bit: **port 443 is shared between HTTPS and TURN-over-TLS**. The top-level `stream {}` block uses `ssl_preread` to inspect the TLS ALPN/SNI *without terminating TLS* and routes `turn.fx.trade-future.ir` → `coturn:5349`, everything else → internal `127.0.0.1:8443` (the real HTTPS vhosts). This lets WebRTC live-trading TURN and the website coexist on one port — critical when corporate firewalls only allow 443.
- nginx hardening (`nginx/nginx.conf`): `server_tokens off`, gzip, and three per-IP rate-limit zones — `api` 60 r/s, `general` 120 r/s, and a strict `auth` zone at **5 r/min** to throttle login/refresh brute-force, all returning `429`.

#### Database migrations — Alembic

Schema is managed by Alembic. After any deploy that changes models:

```bash
docker compose exec api alembic upgrade head
```

The `api` service bind-mounts `./alembic` and `./scripts` read-write so migrations and admin scripts run inside the live container with the production DB URL. (Note: API source itself is baked; `alembic/` and `scripts/` are mounted for operational convenience.)

---

### 16.10 Live-readiness — preflight & divergence

`TRADING_MODE` stays `paper` until the strategy is *proven* on this broker. The gate to flip to `live` is a code-enforced checklist, not vibes.

**Preflight** — `docker compose exec api python -m src.launch.preflight` runs `src/launch/preflight.py`, which returns `is_ready_for_launch=False` if **any CRITICAL check** fails:

- `no_default_passwords` — DB/Redis/Admin passwords not weak; `JWT_SECRET_KEY` ≥32 chars and not "change…".
- `debug_off` — `DEBUG=false`.
- `telegram_token` — bot token set and valid.
- `redis_reachable`, `database_reachable` — live `PING` / `SELECT 1`.
- `paper_trading_period` — at least **7 days** of paper signals recorded (reads `MIN(signals.created_at)`).

WARNING-level checks (allowed but flagged): `ml_models_present`, `monitoring_active` (verifies `prometheus.yml`+`alerts.yml` exist), `backup_script`, `runbook_exists`. The CLI prints a ✅/❌ report and exits non-zero if not launch-ready.

**Divergence** — `src/launch/divergence.py` compares live **paper-trading** performance against the **backtest** baseline. Defaults: a strategy is "degraded" if paper `win_rate` drops **>15 %** below backtest, or `profit_factor` drops **>30 %**. If divergence exceeds threshold it surfaces as the `PaperVsBacktestDegradation` alert and blocks the launch. The philosophy (quoted in the module): backtest 65 % but paper 45 % means overfit / regime change / wrong cost model / execution delay — diagnose before risking real money.

---

### 16.11 Running & operating — the command cookbook

**Bring the stack up / check it:**
```bash
docker compose up -d                 # build-if-needed + start everything
docker compose ps                    # service states + health
docker compose logs -f signal-engine # tail one service
free -h && docker stats --no-stream  # ALWAYS after up — 16 GB box, watch RAM
```

**Deploy a code change (remember: images are baked):**
```bash
docker compose build api signal-engine bot-worker-1
docker compose up -d
docker compose exec api alembic upgrade head     # if models changed
```

**Operate observability (via SSH tunnel):**
```bash
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 -L 5555:127.0.0.1:5555 forex@host
# → Grafana http://localhost:3000  | Prometheus :9090  | Flower :5555
```

**Inspect logs in Loki (Grafana → Explore):**
```logql
{container="coinepro-fx-signal-engine-1"} | json | level="error"
{container="coinepro-fx-watchdog-1"} | json | action="restart"
```

**Backups & restore:**
```bash
BACKUP_PASSPHRASE=$(openssl rand -hex 32) bash scripts/backup.sh   # local encrypted
bash scripts/restore.sh ./backups/db_YYYYMMDD_HHMMSS.sql.gz        # restore (with safety dump)
DRY_RUN=true bash scripts/restore.sh ./backups/db_*.sql.gz         # rehearse
```

**Secrets rotation:**
```bash
bash scripts/rotate_secrets.sh        # → .env.new (DB/Redis/Admin/Grafana/JWT/Backup)
cp .env .env.backup-$(date +%Y%m%d-%H%M%S) && mv .env.new .env
docker compose down && docker compose up -d
# ⚠️ rotating JWT_SECRET_KEY invalidates all sessions → everyone re-logs-in
```

**Pre-live gates:**
```bash
docker compose exec api python -m src.launch.preflight   # must be all-green
python -m pytest tests/test_phase*.py                    # 460-test suite
```

---

### 16.12 Troubleshooting runbook

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` right after a rebuild | nginx cached the old container IP | `nginx-reloader` should auto-fix; force: `docker kill -s HUP $(docker ps -q -f ancestor=nginx:alpine)` |
| Code change "did nothing" | edited `.py` but only ran `restart` (old baked image) | `docker compose build <svc> && docker compose up -d` |
| No new signals for an hour | engine stalled **or** RiskGuard rejecting everything | check `forex_risk_rejections_total` by reason; watchdog restarts a frozen engine, but a high rejection rate is a *tuning* issue |
| `data-feed` keeps restarting | M15 candle stale >20 min → watchdog restart loop | check broker connectivity / rate limits in Loki; after 6 actions/h the watchdog *stops* and logs `watchdog_action_capped` — investigate manually |
| Container OOM-killed | exceeded its `deploy.limits.memory` on the 16 GB box | `docker stats`; check cAdvisor per-container memory panel; LSTM is heavy — on RAM pressure run XGBoost+LightGBM only (per `CLAUDE.md`) |
| Grafana won't start | `GRAFANA_PASSWORD` unset | compose enforces it; set it in `.env` |
| `system_locked == 1` (no trading) | daily-loss circuit breaker tripped | inspect `risk:daily_loss:*` in Redis; wait for rollover or manually unlock after reviewing losses |
| Celery queue ballooning | a slow consumer starving others | confirm queue isolation (`ig`/`ml_training`/`critical`); check Flower queue depth; this is exactly the 2026-06-19 incident pattern |
| Telegram alerts silent | bot token file missing / chat id wrong | verify `/etc/alertmanager/secrets/bot_token` + `ALERTMANAGER_CHAT_ID` |
| Cert expired | certbot renew failed / nginx didn't reload | nginx auto-reloads every 12 h; force a reload; check `certbot/conf/live/...` |

---

### 16.13 Forward roadmap (from `CLAUDE.md` + project memories)

- **ML retrain on real P&L (#119) + productize ML (#120)** — ~2026-06-26 the system will have enough *real-trade* data to retrain models on realised P&L instead of backtest labels (`coinepro-ml-retrain-reminder`).
- **Profitability hardening** — the data-backed fix (`coinepro-profitability-fix-2026-06`): TP1_RR 1.05→1.5, breakeven 0.5→0.8, min-score→70, loser blocklist, plus an EA TP-anchor + stops-guard that needs a Windows recompile.
- **Live-trade scaling / sharding** — the Hetzner Windows copy server (snapshot 395492442) is operational but live stays disabled until account sharding lands (`coinepro-copy-windows`).
- **Prometheus → Alertmanager wiring** — the rules + Alertmanager config exist; finishing the in-compose Alertmanager wiring (and adding the `bearer_token` to the `forex-api` scrape job) closes the last observability gap.
- **BazaarNama (~35 %)**, **SEO ecosystem**, **video/Instagram autopilot** continue per their respective memories.

---
---

## ۱۶. رصدپذیری، عملیات و استقرار

> *اجرای CoinePro-FX یعنی «یک کانتینر بالا بیاور و امیدوار باش» نیست. این یک سیستمِ خود-ابزاردهنده، خود-ترمیم‌کننده و خود-بکاپ‌گیر است که روی یک سرورِ تکیِ Hetzner اجرا می‌شود اما مثل یک تیمِ کوچکِ SRE رفتار می‌کند. این فصل — به‌صورت کامل و با کانفیگِ واقعی — مستند می‌کند که پلتفرم چگونه رصد، عملیات، بکاپ و به production منتقل می‌شود.*

CoinePro-FX یک **پشتهٔ کاملِ رصدپذیری + عملیات را درونِ همان `docker-compose.yml`** قرار می‌دهد که موتورِ معاملاتی را اجرا می‌کند. هیچ Datadog بیرونی، هیچ Prometheusِ مدیریت‌شده و هیچ صورت‌حسابِ لاگِ ابری وجود ندارد. همه‌چیز — متریک، لاگ، داشبورد، هشدار، خود-ترمیمی، بکاپ، TLS، ارکستریشن — کنارِ هم و نسخه‌بندی‌شده است. محدودیتِ طراحی که هر تصمیم را شکل می‌دهد، صداقتِ بی‌رحمانه دربارهٔ سرور است: **یک سرورِ Hetzner، Ubuntu 24.04، ۱۶ گیگ RAM، ۸ vCPU AMD، ۸ گیگ swap، بدونِ GPU** (طبقِ `CLAUDE.md`). هر سرویس یک سقفِ صریحِ `deploy.resources.limits` برای حافظه/CPU دارد تا سرور هرگز موتورِ معاملاتی را برای تغذیهٔ Grafana با OOM نکُشد.

---

### ۱۶.۱ نگاهِ کلی به پشتهٔ رصدپذیری

| لایه | سرویس | ایمیج | پورتِ داخلی | bind به | سقفِ RAM |
|---|---|---|---|---|---|
| پایگاهِ متریک | `prometheus` | `prom/prometheus:latest` | 9090 | `127.0.0.1:9090` | 512M |
| داشبورد | `grafana` | `grafana/grafana:latest` | 3000 | `127.0.0.1:3000` | 512M |
| انبارِ لاگ | `loki` | `grafana/loki:2.9.8` | 3100 | `127.0.0.1:3100` | 768M |
| ارسالِ لاگ | `promtail` | `grafana/promtail:2.9.8` | 9080 | — (push) | 256M |
| متریکِ کانتینر | `cadvisor` | `cadvisor:v0.49.1` | 8080 | `127.0.0.1:8088` | 256M |
| متریکِ هاست | `node-exporter` | `node-exporter:v1.8.1` | 9100 | `127.0.0.1:9100` | 128M |
| مانیتورِ Celery | `flower` | `mher/flower:2.0` | 5555 | `127.0.0.1:5555` | 256M |
| خود-ترمیم | `watchdog` | (ایمیجِ پروژه) | — | — | 256M |
| رجیستریِ مدل | `mlflow` | `mlflow:v2.14.1` | 5000 | `127.0.0.1:5000` | 512M |
| ارکستریتور | `prefect` | `prefect:2.19` | 4200 | `127.0.0.1:4200` | 768M |
| اجرای فلو | `flow-runner` | (ایمیجِ پروژه) | — | — | 384M |

**نکتهٔ امنیتیِ مهم:** هر پورتِ رصدپذیری فقط روی `127.0.0.1:*` منتشر می‌شود — هرگز `0.0.0.0`. Prometheus (9090)، Grafana (3000)، Loki (3100)، Flower (5555)، MLflow (5000)، Prefect (4200)، cAdvisor (8088) و node-exporter (9100) همگی loopback-bound‌اند. تنها پورت‌هایی که به‌بیرون باز هستند `nginx` (`80`/`443`) و پورتِ ICE UDP لایو `8189/udp` هستند. برای رسیدن به Grafana از تونلِ SSH استفاده می‌کنید: `ssh -L 3000:127.0.0.1:3000 forex@host`. این یک سیاستِ عمدیِ «هیچ داشبوردی روی اینترنت باز نیست» است.

---

### ۱۶.۲ متریک — Prometheus و ابزاردهیِ FastAPI

#### پیکربندیِ scrape

Prometheus با `monitoring/prometheus.yml` پیکربندی می‌شود و یک مجموعهٔ کوچک و عمدی از targetها را scrape می‌کند: `forex-api` روی `api:8000/metrics` (هر ۱۰ ثانیه — تندتر چون مهم‌ترین target است)، `prometheus` (self-scrape)، `node-exporter:9100` و `cadvisor:8080` (هر ۳۰ ثانیه).

| target | job | چه چیزی را پاسخ می‌دهد |
|---|---|---|
| `api:8000/metrics` | `forex-api` | سیگنال‌ها، وین‌ریت، ردهای ریسک، P&L، وضعیتِ فید، تأخیرِ ML، تأخیرِ HTTP |
| `node-exporter:9100` | `node-exporter` | RAM/swapِ هاست (محدودیتِ ۱۶ گیگ)، پُرشدنِ دیسک، load average، شبکه |
| `cadvisor:8080` | `cadvisor` | حافظهٔ هر کانتینر در برابرِ سقفِ `deploy.limits` — کانتینری که در آستانهٔ OOM است را می‌گیرد |
| `localhost:9090` | `prometheus` | سلامتِ خودِ Prometheus |

#### متریک‌های دامنه‌ای — `src/core/metrics.py`

برنامهٔ FastAPI از یک auto-instrumentatorِ عمومی که فقط هیستوگرامِ HTTP می‌دهد استفاده **نمی‌کند**. در عوض، `src/core/metrics.py` یک **کاتالوگِ متریکِ مخصوصِ دامنه** با `prometheus_client` تعریف می‌کند — متریک‌هایی که واقعاً می‌گویند آیا *کسب‌وکارِ معاملاتی* سالم است یا نه:

- **سیگنال‌ها:** `forex_signals_generated_total{symbol,direction,signal_type}`، `forex_signals_active`، `forex_signal_score` (هیستوگرامِ ۵۰…۱۰۰).
- **عملکرد:** `forex_signal_pnl_pips`، `forex_win_rate{period}`.
- **فیدِ داده:** `forex_data_feed_status{source}`، `forex_data_feed_latency_seconds`، `forex_data_feed_errors_total`.
- **ML:** `forex_ml_inference_seconds{model}`، `forex_ml_model_accuracy{model}`، و یک متریکِ ظریف اما مهم — `forex_ml_fallback_total{symbol,reason}` که هر بار ML بی‌صدا به امتیازِ خنثیِ `50` برمی‌گردد (چون مدلی لود نشد) شلیک می‌کند. بدونِ آن، پوسیدگیِ مدل نامرئی می‌ماند.
- **ریسک:** `forex_risk_rejections_total{symbol,reason}`، `forex_daily_pnl_dollar`، `forex_daily_consecutive_losses`، `forex_system_locked` (گیجِ مدارشکن)، `forex_market_regime{symbol}`.
- **متریک‌های paper-vs-live:** `forex_trading_mode` (۰=paper, ۱=live)، `forex_paper_signals_generated_total`، `forex_paper_vs_live_divergence{metric}` — همان متریکی که هشدارهای launch به آن وابسته‌اند.

#### اندپوینتِ `/metrics` و نکتهٔ احرازِ هویتش

```python
@app.get("/metrics", include_in_schema=False)
async def metrics(admin: Admin = Depends(get_current_admin)):
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

این اندپوینت **با احرازِ هویتِ ادمین** محافظت می‌شود — یک پورتِ متریکِ باز نیست. چون Prometheus و API شبکهٔ خصوصیِ `coinepro-network` را به اشتراک می‌گذارند و `/metrics` هرگز بیرون منتشر نمی‌شود، مدلِ تهدید این bridge را معتمد فرض می‌کند؛ اگر بعداً بخواهید Prometheus یک اندپوینتِ auth-gated را scrape کند، یک بلاکِ `bearer_token` به jobِ `forex-api` اضافه می‌کنید.

#### Recording rules و SLO — `monitoring/recording_rules.yml`

به‌جای محاسبهٔ دوبارهٔ `histogram_quantile(...)` در هر رفرشِ داشبورد، Prometheus هر ۳۰ ثانیه SLIها را از پیش محاسبه می‌کند: `sli:api_availability:5m`/`:30d`، `sli:api_latency_seconds:p95/p99:5m`، `sli:signal_latency_seconds:p95:1h`، `sli:rejection_rate:5m`، `sli:data_feed_up:ratio`، و `slo:api_error_budget_burn_rate:1h`/`:6h` در برابرِ یک **SLOِ دسترس‌پذیریِ ۹۹٫۵٪**. burn-rate بزرگ‌تر از ۱ یعنی بودجهٔ خطا را سریع‌تر از مجاز می‌خورید.

---

### ۱۶.۳ هشدار — قواعدِ Prometheus → Alertmanager → تلگرام

`monitoring/alerts.yml` دو گروهِ قاعده دارد. گروهِ بحرانی (`forex_signal_critical`، هر ۳۰ ثانیه):

| هشدار | عبارت (خلاصه) | for | شدت |
|---|---|---|---|
| `AllDataFeedsDown` | `sum(forex_data_feed_status) == 0` | ۲د | critical |
| `APIDown` | `up{job="forex_api"} == 0` | ۱د | critical |
| `SystemLockedDueToDailyLoss` | `forex_system_locked == 1` | ۱د | high |
| `HighConsecutiveLosses` | `forex_daily_consecutive_losses >= 3` | ۱د | warning |
| `NoSignalsForOneHour` | `rate(forex_signals_generated_total[1h]) == 0` | ۱س | warning |
| `HighRejectionRate` | ردها/سیگنال‌ها `> 0.8` | ۱۰د | warning |
| `MLModelStale` | مدل ۷ روز retrain نشده | ۵د | warning |
| `HighAPILatency` | `p95(...) > 1.5s` | ۵د | warning |

گروهِ دوم (`forex_paper_trading`) مراقبِ `PaperVsBacktestDegradation` (وین‌ریتِ paper ≥۱۵٪ زیرِ backtest) و `PaperTradeVolumeLow` است — این‌ها دروازهٔ launchِ live هستند.

**مسیریابی** (`monitoring/alertmanager.yml`): درختی که بر اساسِ `alertname/severity/category` گروه می‌کند و به receiverهای تلگرامی مسیر می‌دهد — `telegram_critical` (انتظارِ ۵ث، تکرارِ هر ۱۵د، `continue: true` تا *همچنین* به کانالِ default برسد)، `telegram_risk`، `telegram_infra`، `telegram_launch`. قالب‌های پیامِ فارسی در `monitoring/templates/telegram.tmpl`. توکنِ بات از یک **فایل** خوانده می‌شود (`bot_token_file`) — هرگز inline. `inhibit_rules` نویز را خفه می‌کند: اگر `AllDataFeedsDown` شلیک است، هشدارهای جزئیِ stale-data در همان category خاموش می‌شوند.

---

### ۱۶.۴ داشبوردها — provisioningِ Grafana

Grafana کاملاً provisioned-as-code است (بدونِ click-ops). در `monitoring/grafana/provisioning/`: دیتاسورس‌ها `Prometheus` (پیش‌فرض، `editable:false`) و `Loki` (`maxLines:1000`) را سیم‌کشی می‌کنند — پس Grafana **هم متریک هم لاگ** را کوئری می‌کند. providerِ داشبورد هر JSON در `monitoring/grafana/dashboards/` را در پوشهٔ `CoinePro` بارگذاری می‌کند.

دو داشبورد عرضه می‌شود:
1. **`forex_dashboard.json` — «Forex Signal Bot Dashboard»:** Active Signals، Win Rate (30d)، Total Signals Today، Bot Users، Signals Generated (24h)، Signal Score Distribution، Data Feed Status، ML Inference Duration، API Response Time، Messages Sent.
2. **`risk_overview.json` — «CoinePro FX — Risk Overview»:** وضعیتِ سیستم، P&L روز ($)، زیانِ متوالی، Trading mode، rejections per reason، signals per symbol، رژیمِ بازارِ per-symbol، data feed status.

`GF_SECURITY_ADMIN_PASSWORD` از `${GRAFANA_PASSWORD}` می‌آید (متغیرِ اجباریِ `.env` — compose بدونِ آن بالا نمی‌آید).

---

### ۱۶.۵ لاگ — JSONِ ساختاریافته → Promtail → Loki

#### لاگِ ساختاریافته در مبدأ — `src/core/logger.py`

هر سرویسِ پایتون از **structlog** با `JSONRenderer(ensure_ascii=False)` لاگ می‌گیرد — پس لاگ‌ها هم ماشین‌خوان (JSON) هستند و هم متنِ فارسی را حفظ می‌کنند. مهم‌تر اینکه لاگر **پردازشگرهای حذفِ secret** نصب می‌کند: فهرستی از الگوهای کلید (`*_password`، `*_token`، `*_secret`، `authorization`، `cookie`، `private_key`، …) که مقدارشان با `[REDACTED]` جایگزین می‌شود، به‌علاوهٔ regexهای مقدار که JWT (`eyJ…`)، هدرِ `Bearer …` و کلیدهای `sk_/pk_/api_` را هرجای رشته می‌گیرند. پس حتی یک `logger.info("got", token=jwt)` تصادفی هم نمی‌تواند اعتبارنامه را به Loki نشت دهد.

فراخوانی‌ها مثلِ `logger.warning("watchdog_self_heal", action="restart", service=..., reason=...)` هستند — نامِ رویداد + فیلدهای ساختاریافته. این کوئریِ LogQL مثلِ `{container="coinepro-fx-watchdog-1"} | json | action="restart"` را بدیهی می‌کند.

#### ارسال — `monitoring/promtail-config.yml`

Promtail کانتینرها را **به‌صورتِ پویا از طریقِ Docker socket کشف می‌کند** (`docker_sd_configs`، رفرشِ ۱۵ث)، `__meta_docker_container_name` را به برچسبِ `container` ری‌لیبل می‌کند، `stream` را می‌گیرد، و — مهم — **فقط کانتینرهای همین پروژه** را با `regex: '/coinepro-fx-.*'` نگه می‌دارد. به `http://loki:3100/loki/api/v1/push` فشار می‌دهد. هیچ فایلِ لاگی برای چرخش نیست؛ لاگ مستقیماً از stdoutِ کانتینر جاری می‌شود.

#### ذخیره — `monitoring/loki-config.yml`

Loki تک‌نود و فایل‌سیستمی (`tsdb`/`schema v13`)، `auth_enabled: false` (به‌هرحال loopback)، `replication_factor: 1`، **نگه‌داریِ ۷ روز** (`retention_period: 168h`) با compactorِ `retention_enabled: true`. مصرف rate-limit شده (۸ MB/s، burst ۱۶) تا طوفانِ لاگ دیسک را پُر نکند. `analytics.reporting_enabled: false` — بدونِ phone-home. سرویس‌ها همچنین `./logs:/app/logs` را mount می‌کنند برای یک نسخهٔ روی‌دیسک، اما مسیرِ اصلیِ کوئری Loki از طریقِ Grafana است.

---

### ۱۶.۶ رصدِ Celery — Flower + جداسازیِ صف

Celery روی **چهار صفِ جداگانه** و سه سرویسِ worker اجرا می‌شود — طراحی‌ای که بعد از حادثهٔ ۱۳۹۸/۰۶/۱۹ (۲۰۲۶-۰۶-۱۹) به‌سختی به‌دست آمد، جایی که یک صفِ مشترک به ۲۴۰هزار تسک منفجر شد و auto-closeِ آخرِ هفته هرگز اجرا نشد:

| سرویس | فرمان (صف‌ها) | concurrency | هدف |
|---|---|---|---|
| `celery-worker` | `-Q celery,critical` | ۲ | پیش‌فرض + تریدینگِ **زمان‌حساس** |
| `celery-ig-worker` | `-Q ig` `--max-tasks-per-child=200` | ۴ | I/Oِ اینستاگرام (instagrapiِ کند) — جدا تا تریدینگ را گرسنه نکند |
| `celery-ml-worker` | `-Q ml_training` `--max-tasks-per-child=1` | ۱ | فقط retrainِ سنگینِ هفتگی |
| `celery-beat` | `beat` | — | زمان‌بند |

**Flower** (ایمیجِ `mher/flower:2.0`) به brokerِ Redis وصل می‌شود و نمای زندهٔ workerها، عمقِ صف، موفقیت/شکستِ تسک و زمانِ اجرای هر تسک را روی `127.0.0.1:5555` نشان می‌دهد. `FLOWER_UNAUTHENTICATED_API: "true"` دقیقاً به‌خاطرِ loopback-bound بودنِ پورت امن است. هر worker یک healthcheckِ `celery -A src.core.celery_app inspect ping` دارد، پس workerِ بی‌پاسخ `unhealthy` می‌شود و watchdog ری‌استارتش می‌کند.

---

### ۱۶.۷ خود-ترمیم‌گرِ watchdog — `run_watchdog.py`

سرویسِ `watchdog` سیستمِ عصبیِ خودکارِ سیستم است: به انسان *هشدار نمی‌دهد و منتظر نمی‌ماند* — بلکه از طریقِ Docker socket (اینجا read-write برای `docker restart`) **اقدامِ اصلاحی می‌کند**. آهنگِ حلقه `WATCHDOG_INTERVAL_SECONDS=60`. سه بررسی در هر تیک:

1. **تازگیِ کندل** — `SELECT max(time) FROM candles WHERE timeframe='M15'`. اگر تازه‌ترین کندلِ M15 از `WATCHDOG_CANDLE_STALE_MIN=20` دقیقه کهنه‌تر باشد → ری‌استارتِ `data-feed`. مهم‌ترین خود-ترمیم: فیدِ منجمد یعنی سیگنال روی قیمتِ کهنه.
2. **سلامتِ کانتینر** — بازرسیِ `signal-engine, signal-tracker, data-feed, bot-worker-1, ml-inference, claude-llm, celery-worker, api`. هر کانتینری که `exited` یا `unhealthy` است → ری‌استارت.
3. **حضورِ مدل‌های ML** — اگر `ml_models/` هیچ `*.joblib` نداشته باشد، `ml-inference` را ری‌استارت کن.

**ایمنیِ ضدِّ لوپ** (همان چیزی که این را production-safe می‌کند نه یک بمبِ ری‌استارت):
- **کول‌داونِ هر سرویس** `COOLDOWN_SECONDS=600` — یک سرویس بیش از هر ۱۰ دقیقه یک‌بار ری‌استارت نمی‌شود.
- **سقفِ کلیِ اقدام** `MAX_ACTIONS_PER_HOUR=6` — در همهٔ سرویس‌ها؛ پس از عبور، `watchdog_action_capped` را لاگ و اقدام را رد می‌کند، پس یک وابستگیِ واقعاً خراب به‌صورتِ *انسان-بررسی-کند* ظاهر می‌شود نه لوپِ بی‌نهایت.
- خودِ حلقه طوری بسته‌بندی شده که watchdog **هرگز نمی‌میرد** (`watchdog_loop_error` لاگ و حلقه ادامه می‌یابد).

هر اقدام یک خطِ لاگِ ساختاریافتهٔ `watchdog_self_heal` می‌دهد (در Loki قابل‌دیدن) — یک ردِّ ممیزیِ تمیز.

---

### ۱۶.۸ بکاپ — سه لایهٔ مستقل

CoinePro-FX **سه مکانیزمِ بکاپِ متعامد** دارد تا یک خرابیِ تکی (دیسک، قطعیِ تلگرام، سهمیهٔ Google) هرگز به‌معنای ازدست‌دادنِ داده نباشد. دو تا با cronِ هاست:

```
0  * * * * python3 scripts/hourly_backup.py   >> backup-logs/hourly_backup.log 2>&1
30 * * * * bash    scripts/gdrive_backup.sh    >> backup-logs/gdrive_backup.log 2>&1
```

| اسکریپت | آهنگ | مقصد | دامنه | نگه‌داری |
|---|---|---|---|---|
| `hourly_backup.py` | ساعتی :۰۰ | **تلگرام** (DMِ مالک) | دامپِ DB + زیپِ کد/کانفیگ/کلید (بدونِ ویدیو/مدل)، تقسیم به ≤۴۸MB | تاریخچهٔ تلگرام |
| `gdrive_backup.sh` | ساعتی :۳۰ | **Google Drive** (`rclone`) | **۱۰۰٪ پروژه** + اسنپ‌شاتِ DB/Redis/crontab/گواهی | mirror=زنده؛ `db/<TS>`=۱۴ روز |
| `backup.sh` | دستی/روزانه | `./backups` محلی | DB + مدل + کانفیگ + `.env` **رمزدار** | ۳۰ روز |

**`gdrive_backup.sh`** ستونِ فقراتِ disaster-recovery است: (۱) `pg_dump` از طریقِ `docker compose exec -T timescaledb`، `redis-cli SAVE` + کپیِ `dump.rdb`، گرفتنِ `crontab`، خروجیِ **resolved**ِ `docker compose config`، فهرستِ volumeها؛ (۲) tar کردنِ `certbot/conf`ِ متعلق‌به‌root *از طریقِ کانتینرِ alpine* (کاربرِ forex مستقیماً نمی‌خواند)؛ (۳) `rclone sync` کلِ پروژه به `gdrive:CoinePro-FX-Backups/project-mirror` با excludeهای پوشه‌ای (`node_modules/`، `dist/`، `/logs/`، …) تا rclone اصلاً واردشان نشود؛ (۴) آپلودِ اسنپ‌شاتِ تاریخ‌دار به `db/<TS>`؛ (۵) هرسِ اسنپ‌شات‌های قدیمی‌ترِ از ۱۴ روز.

**`backup.sh`** بکاپِ محلیِ سیاست‌گرا با ریلِ ایمنیِ واقعی: از بکاپِ plaintextِ `.env` **امتناع** می‌کند — `BACKUP_PASSPHRASE` باید تنظیم باشد وگرنه hard-exit (فقط `ALLOW_UNENCRYPTED_BACKUP=true` آن را override می‌کند، آن‌هم فقط dev). `.env` با `openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt` رمز می‌شود → `env_<TS>.enc` (chmod 600). پس از دامپ، **یکپارچگی را بررسی می‌کند** (`gunzip -t`) و اگر دامپ خراب باشد لغو می‌کند. قدیمی‌ترها را بعد از `RETENTION_DAYS=30` هرس می‌کند.

**Restore** (`scripts/restore.sh <db.sql.gz> [models] [env.enc]`): دامپ را پیش‌بررسی می‌کند (`gunzip -t`)، **اول از DB فعلی یک بکاپِ ایمنی می‌گیرد** (تا restoreِ بد برگشت‌پذیر باشد)، DB را `DROP`/`CREATE` می‌کند، با `ON_ERROR_STOP=1` بازمی‌گرداند، اختیاراً `.env` را به `.env.restored` رمزگشایی می‌کند (هرگز auto-overwrite نمی‌کند)، **تأییدِ پس‌از-restore** اجرا می‌کند (شمارشِ `signals`/`users`/`admins`) و سرویس‌های هسته را ری‌استارت می‌کند. `DRY_RUN=true` همه‌چیز را بدونِ دست‌زدن چاپ می‌کند. runbookِ کاملِ بازیابیِ bare-metal در `RESTORE_GDRIVE.md` است؛ `scripts/dr_drill.sh` برای *تمرینِ* آن وجود دارد.

---

### ۱۶.۹ مدلِ استقرار — تک‌سرورِ Hetzner، ایمیج‌های baked

- **هاست:** یک سرورِ Hetzner، Ubuntu 24.04، ۱۶ گیگ/۸ vCPU/۸ گیگ swap. کاربرِ کاری `forex` (در گروهِ `docker` → بدونِ نیاز به `sudo`). پروژه در `/home/forex/CoinePro-FX`.
- **همه‌چیز Docker است.** `docker-compose.yml` تنها منبعِ حقیقت؛ `networks.default.name: coinepro-network`.
- **ایمیج‌ها baked هستند، نه bind-mount.** `Dockerfile`، `src/`، `alembic/`، `scripts/`، `run_*.py` را *داخلِ ایمیج* `COPY` می‌کند (و TA-Lib 0.4.0 را از سورس کامپایل + numpy 2.2.6 پین می‌کند). نتیجهٔ عملیاتی — که در همهٔ مموری‌های پروژه تأکید شده — **ویرایشِ یک `.py` تا rebuild نکنی هیچ اثری ندارد**:

```bash
docker compose build api signal-engine
docker compose up -d
```

یک `docker compose restart` ساده کدِ **قدیمیِ** baked را دوباره اجرا می‌کند. این footgunِ شمارهٔ ۱ است.

#### nginxِ بدونِ قطعی و رفعِ «۵۰۲ بعد از rebuild»

وقتی سرویسی مثلِ `api` recreate می‌شود، IPِ جدید می‌گیرد و nginxِ بلندعمر که IPِ قدیم را cache کرده ۵۰۲ می‌دهد. دو مکانیزم رفعش می‌کنند:
1. **`nginx-reloader`** (کانتینرِ `docker:cli` که `scripts/nginx_reloader.sh` را اجرا می‌کند) به رویدادهای `start`ِ Docker گوش می‌دهد؛ وقتی `*-api-*`/`*-frontend-website-*`/`*-frontend-admin-*` (دوباره)استارت می‌شوند، ۳ ثانیه صبر و `nginx -s HUP` می‌فرستد (reloadِ بی‌قطعی) تا IPِ جدید را resolve کند.
2. **خودِ nginx** `while :; do sleep 12h; nginx -s reload; done & exec nginx -g 'daemon off;'` را اجرا می‌کند — reloadِ توکارِ هر ۱۲ ساعت تا گواهیِ تازه‌تمدیدشدهٔ certbot برداشته شود.

#### TLS — certbot، تقسیمِ ۴۴۳ و ACME

- **`certbot`** حلقهٔ `certbot renew; sleep 12h` را برای همیشه اجرا می‌کند و `./certbot/conf` (گواهی‌ها) و `./certbot/www` (webrootِ ACME) را با nginx به اشتراک می‌گذارد.
- `conf.d/*.conf` چالشِ `/.well-known/acme-challenge/` را روی **پورت ۸۰** سرو و بقیه را `return 301 https` می‌کنند. TLS روی یک serverِ داخلیِ `8443 ssl` با `…/live/fx.trade-future.ir/fullchain.pem` ترمینال می‌شود.
- نکتهٔ هوشمندانه: **پورت ۴۴۳ بینِ HTTPS و TURN-over-TLS مشترک است**. بلاکِ `stream {}` با `ssl_preread` فقط ALPN/SNI را *بدونِ ترمینالِ TLS* می‌خواند و `turn.fx.trade-future.ir` را → `coturn:5349` و بقیه را → `127.0.0.1:8443` مسیر می‌دهد. این به TURNِ لایو-تریدِ WebRTC و وب‌سایت اجازه می‌دهد روی یک پورت کنارِ هم باشند — حیاتی وقتی فایروال‌ها فقط ۴۴۳ را اجازه می‌دهند.
- سخت‌سازیِ nginx: `server_tokens off`، gzip، و سه zoneِ rate-limitِ per-IP — `api` ۶۰r/s، `general` ۱۲۰r/s، و یک zoneِ سخت‌گیرانهٔ `auth` با **۵r/min** برای throttleِ brute-forceِ login، همه با `429`.

#### مهاجرتِ دیتابیس — Alembic

```bash
docker compose exec api alembic upgrade head
```

سرویسِ `api` پوشه‌های `./alembic` و `./scripts` را read-write mount می‌کند تا migrationها و اسکریپت‌های ادمین داخلِ کانتینرِ زنده با URLِ DBِ production اجرا شوند.

---

### ۱۶.۱۰ آمادگیِ live — preflight و divergence

`TRADING_MODE` تا *اثبات* استراتژی روی این بروکر `paper` می‌ماند. دروازهٔ تغییر به `live` یک چک‌لیستِ کداجباری است، نه حس.

**Preflight** — `docker compose exec api python -m src.launch.preflight` اگر **هر چکِ CRITICAL** fail شود `is_ready_for_launch=False` برمی‌گرداند:
- `no_default_passwords` — پسوردهای DB/Redis/Admin ضعیف نباشند؛ `JWT_SECRET_KEY` ≥۳۲ کاراکتر و حاویِ «change» نباشد.
- `debug_off` — `DEBUG=false`.
- `telegram_token` — توکنِ بات معتبر.
- `redis_reachable`، `database_reachable` — `PING`/`SELECT 1` زنده.
- `paper_trading_period` — حداقل **۷ روز** سیگنالِ paper ثبت‌شده (`MIN(signals.created_at)`).

چک‌های WARNING (مجاز اما علامت‌گذاری‌شده): `ml_models_present`، `monitoring_active` (وجودِ `prometheus.yml`+`alerts.yml`)، `backup_script`، `runbook_exists`. CLI گزارشِ ✅/❌ چاپ و در صورتِ ناآمادگی exitِ غیرصفر می‌دهد.

**Divergence** — `src/launch/divergence.py` عملکردِ **paper-trading**ِ زنده را با خط‌پایهٔ **backtest** مقایسه می‌کند. پیش‌فرض: استراتژی «degraded» است اگر `win_rate`ِ paper **بیش از ۱۵٪** زیرِ backtest یا `profit_factor` **بیش از ۳۰٪** افت کند. اگر divergence از آستانه فراتر رود، به‌صورتِ هشدارِ `PaperVsBacktestDegradation` ظاهر و launch را بلاک می‌کند. فلسفه: backtest ۶۵٪ اما paper ۴۵٪ یعنی overfit / تغییرِ رژیم / cost modelِ غلط / تأخیرِ اجرا — قبل از ریسکِ پولِ واقعی تشخیص بده.

---

### ۱۶.۱۱ اجرا و عملیات — دفترچهٔ فرمان

**بالا آوردن / بررسی:**
```bash
docker compose up -d
docker compose ps
docker compose logs -f signal-engine
free -h && docker stats --no-stream   # همیشه بعد از up — سرورِ ۱۶ گیگ، مراقبِ RAM
```

**استقرارِ تغییرِ کد (یادآوری: ایمیج‌ها baked):**
```bash
docker compose build api signal-engine bot-worker-1
docker compose up -d
docker compose exec api alembic upgrade head     # اگر مدل‌ها عوض شدند
```

**عملیاتِ رصد (از طریقِ تونلِ SSH):**
```bash
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 -L 5555:127.0.0.1:5555 forex@host
# Grafana :3000 | Prometheus :9090 | Flower :5555
```

**کوئریِ لاگ در Loki (Grafana → Explore):**
```logql
{container="coinepro-fx-signal-engine-1"} | json | level="error"
{container="coinepro-fx-watchdog-1"} | json | action="restart"
```

**بکاپ و restore:**
```bash
BACKUP_PASSPHRASE=$(openssl rand -hex 32) bash scripts/backup.sh
bash scripts/restore.sh ./backups/db_YYYYMMDD_HHMMSS.sql.gz
DRY_RUN=true bash scripts/restore.sh ./backups/db_*.sql.gz
```

**چرخشِ secret:**
```bash
bash scripts/rotate_secrets.sh
cp .env .env.backup-$(date +%Y%m%d-%H%M%S) && mv .env.new .env
docker compose down && docker compose up -d
# ⚠️ چرخشِ JWT_SECRET_KEY همهٔ سشن‌ها را باطل می‌کند → همه دوباره login
```

**دروازه‌های پیش‌از-live:**
```bash
docker compose exec api python -m src.launch.preflight   # باید همه‌سبز باشد
python -m pytest tests/test_phase*.py                    # مجموعهٔ ۴۶۰ تست
```

---

### ۱۶.۱۲ دفترچهٔ عیب‌یابی

| نشانه | علتِ محتمل | رفع |
|---|---|---|
| `502` بلافاصله بعد از rebuild | nginx IPِ قدیمِ کانتینر را cache کرده | `nginx-reloader` باید خودکار رفع کند؛ اجباری: `docker kill -s HUP $(docker ps -q -f ancestor=nginx:alpine)` |
| تغییرِ کد «هیچ اثری نداشت» | `.py` ویرایش شد اما فقط `restart` اجرا شد (ایمیجِ قدیمِ baked) | `docker compose build <svc> && docker compose up -d` |
| یک ساعت بدونِ سیگنالِ جدید | موتور متوقف **یا** RiskGuard همه را رد می‌کند | `forex_risk_rejections_total` per reason را ببین؛ نرخِ ردِ بالا یک مسئلهٔ *تنظیم* است |
| `data-feed` مدام ری‌استارت | کندلِ M15 از ۲۰د کهنه‌تر → لوپِ watchdog | اتصالِ بروکر/rate-limit را در Loki ببین؛ بعد از ۶ اقدام/ساعت watchdog *متوقف* و `watchdog_action_capped` لاگ می‌کند |
| کانتینر OOM-kill شد | از سقفِ `deploy.limits.memory` روی سرورِ ۱۶ گیگ گذشت | `docker stats`؛ پنلِ حافظهٔ cAdvisor را ببین؛ LSTM سنگین است — در فشارِ RAM فقط XGBoost+LightGBM (طبقِ `CLAUDE.md`) |
| Grafana بالا نمی‌آید | `GRAFANA_PASSWORD` تنظیم نشده | در `.env` تنظیم کن |
| `system_locked == 1` (بدونِ تریدینگ) | مدارشکنِ daily-loss فعال شد | `risk:daily_loss:*` در Redis را ببین؛ منتظرِ rollover یا بعد از بررسی دستی unlock کن |
| صفِ Celery بادکرده | یک consumerِ کند بقیه را گرسنه می‌کند | جداسازیِ صف (`ig`/`ml_training`/`critical`) را تأیید؛ عمقِ صف در Flower؛ همان الگوی حادثهٔ ۲۰۲۶-۰۶-۱۹ |
| هشدارهای تلگرام خاموش | فایلِ توکنِ بات نیست / chat id غلط | `/etc/alertmanager/secrets/bot_token` + `ALERTMANAGER_CHAT_ID` را بررسی کن |
| گواهی منقضی | renewِ certbot شکست / nginx reload نشد | nginx هر ۱۲ساعت auto-reload می‌کند؛ یک reloadِ اجباری بزن |

---

### ۱۶.۱۳ نقشهٔ راهِ پیش‌رو (از `CLAUDE.md` + مموری‌های پروژه)

- **retrainِ ML روی P&L واقعی (#119) + محصول‌سازیِ ML (#120)** — حدودِ ۲۰۲۶-۰۶-۲۶ سیستم دادهٔ *معاملهٔ واقعیِ* کافی برای retrainِ مدل‌ها روی P&Lِ محقق‌شده به‌جای برچسبِ backtest خواهد داشت (`coinepro-ml-retrain-reminder`).
- **سخت‌سازیِ سوددهی** — رفعِ داده‌محور (`coinepro-profitability-fix-2026-06`): TP1_RR ۱٫۰۵→۱٫۵، breakeven ۰٫۵→۰٫۸، min-score→۷۰، blocklistِ بازنده‌ها، و یک EAِ TP-anchor + stops-guard که نیاز به recompileِ ویندوز دارد.
- **مقیاس‌دهیِ لایو / sharding** — سرورِ کپیِ ویندوزِ Hetzner (اسنپ‌شات 395492442) عملیاتی است اما live تا shardingِ حساب غیرفعال می‌ماند (`coinepro-copy-windows`).
- **سیم‌کشیِ Prometheus → Alertmanager** — قواعد و کانفیگِ Alertmanager موجودند؛ تکمیلِ سیم‌کشیِ Alertmanager در compose (و افزودنِ `bearer_token` به jobِ `forex-api`) آخرین شکافِ رصدپذیری را می‌بندد.
- **BazaarNama (~۳۵٪)**، **اکوسیستمِ SEO**، **خلبانِ ویدیو/اینستاگرام** طبقِ مموری‌های مربوطه ادامه دارند.

---

[⬅ 15. Core Infrastructure & Security Posture](core-security.md) · [🏠 Home · خانه](../README.md)
