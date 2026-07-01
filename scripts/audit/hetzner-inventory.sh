#!/usr/bin/env bash
# ممیزیِ هتزنر — ۱۰۰٪ فقط-خواندنی (فقط GET). روی لپ‌تاپ/هر سیستمی با curl اجرا کن.
# استفاده:  HTOKEN='توکن' bash hetzner-inventory.sh > hetzner-report.txt
set -euo pipefail
: "${HTOKEN:?HTOKEN را ست کن: HTOKEN='...' bash hetzner-inventory.sh}"
H="Authorization: Bearer $HTOKEN"
B="https://api.hetzner.cloud/v1"

echo "===== SERVERS ====="
curl -sS -H "$H" "$B/servers?per_page=50" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d.get('servers',[]):
    ip=s['public_net']['ipv4']['ip'] if s['public_net'].get('ipv4') else '-'
    print(f\"- {s['name']} | id={s['id']} | {s['server_type']['name']} ({s['server_type']['cores']}c/{s['server_type']['memory']}GB/{s['server_type']['disk']}GB) | {s['datacenter']['name']} | {s['image']['name'] if s.get('image') else '?'} | IP={ip} | status={s['status']}\")
"
echo; echo "===== VOLUMES ====="
curl -sS -H "$H" "$B/volumes?per_page=50" | python3 -c "
import json,sys
for v in json.load(sys.stdin).get('volumes',[]):
    print(f\"- {v['name']} | {v['size']}GB | attached_to={v.get('server')}\")"
echo; echo "===== NETWORKS ====="
curl -sS -H "$H" "$B/networks?per_page=50" | python3 -c "
import json,sys
for n in json.load(sys.stdin).get('networks',[]):
    print(f\"- {n['name']} | {n['ip_range']} | servers={len(n.get('servers',[]))}\")"
echo; echo "===== FIREWALLS ====="
curl -sS -H "$H" "$B/firewalls?per_page=50" | python3 -c "
import json,sys
for f in json.load(sys.stdin).get('firewalls',[]):
    print(f\"- {f['name']} | rules={len(f.get('rules',[]))}\")
    for r in f.get('rules',[]):
        print(f\"    {r['direction']} {r.get('protocol')} {r.get('port','')} from/to {len(r.get('source_ips',r.get('destination_ips',[])))} ips\")"
echo; echo "===== LOAD BALANCERS ====="
curl -sS -H "$H" "$B/load_balancers?per_page=50" | python3 -c "
import json,sys
for l in json.load(sys.stdin).get('load_balancers',[]):
    print(f\"- {l['name']}\")" 2>/dev/null || echo "(none)"
echo; echo "===== PRIMARY IPs ====="
curl -sS -H "$H" "$B/primary_ips?per_page=50" | python3 -c "
import json,sys
for p in json.load(sys.stdin).get('primary_ips',[]):
    print(f\"- {p['ip']} | assignee={p.get('assignee_id')}\")"
echo; echo "DONE — این خروجی را برای Claude بفرست."
