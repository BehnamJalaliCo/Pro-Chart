#!/usr/bin/env python3
r"""CoinePro — Windows Agent (کپیِ زندهٔ کاربران روی سرورِ ویندوز).

روی سرورِ ویندوز اجرا می‌شود (نه Wine → پایدار). هر چند ثانیه فهرستِ حساب‌های فعال
را از API می‌گیرد و برای هر کدام یک ترمینالِ MT5ِ portable و ایزوله با حسابِ خودش
اجرا می‌کند که همان EA را روی همان سیگنال‌ها با تنظیماتِ ریسکِ کاربر اجرا می‌کند.

پیش‌نیاز روی سرورِ ویندوز (یک‌بار):
  - Python 3 نصب باشد.
  - MetaTrader 5 نصب باشد (مسیرش در MT5_DIR).
  - CoineProAutoTrader.ex5 در MQL5\Experts نصبِ MT5 کامپایل شده باشد.
  - متغیرهای محیطی (یا config.ini کنار اسکریپت):
        API_URL   = https://api.fx.trade-future.ir   (یا http داخلی)
        EA_TOKEN  = <همان EA_TOKEN سرورِ اصلی>
        MT5_DIR   = C:\Program Files\MetaTrader 5
        USERS_DIR = C:\CoinePro\users

اجرا به‌صورتِ سرویس (NSSM) یا Task Scheduler توصیه می‌شود.
"""
import json
import os
import py_compile
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

try:
    import configparser
    _cfg = configparser.ConfigParser()
    _cfg.read(os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.ini"))
    _C = dict(_cfg["agent"]) if _cfg.has_section("agent") else {}
except Exception:  # noqa: BLE001
    _C = {}


def _opt(key, default):
    return os.environ.get(key) or _C.get(key.lower()) or default


API = _opt("API_URL", "http://localhost:8000").rstrip("/")
TOKEN = _opt("EA_TOKEN", "")
MT5_DIR = _opt("MT5_DIR", r"C:\Program Files\MetaTrader 5")
USERS_DIR = _opt("USERS_DIR", r"C:\CoinePro\users")
POLL = int(_opt("POLL", "12"))

_running = {}  # uid -> {"stop": Event, "bridge": Thread}
_IDENT = None  # هویتِ این سرور (IP عمومی/hostname/شناسهٔ Hetzner) — یک‌بار کش می‌شود


def _meta(path, timeout=3):
    try:
        with urllib.request.urlopen(f"http://169.254.169.254/hetzner/v1/metadata/{path}", timeout=timeout) as r:
            return r.read().decode("ascii", "ignore").strip()
    except Exception:  # noqa: BLE001
        return ""


def _server_identity():
    """IP عمومیِ این سرور را برای sharding تعیین می‌کند (متادیتای Hetzner، سپس fallback)."""
    global _IDENT
    if _IDENT is not None:
        return _IDENT
    ip = _meta("public-ipv4")
    if not ip:
        for url in ("https://api.ipify.org", "https://ifconfig.me/ip", "https://checkip.amazonaws.com"):
            try:
                with urllib.request.urlopen(url, timeout=5) as r:
                    ip = r.read().decode("ascii", "ignore").strip()
                if ip:
                    break
            except Exception:  # noqa: BLE001
                continue
    try:
        hid = int(_meta("instance-id") or 0)
    except (TypeError, ValueError):
        hid = 0
    _IDENT = {"ip": ip, "host": socket.gethostname(), "hid": hid}
    print(f"[agent] identity ip={ip} host={_IDENT['host']} hid={hid}", flush=True)
    return _IDENT


def _api_users():
    idn = _server_identity()
    qs = urllib.parse.urlencode({"token": TOKEN, "ip": idn["ip"], "host": idn["host"], "hid": idn["hid"]})
    with urllib.request.urlopen(f"{API}/ea/users?{qs}", timeout=10) as r:
        return json.load(r).get("users", [])


def _udir(uid):
    return os.path.join(USERS_DIR, str(uid))


def _term_exe(uid):
    return os.path.join(_udir(uid), "terminal64.exe")


def _files(uid):
    # UseCommon=false → فایل‌های لوکالِ ایزوله در MQL5\Files
    return os.path.join(_udir(uid), "MQL5", "Files")


# نسخهٔ provision — با تغییرِ این عدد، ترمینالِ کاربر تمیز دوباره ساخته می‌شود.
_PROV_VER = "14"
# نسخهٔ EA — با تغییر، EA روی سرور دوباره از .mq5 کامپایل می‌شود.
_EA_VER = "1.5"
# نسخهٔ خودِ agent — با بالاتربودنِ نسخهٔ سرور، agent خودش را آپدیت و ری‌استارت می‌کند.
_AGENT_VER = "27"


def _self_update():
    """اگر روی سرور نسخهٔ جدیدتری از agent باشد، خودش را دانلود، اعتبارسنجی و ری‌استارت می‌کند.
    این یعنی هیچ‌وقت لازم نیست کسی دستی روی سرورِ ویندوز کد بزند (شاملِ سرورهای خودکار)."""
    try:
        with urllib.request.urlopen(f"{API}/public/winagent/version.txt", timeout=8) as r:
            txt = r.read().decode("ascii", "ignore")
        latest = ""
        for line in txt.splitlines():
            if line.strip().startswith("agent="):
                latest = line.split("=", 1)[1].strip()
        if not latest or latest == _AGENT_VER:
            return
        new = urllib.request.urlopen(f"{API}/public/winagent/coinepro_agent.py", timeout=20).read()
        here = os.path.abspath(__file__)
        tmp = here + ".new"
        with open(tmp, "wb") as f:
            f.write(new)
        py_compile.compile(tmp, doraise=True)   # اگر سینتکس خراب بود، آپدیت نکن
        shutil.copyfile(tmp, here)              # فایلِ روی دیسک = نسخهٔ جدید
        os.remove(tmp)
        print(f"[agent] self-update {_AGENT_VER} -> {latest}; exiting for wrapper relaunch", flush=True)
        # wrapperِ تسک (run_agent loop) ظرفِ چند ثانیه نسخهٔ جدید را دوباره اجرا می‌کند.
        os._exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] self-update skipped: {exc}", flush=True)


