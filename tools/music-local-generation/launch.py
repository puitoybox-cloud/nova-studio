"""Launch an already prepared local runtime. Never installs or downloads assets."""
import argparse
import json
import os
import platform
import signal
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def paths(asset_root):
    root = Path(asset_root).resolve(strict=True)
    result = {'weights': root / 'weights', 'sinsy': root / 'runtime/bin/sinsy',
              'dictionary': root / 'runtime/dic',
              'voice': root / 'hts_voice_nitech_jp_song070_f001-0.90/nitech_jp_song070_f001.htsvoice'}
    for key, value in result.items():
        value.resolve(strict=True).relative_to(root)
        if key in ('weights', 'dictionary') and not value.is_dir(): raise ValueError(key + ' directory required')
        if key in ('sinsy', 'voice') and not value.is_file(): raise ValueError(key + ' file required')
    if not os.access(result['sinsy'], os.X_OK): raise ValueError('Sinsy is not executable')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('assets', type=Path); p.add_argument('--port', type=int, default=8766)
    p.add_argument('--lan-ip'); p.add_argument('--tls-cert', type=Path); p.add_argument('--tls-key', type=Path)
    p.add_argument('--check', action='store_true', help='Validate paths and CPU dependencies without starting')
    args = p.parse_args()
    if not 1024 <= args.port <= 65535: p.error('port outside bounds')
    resolved = paths(args.assets)
    import onnxruntime
    if 'CPUExecutionProvider' not in onnxruntime.get_available_providers(): raise RuntimeError('CPU provider unavailable')
    # Verify the fixed weights and voice before opening a network listener.
    from compose import digest
    for name, lock in json.loads((HERE / 'model-lock.json').read_text())['files'].items():
        if digest(resolved['weights'] / name) != lock['sha256']: raise ValueError('model identity mismatch: ' + name)
    if digest(resolved['voice']) != json.loads((HERE / 'source-lock.json').read_text())['voiceFile']['sha256']:
        raise ValueError('voice identity mismatch')
    subprocess.run([str(resolved['sinsy']), '-h'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10, check=True)
    print(json.dumps({'system': platform.system(), 'architecture': platform.machine(), 'cpuProvider': True,
                      'signedDistribution': False, 'assetsVerified': True}), flush=True)
    if args.check: return
    command = [sys.executable, str(HERE / 'serve.py'), '--port', str(args.port)]
    for key, value in resolved.items(): command += ['--' + key, str(value)]
    for key in ('lan_ip', 'tls_cert', 'tls_key'):
        if getattr(args, key): command += ['--' + key.replace('_', '-'), str(getattr(args, key))]
    child = subprocess.Popen(command, start_new_session=True)
    def stop(signum, frame):
        if child.poll() is None: os.killpg(child.pid, signal.SIGTERM)
    previous = {s: signal.signal(s, stop) for s in (signal.SIGINT, signal.SIGTERM)}
    try: returncode = child.wait()
    finally:
        stop(None, None)
        for sig, callback in previous.items(): signal.signal(sig, callback)
    if returncode: raise SystemExit(returncode)


if __name__ == '__main__': main()
