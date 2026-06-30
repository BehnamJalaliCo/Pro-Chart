#!/usr/bin/env python3
"""نقطه ورود Celery Worker"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.celery_app import celery_app

if __name__ == "__main__":
    celery_app.start(["worker", "-l", "info", "-c", "2", "-B"])