def _srv_cache():
    # کَشِ لوکالِ servers.dat (لیستِ سرورهای بروکر، شاملِ OneRoyal) کنارِ USERS_DIR.
    return os.path.join(USERS_DIR, "servers.dat")


def _ensure_servers_dat():
    """servers.dat را از سرور دانلود و کَش می‌کند. نصبِ خامِ MT5 فقط سرورهای
    MetaQuotes را می‌شناسد؛ بدونِ این فایل login به OneRoyal-Server (و هر بروکرِ
    غیرMetaQuotes) بی‌صدا شکست می‌خورد و ترمینال روی دموی پیش‌فرض می‌ماند.
    این فایل بعداً در _provision داخلِ Config هر ترمینالِ per-user نوشته می‌شود
    (چون copytree پوشهٔ config را ignore می‌کند)."""
    dst = _srv_cache()
    try:
        os.makedirs(USERS_DIR, exist_ok=True)
        data = urllib.request.urlopen(f"{API}/public/winagent/servers.dat", timeout=20).read()
        if not data or len(data) < 1024:
            print(f"[srv] download too small ({len(data)}B); skip", flush=True)
            return os.path.exists(dst)
        old = b""
        if os.path.exists(dst):
            with open(dst, "rb") as f:
                old = f.read()
        if old != data:
            with open(dst, "wb") as f:
                f.write(data)
            print(f"[srv] servers.dat cached ({len(data)}B)", flush=True)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[srv] ensure servers.dat skipped: {exc}", flush=True)
        return os.path.exists(dst)


def _install_servers_dat(uid):
    """servers.dat کَش‌شده را در Config ترمینالِ این کاربر می‌نویسد (login به بروکر را ممکن می‌کند)."""
    src = _srv_cache()
    if not os.path.exists(src):
        return
    cfg = os.path.join(_udir(uid), "Config")
    try:
        os.makedirs(cfg, exist_ok=True)
        shutil.copyfile(src, os.path.join(cfg, "servers.dat"))
    except Exception as exc:  # noqa: BLE001
        print(f"[srv] install for uid={uid} failed: {exc}", flush=True)


