#!/bin/bash
set -e
cd "$(dirname "$0")"
EXPECTED="$(tr -d '[:space:]' < PR238_EXACT_HEAD.txt)"
PORT=8765
if [ -f .pr238-preview.pid ] && kill -0 "$(cat .pr238-preview.pid)" 2>/dev/null; then
  kill "$(cat .pr238-preview.pid)" 2>/dev/null || true
fi
python3 -m http.server "$PORT" --bind 127.0.0.1 > .pr238-preview.log 2>&1 &
echo $! > .pr238-preview.pid
sleep 1
open -a "Google Chrome" "http://127.0.0.1:$PORT/music-studio.html?verification=$EXPECTED"
echo "PR #238 exact product HEAD: $EXPECTED"
echo "Preview: http://127.0.0.1:$PORT/music-studio.html?verification=$EXPECTED"
