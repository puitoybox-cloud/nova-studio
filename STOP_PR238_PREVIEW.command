#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -f .pr238-preview.pid ]; then
  PID="$(cat .pr238-preview.pid)"
  if kill -0 "$PID" 2>/dev/null; then kill "$PID"; fi
  rm -f .pr238-preview.pid
fi
echo "PR #238 preview stopped."
