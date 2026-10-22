"""Own package engine and native UI until normal application exit.

Uses the existing Studio save-on-close contract. No developer fallback, PATH
Python, network installation, external provider or implicit TLS trust changes.
"""
import os
from pathlib import Path
import plistlib
import selectors
import signal
import subprocess
import sys
import threading
import time

CODE = Path(__file__).resolve().parent
CONTENTS = CODE.parents[2]
ORIGIN = 'http://127.0.0.1:8766'


def stop(child):
    if child is None or child.poll() is not None: return
    child.terminate()
    try: child.wait(timeout=6)
    except subprocess.TimeoutExpired:
        child.kill(); child.wait(timeout=2)
        raise RuntimeError('Packaged child required forced shutdown')


def ready(child, timeout=240):
    deadline = time.monotonic() + timeout
    pending = b''
    with selectors.DefaultSelector() as selector:
        selector.register(child.stdout, selectors.EVENT_READ)
        while time.monotonic() < deadline:
            if child.poll() is not None: raise RuntimeError('Packaged engine exited before readiness')
            if not selector.select(.2): continue
            chunk = os.read(child.stdout.fileno(), 4096)
            if not chunk: raise RuntimeError('Packaged engine closed readiness channel')
            pending += chunk
            if len(pending) > 32768: raise ValueError('Engine readiness output budget')
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                if line.decode('utf-8', errors='strict') == ORIGIN + '/music-studio.html': return
    raise TimeoutError('Packaged engine readiness deadline')


def drain(stream):
    try:
        while stream.read(4096): pass
    finally: stream.close()


def main():
    if not sys.flags.isolated: raise ValueError('Isolated packaged interpreter required')
    runtime = (CONTENTS / 'Frameworks/Python').resolve(strict=True)
    Path(sys.executable).resolve(strict=True).relative_to(runtime)
    Path(sys.prefix).resolve(strict=True).relative_to(runtime)
    sys.path.insert(0, str(CODE))
    from package_integrity import verify
    verify(CONTENTS)
    info = plistlib.loads((CONTENTS / 'Info.plist').read_bytes())
    name = info['NOVAOriginalExecutable']
    if not isinstance(name, str) or Path(name).name != name or name in ('.', '..'):
        raise ValueError('Invalid native wrapper name')
    native = (CONTENTS / 'MacOS' / name).resolve(strict=True)
    native.relative_to(CONTENTS)
    env = {k: v for k, v in os.environ.items() if not k.startswith(('PYTHON', 'DYLD_', 'NOVA_'))}
    env['PATH'] = '/usr/bin:/bin'
    env['NOVA_PACKAGE_ENGINE_ORIGIN'] = ORIGIN
    engine = ui = None
    interrupted = [False]
    def interrupt(signum, frame):
        interrupted[0] = True
        if ui is not None and ui.poll() is None: ui.terminate()
        if engine is not None and engine.poll() is None: engine.terminate()
    old = {s: signal.signal(s, interrupt) for s in (signal.SIGINT, signal.SIGTERM)}
    try:
        engine = subprocess.Popen([str(CONTENTS / 'Helpers/MusicStudioEngine')],
                                  env=env, cwd=CONTENTS, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, start_new_session=True)
        ready(engine)
        threading.Thread(target=drain, args=(engine.stdout,), daemon=True).start()
        if interrupted[0]: raise InterruptedError('Startup interrupted')
        ui = subprocess.Popen([str(native)], env=env, cwd=CONTENTS, start_new_session=True)
        # Engine failure never kills an editor holding unsaved data. Generation
        # becomes unavailable; existing editing/save remains usable until exit.
        result = ui.wait()
        if result and not interrupted[0]: raise RuntimeError('Native wrapper exited with status ' + str(result))
    finally:
        try: stop(ui)
        finally:
            try: stop(engine)
            finally:
                for sig, callback in old.items(): signal.signal(sig, callback)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('Music Studio package refused: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
