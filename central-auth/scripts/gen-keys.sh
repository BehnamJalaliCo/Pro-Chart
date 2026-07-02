#!/usr/bin/env bash
# ساختِ جفت‌کلیدِ RSA برای امضای RS256 — کلیدِ خصوصی هرگز از سرورِ مرکزی خارج نمی‌شود و commit نمی‌شود.
set -euo pipefail
KDIR="$(cd "$(dirname "$0")/.." && pwd)/keys"
mkdir -p "$KDIR"
if [[ -f "$KDIR/jwt_private.pem" ]]; then
  echo "کلید از قبل هست: $KDIR/jwt_private.pem — برای چرخش، دستی جابه‌جا کن."
  exit 0
fi
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KDIR/jwt_private.pem"
openssl rsa -in "$KDIR/jwt_private.pem" -pubout -out "$KDIR/jwt_public.pem"
chmod 600 "$KDIR/jwt_private.pem"
chmod 644 "$KDIR/jwt_public.pem"
echo "کلیدها ساخته شد در $KDIR (private=600). عمومی را می‌توان به سرویس‌های دیگر داد."
