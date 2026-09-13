#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
PORT=8765
PID_FILE=".pr241-preview.pid"
LOG_FILE=".pr241-preview.log"
PIPELINE_DIR="tools/music-audio-pipeline"
OLD_PREVIEW="../nova-studio-verification-pr241-exact-head-preview/tools/music-audio-pipeline/.venv"

chmod u+x "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" "$PIPELINE_DIR/STOP_AUDIO_PIPELINE.command" 2>/dev/null || true

if [[ ! -e "$PIPELINE_DIR/.venv" && -d "$OLD_PREVIEW" ]]; then
  ln -s "$(cd "$(dirname "$OLD_PREVIEW")" && pwd)/.venv" "$PIPELINE_DIR/.venv"
  echo "前回のAudio Pipeline初回セットアップを再利用します。"
fi

# Stop only a stale Python http.server from an earlier Preview.
for STALE_PID in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  STALE_COMMAND="$(ps -p "$STALE_PID" -o command= 2>/dev/null || true)"
  if [[ "$STALE_COMMAND" == *"http.server"* && "$STALE_COMMAND" == *"8765"* ]]; then
    echo "前回のPreview serverを停止します: PID $STALE_PID"
    kill "$STALE_PID" 2>/dev/null || true
    sleep 1
  fi
done

if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: 127.0.0.1:$PORT は別のアプリが使用しています。"
  echo "安全のため、そのプロセスは停止していません。"
  exit 1
fi

nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 1

if ! curl -fsS "http://127.0.0.1:${PORT}/music-studio.html" >/dev/null 2>&1; then
  echo "ERROR: PR #241 Previewのmusic-studio.htmlを配信できません。"
  echo "ログ: $(pwd)/$LOG_FILE"
  exit 1
fi

echo "PR #241 Music Studio Preview serverを確認しました。"
/bin/zsh "$PIPELINE_DIR/START_AUDIO_PIPELINE.command" &
sleep 1
open "http://127.0.0.1:${PORT}/music-studio.html"

echo "PR #241 exact-head Preview v3 を開きました。"
echo "Product HEAD: 516a3cafd1c63bcff9fada9bb7bcc7ae24d5375b"
echo "終了時は STOP_PR241_PREVIEW.command を使用してください。"
read -r "?Enterでこのウインドウを閉じます..."
