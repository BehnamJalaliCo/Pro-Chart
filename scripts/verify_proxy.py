import urllib.request
from src.core.security import create_access_token
T = create_access_token({"sub": "student:1", "scope": "academy", "sid": 1, "tier": "premium"})
# مسیر از طریقِ کانتینرِ frontend (پراکسیِ /api) — نامِ سرویس در شبکهٔ کامپوز
for url in ["http://frontend-prochart/api/academy/bn/prices?symbols=EURUSD",
            "http://frontend-prochart/api/academy/chart/EURUSD?tf=H1&limit=3",
            "http://frontend-prochart/"]:
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + T})
    try:
        r = urllib.request.urlopen(req, timeout=15)
        b = r.read()
        print(f"{r.status}  {url}  ::  {b[:90].decode(errors='replace')}")
    except Exception as e:
        print(f"ERR {url} :: {e}")
