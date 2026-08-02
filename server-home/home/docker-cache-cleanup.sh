#!/usr/bin/env bash
# Weekly Docker BUILD CACHE cleanup — safe for projects.
# Only prunes build cache older than 7 days.
# NEVER touches images, containers, volumes, or networks.
set -euo pipefail

LOG="/home/bazaarnama/docker-cache-cleanup.log"

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') ====="
  echo "Disk before:"
  df -h / | tail -1
  echo "Pruning build cache older than 7 days (168h)..."
  docker builder prune -f --filter until=168h
  echo "Disk after:"
  df -h / | tail -1
  echo
} >> "$LOG" 2>&1

# Keep log from growing forever: trim to last 500 lines.
tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
