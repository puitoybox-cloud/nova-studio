#!/bin/bash
set -u

PRODUCT_SHA="565e528081fe538fa61512914818a4f70f1840b0"
PID_FILE="/tmp/nova-studio-pr253-${PRODUCT_SHA}-preview.pid"

if [ -f "$PID_FILE" ]; then
  SERVER_PID="$(sed -n '1p' "$PID_FILE")"
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    echo "PR #253 Preview（${PRODUCT_SHA}）を停止しました。"
  else
    echo "PR #253 Previewはすでに停止しています。"
  fi
  rm -f "$PID_FILE"
else
  echo "この製品HEADのPR #253 Previewは起動していません。"
fi
