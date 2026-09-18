#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR=".venv"
PID_FILE=".pipeline.pid"
LOG_FILE="audio-pipeline.log"
HEALTH_URL="http://127.0.0.1:8766/health"

pause_and_exit(){
  local code="${1:-0}"
  read -r -p "Enterで閉じます..." _ || true
  exit "$code"
}

show_log(){
  if [ -s "$LOG_FILE" ]; then
    echo
    echo "----- audio-pipeline.log -----"
    cat "$LOG_FILE"
    echo "----- log end -----"
  else
    echo "ログは空です。"
  fi
}

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 が見つかりません。"
  echo "python3 を使える状態にしてから、もう一度このファイルを開いてください。"
  pause_and_exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "初回セットアップを開始します。"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/python" -m pip install --upgrade pip wheel
  "$VENV_DIR/bin/python" -m pip install 'setuptools<82'
  "$VENV_DIR/bin/pip" install -r requirements.txt
fi

if ! "$VENV_DIR/bin/python" -c 'import pkg_resources' >/dev/null 2>&1; then
  echo "Audio Pipelineの互換部品を修復します。"
  "$VENV_DIR/bin/python" -m pip install 'setuptools<82'
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Audio Pipeline はすでに起動しています。"
  echo "$HEALTH_URL"
  pause_and_exit 0
fi
rm -f "$PID_FILE"

if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
  echo "Audio Pipeline はすでに 127.0.0.1:8766 で起動しています。"
  echo "$HEALTH_URL"
  pause_and_exit 0
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:8766 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Audio Pipeline を起動できません。127.0.0.1:8766 が別のプロセスで使用中です。"
  echo "次の一覧をスクリーンショットで共有してください。"
  lsof -nP -iTCP:8766 -sTCP:LISTEN || true
  pause_and_exit 1
fi

: > "$LOG_FILE"
PYTHONUNBUFFERED=1 nohup "$VENV_DIR/bin/python" -u server.py > "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

STARTED=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
    STARTED=1
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ "$STARTED" -eq 1 ]; then
  echo "Audio Pipeline を起動しました。"
  echo "Music StudioでMP3 / WAVなどを選べます。"
  echo "終了するときは STOP_AUDIO_PIPELINE.command を開いてください。"
  echo "ログ: $PWD/$LOG_FILE"
  pause_and_exit 0
fi

echo "Audio Pipeline の起動に失敗しました。"
if kill -0 "$PID" 2>/dev/null; then
  echo "プロセスは残っていますが、health確認に成功しませんでした。"
  kill "$PID" 2>/dev/null || true
fi
rm -f "$PID_FILE"
echo "起動時の内容を下に表示します。"
show_log
pause_and_exit 1
