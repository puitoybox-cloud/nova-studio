#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=8765
PRODUCT_SHA="2d7d62035fe74e6bf1fe652a552b56a6c80a48a8"
echo "PR #250 exact product HEAD: $PRODUCT_SHA"
python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/pr250-ipad-touch-preview.log 2>&1 &
echo $! >/tmp/pr250-ipad-touch-preview.pid
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
open -a "Google Chrome" "http://127.0.0.1:$PORT/music-studio.html" || true
echo "Mac:  http://127.0.0.1:$PORT/music-studio.html"
if [ -n "$IP" ]; then echo "iPad: http://$IP:$PORT/music-studio.html"; fi
wait
