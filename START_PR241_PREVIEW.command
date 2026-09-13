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

echo "PR #241 exact-head Preview v2 を開きました。"
echo "Product HEAD: 516a3cafd1c63bcff9fada9bb7bcc7ae24d5375b"
echo "起動に失敗した場合は、Audio Pipeline側のTerminalに原因が直接表示されます。"
echo "終了時は STOP_PR241_PREVIEW.command をダブルクリックしてください。"
read -r "?Enterでこのウインドウを閉じます..."