def _ea_lib_present():
    return os.path.exists(os.path.join(MT5_DIR, "MQL5", "Include", "Trade", "Trade.mqh"))


def _seed_ea_lib():
    """کتابخانهٔ استانداردِ MQL5 (Include) را از یکی از ترمینال‌های کاربر — که بعد از
    اتصال خودش دانلودش می‌کند — به نصبِ پایه کپی می‌کند تا کامپایلِ EA ممکن شود و در
    snapshot بماند. (نصبِ سایلنتِ MT5 پوشهٔ Include را ندارد.)"""
    if _ea_lib_present():
        return True
    base_inc = os.path.join(MT5_DIR, "MQL5", "Include")
    try:
        for d in os.listdir(USERS_DIR):
            src = os.path.join(USERS_DIR, d, "MQL5", "Include")
            if os.path.exists(os.path.join(src, "Trade", "Trade.mqh")):
                subprocess.run(["robocopy", src, base_inc, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"],
                               capture_output=True, timeout=180)
                print("[ea] seeded standard library into base from users\\" + d, flush=True)
                break
    except Exception as exc:  # noqa: BLE001
        print(f"[ea] seed lib error: {exc}", flush=True)
    return _ea_lib_present()


def _ensure_ea_compiled():
    """EA را روی خودِ سرور از سورس کامپایل می‌کند تا نسخهٔ ایزولاسیونِ per-user (v1.2)
    در نصبِ پایه باشد؛ سپس provisioning آن را به هر کاربر کپی می‌کند."""
    experts = os.path.join(MT5_DIR, "MQL5", "Experts")
    mql5 = os.path.join(MT5_DIR, "MQL5")
    mq5 = os.path.join(experts, "CoineProAutoTrader.mq5")
    ex5 = os.path.join(experts, "CoineProAutoTrader.ex5")
    marker = os.path.join(MT5_DIR, ".ea_ver")
    try:
        with open(marker, encoding="ascii", errors="ignore") as f:
            if f.read().strip() == _EA_VER and os.path.exists(ex5):
                return
    except Exception:  # noqa: BLE001
        pass
    try:
        os.makedirs(experts, exist_ok=True)
        urllib.request.urlretrieve(f"{API}/public/winagent/CoineProAutoTrader.mq5", mq5)
    except Exception as exc:  # noqa: BLE001
        print(f"[ea] download .mq5 failed: {exc}", flush=True)
        return
    if not _seed_ea_lib():
        print("[ea] WARNING standard library missing; keeping existing .ex5", flush=True)
        return
    me = os.path.join(MT5_DIR, "metaeditor64.exe")
    ex5_before = os.path.getmtime(ex5) if os.path.exists(ex5) else 0
    status = os.path.join(MT5_DIR, ".ea_compile_status")
    try:
        # مسیرها فاصله دارند ("Program Files") → باید با کوتیشن از طریقِ shell بروند، وگرنه
        # metaeditor مسیر را سرِ فاصله می‌بُرد و rc=0 می‌داد بدونِ اینکه واقعاً کامپایل کند.
        cmd = f'"{me}" /compile:"{mq5}" /include:"{mql5}" /log'
        r = subprocess.run(cmd, timeout=180, capture_output=True, text=True, shell=True)
        with open(status, "w", encoding="ascii", errors="ignore") as f:
            f.write(f"rc={r.returncode} out={(r.stdout or '')[:160]} err={(r.stderr or '')[:160]}")
    except Exception as exc:  # noqa: BLE001
        try:
            with open(status, "w", encoding="ascii", errors="ignore") as f:
                f.write(f"EXC={exc}")
        except Exception:  # noqa: BLE001
            pass
        print(f"[ea] compile error: {exc}", flush=True)
    # صبرِ کوتاه چون metaeditor ممکن است async برگردد
    for _ in range(20):
        if os.path.exists(ex5) and os.path.getmtime(ex5) > ex5_before:
            break
        time.sleep(2)
    ex5_after = os.path.getmtime(ex5) if os.path.exists(ex5) else 0
    if ex5_after > ex5_before:
        try:
            with open(marker, "w", encoding="ascii", errors="ignore") as f:
                f.write(_EA_VER)
        except Exception:  # noqa: BLE001
            pass
        print(f"[ea] recompiled v{_EA_VER}", flush=True)
    else:
        # کامپایل ex5 را تازه نکرد → marker را نزن تا دفعهٔ بعد دوباره تلاش شود
        print("[ea] WARNING compile did not refresh .ex5 (will retry next start)", flush=True)
# پوشه‌هایی که نباید از مستر ارث ببریم: پروفایل/چارتِ pin‌شده (UseCommon/close_all بیات)،
# کانفیگ (لاگین/سرورِ مستر)، history و لاگ‌های مستر.
_IGNORE = shutil.ignore_patterns("profiles", "config", "bases", "logs", "Logs", "Tester")


def _prov_marker(uid):
    return os.path.join(_udir(uid), ".cpver")


def _needs_reprovision(uid):
    try:
        with open(_prov_marker(uid), encoding="ascii", errors="ignore") as f:
            return f.read().strip() != _PROV_VER
    except Exception:  # noqa: BLE001
        return True


def _provision(uid, login, server, password):
    ud = _udir(uid)
    if (not os.path.exists(_term_exe(uid))) or _needs_reprovision(uid):
        os.makedirs(USERS_DIR, exist_ok=True)
        if os.path.exists(ud):
            shutil.rmtree(ud, ignore_errors=True)
        print(f"[agent] provisioning(clean v{_PROV_VER}) MT5 for uid={uid} ...", flush=True)
        shutil.copytree(MT5_DIR, ud, dirs_exist_ok=True, ignore=_IGNORE)
        with open(_prov_marker(uid), "w", encoding="ascii", errors="ignore") as f:
            f.write(_PROV_VER)
    presets = os.path.join(ud, "MQL5", "Presets")
    os.makedirs(presets, exist_ok=True)
    with open(os.path.join(presets, "user.set"), "w", encoding="ascii", errors="ignore") as f:
        # فرمتِ bool متاتریدر در .set عددی است (0/1)، نه false/true
        f.write("UseCommon=0\n")
    with open(os.path.join(ud, "start.ini"), "w", encoding="ascii", errors="ignore") as f:
        f.write(
            "[Common]\n"
            f"Login={login}\nPassword={password}\nServer={server}\n"
            "[StartUp]\nExpert=CoineProAutoTrader\nSymbol=EURUSD\nPeriod=M15\n"
            "ExpertParameters=user.set\n"
            "[Experts]\nAllowLiveTrading=1\nEnabled=1\nAllowDllImport=0\n"
        )
    # servers.dat را داخلِ Config بنویس (copytree آن را ignore می‌کند) تا login به بروکر کار کند.
    _install_servers_dat(uid)
    os.makedirs(_files(uid), exist_ok=True)


def _read_tail(path, n=40):
    """خواندنِ انتهای یک فایلِ لاگِ MT5 (ممکن است UTF-16 یا UTF-8 باشد)."""
    try:
        with open(path, "rb") as f:
            raw = f.read()
    except Exception:  # noqa: BLE001
        return ""
    for enc in ("utf-16-le", "utf-8", "latin-1"):
        try:
            txt = raw.decode(enc, "ignore").replace("\x00", "")
            if txt.count("\n") >= 1 or enc == "latin-1":
                break
        except Exception:  # noqa: BLE001
            txt = ""
    lines = [ln.rstrip() for ln in txt.splitlines() if ln.strip()]
    return "\n".join(lines[-n:])


def _latest_log(dirpath):
    try:
        logs = [os.path.join(dirpath, x) for x in os.listdir(dirpath) if x.lower().endswith(".log")]
        if not logs:
            return ""
        newest = max(logs, key=lambda p: os.path.getmtime(p))
        return _read_tail(newest)
    except Exception:  # noqa: BLE001
        return ""


def _listdir_safe(d):
    try:
        return sorted(os.listdir(d))
    except Exception:  # noqa: BLE001
        return []


def _common_files_dir():
    # پوشهٔ Common\Files متاتریدر (وقتی UseCommon=true باشد EA اینجا می‌نویسد)
    appdata = os.environ.get("APPDATA", r"C:\Users\Administrator\AppData\Roaming")
    return os.path.join(appdata, "MetaQuotes", "Terminal", "Common", "Files")


def _collect_diag(uid):
    """لاگِ ترمینال (login/connection) + لاگِ EA (compile/init) + دیدِ پوشه‌ها برای رفعِ اشکالِ از راه دور."""
    ud = _udir(uid)
    local_files = os.path.join(ud, "MQL5", "Files")
    common_files = _common_files_dir()
    statf_local = os.path.join(local_files, "coinepro_ea_status.txt")
    statf_common = os.path.join(common_files, "coinepro_ea_status.txt")
    return {
        "uid": uid,
        "term_exists": os.path.exists(_term_exe(uid)),
        "ea_present": os.path.exists(os.path.join(ud, "MQL5", "Experts", "CoineProAutoTrader.ex5")),
        "running": _term_running(uid),
        "local_files": _listdir_safe(local_files),
        "common_files": _listdir_safe(common_files),
        "status_local_exists": os.path.exists(statf_local),
        "status_common_exists": os.path.exists(statf_common),
        "status_local_tail": _read_tail(statf_local, 8) if os.path.exists(statf_local) else "",
        "status_common_tail": _read_tail(statf_common, 8) if os.path.exists(statf_common) else "",
        "userset": _read_tail(os.path.join(ud, "MQL5", "Presets", "user.set"), 6),
        "startini": _read_tail(os.path.join(ud, "start.ini"), 12),
        "prov_ver": _read_tail(_prov_marker(uid), 1),
        "terminal_log": _latest_log(os.path.join(ud, "logs")),
        "expert_log": _latest_log(os.path.join(ud, "MQL5", "Logs")),
    }


def _post_diag(uid):
    try:
        body = json.dumps(_collect_diag(uid)).encode("utf-8", "ignore")
        req = urllib.request.Request(f"{API}/ea/diag?token={TOKEN}&uid={uid}", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=8).read()
    except Exception as exc:  # noqa: BLE001
        print(f"[diag {uid}] {exc}", flush=True)


def _system_metrics():
    """مصرفِ منابعِ سرور برای تستِ بار: RAM کل/آزاد (MB)، بارِ CPU (%)، تعدادِ ترمینال."""
    m = {"ram_total_mb": 0, "ram_free_mb": 0, "cpu_pct": 0, "terminals": 0}
    try:
        out = subprocess.run(["wmic", "OS", "get", "FreePhysicalMemory,TotalVisibleMemorySize", "/value"],
                             capture_output=True, text=True, timeout=10).stdout
        for line in out.splitlines():
            if "FreePhysicalMemory=" in line:
                m["ram_free_mb"] = int(line.split("=")[1].strip() or 0) // 1024
            elif "TotalVisibleMemorySize=" in line:
                m["ram_total_mb"] = int(line.split("=")[1].strip() or 0) // 1024
    except Exception:  # noqa: BLE001
        pass
    try:
        out = subprocess.run(["wmic", "cpu", "get", "loadpercentage", "/value"],
                             capture_output=True, text=True, timeout=10).stdout
        for line in out.splitlines():
            if "LoadPercentage=" in line and line.split("=")[1].strip():
                m["cpu_pct"] = int(line.split("=")[1].strip())
    except Exception:  # noqa: BLE001
        pass
    try:
        out = subprocess.run(["wmic", "process", "where", "name='terminal64.exe'", "get", "ProcessId"],
                             capture_output=True, text=True, timeout=10).stdout
        m["terminals"] = sum(1 for ln in out.splitlines() if ln.strip().isdigit())
    except Exception:  # noqa: BLE001
        pass
    return m


def _post_metrics():
    """گزارشِ منابعِ سرور (uid=0 → ea:diag:agent) — برای تستِ بار و پایش."""
    try:
        idn = _server_identity()
        payload = {"metrics": _system_metrics(), "ip": idn["ip"], "host": idn["host"],
                   "running_uids": sorted(_running.keys()),
                   "agent_ver": _AGENT_VER, "ea_ver_target": _EA_VER,
                   "ea_marker": _read_tail(os.path.join(MT5_DIR, ".ea_ver"), 1),
                   "ea_lib": _ea_lib_present(),
                   "ea_compile_log": _read_tail(os.path.join(MT5_DIR, "MQL5", "Experts", "CoineProAutoTrader.log"), 12),
                   "ea_compile_status": _read_tail(os.path.join(MT5_DIR, ".ea_compile_status"), 4),
                   "metaeditor_exists": os.path.exists(os.path.join(MT5_DIR, "metaeditor64.exe"))}
        body = json.dumps(payload).encode("utf-8", "ignore")
        req = urllib.request.Request(f"{API}/ea/diag?token={TOKEN}&uid=0", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=8).read()
    except Exception as exc:  # noqa: BLE001
        print(f"[metrics] {exc}", flush=True)


def _atomic_write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".tmp", "w", encoding="ascii", errors="ignore") as f:
        f.write(text)
    os.replace(path + ".tmp", path)


