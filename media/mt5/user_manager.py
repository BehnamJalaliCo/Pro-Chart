#!/usr/bin/env python3
"""مدیرِ ترمینال‌های MT5 کاربران (کپیِ زنده) — هر کاربر در WINEPREFIXِ کاملاً جدا.

چرا prefixِ جدا: اجرای چند ترمینالِ MT5 در یک WINEPREFIXِ مشترک باعثِ تداخلِ
wineserver و کرشِ ترمینال می‌شود. با prefixِ جدا برای هر کاربر:
  - wineserverِ مستقل → پایداری،
  - فولدرِ Commonِ مستقل → ایزولاسیونِ فایل‌های سیگنال/تنظیمات/وضعیت (بدونِ تداخل با مَستر).

هر کاربر: prefix از روی prefixِ مَستر کپی می‌شود (یک‌بار، بدونِ history/logs سنگین)،
ترمینال با حسابِ او لاگین می‌شود، همان EA را روی همان سیگنال‌ها با تنظیماتِ ریسکِ خودش
اجرا می‌کند. تریدکردن با فلگِ enabledِ EA (از CopySettings) کنترل می‌شود.
"""
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.request

API = os.environ.get("API_URL", "http://api:8000")
TOKEN = os.environ.get("EA_TOKEN", "")
MASTER_PREFIX = os.environ.get("WINEPREFIX", "/root/.wine")
DISPLAY = os.environ.get("USERS_DISPLAY", ":20")  # دیسپلیِ پایدارِ مَستر (Selkies، با همهٔ افزونه‌ها)
PREFIXES_ROOT = os.environ.get("MT5_PREFIXES_DIR", "/mt5_users_prefixes")
POLL = 12

# uid -> {"stop": Event, "bridge": Thread}
_running: dict[int, dict] = {}


def _api_users():
    with urllib.request.urlopen(f"{API}/ea/users?token={TOKEN}", timeout=10) as r:
        return json.load(r).get("users", [])


def _uprefix(uid: int) -> str:
    return os.path.join(PREFIXES_ROOT, str(uid))


def _term_exe(uid: int) -> str:
    return os.path.join(_uprefix(uid), "drive_c", "Program Files", "MetaTrader 5", "terminal64.exe")


def _common_files(uid: int) -> str:
    return os.path.join(_uprefix(uid), "drive_c", "users", "root", "AppData", "Roaming",
                        "MetaQuotes", "Terminal", "Common", "Files")


def _provision(uid: int, login: str, server: str, password: str):
    up = _uprefix(uid)
    if not os.path.exists(_term_exe(uid)):
        os.makedirs(PREFIXES_ROOT, exist_ok=True)
        print(f"[user-mgr] provisioning prefix for uid={uid} (copy, one-time)...", flush=True)
        # کپیِ prefixِ مَستر بدونِ دادهٔ سنگین (history/logs/tester) برای سرعت
        shutil.copytree(
            MASTER_PREFIX, up,
            ignore=shutil.ignore_patterns("bases", "Tester", "logs", "Logs", "*.log", "*.hst", "*.dat"),
            dirs_exist_ok=True, symlinks=True,
        )
        print(f"[user-mgr] prefix ready for uid={uid}", flush=True)
    # کانفیگِ استارتاپ: لاگینِ حسابِ کاربر + اتچِ EA. UseCommon=true (پیش‌فرض) → Commonِ همین prefixِ ایزوله
    with open(os.path.join(up, "drive_c", "start.ini"), "w", encoding="ascii", errors="ignore") as f:
        f.write(
            "[Common]\n"
            f"Login={login}\nPassword={password}\nServer={server}\n"
            "[StartUp]\nExpert=CoineProAutoTrader\nSymbol=EURUSD\nPeriod=M15\n"
            "[Experts]\nAllowLiveTrading=1\nEnabled=1\nAllowDllImport=0\n"
        )
    # پاک‌کردنِ پروفایل/چارت‌های ذخیره‌شدهٔ مَستر تا MT5 پروفایلِ قدیمی را بازیابی نکند؛
    # این‌طور /config حتماً EA را روی چارتِ تازهٔ EURUSD M15 اتچ می‌کند (اتچِ قطعی).
    troot = os.path.join(up, "drive_c", "users", "root", "AppData", "Roaming",
                         "MetaQuotes", "Terminal")
    try:
        for d in os.listdir(troot):
            if len(d) == 32:  # هَشِ دادهٔ ترمینال
                shutil.rmtree(os.path.join(troot, d, "profiles"), ignore_errors=True)
    except FileNotFoundError:
        pass
    cf = _common_files(uid)
    os.makedirs(cf, exist_ok=True)
    # پاک‌کردنِ فایل‌های کنترلیِ به‌ارث‌رسیده از prefixِ مَستر (به‌ویژه close_all_idِ قدیمی
    # که باعثِ close-all + سرکوبِ اشتباهِ سیگنال‌ها روی استارت می‌شد). پل دوباره می‌نویسد.
    for fn in ("coinepro_ea_settings.txt", "coinepro_ea_status.txt", "coinepro_signals.csv"):
        try:
            os.remove(os.path.join(cf, fn))
        except FileNotFoundError:
            pass


