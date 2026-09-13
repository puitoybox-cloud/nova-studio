#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR=".venv"
PID_FILE=".pipeline.pid"
LOG_FILE="audio-pipeline.log"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 が見つかりません。"
  echo "python3 を使える状態にしてから、もう一度このファイルを開いてください。"
  read -r -p "Enterで閉じます..." _
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "初回セットアップを開始します。"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/python" -m pip install --upgrade pip setuptools wheel
  "$VENV_DIR/bin/pip" install -r requirements.txt
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Audio Pipeline はすでに起動しています。"
  echo "http://127.0.0.1:8766/health"
  read -r -p "Enterで閉じます..." _
  exit 0
fi

nohup "$VENV_DIR/bin/python" server.py > "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"
sleep 2

if kill -0 "$PID" 2>/dev/null; then
  echo "Audio Pipeline を起動しました。"
  echo "Music StudioでMP3 / WAVなどを選べます。"
  echo "終了するときは STOP_AUDIO_PIPELINE.command を開いてください。"
  echo "ログ: $PWD/$LOG_FILE"
else
  echo "Audio Pipeline の起動に失敗しました。"
  echo "ログを確認してください: $PWD/$LOG_FILE"
fi
read -r -p "Enterで閉じます..." _