def _bridge(uid, stop):
    files = _files(uid)
    common = _common_files_dir()
    # EA v1.2 وقتی در پوشهٔ users\<id> اجرا شود خودکار فایلِ لوکالِ ایزوله می‌سازد →
    # bridge فقط به لوکال می‌نویسد (ایزولاسیونِ کاملِ چندکاربره). status را اول از لوکال
    # و در صورتِ نبود از Common می‌خواند (سازگاری با نسخهٔ قبل تا کامپایلِ EA کامل شود).
    sig_paths = [os.path.join(files, "coinepro_signals.csv")]
    setf_paths = [os.path.join(files, "coinepro_ea_settings.txt")]
    statf_local = os.path.join(files, "coinepro_ea_status.txt")
    statf_common = os.path.join(common, "coinepro_ea_status.txt")
    sig_url = f"{API}/ea/signals?token={TOKEN}&uid={uid}"  # فیدِ per-user (ضدِ re-open)
    cfg_url = f"{API}/ea/config?token={TOKEN}&uid={uid}"
    hb_url = f"{API}/ea/heartbeat?token={TOKEN}&uid={uid}"
    deals_url = f"{API}/ea/deals?token={TOKEN}&uid={uid}"
    dealf_local = os.path.join(files, "coinepro_ea_deals.txt")
    dealf_common = os.path.join(common, "coinepro_ea_deals.txt")
    specs_url = f"{API}/ea/specs?token={TOKEN}&uid={uid}"
    specf_local = os.path.join(files, "coinepro_ea_specs.txt")
    specf_common = os.path.join(common, "coinepro_ea_specs.txt")
    symbols_url = f"{API}/ea/symbols?token={TOKEN}&uid={uid}"
    symf_local = os.path.join(files, "coinepro_ea_symbols.txt")
    symf_common = os.path.join(common, "coinepro_ea_symbols.txt")
    _diag_tick = 0

    def num(v):
        try:
            return ("%.8f" % float(v)).rstrip("0").rstrip(".") if v is not None else "0"
        except (TypeError, ValueError):
            return "0"

    def _open_ids():
        """idِ پوزیشن‌های بازِ فعلیِ این کاربر از فایلِ status (dismissِ اتمیکِ ضدِّ re-open)."""
        sf = statf_local if os.path.exists(statf_local) else (
            statf_common if os.path.exists(statf_common) else None)
        if not sf:
            return None
        try:
            with open(sf, encoding="ascii", errors="ignore") as f:
                raw = f.read()
            for line in raw.splitlines():
                if line.startswith("positions="):
                    ids = []
                    for chunk in line.split("=", 1)[1].split("|"):
                        p = chunk.split(";")
                        if len(p) >= 6:
                            try:
                                ids.append(str(int(float(p[5]))))
                            except (TypeError, ValueError):
                                pass
                    return ",".join(ids)
            return ""
        except Exception:  # noqa: BLE001
            return None

    while not stop.is_set():
        try:
            oid = _open_ids()
            _surl = sig_url + ("&open_ids=" + urllib.parse.quote(oid) if oid is not None else "")
            with urllib.request.urlopen(_surl, timeout=8) as r:
                data = json.load(r)
            lines = [";".join([str(s.get("id")), str(s.get("symbol")), str(s.get("action")),
                               num(s.get("entry")), num(s.get("sl")),
                               num(s.get("tp1")), num(s.get("tp2")), num(s.get("tp3")),
                               num(s.get("trail_sl")),                      # فیلدِ ۹: SLِ قفل‌شدهٔ سرور
                               num(s.get("risk_mult") if s.get("risk_mult") is not None else 1.0)])  # فیلدِ ۱۰: حجمِ تطبیقی
                     for s in data.get("signals", [])]
            sig_text = "\n".join(lines)
            for p in sig_paths:
                _atomic_write(p, sig_text)
            with urllib.request.urlopen(cfg_url, timeout=8) as r:
                txt = r.read().decode("ascii", "ignore")
            for p in setf_paths:
                _atomic_write(p, txt)
            statf = statf_local if os.path.exists(statf_local) else (
                statf_common if os.path.exists(statf_common) else None)
            if statf:
                with open(statf, encoding="ascii", errors="ignore") as f:
                    raw = f.read()
                body = json.dumps({"raw": raw}).encode("ascii", "ignore")
                req = urllib.request.Request(hb_url, data=body,
                                             headers={"Content-Type": "application/json"}, method="POST")
                urllib.request.urlopen(req, timeout=8).read()
            # دیلِ بسته‌شدهٔ واقعی (سود/کمیسیون/سواپ) → سرور (idempotent)
            dealf = dealf_local if os.path.exists(dealf_local) else (
                dealf_common if os.path.exists(dealf_common) else None)
            if dealf:
                with open(dealf, encoding="ascii", errors="ignore") as f:
                    draw = f.read().strip()
                deals = []
                for line in draw.splitlines():
                    p = line.split(";")
                    if len(p) < 13:
                        continue
                    deals.append({"deal_id": p[0], "position": p[1], "signal_id": p[2],
                                  "symbol": p[3], "dir": p[4], "volume": p[5], "exit": p[6],
                                  "close_time": p[7], "profit": p[8], "commission": p[9],
                                  "swap": p[10], "reason": p[11], "balance": p[12]})
                if deals:
                    dbody = json.dumps({"deals": deals}).encode("ascii", "ignore")
                    dreq = urllib.request.Request(deals_url, data=dbody,
                                                  headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(dreq, timeout=8).read()
                    try:
                        os.remove(dealf)
                    except OSError:
                        pass
            # مشخصاتِ واقعیِ نماد از بروکر → سرور
            specf = specf_local if os.path.exists(specf_local) else (
                specf_common if os.path.exists(specf_common) else None)
            if specf:
                with open(specf, encoding="ascii", errors="ignore") as f:
                    sraw = f.read().strip()
                specs = []
                for line in sraw.splitlines():
                    p = line.split(";")
                    if len(p) < 8:
                        continue
                    specs.append({"symbol": p[0], "contract_size": p[1], "tick_size": p[2],
                                  "tick_value": p[3], "point": p[4], "digits": p[5],
                                  "stops_level": p[6], "spread_points": p[7]})
                if specs:
                    sbody = json.dumps({"specs": specs}).encode("ascii", "ignore")
                    sreq = urllib.request.Request(specs_url, data=sbody,
                                                  headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(sreq, timeout=8).read()
                    try:
                        os.remove(specf)
                    except OSError:
                        pass
            # کلِ لیستِ نمادهای بروکر (یک‌بار) → سرور (برای نگاشتِ نام)
            symf = symf_local if os.path.exists(symf_local) else (
                symf_common if os.path.exists(symf_common) else None)
            if symf:
                with open(symf, encoding="ascii", errors="ignore") as f:
                    symraw = f.read().strip()
                if symraw:
                    symbody = json.dumps({"symbols": symraw}).encode("ascii", "ignore")
                    symreq = urllib.request.Request(symbols_url, data=symbody,
                                                    headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(symreq, timeout=8).read()
                    try:
                        os.remove(symf)
                    except OSError:
                        pass
        except Exception as exc:  # noqa: BLE001
            print(f"[bridge {uid}] {exc}", flush=True)
        # هر ~۱۵ ثانیه لاگِ تشخیصیِ MT5 را برای سرور بفرست (برای رفعِ اشکالِ از راه دور)
        _diag_tick += 1
        if _diag_tick % 3 == 1:
            _post_diag(uid)
        stop.wait(5)


def _term_running(uid):
    # ویندوز: شمارشِ پراسسِ terminal64 با مسیرِ این کاربر (WMIC/tasklist).
    try:
        out = subprocess.run(
            ["wmic", "process", "where", f"ExecutablePath like '%users\\\\{uid}\\\\terminal64.exe%'", "get", "ProcessId"],
            capture_output=True, text=True, timeout=10).stdout
        return any(ch.isdigit() for ch in out)
    except Exception:  # noqa: BLE001
        return False


def _ensure_bridge(uid):
    info = _running.get(uid)
    if info and info["bridge"].is_alive():
        return
    stop = threading.Event()
    th = threading.Thread(target=_bridge, args=(uid, stop), daemon=True)
    th.start()
    _running[uid] = {"stop": stop, "bridge": th}


def _launch(uid, login, server, password):
    _provision(uid, login, server, password)
    subprocess.Popen([_term_exe(uid), "/portable", r"/config:start.ini"],
                     cwd=_udir(uid), creationflags=0x00000008)  # DETACHED_PROCESS
    print(f"[agent] launched MT5 for uid={uid} login={login}", flush=True)


def _stop(uid):
    info = _running.pop(uid, None)
    if info:
        info["stop"].set()
    subprocess.run(["taskkill", "/F", "/FI", f"WINDOWTITLE eq {uid} *"], capture_output=True)
    # روشِ مطمئن‌تر: بستن با مسیر
    subprocess.run(["wmic", "process", "where",
                    f"ExecutablePath like '%users\\\\{uid}\\\\terminal64.exe%'", "delete"], capture_output=True)
    print(f"[agent] stopped MT5 for uid={uid}", flush=True)


def main():
    print(f"[agent] start v{_AGENT_VER} API={API} MT5_DIR={MT5_DIR} USERS_DIR={USERS_DIR}", flush=True)
    _self_update()        # اول بررسیِ آپدیتِ خودِ agent
    _ensure_servers_dat() # لیستِ سرورهای بروکر (OneRoyal) را کَش کن تا login کار کند
    _ensure_ea_compiled()
    _loop = 0
    while True:
        _loop += 1
        if _loop % 15 == 0:   # هر ~۳ دقیقه آپدیتِ خودکارِ agent را چک کن
            _self_update()
        try:
            desired = {int(u["uid"]): u for u in _api_users()}
            for uid in list(_running.keys()):
                if uid not in desired:
                    _stop(uid)
            for uid, u in desired.items():
                # اگر نسخهٔ provision قدیمی است و ترمینال روشن است → اول ببند تا تمیز بازساخته شود
                if _needs_reprovision(uid) and _term_running(uid):
                    print(f"[agent] stale provision for uid={uid} → stopping for clean rebuild", flush=True)
                    _stop(uid)
                    continue
                _ensure_bridge(uid)
                if not _term_running(uid):
                    _launch(uid, str(u["login"]), str(u["server"]), str(u["password"]))
            print(f"[agent] desired={list(desired.keys())} "
                  f"alive={[u for u in desired if _term_running(u)]}", flush=True)
            _post_metrics()
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] loop error: {exc}", flush=True)
        time.sleep(POLL)


if __name__ == "__main__":
    main()
