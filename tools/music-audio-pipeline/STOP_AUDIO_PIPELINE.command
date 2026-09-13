#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
PID_FILE=".pipeline.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "Audio Pipeline は起動していません。"
  read -r -p "Enterで閉じます..." _
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in 1 2 3 4 5; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
fi
rm -f "$PID_FILE"
echo "Audio Pipeline を停止しました。"
read -r -p "Enterで閉じます..." _
