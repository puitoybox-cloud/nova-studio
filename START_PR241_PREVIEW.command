#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
PORT=8765
PID_FILE=".pr241-preview.pid"
LOG_FILE=".pr241-preview.log"
PIPELINE_DIR="tools/music-audio-pipeline"
OLD_PREVIEW="../nova-studio-verification-pr241-exact-head-preview/tools/music-audio-pipeline/.venv"

# GitHub ZIP does not preserve executable bits. Restore them before launching helpers.
chmod u+x "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true

if [[ ! -e "$PIPELINE_DIR/.venv" && -d "$OLD_PREVIEW" ]]; then
  ln -s "$(cd "$(dirname "$OLD_PREVIEW")" && pwd)/.venv" "$PIPELINE_DIR/.venv"
  echo "前回のAudio Pipeline初回セットアップを再利用します。"
fi

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "PR #241 Preview server はすでに起動しています。"
else
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
fi

/bin/zsh "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" &
sleep 1
open "http://127.0.0.1:${PORT}/music-studio.html"

echo "PR #241 exact-head Preview v3 を開きました。"
echo "Product HEAD: 516a3cafd1c63bcff9fada9bb7bcc7ae24d5375b"
echo "GitHub ZIPの実行権限に依存せずAudio Pipelineを起動します。"
echo "終了時は STOP_PR241_PREVIEW.command を開いてください。"
read -r "?Enterでこのウインドウを閉じます..."
