#!/bin/bash
set +e
if [ -f /tmp/nova-pr242-preview.pid ]; then
  PID=$(cat /tmp/nova-pr242-preview.pid)
  kill "$PID" 2>/dev/null
  rm -f /tmp/nova-pr242-preview.pid
fi
pkill -f "python3 -m http.server 8765 --bind 127.0.0.1" 2>/dev/null
echo "PR #242 Preview stopped."
