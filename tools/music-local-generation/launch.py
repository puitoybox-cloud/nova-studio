"""Launch an already prepared local runtime. Never installs or downloads assets."""
import argparse
import json
import os
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
    p.add_argument('assets', type=Path, nargs='?'); p.add_argument('--config', type=Path); p.add_argument('--port', type=int, default=8766)
    p.add_argument('--lan-ip'); p.add_argument('--tls-cert', type=Path); p.add_argument('--tls-key', type=Path)
    p.add_argument('--check', action='store_true', help='Validate paths and CPU dependencies without starting')
    args = p.parse_args()
    if args.config:
        if args.assets or any(getattr(args, k) for k in ('lan_ip', 'tls_cert', 'tls_key')) or args.port != 8766:
            p.error('--config cannot be combined with connection overrides')
        try:
            settings = json.loads(args.config.read_text())
            if not isinstance(settings, dict) or set(settings) - {'assets', 'port', 'lan_ip', 'tls_cert', 'tls_key'}:
                raise ValueError('unknown config keys')
            if not isinstance(settings.get('assets'), str) or not settings['assets']: raise ValueError('assets path required')
            for name in ('assets', 'tls_cert', 'tls_key'):
                if name not in settings: continue
                if not isinstance(settings[name], str) or not settings[name]: raise ValueError(name + ' path required')
                settings[name] = (args.config.resolve().parent / settings[name]).resolve()
            if 'lan_ip' in settings and not isinstance(settings['lan_ip'], str): raise ValueError('lan_ip string required')
            for key, value in settings.items(): setattr(args, key, value)
        except (ValueError, OSError) as error: p.error('Config（起動設定）: ' + str(error))
    if not args.assets: p.error('assets or --config required')
    from diagnostics import diagnose
    report = diagnose(args.assets, args.port, args.lan_ip, args.tls_cert, args.tls_key)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if not report['ok']: raise SystemExit(1)
    if args.check: return
    resolved = paths(args.assets)
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
