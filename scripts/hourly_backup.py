#!/usr/bin/env python3
"""بکاپِ ساعتیِ هسته به تلگرام (کرون).
دامپِ DB + زیپِ کد/کانفیگ/کلیدها (بدونِ ویدیو/مدل/node_modules) → تقسیمِ ۴۸MB → ارسال به مالک.
chat_id ثابت است (مالک ربات را Start کرده)."""
import glob
import gzip
import os
import subprocess
import time
import zipfile

import requests

PROJECT = "/home/forex/CoinePro-FX"


def _env(key, default=""):
    """خواندنِ کلید از .env (یا متغیرِ محیطی) — توکن دیگر در کد هاردکد نیست."""
    try:
        with open(f"{PROJECT}/.env") as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return os.environ.get(key, default)


TOKEN = _env("BACKUP_BOT_TOKEN")
CHAT = _env("BACKUP_CHAT_ID")
API = f"https://api.telegram.org/bot{TOKEN}"
TS = time.strftime("%Y-%m-%d_%H%M%S")
TMP = f"/tmp/cp_hourly_{TS}"

EXC_SUB = ["/node_modules/", "/.git/", "/__pycache__/", "/dist/", "/logs/",
           "/instagram-Ai-Direct/", "/edu_assets/", "/ml_models/", "/backup_work/",
           "/avatar_work/frames/", "/avatar_work/rec", "/avatar_work/voices/",
           "/avatar_work/Wav2Lip/", "/avatar_work/stage/", "/.cache/"]
EXC_AV_EXT = (".webm", ".mp4", ".wav", ".onnx", ".mp3", ".png", ".m4a")


def excluded(p):
    if p.endswith(".pyc"):
        return True
    for s in EXC_SUB:
        if s in p:
            return True
    if "/avatar_work/" in p and p.endswith(EXC_AV_EXT):
        return True
    return False


def main():
    os.makedirs(TMP, exist_ok=True)
    db = os.environ.get("DB_NAME", "forex_signal")
    try:
        with open(f"{PROJECT}/.env") as f:
            for line in f:
                if line.startswith("DB_NAME="):
                    db = line.strip().split("=", 1)[1] or db
    except Exception:
        pass

    # ۱) دامپِ دیتابیس
    dump = subprocess.run(["docker", "compose", "exec", "-T", "timescaledb",
                           "pg_dump", "-U", "coinepro", "-d", db],
                          cwd=PROJECT, capture_output=True)
    with gzip.open(f"{TMP}/database_dump.sql.gz", "wb") as g:
        g.write(dump.stdout)

    # ۲) زیپِ هسته
    zpath = f"{TMP}/CoinePro-FX_core_{TS}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for dp, dirs, files in os.walk(PROJECT):
            if excluded(dp + "/"):
                dirs[:] = []
                continue
            for fn in files:
                full = os.path.join(dp, fn)
                if excluded(full) or os.path.islink(full):
                    continue
                try:
                    z.write(full, os.path.relpath(full, os.path.dirname(PROJECT)))
                except Exception:
                    pass
        z.write(f"{TMP}/database_dump.sql.gz", f"backup/database_dump_{TS}.sql.gz")

    # ۳) تقسیم به ≤۴۸MB
    parts = []
    size = os.path.getsize(zpath)
    chunk = 48 * 1024 * 1024
    if size <= chunk:
        parts = [zpath]
    else:
        with open(zpath, "rb") as f:
            i = 0
            while True:
                buf = f.read(chunk)
                if not buf:
                    break
                pp = f"{zpath}.part{i:02d}"
                with open(pp, "wb") as o:
                    o.write(buf)
                parts.append(pp)
                i += 1

    # ۴) ارسال
    try:
        requests.post(f"{API}/sendMessage", data={"chat_id": CHAT,
                      "text": f"🕐 بکاپِ ساعتیِ هسته — {TS}\nقطعات: {len(parts)} | حجم: {size // 1048576}MB"}, timeout=30)
    except Exception:
        pass
    for i, p in enumerate(parts, 1):
        for _ in range(3):
            try:
                with open(p, "rb") as f:
                    r = requests.post(f"{API}/sendDocument",
                                      data={"chat_id": CHAT, "caption": f"core {i}/{len(parts)} · {TS}"},
                                      files={"document": (os.path.basename(p), f)}, timeout=300).json()
                if r.get("ok"):
                    break
                time.sleep(5)
            except Exception:
                time.sleep(8)
        time.sleep(1)

    # ۵) پاکسازی
    subprocess.run(["rm", "-rf", TMP])
    print(f"[{TS}] hourly backup sent: {len(parts)} part(s), {size // 1048576}MB")


if __name__ == "__main__":
    main()
