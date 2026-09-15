#!/bin/bash
set -u

PREVIEW_SHA="d7185bed0a811f79e7ea72e5a5634f42d6759d84"
PREVIEW_PORT="8765"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PID_FILE="/tmp/nova-studio-pr249-ipad-preview.pid"
LOG_FILE="/tmp/nova-studio-pr249-ipad-preview.log"

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "PR #249 Previewを起動できません" message "python3が見つかりません。画面を閉じずにティアへ知らせてください。" as critical' 2>/dev/null || true
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(sed -n '1p' "$PID_FILE")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
  fi
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$LAN_IP" ]; then
  osascript -e 'display alert "iPad用URLを作れません" message "MacをiPadと同じWi-Fiへ接続して、もう一度ダブルクリックしてください。" as critical' 2>/dev/null || true
  exit 1
fi

MAC_URL="http://127.0.0.1:${PREVIEW_PORT}/music-studio.html?verification=${PREVIEW_SHA}#music-studio"
IPAD_URL="http://${LAN_IP}:${PREVIEW_PORT}/music-studio.html?verification=${PREVIEW_SHA}#music-studio"

cd "$SCRIPT_DIR" || exit 1
python3 -m http.server "$PREVIEW_PORT" --bind 0.0.0.0 >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for _ in 1 2 3 4 5; do
  if curl --silent --fail "http://127.0.0.1:${PREVIEW_PORT}/music-studio.html" >/dev/null; then
    open -a "Google Chrome" "$MAC_URL" 2>/dev/null || open "$MAC_URL"
    osascript -e "display dialog \"M1 iPadのSafariで次のURLを開いてください。\\n\\n${IPAD_URL}\\n\\n確認HEAD: ${PREVIEW_SHA}\" with title \"PR #249 iPad Preview\" buttons {\"OK\"} default button \"OK\"" 2>/dev/null || true
    echo "PR #249 iPad Previewを起動しました。"
    echo "確認HEAD: $PREVIEW_SHA"
    echo "M1 iPad用URL: $IPAD_URL"
    exit 0
  fi
  sleep 1
done

echo "Preview serverを起動できませんでした。ログ: $LOG_FILE"
read -r -p "Enterで閉じます。" _
exit 1
