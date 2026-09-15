#!/bin/bash
PID_FILE=/tmp/pr250-pointer-fix-preview.pid
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  [ -z "$PID" ] || kill "$PID" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
echo "PR #250 Preview stopped."
