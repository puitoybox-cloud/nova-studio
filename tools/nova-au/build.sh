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
 -framework CoreFoundation -framework Cocoa -framework CoreMIDI -framework UniformTypeIdentifiers -framework JavaScriptCore -framework Security \
 "$SDK"/src/AudioUnitSDK/*.cpp NovaMix.mm View.mm WholeSongController.mm -fobjc-arc \
 -o "$BUNDLE/Contents/MacOS/NovaMix"
# Offline companion reuses the AU quality DSP; it is never called from render.
xcrun clang++ -std=c++20 -arch x86_64 -mmacosx-version-min=12.0 -O2 whole-song.cpp -o "$BUNDLE/Contents/MacOS/nova-whole-song"
xcrun clang++ -std=c++20 -arch x86_64 -mmacosx-version-min=12.0 -O2 section-meter.cpp -o "$BUNDLE/Contents/MacOS/nova-section-meter"
cp whole-song.py select-whole-song.py au-whole-song.py compare-sections.py "$BUNDLE/Contents/Resources/"
printf 'BNDLNvSt'  > "$BUNDLE/Contents/PkgInfo"
cp Info.plist "$BUNDLE/Contents/Info.plist"
cp "$SDK/LICENSE.txt" "$BUNDLE/Contents/Resources/AudioUnitSDK-LICENSE.txt"
plutil -lint "$BUNDLE/Contents/Info.plist"
file "$BUNDLE/Contents/MacOS/NovaMix"
lipo "$BUNDLE/Contents/MacOS/NovaMix" -verify_arch x86_64
nm -gU "$BUNDLE/Contents/MacOS/NovaMix" | grep _NovaMixFactory
# Ad-hoc development sealing uses no Apple identity, certificate, keychain secret or notarization.
codesign --force --sign - "$BUNDLE/Contents/MacOS/nova-whole-song"
codesign --force --sign - "$BUNDLE/Contents/MacOS/nova-section-meter"
codesign --verify --strict "$BUNDLE/Contents/MacOS/nova-section-meter"
codesign --verify --strict "$BUNDLE/Contents/MacOS/nova-whole-song"
python3 - "$BUNDLE" <<'PYINVENTORY'
import hashlib,json,sys
from pathlib import Path
r=Path(sys.argv[1])/'Contents/Resources'
names=['whole-song.py','select-whole-song.py','au-whole-song.py','compare-sections.py','../MacOS/nova-whole-song','../MacOS/nova-section-meter']
(r/'whole-song-runtime.json').write_text(json.dumps({n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in names}))
PYINVENTORY
codesign --force --sign - "$BUNDLE"
codesign --verify --strict "$BUNDLE"
# No user-machine installation is performed by this build script.
