#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$TASK_ROOT/scripts/music-stage-native-web.py" "$TASK_ROOT/tools/music-native-wrapper/MusicStudioWeb"
exec swift run --package-path "$TASK_ROOT/tools/music-native-wrapper" MusicStudioNativeApp "$@"
