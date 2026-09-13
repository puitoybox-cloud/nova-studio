#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
PORT=8765
PID_FILE=".pr241-preview.pid"
LOG_FILE=".pr241-preview.log"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "PR #241 Preview server はすでに起動しています。"
else
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
fi

open "tools/music-audio-pipeline/START_AUDIO_PIPELINE.command"
sleep 1
open "http://127.0.0.1:${PORT}/music-studio.html"

echo "PR #241 exact-head Preview を開きました。"
echo "Product HEAD: a77f72eb38287a9a6e05d0f84062332ad2b95a38"
echo "初回はAudio Pipelineの必要ファイル準備に時間がかかる場合があります。"
echo "終了時は STOP_PR241_PREVIEW.command をダブルクリックしてください。"
read -r "?Enterでこのウインドウを閉じます..."
