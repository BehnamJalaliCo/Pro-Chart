#!/bin/bash
# =============================================================================
# اسکریپت نصب و راه‌اندازی کامل سرور CoinePro
# Ubuntu 24.04 LTS - باید با sudo اجرا شود
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# بررسی اجرا با sudo
if [ "$EUID" -ne 0 ]; then
    log_error "لطفاً با sudo اجرا کنید: sudo bash $0"
    exit 1
fi

INSTALL_USER="${SUDO_USER:-coinepro}"
PROJECT_DIR="/home/${INSTALL_USER}/forex-signal-bot"

log_info "شروع نصب CoinePro Forex Signal Platform"
log_info "کاربر: ${INSTALL_USER}"
log_info "مسیر: ${PROJECT_DIR}"

# ── 1. بروزرسانی سیستم ────────────────────────────────
log_info "بروزرسانی سیستم..."
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. نصب وابستگی‌های سیستمی ─────────────────────────
log_info "نصب پکیج‌های سیستمی..."
apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libpq-dev \
    git \
    htop \
    iotop \
    ncdu \
    jq \
    unzip \
    ufw \
    fail2ban

# ── 3. نصب Docker ─────────────────────────────────────
if ! command -v docker &> /dev/null; then
    log_info "نصب Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # اضافه کردن کاربر به گروه docker
    usermod -aG docker "${INSTALL_USER}"
    log_info "Docker نصب شد"
else
    log_info "Docker قبلاً نصب شده"
fi

# بررسی Docker Compose
if docker compose version &> /dev/null; then
    log_info "Docker Compose: $(docker compose version --short)"
else
    log_error "Docker Compose نصب نشد!"
    exit 1
fi

# ── 4. تنظیمات فایروال ────────────────────────────────
log_info "تنظیم فایروال..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 1367/tcp   # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw --force enable
log_info "فایروال فعال شد (پورت‌ها: 1367, 80, 443)"

# ── 5. تنظیمات fail2ban ───────────────────────────────
log_info "تنظیم fail2ban..."
cat > /etc/fail2ban/jail.local <<'JAIL'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port    = 1367
JAIL
systemctl restart fail2ban

# ── 6. بهینه‌سازی سیستم ───────────────────────────────
log_info "بهینه‌سازی تنظیمات کرنل..."
cat > /etc/sysctl.d/99-coinepro.conf <<'SYSCTL'
# TCP Optimization
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_tw_reuse = 1

# Memory
vm.swappiness = 10
vm.overcommit_memory = 1

# File limits
fs.file-max = 2097152
SYSCTL
sysctl --system > /dev/null 2>&1

# ── 7. تنظیمات limits ─────────────────────────────────
cat > /etc/security/limits.d/99-coinepro.conf <<'LIMITS'
*       soft    nofile      1048576
*       hard    nofile      1048576
*       soft    nproc       65535
*       hard    nproc       65535
LIMITS

# ── 8. ساخت swap اگر وجود ندارد ──────────────────────
if [ ! -f /swapfile ]; then
    log_info "ساخت swap file (4GB)..."
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log_info "Swap فعال شد"
fi

# ── 9. آماده‌سازی پروژه ───────────────────────────────
log_info "آماده‌سازی پروژه..."
cd "${PROJECT_DIR}"

# ساخت پوشه‌ها
mkdir -p logs ml_models certbot/www certbot/conf ssl

# ساخت .env اگر وجود ندارد
if [ ! -f .env ]; then
    cp .env.example .env
    # تولید کلیدهای رندوم
    JWT_KEY=$(openssl rand -hex 32)
    ADMIN_KEY=$(openssl rand -hex 16)
    DB_PASS=$(openssl rand -hex 16)
    REDIS_PASS=$(openssl rand -hex 16)

    sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=${JWT_KEY}/" .env
    sed -i "s/ADMIN_SECRET_KEY=.*/ADMIN_SECRET_KEY=${ADMIN_KEY}/" .env
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/" .env
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/" .env

    log_warn "فایل .env ایجاد شد - لطفاً تنظیمات را تکمیل کنید:"
    log_warn "  - TELEGRAM_BOT_TOKEN"
    log_warn "  - TELEGRAM_ADMIN_IDS"
    log_warn "  - OANDA_API_KEY (اختیاری)"
    log_warn "  - TWELVEDATA_API_KEY (اختیاری)"
fi

# تنظیم مالکیت فایل‌ها
chown -R "${INSTALL_USER}:${INSTALL_USER}" "${PROJECT_DIR}"

# ── 10. نصب اولیه SSL (Let's Encrypt) ────────────────
log_info "برای دریافت SSL پس از راه‌اندازی این دستور را اجرا کنید:"
log_info "  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d FX.trade-future.ir -d Panel.FX.trade-future.ir -d api.FX.trade-future.ir"

# ── خلاصه ──────────────────────────────────────────────
echo ""
echo "=============================================="
echo -e "${GREEN}  نصب CoinePro با موفقیت انجام شد! ${NC}"
echo "=============================================="
echo ""
echo "  مراحل بعدی:"
echo "  1. از سشن خارج شوید و مجدد لاگین کنید (برای گروه docker)"
echo "  2. فایل .env را ویرایش کنید:"
echo "     nano ${PROJECT_DIR}/.env"
echo "  3. سرویس‌ها را اجرا کنید:"
echo "     cd ${PROJECT_DIR}"
echo "     docker compose up -d"
echo "  4. مایگریشن دیتابیس:"
echo "     docker compose exec api python scripts/migrate_db.py"
echo "  5. ساخت ادمین:"
echo "     docker compose exec api python scripts/create_admin.py"
echo ""
echo "  پورت‌ها:"
echo "    SSH:       1367"
echo "    HTTP:      80"
echo "    HTTPS:     443"
echo "    API:       8000 (internal)"
echo "    Grafana:   3000 (internal)"
echo "    Prometheus: 9090 (internal)"
echo ""
