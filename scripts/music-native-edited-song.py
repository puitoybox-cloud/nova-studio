"""Four separate actual Intel app launches; isolated persistent WebKit profiles.

Requires an explicitly instrumented CI candidate. No test scripts are accepted by
normal app builds. Only the existing six-note MIDI fixture is imported/edited.
"""
import base64
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
app = Path(sys.argv[1]).resolve(strict=True)
report = Path(sys.argv[2])
contents = app / 'Contents'
inventory = json.loads((contents / 'Resources/package-candidate.json').read_text())
assert inventory.get('nativeAcceptanceInstrumentation') is True, 'CI-only candidate required'
info = plistlib.loads((contents / 'Info.plist').read_bytes())
entry = contents / 'MacOS' / info['CFBundleExecutable']
profile, recovery_profile = str(uuid.uuid4()), str(uuid.uuid4())
project_id = 'native-ci-' + str(uuid.uuid4())
source = (ROOT / 'scripts/music-native-edited-song.js').read_text()
prior = None
results = []
with tempfile.TemporaryDirectory(prefix='nova-native-acceptance-') as tmp:
    tmp = Path(tmp)
    for phase in ('write', 'edit', 'read', 'restore'):
        data = {'phase': phase, 'id': project_id}
        if phase == 'write':
            data['midi'] = base64.b64encode((ROOT / 'tools/music-audio-pipeline/fixtures/observed_six_notes_stems.mid').read_bytes()).decode()
        else:
            data.update({k: prior[k] for k in ('expected', 'audio')})
            if phase == 'restore':
                data['archive'] = prior['archive']
        script, output = tmp / (phase + '.js'), tmp / (phase + '.json')
        script.write_text(source + '\nreturn await runNativeEditedSong(' + json.dumps(data) + ');\n')
        env = dict(os.environ, NOVA_NATIVE_ACCEPTANCE_SCRIPT=str(script),
                   NOVA_NATIVE_ACCEPTANCE_RESULT=str(output),
                   NOVA_NATIVE_ACCEPTANCE_STORE=recovery_profile if phase == 'restore' else profile)
        with (tmp / (phase + '.stdout')).open('w+') as stdout, (tmp / (phase + '.stderr')).open('w+') as stderr:
            child = subprocess.Popen([str(entry)], env=env, stdout=stdout, stderr=stderr)
            try:
                deadline = time.monotonic() + 300
                while not output.exists():
                    stdout.flush(); stdout.seek(0); events = stdout.read()
                    if child.poll() is not None or 'NATIVE_ACCEPTANCE_FAILED' in events:
                        stderr.seek(0)
                        raise RuntimeError('Native edited-song ' + phase + ' failed: ' + events[-4096:] + stderr.read()[-4096:])
                    if time.monotonic() >= deadline:
                        stderr.seek(0)
                        raise TimeoutError('Native edited-song ' + phase + ' deadline: ' + events[-4096:] + stderr.read()[-4096:])
                    time.sleep(.1)
                prior = json.loads(output.read_text())
                assert prior['phase'] == phase and not prior['console'] and not prior['external']
                child.send_signal(signal.SIGTERM)
                assert child.wait(timeout=45) == 0, 'Native save-gated exit failed'
                stdout.seek(0); events = stdout.read()
                assert 'NOVA_PACKAGE_CLOSE_SAVED' in events, 'Native close save acknowledgement missing'
                try:
                    urllib.request.urlopen('http://127.0.0.1:8765/__nova_generation/status', timeout=1)
                except urllib.error.URLError:
                    pass
                else:
                    raise RuntimeError('Owned engine survived full app exit')
                results.append({k: prior[k] for k in ('phase', 'id', 'origin', 'revision', 'noteCount', 'console', 'external')})
                results[-1].update(pid=child.pid, saveGatedExit=True, engineStopped=True)
            finally:
                if child.poll() is None:
                    child.terminate()
                    try: child.wait(timeout=15)
                    except subprocess.TimeoutExpired: child.kill(); child.wait(timeout=5)
        # Preserve a small reviewable checkpoint even if a later phase fails.
        report.write_text(json.dumps({'phases': results, 'complete': phase == 'restore',
                                     'separateRecoveryProfile': recovery_profile != profile,
                                     'instrumentedNativeCI': True, 'physicalAcceptance': False}, indent=2))
print(report.read_text())
