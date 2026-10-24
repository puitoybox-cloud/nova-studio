#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ $(uname -s) != Darwin ]]; then echo 'Apple SDK/macOS required for AU binary build' >&2; exit 1; fi
OUT=${1:?provide an output directory}
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
BUNDLE="$OUT/NovaMix.component"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"
SDK=vendor/AudioUnitSDK
python3 - "$OUT/AssistantSource.hpp" <<'PYEMBED'
import json,sys
from pathlib import Path
source=Path('../../music-studio-logic-instruments.js').read_text()
Path(sys.argv[1]).write_text('static constexpr const char* NovaAssistantSource = '+json.dumps(source,ensure_ascii=True).replace('?', r'\?')+';\n')
PYEMBED
# The Apple SDK is vendored at a fixed revision; builds do not fetch network dependencies.
xcrun clang++ -std=c++23 -arch x86_64 -mmacosx-version-min=12.0 -O2 -fvisibility=hidden \
 -I "$SDK/include" -I "$OUT" -bundle -framework AudioToolbox -framework AudioUnit -framework CoreAudio \
 -framework CoreFoundation -framework Cocoa -framework CoreMIDI -framework UniformTypeIdentifiers -framework JavaScriptCore \
 "$SDK"/src/AudioUnitSDK/*.cpp NovaMix.mm View.mm -fobjc-arc \
 -o "$BUNDLE/Contents/MacOS/NovaMix"
cp Info.plist "$BUNDLE/Contents/Info.plist"
cp "$SDK/LICENSE.txt" "$BUNDLE/Contents/Resources/AudioUnitSDK-LICENSE.txt"
plutil -lint "$BUNDLE/Contents/Info.plist"
file "$BUNDLE/Contents/MacOS/NovaMix"
lipo "$BUNDLE/Contents/MacOS/NovaMix" -verify_arch x86_64
nm -gU "$BUNDLE/Contents/MacOS/NovaMix" | grep _NovaMixFactory
# No identity, signing secret, notarization or user plug-in installation is used.
