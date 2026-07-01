# ممیزیِ ویندوز سرور (MT5) — ۱۰۰٪ فقط-خواندنی.
# اجرا در PowerShell (به‌عنوان Administrator):  .\server-audit.ps1 > audit-windows.txt
Write-Output "===== HOST ====="
$env:COMPUTERNAME; (Get-CimInstance Win32_OperatingSystem).Caption
Write-Output "===== RESOURCES ====="
"CPU: $((Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors) cores"
"RAM: {0:N1} GB" -f ((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)
Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}},@{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}} | Format-Table
Write-Output "===== METATRADER ====="
Get-Process | Where-Object {$_.ProcessName -match "terminal|metatrader|mt5"} | Select-Object ProcessName,Id,Path | Format-Table -AutoSize
Get-ChildItem "C:\Program Files\*MetaTrader*","C:\Program Files (x86)\*MetaTrader*" -ErrorAction SilentlyContinue | Select-Object FullName
Write-Output "===== PYTHON / BRIDGE PROCESSES ====="
Get-Process | Where-Object {$_.ProcessName -match "python|node|uvicorn|nssm"} | Select-Object ProcessName,Id,Path | Format-Table -AutoSize
Write-Output "===== LISTENING PORTS ====="
Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort -Unique | Format-Table -AutoSize
Write-Output "===== SERVICES (Auto, non-Microsoft) ====="
Get-CimInstance Win32_Service | Where-Object {$_.StartMode -eq "Auto" -and $_.PathName -notmatch "Windows"} | Select-Object Name,State,PathName | Format-Table -AutoSize
Write-Output "===== SCHEDULED TASKS (non-Microsoft) ====="
Get-ScheduledTask | Where-Object {$_.TaskPath -notmatch "Microsoft"} | Select-Object TaskName,State | Format-Table -AutoSize
Write-Output "DONE"
