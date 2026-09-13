#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.pr241-final-test.pid"
PIPELINE_DIR="$ROOT/tools/music-audio-pipeline"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi
/bin/zsh "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true
echo "PR #241 FINAL TEST を停止しました。"
read -r "?Enterで閉じます..."
