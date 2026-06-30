#!/bin/bash
# اسکریپت نصب Docker و Docker Compose روی Ubuntu 24.04
# اجرا: sudo bash scripts/install_docker.sh

set -e

echo "=== نصب Docker ==="

# حذف نسخه‌های قدیمی
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# نصب پیش‌نیازها
apt-get update
apt-get install -y ca-certificates curl gnupg

# اضافه کردن کلید GPG رسمی Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# اضافه کردن ریپوزیتوری
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# نصب Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# اضافه کردن کاربر به گروه docker
usermod -aG docker CoinePro

# فعال‌سازی سرویس
systemctl enable docker
systemctl start docker

echo "=== Docker نصب شد ==="
docker --version
docker compose version

echo ""
echo "لطفاً از سیستم خارج شده و دوباره وارد شوید تا تغییرات گروه اعمال شود."
echo "سپس: cd /home/CoinePro/forex-signal-bot && docker compose up -d"
