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
# The Apple SDK is vendored at a fixed revision; builds do not fetch network dependencies.
xcrun clang++ -std=c++23 -arch x86_64 -mmacosx-version-min=12.0 -O2 -fvisibility=hidden \
 -I "$SDK/include" -bundle -framework AudioToolbox -framework AudioUnit -framework CoreAudio \
 -framework CoreFoundation -framework Cocoa -framework CoreMIDI -framework UniformTypeIdentifiers \
 "$SDK"/src/AudioUnitSDK/*.cpp NovaMix.mm View.mm -fobjc-arc \
 -o "$BUNDLE/Contents/MacOS/NovaMix"
cp Info.plist "$BUNDLE/Contents/Info.plist"
cp "$SDK/LICENSE.txt" "$BUNDLE/Contents/Resources/AudioUnitSDK-LICENSE.txt"
plutil -lint "$BUNDLE/Contents/Info.plist"
file "$BUNDLE/Contents/MacOS/NovaMix"
lipo -verify_arch x86_64 "$BUNDLE/Contents/MacOS/NovaMix"
nm -gU "$BUNDLE/Contents/MacOS/NovaMix" | grep _NovaMixFactory
# No identity, signing secret, notarization or user plug-in installation is used.
