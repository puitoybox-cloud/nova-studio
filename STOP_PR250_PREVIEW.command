#!/bin/bash
set -e
if [ -f /tmp/pr250-scroll-fix-preview.pid ]; then
  PID=$(cat /tmp/pr250-scroll-fix-preview.pid 2>/dev/null || true)
  [ -z "$PID" ] || kill "$PID" 2>/dev/null || true
  rm -f /tmp/pr250-scroll-fix-preview.pid
fi
echo "PR #250 Preview stopped."
