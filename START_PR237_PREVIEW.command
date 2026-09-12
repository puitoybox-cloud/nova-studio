#!/bin/bash
set -u

PREVIEW_SHA="35732e63744553fa34daf2f1865e68bd80b825ce"
PREVIEW_PORT="8765"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PREVIEW_URL="http://127.0.0.1:${PREVIEW_PORT}/music-studio.html?verification=${PREVIEW_SHA}#music-studio"
PID_FILE="/tmp/nova-studio-pr237-preview.pid"
LOG_FILE="/tmp/nova-studio-pr237-preview.log"

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "PR #237 Previewを起動できません" message "python3が見つかりません。画面を閉じずにティアへ知らせてください。" as critical' 2>/dev/null || true
  echo "python3が見つかりません。"
  read -r -p "Enterで閉じます。" _
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(sed -n '1p' "$PID_FILE")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
  fi
fi

cd "$SCRIPT_DIR" || exit 1
python3 -m http.server "$PREVIEW_PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for _ in 1 2 3 4 5; do
  if curl --silent --fail "http://127.0.0.1:${PREVIEW_PORT}/music-studio.html" >/dev/null; then
    open -a "Google Chrome" "$PREVIEW_URL" 2>/dev/null || open "$PREVIEW_URL"
    echo "PR #237 Previewを起動しました。"
    echo "対象commit: $PREVIEW_SHA"
    echo "確認URL: $PREVIEW_URL"
    echo "この画面は閉じて構いません。Preview停止時はSTOP_PR237_PREVIEW.commandをダブルクリックしてください。"
    exit 0
  fi
  sleep 1
done

echo "Preview serverを起動できませんでした。ログ: $LOG_FILE"
read -r -p "Enterで閉じます。" _
exit 1
