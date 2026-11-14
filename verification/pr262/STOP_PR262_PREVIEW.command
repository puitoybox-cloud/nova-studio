#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
PID_FILE="$ROOT/verification/pr262/.preview.pid"
if [ ! -f "$PID_FILE" ]; then echo 'No preview PID recorded.'; exit 0; fi
PID="$(cat "$PID_FILE")"
if ! [[ "$PID" =~ ^[0-9]+$ ]] || [ "$PID" -le 1 ]; then echo 'Invalid PID; no process stopped.'; exit 1; fi
if ! kill -0 "$PID" 2>/dev/null; then rm -f "$PID_FILE"; echo 'Stale PID removed.'; exit 0; fi
COMMAND="$(/bin/ps -p "$PID" -o command= 2>/dev/null || true)"
if [[ "$COMMAND" != *'http.server 8765 --bind 127.0.0.1 --directory'* ]] || [[ "$COMMAND" != *"$ROOT"* ]] ||
   ! /usr/sbin/lsof -nP -a -p "$PID" -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  echo 'PID does not match this preview; no process stopped.'; exit 1
fi
kill "$PID"
rm -f "$PID_FILE"
echo 'Preview stopped.'
