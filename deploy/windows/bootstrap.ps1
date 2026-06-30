# CoinePro — Windows first-login bootstrap (نصبِ خودکارِ RDP + Python + MT5 + EA + agent).
# با پارامترهای -Api و -Token از autounattend اجرا می‌شود.
param(
  [string]$Api = "https://fx.trade-future.ir/api",
  [string]$Token = ""
)
$ErrorActionPreference = "Continue"
$log = "C:\coinepro_bootstrap.log"
function Log($m) { "$([DateTime]::UtcNow.ToString('s'))  $m" | Tee-Object -FilePath $log -Append }

Log "bootstrap start"

# ۱) ساعتِ UTC (هاستِ هتزنر UTC است)
reg add "HKLM\System\CurrentControlSet\Control\TimeZoneInformation" /v RealTimeIsUniversal /d 1 /t REG_DWORD /f | Out-Null

# ۲) فعال‌سازیِ RDP + فایروال
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /d 0 /t REG_DWORD /f | Out-Null
Enable-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "RDP-In" -Direction Inbound -Protocol TCP -LocalPort 3389 -Action Allow -ErrorAction SilentlyContinue | Out-Null
Log "rdp enabled"

# ۳) نصبِ Python (silent، به PATH)
try {
  $py = "C:\python-installer.exe"
  Invoke-WebRequest -UseBasicParsing "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe" -OutFile $py
  Start-Process $py -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
  Log "python installed"
} catch { Log "python FAILED: $_" }

# ۴) نصبِ MetaTrader 5 (silent)
try {
  $mt5 = "C:\mt5setup.exe"
  Invoke-WebRequest -UseBasicParsing "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" -OutFile $mt5
  Start-Process $mt5 -ArgumentList "/auto" -Wait
  Log "mt5 installed"
} catch { Log "mt5 FAILED: $_" }

# ۵) نصبِ EA (ex5) در MQL5\Experts نصبِ MT5
try {
  $expdir = "C:\Program Files\MetaTrader 5\MQL5\Experts"
  New-Item -ItemType Directory -Force -Path $expdir | Out-Null
  Invoke-WebRequest -UseBasicParsing "$Api/public/winagent/CoineProAutoTrader.ex5" -OutFile "$expdir\CoineProAutoTrader.ex5"
  Log "EA installed"
} catch { Log "EA FAILED: $_" }

# ۶) دانلودِ agent + config
try {
  New-Item -ItemType Directory -Force -Path "C:\CoinePro" | Out-Null
  Invoke-WebRequest -UseBasicParsing "$Api/public/winagent/coinepro_agent.py" -OutFile "C:\CoinePro\coinepro_agent.py"
  @"
[agent]
api_url   = $Api
ea_token  = $Token
mt5_dir   = C:\Program Files\MetaTrader 5
users_dir = C:\CoinePro\users
poll      = 12
"@ | Set-Content -Path "C:\CoinePro\config.ini" -Encoding ASCII
  Log "agent + config placed"
} catch { Log "agent download FAILED: $_" }

# ۷) ثبتِ agent به‌صورتِ Scheduled Task (اجرا at startup، بدونِ نیاز به لاگین)
try {
  $pyexe = "C:\Program Files\Python312\python.exe"
  schtasks /Create /TN "CoineProAgent" /TR "`"$pyexe`" C:\CoinePro\coinepro_agent.py" /SC ONSTART /RU SYSTEM /RL HIGHEST /F | Out-Null
  schtasks /Run /TN "CoineProAgent" | Out-Null
  Log "agent scheduled + started"
} catch { Log "agent task FAILED: $_" }

# ۸) سخت‌سازیِ امنیتی (NLA + قفلِ حساب + فایروالِ default-deny + Defender + ضدِّ ماینینگ)
try {
  Invoke-WebRequest -UseBasicParsing "$Api/public/winagent/harden_windows.ps1" -OutFile "C:\CoinePro\harden_windows.ps1"
  powershell -ExecutionPolicy Bypass -File "C:\CoinePro\harden_windows.ps1"
  Log "security hardening applied"
} catch { Log "hardening FAILED: $_" }

Log "bootstrap done"
