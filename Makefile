.PHONY: help build up down restart logs test lint clean setup

# رنگ‌ها
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m

help: ## نمایش راهنما
	@echo "$(GREEN)CoinePro Forex Signal Bot$(NC)"
	@echo "=========================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

# ---- Docker ----

build: ## ساخت Docker images
	docker compose build

up: ## اجرای تمام سرویس‌ها
	docker compose up -d

down: ## توقف تمام سرویس‌ها
	docker compose down

restart: ## ری‌استارت تمام سرویس‌ها
	docker compose down && docker compose up -d

logs: ## نمایش لاگ‌ها
	docker compose logs -f --tail=100

logs-api: ## لاگ‌ API
	docker compose logs -f api --tail=100

logs-bot: ## لاگ ربات
	docker compose logs -f bot-worker-1 --tail=100

logs-engine: ## لاگ سیگنال انجین
	docker compose logs -f signal-engine --tail=100

# ---- Database ----

migrate: ## اجرای migration
	docker compose exec api python scripts/migrate_db.py

seed: ## seed داده‌های اولیه
	docker compose exec api python scripts/seed_data.py

create-admin: ## ساخت ادمین
	docker compose exec api python scripts/create_admin.py

db-shell: ## اتصال به دیتابیس
	docker compose exec timescaledb psql -U coinepro -d forex_signals

# ---- ML ----

train: ## آموزش مدل‌ها
	docker compose exec api python scripts/train_models.py

download-data: ## دانلود داده تاریخی
	docker compose exec api python scripts/download_historical.py

backtest: ## بک‌تست
	docker compose exec api python scripts/backtest.py

# ---- Development ----

test: ## اجرای تست‌ها
	python -m pytest tests/ -v

test-cov: ## اجرای تست‌ها با coverage
	python -m pytest tests/ -v --cov=src --cov-report=html

lint: ## بررسی کد
	ruff check src/ tests/

lint-fix: ## رفع مشکلات lint
	ruff check src/ tests/ --fix

# ---- Setup ----

setup: ## تنظیم اولیه پروژه
	@echo "$(GREEN)تنظیم اولیه CoinePro...$(NC)"
	cp -n .env.example .env || true
	mkdir -p logs ml_models
	@echo "$(YELLOW)فایل .env را با مقادیر واقعی پر کنید$(NC)"
	@echo "$(GREEN)سپس: make build && make up$(NC)"

install-deps: ## نصب وابستگی‌های محلی (توسعه)
	pip install -r requirements.txt

clean: ## پاکسازی فایل‌های موقت
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache htmlcov .coverage

# ---- Monitoring ----

status: ## وضعیت سرویس‌ها
	docker compose ps

health: ## بررسی سلامت
	@echo "API:" && curl -sf http://localhost:8000/health | python -m json.tool || echo "OFFLINE"
	@echo ""
	@echo "TimescaleDB:" && docker compose exec timescaledb pg_isready -U coinepro || echo "OFFLINE"
	@echo ""
	@echo "Redis:" && docker compose exec redis redis-cli ping || echo "OFFLINE"
