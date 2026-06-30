#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  server_hardening.sh — سخت‌سازیِ هاستِ سرورِ اصلیِ CoinePro-FX.
#  اجرا:  sudo bash scripts/server_hardening.sh
#
#  چه می‌کند (همه idempotent و امن):
#    1) فایروال ufw: default-deny ورودی، فقط SSH + 80/443 + 8189/udp (WebRTC) باز
#       — پورتِ SSH خودکار تشخیص داده و قبل از enable باز می‌شود (بدونِ ریسکِ قفل‌شدن)
#    2) fail2ban: جیلِ sshd + nginx (بن‌کردنِ IP مهاجم پس از تلاش‌های ناموفق)
#    3) unattended-upgrades را تأیید/فعال می‌کند (آپدیتِ امنیتیِ خودکار)
#
#  ⚠️ SSH دست نمی‌خورد (طبق درخواست). فقط فایروال + fail2ban.
#  ⚠️ توصیهٔ مهم: علاوه بر این، در پنلِ Hetzner یک «Cloud Firewall» بساز که فقط
#     80/443/<ssh>/8189udp را باز بگذارد — آن لایه از داکر دور نمی‌خورد.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "با sudo اجرا کن: sudo bash $0"; exit 1; }

# ── تشخیصِ پورتِ SSH (از sshd یا اتصالِ فعلی؛ پیش‌فرض 1367) ──
SSH_PORT="$(grep -ihoP '^\s*Port\s+\K[0-9]+' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | head -1 || true)"
[ -z "${SSH_PORT:-}" ] && SSH_PORT="$(ss -tnp 2>/dev/null | grep -i sshd | grep -oP ':\K[0-9]+' | sort -u | head -1 || true)"
[ -z "${SSH_PORT:-}" ] && SSH_PORT=1367
echo "▶ پورتِ SSH تشخیص داده شد: ${SSH_PORT}"

export DEBIAN_FRONTEND=noninteractive
echo "▶ نصبِ ufw + fail2ban …"
apt-get update -qq
apt-get install -y -qq ufw fail2ban >/dev/null

# ── 1) فایروال ufw ──
echo "▶ پیکربندیِ ufw (اول SSH را باز می‌کنیم تا قفل نشوی) …"
ufw allow "${SSH_PORT}/tcp" comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 8189/udp comment 'WebRTC ICE'
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
ufw status verbose

# ── 2) fail2ban ──
echo "▶ پیکربندیِ fail2ban …"
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd
# IPهای خودت/داخلی هرگز بن نشوند
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 10.0.0.0/8 192.168.0.0/16

[sshd]
enabled  = true
port     = ${SSH_PORT}
maxretry = 4
bantime  = 2h

[nginx-http-auth]
enabled  = true

[nginx-limit-req]
enabled  = true
maxretry = 10
bantime  = 30m

[nginx-botsearch]
enabled  = true
bantime  = 1h
EOF
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban
sleep 2
fail2ban-client status 2>/dev/null || true

# ── 3) آپدیتِ امنیتیِ خودکار ──
echo "▶ تأییدِ unattended-upgrades …"
apt-get install -y -qq unattended-upgrades >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo
echo "✅ سخت‌سازیِ هاست انجام شد. SSH دست‌نخورده (پورت ${SSH_PORT})."
echo "   فراموش نکن: یک Hetzner Cloud Firewall هم بساز (80,443,${SSH_PORT}/tcp + 8189/udp)."
