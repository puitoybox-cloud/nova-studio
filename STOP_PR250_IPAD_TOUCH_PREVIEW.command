#!/bin/bash
set -e
if [ -f /tmp/pr250-ipad-touch-preview.pid ]; then
  PID=$(cat /tmp/pr250-ipad-touch-preview.pid)
  kill "$PID" 2>/dev/null || true
  rm -f /tmp/pr250-ipad-touch-preview.pid
fi
echo "PR #250 Preview stopped."
