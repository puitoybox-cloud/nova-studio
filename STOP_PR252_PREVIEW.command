#!/bin/bash
set -u

PRODUCT_SHA="f1694efdf645e44e98dce10a535047791a5b9cd5"
PID_FILE="/tmp/nova-studio-pr252-${PRODUCT_SHA}-preview.pid"

if [ -f "$PID_FILE" ]; then
  SERVER_PID="$(sed -n '1p' "$PID_FILE")"
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    echo "PR #252 Preview（${PRODUCT_SHA}）を停止しました。"
  else
    echo "PR #252 Previewはすでに停止しています。"
  fi
  rm -f "$PID_FILE"
else
  echo "この製品HEADのPR #252 Previewは起動していません。"
fi
