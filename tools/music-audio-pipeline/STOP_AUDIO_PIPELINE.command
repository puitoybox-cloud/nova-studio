#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
PID_FILE=".pipeline.pid"

pause_and_exit(){
  local code="${1:-0}"
  read -r -p "Enterで閉じます..." _ || true
  exit "$code"
}

if [ ! -f "$PID_FILE" ]; then
  echo "Audio Pipeline は起動していません。"
  pause_and_exit 0
fi

PID="$(cat "$PID_FILE")"
if ! [[ "$PID" =~ ^[0-9]+$ ]] || [ "$PID" -le 1 ]; then
  echo "保存されたPIDが不正です。別のアプリを停止せず、PID記録のみ破棄します。"
  rm -f "$PID_FILE"
  pause_and_exit 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Audio Pipeline の古いPID記録を破棄しました。"
  rm -f "$PID_FILE"
  pause_and_exit 0
fi

COMMAND="$(/bin/ps -p "$PID" -o command= 2>/dev/null || true)"
if [[ "$COMMAND" != *python* ]] || [[ "$COMMAND" != *server.py* ]] ||
   ! /usr/sbin/lsof -nP -a -p "$PID" -iTCP:8766 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "PID $PID はこのAudio Pipelineの待受プロセスと確認できません。安全のため停止しません。"
  echo "別のアプリを停止しないよう、PID記録のみ破棄します。"
  rm -f "$PID_FILE"
  pause_and_exit 1
fi

kill "$PID"
for _ in 1 2 3 4 5; do
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done
rm -f "$PID_FILE"
echo "Audio Pipeline を停止しました。"
pause_and_exit 0
