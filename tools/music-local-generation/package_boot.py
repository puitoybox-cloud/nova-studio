"""Entry point for an approved app-contained engine; never uses PATH Python.

Layout: Contents/Frameworks/Python, Resources/MusicStudioEngine/{code,assets}.
Assembly/redistribution approval and signing remain the existing assembler's job.
"""
import importlib.util
import os
import platform
import sys
from pathlib import Path


def contained(root, path, directory=False):
    resolved = path.resolve(strict=True)
    resolved.relative_to(root)
    if not (resolved.is_dir() if directory else resolved.is_file()):
        raise ValueError('Invalid package path: ' + str(path))
    return resolved


def prepare(code, executable=None, prefix=None):
    code = Path(code).resolve(strict=True)
    contents = code.parents[2]
    if code != contents / 'Resources/MusicStudioEngine/code' or contents.name != 'Contents':
        raise ValueError('Invalid engine bundle layout')
    runtime = contained(contents, contents / 'Frameworks/Python', True)
    contained(runtime, Path(executable or sys.executable))
    contained(runtime, Path(prefix or sys.prefix), True)
    assets = contained(contents, code.parent / 'assets', True)
    # No inherited Python/dyld injection, user packages, or developer asset overrides.
    for key in list(os.environ):
        if key.startswith(('PYTHON', 'DYLD_', 'NOVA_MODEL_', 'NOVA_SINSY')):
            del os.environ[key]
    os.environ['PYTHONNOUSERSITE'] = '1'
    os.environ['PATH'] = '/usr/bin:/bin'
    for entry in sys.path:
        if entry:
            candidate = Path(entry).resolve()
            candidate.relative_to(contents)
            if candidate.exists() and not (candidate.is_dir() or candidate.suffix == '.zip'):
                raise ValueError('Invalid Python search path')
    for name in ('onnxruntime', 'numpy', 'PIL'):
        spec = importlib.util.find_spec(name)
        if spec is None or not spec.origin:
            raise ValueError('Missing packaged dependency: ' + name)
        contained(runtime, Path(spec.origin))
    contained(contents, contents / 'Resources/MusicStudioWeb/music-studio.html')
    return assets


def main():
    if platform.system() != 'Darwin' or platform.machine() != 'x86_64':
        raise ValueError('Packaged engine requires Intel macOS')
    if not sys.flags.isolated:
        raise ValueError('Packaged engine requires isolated Python')
    code = Path(__file__).resolve().parent
    assets = prepare(code)
    # Fixed local module; do not trust an installed module with the same name.
    spec = importlib.util.spec_from_file_location('nova_package_integrity', code / 'package_integrity.py')
    integrity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(integrity)
    integrity.verify(code.parents[2])
    # These are connection settings only; asset/runtime paths cannot be overridden.
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--lan-ip')
    parser.add_argument('--tls-cert')
    parser.add_argument('--tls-key')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    sys.path.insert(0, str(code))
    import launch
    sys.argv = [str(code / 'launch.py'), str(assets), '--port', str(args.port)]
    for name in ('lan_ip', 'tls_cert', 'tls_key'):
        if getattr(args, name):
            sys.argv += ['--' + name.replace('_', '-'), getattr(args, name)]
    if args.check:
        sys.argv += ['--check']
    launch.main()


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, ImportError) as error:
        print('Packaged engine refused: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
