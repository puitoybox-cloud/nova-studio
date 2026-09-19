#!/bin/bash
set -u

PR_NUMBER="252"
PRODUCT_SHA="f1694efdf645e44e98dce10a535047791a5b9cd5"
PREVIEW_PORT="8766"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PREVIEW_URL="http://127.0.0.1:${PREVIEW_PORT}/index.html?pr=${PR_NUMBER}&verification=${PRODUCT_SHA}#music-studio"
MARKER_URL="http://127.0.0.1:${PREVIEW_PORT}/PR252_EXACT_HEAD.txt?verification=${PRODUCT_SHA}"
PID_FILE="/tmp/nova-studio-pr252-${PRODUCT_SHA}-preview.pid"
LOG_FILE="/tmp/nova-studio-pr252-${PRODUCT_SHA}-preview.log"

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "PR #252 Previewを起動できません" message "python3が見つかりません。画面を閉じずにティアへ知らせてください。" as critical' 2>/dev/null || true
  echo "python3が見つかりません。"
  read -r -p "Enterで閉じます。" _
  exit 1
fi

if curl --silent --fail "$MARKER_URL" 2>/dev/null | grep --fixed-strings --quiet "Product HEAD: $PRODUCT_SHA"; then
  open -a "Google Chrome" "$MARKER_URL" "$PREVIEW_URL" 2>/dev/null || open "$PREVIEW_URL"
  echo "指定HEADのPR #252 Previewはすでに起動しています。"
  echo "製品HEAD: $PRODUCT_SHA"
  exit 0
fi

if curl --silent --fail "http://127.0.0.1:${PREVIEW_PORT}/" >/dev/null 2>&1; then
  osascript -e 'display alert "PR #252 Previewを起動できません" message "localhost:8766は別のPreviewに使用されています。別HEADを表示しないため起動を中止しました。既存Previewを停止してから再実行してください。" as critical' 2>/dev/null || true
  echo "localhost:${PREVIEW_PORT}は別のPreviewに使用されています。既存プロセスは停止していません。"
  read -r -p "Enterで閉じます。" _
  exit 1
fi

cd "$SCRIPT_DIR" || exit 1
python3 -m http.server "$PREVIEW_PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for _ in 1 2 3 4 5; do
  if curl --silent --fail "$MARKER_URL" | grep --fixed-strings --quiet "Product HEAD: $PRODUCT_SHA"; then
    open -a "Google Chrome" "$MARKER_URL" "$PREVIEW_URL" 2>/dev/null || open "$PREVIEW_URL"
    echo "PR #252 exact-head Previewを起動しました。"
    echo "製品HEAD: $PRODUCT_SHA"
    echo "verification marker: $MARKER_URL"
    echo "確認URL: $PREVIEW_URL"
    echo "停止時はSTOP_PR252_PREVIEW.commandをダブルクリックしてください。"
    exit 0
  fi
  sleep 1
done

kill "$SERVER_PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "指定HEADのmarkerを確認できなかったためPreviewを停止しました。ログ: $LOG_FILE"
read -r -p "Enterで閉じます。" _
exit 1
