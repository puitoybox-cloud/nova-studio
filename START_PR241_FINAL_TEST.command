#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT=8765
PIPELINE_PORT=8766
PID_FILE="$ROOT/.pr241-final-test.pid"
LOG_FILE="$ROOT/.pr241-final-test.log"
PIPELINE_DIR="$ROOT/tools/music-audio-pipeline"

printf '\n=== PR #241 FINAL TEST CLEAN ===\n'
printf 'Product HEAD: 164b1d5a0297af5c564188bf6e9e43e6e7ce95cf\n'
printf '配信フォルダ: %s\n' "$ROOT"

if [[ ! -f "$ROOT/music-studio.html" ]]; then
  echo "ERROR: このフォルダに music-studio.html がありません。"
  read -r "?Enterで閉じます..." || true
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
    read -r "?Enterで閉じます..." || true
    exit 1
  fi
done

# Port 8766 may contain a helper from an older Preview. Stop every Nova server.py
# listener before starting the helper from this exact folder.
for OLD_PIPELINE_PID in $(lsof -tiTCP:"$PIPELINE_PORT" -sTCP:LISTEN 2>/dev/null || true); do
  OLD_PIPELINE_COMMAND="$(ps -p "$OLD_PIPELINE_PID" -o command= 2>/dev/null || true)"
  if [[ "$OLD_PIPELINE_COMMAND" == *"python"* && "$OLD_PIPELINE_COMMAND" == *"server.py"* ]]; then
    echo "前のAudio Pipelineを停止します: PID $OLD_PIPELINE_PID"
    kill "$OLD_PIPELINE_PID" 2>/dev/null || true
  else
    echo "ERROR: 127.0.0.1:$PIPELINE_PORT は別のアプリが使用しています。"
    echo "$OLD_PIPELINE_COMMAND"
    read -r "?Enterで閉じます..." || true
    exit 1
  fi
done

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! lsof -tiTCP:"$PIPELINE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if lsof -tiTCP:"$PIPELINE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: 前のAudio Pipelineを停止できませんでした。"
  read -r "?Enterで閉じます..." || true
  exit 1
fi

nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 1

STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/music-studio.html")"
echo "Music Studio HTTP status: $STATUS"
if [[ "$STATUS" != "200" ]]; then
  echo "ERROR: Music Studio Previewの配信確認に失敗しました。"
  read -r "?Enterで閉じます..." || true
  exit 1
fi

chmod u+x "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true
# START_AUDIO_PIPELINE.command is a Bash script. Run it with Bash, not zsh.
/bin/bash "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" </dev/null

PIPELINE_OK=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS --max-time 2 "http://127.0.0.1:${PIPELINE_PORT}/health" >/dev/null 2>&1; then
    PIPELINE_OK=1
    break
  fi
  sleep 1
done

if [[ "$PIPELINE_OK" -ne 1 ]]; then
  echo "ERROR: 修正版Audio Pipelineのhealth確認に失敗しました。"
  if [[ -s "$PIPELINE_DIR/audio-pipeline.log" ]]; then
    echo "----- audio-pipeline.log -----"
    cat "$PIPELINE_DIR/audio-pipeline.log"
    echo "----- log end -----"
  fi
  read -r "?Enterで閉じます..." || true
  exit 1
fi

echo "Audio Pipeline: 修正版を 127.0.0.1:$PIPELINE_PORT で起動確認"
open -a "Google Chrome" "http://127.0.0.1:${PORT}/music-studio.html?verification=pr241-final-test-clean"
echo "PR #241 FINAL TEST CLEAN: Music Studioと修正版Audio Pipelineの両方を確認してChromeを開きました。"
echo "このTerminalは閉じずに残してください。"
read -r "?Enterでこのウインドウを閉じます..." || true
