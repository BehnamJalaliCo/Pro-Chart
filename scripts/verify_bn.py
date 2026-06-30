import urllib.request, json
from src.core.security import create_access_token
T = create_access_token({"sub": "student:1", "scope": "academy", "sid": 1, "tier": "premium"})
base = "http://localhost:8000"
eps = ["/academy/bn/watchlist", "/academy/bn/prices?symbols=EURUSD,XAUUSD",
       "/academy/bn/layouts", "/academy/bn/ai-signal/quota", "/academy/chart/EURUSD?tf=H1&limit=5"]
for ep in eps:
    req = urllib.request.Request(base + ep, headers={"Authorization": "Bearer " + T})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        body = r.read().decode()
        print(f"{r.status}  {ep}  ::  {body[:140]}")
    except urllib.error.HTTPError as e:
        print(f"{e.code}  {ep}  ::  {e.read().decode()[:140]}")
    except Exception as e:
        print(f"ERR {ep} :: {e}")
