"""Actual app entry/owned process acceptance on clean Intel CI; no songs edited."""
import json
import os
from pathlib import Path
import plistlib
import signal
import selectors
import socket
import subprocess
import sys
import time
import urllib.request

app = Path(sys.argv[1]).resolve(strict=True)
contents = app / 'Contents'
info = plistlib.loads((contents / 'Info.plist').read_bytes())
entry = contents / 'MacOS' / info['CFBundleExecutable']
native = str(contents / 'MacOS' / info['NOVAOriginalExecutable'])
# Reserve the existing Audio Helper port with a real listening socket. It is
# not a fake processing backend and returns no health/processing success.
legacy = socket.socket()
legacy.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
legacy.bind(('127.0.0.1', 8766)); legacy.listen(1)
try:
    child = subprocess.Popen([str(entry)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
except BaseException:
    legacy.close()
    raise
started = time.monotonic()
owned = []
output = b''
selector = selectors.DefaultSelector()
selector.register(child.stdout, selectors.EVENT_READ)
try:
    while time.monotonic() - started < 240:
        if child.poll() is not None: raise RuntimeError('App exited before native startup: ' + child.stderr.read(4096).decode(errors='replace'))
        lines = subprocess.check_output(['/bin/ps', '-axo', 'pid=,ppid=,command='], text=True).splitlines()
        owned = [line.strip() for line in lines if len(line.split(None, 2)) == 3 and line.split(None, 2)[1] == str(child.pid)]
        if selector.select(.1):
            output += os.read(child.stdout.fileno(), 4096)
            if len(output) > 16384: raise ValueError('Native readiness output budget')
        if any(native in line for line in owned) and b'NOVA_PACKAGE_NATIVE_SAVE_API_READY\n' in output:
            with urllib.request.urlopen('http://127.0.0.1:8765/__nova_generation/status', timeout=3) as response:
                status = json.load(response)
            if not status['composer'] or not status['singer']: raise ValueError('Incomplete packaged engine')
            break
        time.sleep(.2)
    else: raise TimeoutError('Native package startup deadline')
    child.send_signal(signal.SIGTERM)
    try:
        child.wait(timeout=45)
    except subprocess.TimeoutExpired as error:
        while selector.select(0):
            chunk = os.read(child.stdout.fileno(), 4096)
            if not chunk: break
            output += chunk
        raise RuntimeError('Native save-gated exit failed: ' + output[-4096:].decode(errors='replace')) from error
    if child.returncode != 0: raise RuntimeError('App launcher did not stop cleanly')
    try:
        urllib.request.urlopen('http://127.0.0.1:8765/__nova_generation/status', timeout=1)
    except OSError: pass
    else: raise RuntimeError('Owned engine survived launcher shutdown')
    print(json.dumps({'app':str(app),'entry':str(entry),'nativeWrapper':native,
                      'ownedChildren':owned,'packageEngineStartup':True,
                      'nativeProcessStarted':True,'nativeDocumentLoaded':True,'nativeSaveAPIReady':True,'ownedShutdown':True,
                      'generationOrigin':'http://127.0.0.1:8765','legacyAudioPort8766Occupied':True,
                      'saveOnClose':'UNVERIFIED: signal shutdown without edits',
                      'physicalAcceptance':False}, indent=2))
finally:
    if child.poll() is None:
        child.terminate()
        try: child.wait(timeout=12)
        except subprocess.TimeoutExpired: child.kill(); child.wait()
    selector.close(); child.stdout.close(); child.stderr.close(); legacy.close()