def _bridge_loop(uid: int, stop: threading.Event):
    files = _common_files(uid)
    sig_out = os.path.join(files, "coinepro_signals.csv")
    set_out = os.path.join(files, "coinepro_ea_settings.txt")
    status_in = os.path.join(files, "coinepro_ea_status.txt")
    sig_url = f"{API}/ea/signals?token={TOKEN}&uid={uid}"
    cfg_url = f"{API}/ea/config?token={TOKEN}&uid={uid}"
    hb_url = f"{API}/ea/heartbeat?token={TOKEN}&uid={uid}"

    def _num(v):
        try:
            return ("%.8f" % float(v)).rstrip("0").rstrip(".") if v is not None else "0"
        except (TypeError, ValueError):
            return "0"

    while not stop.is_set():
        try:
            with urllib.request.urlopen(sig_url, timeout=8) as r:
                data = json.load(r)
            lines = [";".join([str(s.get("id")), str(s.get("symbol")), str(s.get("action")),
                               _num(s.get("entry")), _num(s.get("sl")),
                               _num(s.get("tp1")), _num(s.get("tp2")), _num(s.get("tp3"))])
                     for s in data.get("signals", [])]
            os.makedirs(files, exist_ok=True)
            with open(sig_out + ".tmp", "w", encoding="ascii", errors="ignore") as f:
                f.write("\n".join(lines))
            os.replace(sig_out + ".tmp", sig_out)
            with urllib.request.urlopen(cfg_url, timeout=8) as r:
                txt = r.read().decode("ascii", "ignore")
            with open(set_out + ".tmp", "w", encoding="ascii", errors="ignore") as f:
                f.write(txt)
            os.replace(set_out + ".tmp", set_out)
            if os.path.exists(status_in):
                with open(status_in, encoding="ascii", errors="ignore") as f:
                    raw = f.read()
                body = json.dumps({"raw": raw}).encode("ascii", "ignore")
                req = urllib.request.Request(hb_url, data=body,
                                             headers={"Content-Type": "application/json"}, method="POST")
                urllib.request.urlopen(req, timeout=8).read()
        except Exception as exc:  # noqa: BLE001
            print(f"[user-bridge {uid}] {exc}", flush=True)
        stop.wait(5)


def _term_running(uid: int) -> bool:
    r = subprocess.run(["pgrep", "-f", f"{PREFIXES_ROOT}/{uid}/"], stdout=subprocess.DEVNULL)
    return r.returncode == 0


def _ensure_bridge(uid: int):
    info = _running.get(uid)
    if info and info["bridge"].is_alive():
        return
    stop = threading.Event()
    th = threading.Thread(target=_bridge_loop, args=(uid, stop), daemon=True)
    th.start()
    _running[uid] = {"stop": stop, "bridge": th}


def _launch_terminal(uid: int, login: str, server: str, password: str):
    _provision(uid, login, server, password)
    env = dict(os.environ, DISPLAY=DISPLAY, WINEPREFIX=_uprefix(uid))
    subprocess.Popen(["wine", _term_exe(uid), "/config:C:\\start.ini"],
                     env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[user-mgr] launched terminal for uid={uid} login={login}", flush=True)


def _stop(uid: int):
    info = _running.pop(uid, None)
    if info:
        info["stop"].set()
    subprocess.run(["pkill", "-9", "-f", f"{PREFIXES_ROOT}/{uid}/"], stdout=subprocess.DEVNULL)
    print(f"[user-mgr] stopped terminal for uid={uid}", flush=True)


def _ensure_xvfb():
    # از دیسپلیِ پایدارِ مَستر (:20) استفاده می‌کنیم که از قبل با همهٔ افزونه‌ها +
    # پنجره‌مدیر بالا است؛ نیازی به ساختِ Xvfb جدا نیست (که روی headless فریز می‌کرد).
    print(f"[user-mgr] using existing display {DISPLAY}", flush=True)


def main():
    print(f"[user-mgr] start API={API} display={DISPLAY} prefixes={PREFIXES_ROOT}", flush=True)
    _ensure_xvfb()
    time.sleep(3)
    while True:
        try:
            desired = {int(u["uid"]): u for u in _api_users()}
            for uid in list(_running.keys()):
                if uid not in desired:
                    _stop(uid)
            for uid, u in desired.items():
                _ensure_bridge(uid)
                if not _term_running(uid):
                    _launch_terminal(uid, str(u["login"]), str(u["server"]), str(u["password"]))
            print(f"[user-mgr] desired={list(desired.keys())} "
                  f"alive={[u for u in desired if _term_running(u)]}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[user-mgr] loop error: {exc}", flush=True)
        time.sleep(POLL)


if __name__ == "__main__":
    main()
