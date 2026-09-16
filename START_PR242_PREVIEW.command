#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "PR #242 exact-head Preview"
echo "Product HEAD: 5c9b7c6d8cfbaf31f00dcecf54491411a3c8e8a0"
echo "Starting http://127.0.0.1:8765/music-studio.html#music-studio"
python3 -m http.server 8765 --bind 127.0.0.1 >/tmp/nova-pr242-preview.log 2>&1 &
echo $! > /tmp/nova-pr242-preview.pid
sleep 1
open -a "Google Chrome" "http://127.0.0.1:8765/music-studio.html#music-studio"
echo "Preview started. Keep this Terminal window open while testing."
read -n 1 -s -r -p "Press any key to close this window."
echo
