#!/bin/bash
set -u

PID_FILE="/tmp/nova-studio-pr239-preview.pid"

if [ -f "$PID_FILE" ]; then
  SERVER_PID="$(sed -n '1p' "$PID_FILE")"
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    echo "PR #239 Previewを停止しました。"
  else
    echo "PR #239 Previewはすでに停止しています。"
  fi
  rm -f "$PID_FILE"
else
  echo "PR #239 Previewは起動していません。"
fi
