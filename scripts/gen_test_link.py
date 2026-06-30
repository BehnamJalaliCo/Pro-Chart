from datetime import timedelta
from src.core.security import create_access_token
t = create_access_token({"sub": "student:1", "scope": "academy", "sid": 1, "tier": "premium"}, timedelta(hours=4))
print("http://91.107.181.124/#t=" + t)
