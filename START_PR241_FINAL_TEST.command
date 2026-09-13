#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT=8765
PIPELINE_PORT=8766
PID_FILE="$ROOT/.pr241-final-test.pid"
LOG_FILE="$ROOT/.pr241-final-test.log"
PIPELINE_DIR="$ROOT/tools/music-audio-pipeline"

printf '\n=== PR #241 FINAL TEST ===\n'
printf 'Product HEAD: 516a3cafd1c63bcff9fada9bb7bcc7ae24d5375b\n'
printf '配信フォルダ: %s\n' "$ROOT"

if [[ ! -f "$ROOT/music-studio.html" ]]; then
  echo "ERROR: このフォルダに music-studio.html がありません。"
  echo "実際のフォルダ内容を確認してください: $ROOT"
  read -r "?Enterで閉じます..."
  exit 1
fi

echo "OK: music-studio.html を確認しました。"

for STALE_PID in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  STALE_COMMAND="$(ps -p "$STALE_PID" -o command= 2>/dev/null || true)"
  if [[ "$STALE_COMMAND" == *"http.server"* ]]; then
    echo "前のPreview用HTTP serverを停止します: PID $STALE_PID"
    kill "$STALE_PID" 2>/dev/null || true
    sleep 1
  else
    echo "ERROR: 127.0.0.1:$PORT は別のアプリが使用しています。"
    echo "$STALE_COMMAND"
    read -r "?Enterで閉じます..."
    exit 1
  fi
done

nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 1

STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/music-studio.html")"
echo "Music Studio HTTP status: $STATUS"
if [[ "$STATUS" != "200" ]]; then
  echo "ERROR: Music Studio Previewの配信確認に失敗しました。"
  echo "ログ: $LOG_FILE"
  read -r "?Enterで閉じます..."
  exit 1
fi

chmod u+x "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true
/bin/zsh "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" &
sleep 1

if lsof -tiTCP:"$PIPELINE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Audio Pipeline: 127.0.0.1:$PIPELINE_PORT で起動確認"
else
  echo "Audio Pipeline: 起動処理中または失敗。別Terminalの表示を確認してください。"
fi

open -a "Google Chrome" "http://127.0.0.1:${PORT}/music-studio.html?verification=pr241-final-test"
echo "PR #241 FINAL TEST: Music Studio HTTP 200 を確認してChromeを開きました。"
echo "このTerminalは閉じずに残してください。"
read -r "?Enterでこのウインドウを閉じます..."
