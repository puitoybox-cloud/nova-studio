#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=8765
PRODUCT_SHA="b8b6f9226c1b39172b2e7f040ed228fae7fe01c3"
echo "PR #250 exact product HEAD: $PRODUCT_SHA"
if [ -f /tmp/pr250-pointer-fix-preview.pid ]; then
  OLD_PID=$(cat /tmp/pr250-pointer-fix-preview.pid 2>/dev/null || true)
  [ -z "$OLD_PID" ] || kill "$OLD_PID" 2>/dev/null || true
  rm -f /tmp/pr250-pointer-fix-preview.pid
fi
python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/pr250-pointer-fix-preview.log 2>&1 &
echo $! >/tmp/pr250-pointer-fix-preview.pid
sleep 1
IP=""
for IFACE in en0 en1; do
  CANDIDATE=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
  if [ -n "$CANDIDATE" ]; then IP="$CANDIDATE"; break; fi
done
if [ -z "$IP" ]; then
  IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  [ -z "$IFACE" ] || IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
fi
MAC_URL="http://127.0.0.1:$PORT/music-studio.html"
open -a "Google Chrome" "$MAC_URL" || true
if [ -n "$IP" ]; then
  IPAD_URL="http://$IP:$PORT/music-studio.html"
  echo "iPad: $IPAD_URL"
  osascript -e "display dialog \"iPadのSafariでこのリンクを開いてください:\n\n$IPAD_URL\" buttons {\"OK\"} default button \"OK\" with title \"PR #250 iPad Preview\""
else
  osascript -e 'display dialog "iPad用リンクを取得できませんでした。MacとiPadが同じWi-Fiに接続されていることを確認してください。" buttons {"OK"} default button "OK" with icon caution with title "PR #250 iPad Preview"'
fi
wait
