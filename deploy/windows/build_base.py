#!/usr/bin/env python3
"""ساختِ خودکارِ «ایمیجِ پایهٔ ویندوز» روی Hetzner Cloud (یک‌بار) → snapshot.

مراحل (همه با API + SSH، بدونِ دخالتِ دستی):
  1) ساختِ سرورِ x86 (≥۱۶GB برای QEMU).
  2) فعال‌سازیِ Rescue (لینوکس) + کلیدِ SSH + ری‌بوت به rescue.
  3) SSH → اجرای rescue_install.sh (دانلودِ ISO ویندوز + نصبِ unattended با QEMU +
     اجرای bootstrap که Python/MT5/EA/agent را نصب می‌کند).
  4) خروج از rescue + ری‌بوت به ویندوز.
  5) ساختِ snapshot → چاپِ HETZNER_SNAPSHOT_ID.

اجرا روی سرورِ اصلی (که ssh + python دارد):
    WIN_ADMIN_PASS='...' python3 deploy/windows/build_base.py
متغیرها از .env خوانده می‌شوند (HETZNER_API_TOKEN, EA_TOKEN).
"""
import os
import subprocess
import sys
import time

import urllib.request
import json

API = "https://api.hetzner.cloud/v1"


def _env(key, default=None):
    v = os.environ.get(key)
    if v:
        return v
    try:
        for line in open(".env"):
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return default


TOKEN = _env("HETZNER_API_TOKEN")
EA_TOKEN = _env("EA_TOKEN")
ADMIN_PASS = _env("WIN_ADMIN_PASS") or "CoinePro#" + os.urandom(4).hex()
SERVER_TYPE = _env("BUILD_SERVER_TYPE", "cpx42")  # 8c/16GB برای QEMU (موجود در hel1)
LOCATION = _env("HETZNER_LOCATION", "hel1")
WIN_API = _env("WIN_API_URL", "https://fx.trade-future.ir/api")  # دامنهٔ سایت /api → backend
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{API}{path}", data=data, headers=H, method=method)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def wait_action(aid):
    while True:
        a = api("GET", f"/actions/{aid}")["action"]
        if a["status"] != "running":
            return a["status"]
        time.sleep(4)


def ssh(ip, key, cmd, timeout=120):
    return subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
         "-i", key, f"root@{ip}", cmd], capture_output=True, text=True, timeout=timeout)


def main():
    assert TOKEN and EA_TOKEN, "HETZNER_API_TOKEN + EA_TOKEN required"
    # کلیدِ SSH
    keyfile = "/tmp/coinepro_build_key"
    if not os.path.exists(keyfile):
        subprocess.run(["ssh-keygen", "-t", "ed25519", "-N", "", "-f", keyfile, "-q"], check=True)
    pub = open(keyfile + ".pub").read().strip()
    # ثبتِ کلید در هتزنر (یا استفاده از موجود)
    try:
        k = api("POST", "/ssh_keys", {"name": "coinepro-build", "public_key": pub})["ssh_key"]
    except Exception:
        k = next(x for x in api("GET", "/ssh_keys")["ssh_keys"] if x["name"] == "coinepro-build")
    key_id = k["id"]

    print("[build] creating server...")
    srv = api("POST", "/servers", {
        "name": "coinepro-win-base", "server_type": SERVER_TYPE, "location": LOCATION,
        "image": "ubuntu-24.04", "ssh_keys": [key_id], "start_after_create": True,
        "labels": {"coinepro-build": "1"},
    })
    sid = srv["server"]["id"]
    ip = srv["server"]["public_net"]["ipv4"]["ip"]
    print(f"[build] server {sid} ip={ip}")
    wait_action(srv["action"]["id"])

    print("[build] enabling rescue...")
    res = api("POST", f"/servers/{sid}/actions/enable_rescue", {"type": "linux64", "ssh_keys": [key_id]})
    wait_action(res["action"]["id"])
    rb = api("POST", f"/servers/{sid}/actions/reboot", {})
    wait_action(rb["action"]["id"])

    print("[build] waiting for rescue SSH...")
    for _ in range(60):
        time.sleep(5)
        r = ssh(ip, keyfile, "echo ok", timeout=15)
        if r.returncode == 0 and "ok" in r.stdout:
            break
    else:
        print("[build] rescue SSH timeout"); sys.exit(1)

    print("[build] uploading + running installer (this takes ~30-45 min)...")
    subprocess.run(["scp", "-o", "StrictHostKeyChecking=no", "-i", keyfile,
                    "deploy/windows/rescue_install.sh", f"root@{ip}:/root/rescue_install.sh"], check=True)
    inst = ssh(ip, keyfile,
               f"WIN_API_URL='{WIN_API}' WIN_EA_TOKEN='{EA_TOKEN}' WIN_ADMIN_PASS='{ADMIN_PASS}' "
               f"bash /root/rescue_install.sh", timeout=4000)
    print(inst.stdout[-2000:]); print(inst.stderr[-1000:])

    print("[build] disabling rescue + reboot into Windows...")
    api("POST", f"/servers/{sid}/actions/disable_rescue", {})
    rb = api("POST", f"/servers/{sid}/actions/reboot", {})
    wait_action(rb["action"]["id"])
    print("[build] waiting ~6 min for Windows first-boot + bootstrap...")
    time.sleep(360)

    print("[build] powering off + creating snapshot...")
    po = api("POST", f"/servers/{sid}/actions/poweroff", {})
    wait_action(po["action"]["id"])
    snap = api("POST", f"/servers/{sid}/actions/create_image",
               {"type": "snapshot", "description": "coinepro-win-base"})
    wait_action(snap["action"]["id"])
    image_id = snap["image"]["id"]
    print(f"\n[build] DONE. snapshot id = {image_id}")
    print(f"[build] admin password = {ADMIN_PASS}")
    print(f"[build] set in .env:  HETZNER_SNAPSHOT_ID={image_id}")
    print(f"[build] RDP to {ip} as Administrator to verify (or delete base server {sid}).")


if __name__ == "__main__":
    main()
