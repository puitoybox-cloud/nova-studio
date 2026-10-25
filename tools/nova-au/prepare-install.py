#!/usr/bin/env python3
"""Read installed AU identities, verify candidate and stage a new reviewable kit.
Never writes to Components, Logic projects, caches, preferences or keychains.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

IDENTITY = ('aufx', 'NvMx', 'NvSt')
BUNDLE_ID = 'studio.nova.audio.NovaMix'


def inventory(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('bundle must be a real directory')
    rows = []
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise ValueError('symlink in AU bundle: ' + str(p))
        if p.is_file():
            digest = hashlib.sha256()
            with p.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
            rows.append({'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
                         'sha256': digest.hexdigest(), 'executable': bool(p.stat().st_mode & 0o111)})
        elif not p.is_dir():
            raise ValueError('unsupported bundle entry')
    return rows


def identity(bundle):
    with (bundle / 'Contents/Info.plist').open('rb') as stream:
        p = plistlib.load(stream)
    return p, [tuple(c.get(k) for k in ('type', 'subtype', 'manufacturer'))
               for c in p.get('AudioComponents', [])]


def scan(roots):
    matches, errors = [], []
    for root in roots:
        if not root.exists():
            continue
        if root.is_symlink() or not root.is_dir():
            errors.append(str(root) + ': unsafe Components directory')
            continue
        try:
            entries = sorted(root.iterdir())
        except OSError as error:
            errors.append(str(root) + ': ' + str(error))
            continue
        for bundle in entries:
            if bundle.suffix != '.component':
                continue
            try:
                p, components = identity(bundle)
                if IDENTITY in components or p.get('CFBundleIdentifier') == BUNDLE_ID or bundle.name == 'NovaMix.component':
                    matches.append({'path': str(bundle), 'version': p.get('CFBundleVersion'),
                                    'bundleId': p.get('CFBundleIdentifier'), 'components': components,
                                    'files': inventory(bundle)})
            except (OSError, ValueError, plistlib.InvalidFileException) as error:
                # An unreadable component could conceal a duplicate identity.
                errors.append(str(bundle) + ': ' + str(error))
    return matches, errors


def verify_runtime(candidate):
    root = Path(candidate) / 'Contents/Resources/Runtime'
    manifest = json.loads((root / 'inventory.json').read_text())
    if (manifest.get('format'), manifest.get('architecture')) != ('nova-contained-runtime-v1', 'x86_64'):
        raise ValueError('invalid contained runtime identity')
    expected = manifest.get('files')
    if not isinstance(expected, list) or not expected:
        raise ValueError('empty runtime inventory')
    actual = inventory(root)
    # The inventory itself is sealed by codesign and is intentionally not self-hashed.
    actual = [r for r in actual if r['path'] != 'inventory.json']
    normalized = [{'path': r['path'], 'sha256': r['sha256'], 'bytes': r['byteLength'], 'executable': r['executable']} for r in expected]
    if sorted(normalized, key=lambda r: r['path']) != actual:
        raise ValueError('contained runtime hash/permission/file-set mismatch')
    paths = {r['path']: r for r in actual}
    for field, fixed in (('python', 'Python/bin/python3.12'), ('ffmpeg', 'FFmpeg/bin/ffmpeg'), ('ffprobe', 'FFmpeg/bin/ffprobe')):
        if manifest.get(field) != fixed or fixed not in paths or not paths[fixed]['executable']:
            raise ValueError('contained executable missing or not executable: ' + field)
    return {'verifiedFiles': len(actual), 'architecture': 'x86_64', 'hashesAndPermissionsVerified': True}


def prepare(candidate, output, roots, native=True):
    candidate, output = Path(candidate).resolve(), Path(output).resolve()
    # A kit is never staged in an AU search path or inside its own source.
    for root in [candidate, *[Path(x).resolve() for x in roots]]:
        if output == root or root in output.parents:
            raise ValueError('kit destination must be outside source and Components')
    p, ids = identity(candidate)
    if p.get('CFBundleIdentifier') != BUNDLE_ID or ids != [IDENTITY] or p.get('LSMinimumSystemVersion') != '12.0':
        raise ValueError('unexpected AU identity/minimum OS')
    files = inventory(candidate)
    runtime = verify_runtime(candidate) if native else None
    required = {'Contents/MacOS/NovaMix', 'Contents/MacOS/nova-whole-song',
                'Contents/Resources/whole-song-runtime.json', 'Contents/Resources/AudioUnitSDK-LICENSE.txt'}
    if not required.issubset({r['path'] for r in files}):
        raise ValueError('incomplete development AU')
    validation = {'scope': 'portable-tests-only', 'signatureVerified': False, 'x86_64Verified': False}
    if native:
        if sys.platform != 'darwin':
            raise ValueError('native preflight requires macOS')
        for name in ('NovaMix', 'nova-whole-song'):
            binary = candidate / 'Contents/MacOS' / name
            subprocess.run(['/usr/bin/lipo', str(binary), '-verify_arch', 'x86_64'], check=True, capture_output=True)
            subprocess.run(['/usr/bin/codesign', '--verify', '--strict', str(binary)], check=True, capture_output=True)
        subprocess.run(['/usr/bin/codesign', '--verify', '--strict', str(candidate)], check=True, capture_output=True)
        validation = {'scope': 'development-ad-hoc-only', 'signatureVerified': True, 'x86_64Verified': True}
    matches, errors = scan(roots)
    report = {'format': 'nova-au-install-kit-v1', 'candidateVersion': p.get('CFBundleVersion'),
              'component': IDENTITY, 'minimumMacOS': '12.0', 'logicVersion': None,
              'logicCompatibilityVerified': False, 'installed': matches, 'scanErrors': errors,
              'manualInstallationAllowed': not matches and not errors, 'validation': validation,
              'files': files, 'runtime': ('bundled Python/FFmpeg candidate; inspect exact-head package-only acceptance' if (candidate / 'Contents/Resources/Runtime/inventory.json').is_file() else 'runtime not bundled; whole-song execution unavailable'),
              'runtimeVerification': runtime, 'installationPerformed': False}
    # Exclusive mkdir prevents replacing a previous kit/receipt; no mutation of installed AU.
    output.mkdir(parents=False, exist_ok=False)
    try:
        staged = output / 'NovaMix.component'
        shutil.copytree(candidate, staged, symlinks=False)
        if native:
            verify_runtime(staged)
        if inventory(staged) != files or inventory(candidate) != files:
            raise ValueError('source changed or staged hash mismatch')
        (output / 'preflight.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    except BaseException:
        # Preserve partial kit for diagnosis; never treat it as installable.
        (output / 'INCOMPLETE').touch()
        raise
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('component', type=Path)
    parser.add_argument('new_kit_directory', type=Path)
    args = parser.parse_args()
    roots = [Path.home() / 'Library/Audio/Plug-Ins/Components', Path('/Library/Audio/Plug-Ins/Components')]
    result = prepare(args.component, args.new_kit_directory, roots)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # Conflict does not invalidate the candidate kit, but blocks normal installation.
    return 0 if result['manualInstallationAllowed'] else 2


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print('NOVA AU preflight failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
