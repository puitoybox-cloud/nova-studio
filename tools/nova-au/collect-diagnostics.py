#!/usr/bin/env python3
"""Read-only AU diagnostics; creates a new report folder, never installs or repairs."""
import argparse
import json
import platform
import subprocess
from pathlib import Path


def collect(output):
    output = Path(output)
    roots = [Path.home() / 'Library/Audio/Plug-Ins/Components', Path('/Library/Audio/Plug-Ins/Components')]
    destination = output.resolve()
    if any(destination == r.resolve() or r.resolve() in destination.parents for r in roots):
        raise ValueError('report must be outside Components')
    if platform.system() != 'Darwin':
        raise ValueError('requires macOS; no simulated native success')
    output.mkdir(exist_ok=False)
    commands = {
        'macos': ['/usr/bin/sw_vers'],
        'architecture': ['/usr/bin/uname', '-m'],
        'component-list': ['/usr/bin/auval', '-a'],
        'component-validation': ['/usr/bin/auval', '-v', 'aufx', 'NvMx', 'NvSt'],
        'registrar': ['/usr/bin/log', 'show', '--last', '10m', '--style', 'compact',
                      '--predicate', 'process == "AudioComponentRegistrar" AND (eventMessage CONTAINS "NovaMix" OR eventMessage CONTAINS "NvMx")'],
    }
    results = {}
    for name, command in commands.items():
        try:
            r = subprocess.run(command, capture_output=True, timeout=120)
            (output / (name + '.txt')).write_bytes(r.stdout + b'\nSTDERR:\n' + r.stderr)
            results[name] = {'exitCode': r.returncode, 'command': command}
        except (OSError, subprocess.TimeoutExpired) as error:
            results[name] = {'error': str(error), 'command': command}
    report = {'format': 'nova-au-diagnostics-v1', 'readOnly': True, 'installationPerformed': False,
              'logicPhysicalAcceptance': False, 'results': results,
              'note': 'Logs can contain local paths. Review before sharing. No cache/preference/quarantine/keychain changes.'}
    (output / 'diagnostics.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('new_report_directory', type=Path)
    args = parser.parse_args()
    print(json.dumps(collect(args.new_report_directory), ensure_ascii=False, indent=2))
