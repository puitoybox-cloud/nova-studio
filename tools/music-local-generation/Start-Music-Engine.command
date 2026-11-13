#!/bin/bash
# Explicit foreground launch only. No installation or trust changes.
cd -- "$(dirname -- "$0")" || exit 1
if [ -x .venv/bin/python3 ]; then
  engine_python="$PWD/.venv/bin/python3"
else
  engine_python="python3"
fi
if [ "$#" -eq 0 ]; then
  "$engine_python" launch.py --config launch.json
else
  "$engine_python" launch.py "$@"
fi
engine_result=$?
if [ "$engine_result" -ne 0 ]; then
  printf '\nEngine stopped（起動できませんでした）。上の診断とREADMEを確認してください。\n'
  read -r -p 'Enter（終了）' engine_ack
fi
exit "$engine_result"
