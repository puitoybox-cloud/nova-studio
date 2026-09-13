#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
PID_FILE=".pr241-preview.pid"
PIPELINE_DIR="tools/music-audio-pipeline"

chmod u+x "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

/bin/zsh "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command"
echo "PR #241 Preview server の停止処理を行いました。"
read -r "?Enterでこのウインドウを閉じます..."
