#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=8765
PRODUCT_SHA="2d7d62035fe74e6bf1fe652a552b56a6c80a48a8"
echo "PR #250 exact product HEAD: $PRODUCT_SHA"

if [ -f /tmp/pr250-ipad-touch-preview.pid ]; then
  OLD_PID=$(cat /tmp/pr250-ipad-touch-preview.pid 2>/dev/null || true)
  if [ -n "$OLD_PID" ]; then kill "$OLD_PID" 2>/dev/null || true; fi
  rm -f /tmp/pr250-ipad-touch-preview.pid
fi

python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/pr250-ipad-touch-preview.log 2>&1 &
echo $! >/tmp/pr250-ipad-touch-preview.pid
sleep 1

IP=""
for IFACE in en0 en1; do
  CANDIDATE=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
  if [ -n "$CANDIDATE" ]; then
    IP="$CANDIDATE"
    break
  fi
done
if [ -z "$IP" ]; then
  IP=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}' | xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)
fi

MAC_URL="http://127.0.0.1:$PORT/music-studio.html"
open -a "Google Chrome" "$MAC_URL" || true

if [ -n "$IP" ]; then
  IPAD_URL="http://$IP:$PORT/music-studio.html"
  echo "Mac:  $MAC_URL"
  echo "iPad: $IPAD_URL"
  osascript -e "display dialog \"iPadのSafariでこのリンクを開いてください:\n\n$IPAD_URL\" buttons {\"OK\"} default button \"OK\" with title \"PR #250 iPad Preview\""
else
  echo "Mac: $MAC_URL"
  osascript -e 'display dialog "iPad用リンクを取得できませんでした。MacとiPadが同じWi-Fiに接続されていることを確認してください。" buttons {"OK"} default button "OK" with icon caution with title "PR #250 iPad Preview"'
fi

wait
