#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
PORT=8765
PID_FILE="$ROOT/verification/pr262/.preview.pid"
MARKER="$ROOT/verification/pr262/PRODUCT_HEAD.txt"
if [ ! -f "$MARKER" ] || [ ! -f "$ROOT/music-studio.html" ]; then
  echo 'Preview bundle is incomplete.'; exit 1
fi
HEAD="$(cat "$MARKER")"
if ! [[ "$HEAD" =~ ^[0-9a-f]{40}$ ]]; then echo 'Invalid verification marker.'; exit 1; fi
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
    echo "Existing preview process $PID; stop it before starting another."; exit 1
  fi
  rm -f "$PID_FILE"
fi
if /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use; no process was stopped."; exit 1
fi
echo "PRODUCT_HEAD=$HEAD"
echo "PRODUCT_URL=http://127.0.0.1:$PORT/music-studio.html"
echo "VERIFICATION_URL=http://127.0.0.1:$PORT/verification/pr262/PRODUCT_HEAD.txt"
/usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" > "$ROOT/verification/pr262/preview.log" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"
for _ in 1 2 3 4 5; do
  if /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$PORT/verification/pr262/PRODUCT_HEAD.txt" | /usr/bin/grep -qx "$HEAD"; then
    /usr/bin/open -a 'Google Chrome' "http://127.0.0.1:$PORT/music-studio.html" || true
    echo 'Preview ready. Open the verification URL and compare the 40-character HEAD.'
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  sleep 1
done
echo 'Preview startup failed.'; kill "$PID" 2>/dev/null || true; rm -f "$PID_FILE"; exit 1
