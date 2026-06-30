from datetime import timedelta
from src.core.security import create_access_token
print(create_access_token({"sub":"student:1","scope":"academy","sid":1,"tier":"premium"}, timedelta(hours=4)), end="")
