# ════════════════════════════════════════════════════════════════════
#  harden_windows.ps1 — سخت‌سازیِ امنیتیِ سرورِ ویندوزِ کپی‌ترید.
#  هدف: نگذاریم هکر به سرور نفوذ کند یا منابع (CPU/پهنای‌باند) را سوءاستفاده کند.
#
#  اجرا (به‌عنوان Administrator):
#    powershell -ExecutionPolicy Bypass -File harden_windows.ps1 -AdminIP "<آی‌پیِ خودت>"
#  اگر AdminIP ندهی، RDP باز می‌ماند ولی با NLA + قفلِ حساب محافظت می‌شود.
#
#  چه می‌کند:
#    1) RDP: فعال‌کردنِ NLA؛ محدودکردنِ منبع به IP مالک (اگر داده شود)
#    2) قفلِ حساب پس از ۵ تلاشِ ناموفق (ضدِّ brute-force RDP)
#    3) فایروال: default-deny ورودی؛ فقط RDP + ICMP باز؛ بستنِ SMB/NetBIOS از بیرون
#    4) بستنِ پورت‌های رایجِ ماینینگ در خروجی (اگر نفوذ شد، نتواند ماین کند)
#    5) Defender: real-time + cloud + قواعدِ ASR
#    6) غیرفعال‌کردنِ SMBv1 و سرویس‌های بلااستفاده
#    7) Windows Update خودکار
# ════════════════════════════════════════════════════════════════════
param(
  [string]$AdminIP = "",          # IP مالک برای محدودکردنِ RDP (خالی = بدونِ محدودیتِ منبع)
  [int]$RdpPort = 3389
)
$ErrorActionPreference = "Continue"
function Log($m) { Write-Host "[harden] $m" }

# ── 1) RDP: اجبارِ NLA (احرازِ سطحِ شبکه — مانعِ اتصالِ بدونِ اعتبار) ──
Log "RDP: enforce NLA"
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v UserAuthentication /d 1 /t REG_DWORD /f | Out-Null
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v SecurityLayer /d 2 /t REG_DWORD /f | Out-Null

# ── 2) سیاستِ قفلِ حساب (ضدِّ brute-force) ──
Log "Account lockout: 5 tries -> 15 min"
net accounts /lockoutthreshold:5 /lockoutduration:15 /lockoutwindow:15 | Out-Null
net accounts /minpwlen:14 | Out-Null

# ── 3) فایروال: default-deny ورودی، فقط RDP + ICMP ──
Log "Firewall: default-deny inbound"
Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block -DefaultOutboundAction Allow -Enabled True -ErrorAction SilentlyContinue
# قاعدهٔ RDP — اگر AdminIP داده شده، فقط از همان IP
Remove-NetFirewallRule -DisplayName "CoinePro-RDP" -ErrorAction SilentlyContinue
if ($AdminIP -ne "") {
  New-NetFirewallRule -DisplayName "CoinePro-RDP" -Direction Inbound -Protocol TCP -LocalPort $RdpPort -RemoteAddress $AdminIP -Action Allow -ErrorAction SilentlyContinue | Out-Null
  Log "RDP restricted to $AdminIP"
} else {
  New-NetFirewallRule -DisplayName "CoinePro-RDP" -Direction Inbound -Protocol TCP -LocalPort $RdpPort -Action Allow -ErrorAction SilentlyContinue | Out-Null
  Log "RDP open (no AdminIP) — protected by NLA + lockout"
}
# اجازهٔ ICMP (پینگ) برای مانیتورینگ
New-NetFirewallRule -DisplayName "CoinePro-ICMP" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Action Allow -ErrorAction SilentlyContinue | Out-Null
# بستنِ صریحِ SMB/NetBIOS از بیرون
foreach ($p in 135,137,138,139,445) {
  New-NetFirewallRule -DisplayName "CoinePro-Block-$p" -Direction Inbound -Protocol TCP -LocalPort $p -Action Block -ErrorAction SilentlyContinue | Out-Null
}

# ── 4) بستنِ پورت‌های رایجِ استخرِ ماینینگ در خروجی (دفاع در صورتِ نفوذ) ──
Log "Block common mining/stratum outbound ports"
$miningPorts = 3333,4444,5555,7777,8888,9999,14444,45560,45700,3334,5730
New-NetFirewallRule -DisplayName "CoinePro-Block-Mining" -Direction Outbound -Protocol TCP -RemotePort $miningPorts -Action Block -ErrorAction SilentlyContinue | Out-Null

# ── 5) Microsoft Defender ──
Log "Defender: real-time + cloud + ASR"
try {
  Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
  Set-MpPreference -MAPSReporting Advanced -SubmitSamplesConsent SendSafeSamples -ErrorAction SilentlyContinue
  Set-MpPreference -PUAProtection Enabled -ErrorAction SilentlyContinue
  # قواعدِ Attack Surface Reduction (بلاکِ سوءاستفاده‌های رایج)
  $asr = @("D4F940AB-401B-4EFC-AADC-AD5F3C50688A","3B576869-A4EC-4529-8536-B80A7769E899",
           "5BEB7EFE-FD9A-4556-801D-275E5FFC04CC","D3E037E1-3EB8-44C8-A917-57927947596D",
           "BE9BA2D9-53EA-4CDC-84E5-9B1EEEE46550")
  foreach ($r in $asr) { Add-MpPreference -AttackSurfaceReductionRules_Ids $r -AttackSurfaceReductionRules_Actions Enabled -ErrorAction SilentlyContinue }
} catch { Log "Defender config skipped: $_" }

# ── 6) غیرفعال‌کردنِ SMBv1 و سرویس‌های بلااستفاده ──
Log "Disable SMBv1 + unused services"
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force -ErrorAction SilentlyContinue
foreach ($svc in "RemoteRegistry","Spooler","SSDPSRV","upnphost","WMPNetworkSvc") {
  Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
  Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
}

# ── 7) Windows Update خودکار ──
Log "Enable automatic Windows Update"
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update" /v AUOptions /d 4 /t REG_DWORD /f | Out-Null

Log "DONE — Windows copy server hardened."
