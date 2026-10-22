"""Build an unsigned Intel candidate with real, isolated runtime and fixed assets.

Explicit build-time acquisition only. Never publishes or signs a release. A failed
build leaves a .incomplete directory; the final .app appears only after validation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import shutil
import subprocess
import tarfile

from prepare import download, prepare

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PYTHON_URL = ('https://github.com/astral-sh/python-build-standalone/releases/download/20261021/'
              'cpython-3.12.15%2B20261021-x86_64-apple-darwin-pgo%2Blto-full.tar.zst')
PYTHON_SHA = '14dd4aea2051903a788519ca56328c3f9932fb505a57400d81fea4abe2870fc7'
# Permissive upstream terms. Their exact shipped texts are mandatory, preserved,
# and inventoried. This is not approval for unrelated audio/backend distributions.
RUNTIME_LICENSES = {'Python-2.0', 'CNRI-Python', 'bzip2-1.0.6', 'MIT', 'X11',
                    'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Zlib', 'TCL'}


def run(*args, **kw):
    subprocess.run(list(map(str, args)), check=True, **kw)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def runtime_notices(source, destination):
    metadata = json.loads((source / 'PYTHON.json').read_text())
    if metadata['target_triple'] != 'x86_64-apple-darwin' or metadata['python_version'] != '3.12.15':
        raise ValueError('Unexpected Python target')
    declarations = [metadata]
    for variants in metadata['build_info']['extensions'].values():
        declarations.extend(variants)
    paths = {metadata['license_path']}
    for item in declarations:
        if set(item.get('licenses', [])) - RUNTIME_LICENSES:
            raise ValueError('Unreviewed Python license')
        paths.update(item.get('license_paths', []))
    destination.mkdir(parents=True)
    for name in sorted(paths):
        path = (source / name).resolve(strict=True)
        path.relative_to(source.resolve())
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError('Missing runtime license text')
        shutil.copy2(path, destination / path.name)
    shutil.copy2(source / 'PYTHON.json', destination / 'PYTHON.json')


def files_manifest(contents):
    files = []
    for path in sorted(contents.rglob('*')):
        if path.is_symlink():
            path.resolve(strict=True).relative_to(contents.resolve())
            files.append({'path': path.relative_to(contents).as_posix(), 'symlink': os.readlink(path)})
        elif path.is_file():
            files.append({'path': path.relative_to(contents).as_posix(), 'byteLength': path.stat().st_size,
                          'sha256': digest(path), 'executable': bool(path.stat().st_mode & 0o111)})
    return files


def check_models(assets):
    for name, info in json.loads((HERE / 'model-lock.json').read_text())['files'].items():
        path = assets / 'weights' / name
        if path.stat().st_size != info['byteLength'] or digest(path) != info['sha256']:
            raise ValueError('Model identity mismatch: ' + name)


def verify_wheel_notices(runtime):
    site = runtime / 'lib/python3.12/site-packages'
    for wheel in json.loads((HERE / 'intel-wheels.json').read_text()):
        for notice in wheel['notices']:
            path = site / notice['path']
            path.resolve(strict=True).relative_to(runtime.resolve())
            if path.stat().st_size != notice['byteLength'] or digest(path) != notice['sha256']:
                raise ValueError('Changed/missing dependency notice: ' + notice['path'])


def build(work, output):
    if platform.system() != 'Darwin' or platform.machine() != 'x86_64':
        raise ValueError('Build requires native Intel macOS; no cross-platform success substitute')
    work, output = Path(work).resolve(), Path(output).resolve()
    work.mkdir(parents=True, exist_ok=False)
    if output.exists(): raise FileExistsError(output)
    staged = output.with_name(output.name + '.incomplete')
    if staged.exists(): raise FileExistsError(staged)
    archive = work / 'python.tar.zst'
    download(PYTHON_URL, archive, PYTHON_SHA)
    # Decompress with the build host's tool, never a shipped external dependency.
    tarpath = work / 'python.tar'
    with tarpath.open('wb') as target:
        run('/usr/bin/env', 'zstd', '-d', '-c', archive, stdout=target)
    with tarfile.open(tarpath) as tar:
        tar.extractall(work / 'python-source', filter='data')
    source = work / 'python-source/python'
    run('python3', ROOT / 'scripts/music-stage-native-web.py', ROOT / 'tools/music-native-wrapper/MusicStudioWeb')
    derived = work / 'native'
    run('xcodebuild', '-project', ROOT / 'tools/music-native-wrapper/MusicStudioNative.xcodeproj',
        '-scheme', 'MusicStudioMac', '-configuration', 'Release', '-derivedDataPath', derived,
        'ARCHS=x86_64', 'ONLY_ACTIVE_ARCH=NO', 'MACOSX_DEPLOYMENT_TARGET=13.0', 'CODE_SIGNING_ALLOWED=NO', 'build')
    app = derived / 'Build/Products/Release/Music Studio.app'
    shutil.copytree(app, staged, symlinks=True)
    contents = staged / 'Contents'
    runtime = contents / 'Frameworks/Python'
    shutil.copytree(source / 'install', runtime, symlinks=True)
    # Compiler-only objects/archives are not executable images and are not used
    # by this fixed wheel runtime. Do not feed MH_OBJECT files to codesign.
    for pattern in ('*.o', '*.a'):
        for item in runtime.rglob(pattern): item.unlink()
    runtime_notices(source, contents / 'Resources/Notices/Python')
    python = runtime / 'bin/python3'
    # Pinned direct requirements, wheel-only: native source builds are forbidden.
    # Full resolved wheel/notice identity is included in the resulting candidate.
    run(python, '-I', '-B', '-m', 'pip', 'install', '--only-binary=:all:',
        '--require-hashes', '--report', work / 'pip-install.json', '-r', HERE / 'intel-requirements.lock')
    run(python, '-I', '-B', '-m', 'pip', 'check')
    verify_wheel_notices(runtime)
    shutil.copy2(work / 'pip-install.json', contents / 'Resources/Notices/pip-install.json')
    shutil.copy2(HERE / 'vendor/Flatbuffers-LICENSE', contents / 'Resources/Notices/Flatbuffers-LICENSE')
    engine = contents / 'Resources/MusicStudioEngine'
    code = engine / 'code'
    shutil.copytree(HERE, code, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    assets = work / 'assets'
    prepare(assets)
    target = engine / 'assets'
    target.mkdir()
    for name in ('weights', 'runtime', 'hts_voice_nitech_jp_song070_f001-0.90', 'notices'):
        shutil.copytree(assets / name, target / name, symlinks=True)
    check_models(target)
    (contents / 'Helpers').mkdir(exist_ok=True)
    shutil.copy2(HERE / 'MusicStudioEngine', contents / 'Helpers/MusicStudioEngine')
    (contents / 'Helpers/MusicStudioEngine').chmod(0o755)
    # Remove build-local static headers/archives: they are not runtime dependencies.
    shutil.rmtree(target / 'runtime/include')
    for path in (target / 'runtime/lib').glob('*.a'): path.unlink()
    for path in (target / 'runtime/lib').glob('*.la'): path.unlink()
    plist = contents / 'Info.plist'
    info = plistlib.loads(plist.read_bytes())
    original = info['CFBundleExecutable']
    if Path(original).name != original or original in ('.', '..'): raise ValueError('Invalid native executable')
    native_name = original + '-Native'
    (contents / 'MacOS' / original).rename(contents / 'MacOS' / native_name)
    info['NOVAOriginalExecutable'] = native_name
    plist.write_bytes(plistlib.dumps(info))
    run('/usr/bin/clang', '-arch', 'x86_64', '-mmacosx-version-min=13.0', '-Wall', '-Wextra',
        HERE / 'native_launcher.c', '-o', contents / 'MacOS' / original)
    native = relocate(contents)
    files = files_manifest(contents)
    report = {'format': 'NOVA_INTEL_PACKAGE_CANDIDATE', 'version': 1,
              'buildRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'pythonSource': {'url': PYTHON_URL, 'sha256': PYTHON_SHA},
              'architecture': 'x86_64', 'files': files,
              'byteLength': sum(f.get('byteLength', 0) for f in files), 'nativeImages': native,
              'publicationEligible': False, 'signed': False, 'notarized': False,
              'licenseClosure': 'OPEN: NumPy linked GCC/LGPL source obligations require release review',
              'physicalAcceptance': 'UNVERIFIED', 'fullFeatureAcceptance': 'UNVERIFIED'}
    (contents / 'Resources/package-candidate.json').write_text(json.dumps(report, indent=2) + '\n')
    # Check after writing the manifest, using only the assembled interpreter.
    run(contents / 'Helpers/MusicStudioEngine', '--check')
    staged.rename(output)
    print(json.dumps({'app': str(output), 'byteLength': report['byteLength'], 'files': len(files),
                      'publicationEligible': False}))


def relocate(contents):
    """Rewrite only already bundled libraries; reject external non-Apple loads."""
    images = []
    for path in contents.rglob('*'):
        if path.is_symlink() or not path.is_file(): continue
        with path.open('rb') as stream: magic = stream.read(4)
        if magic not in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'):
            continue
        arch = subprocess.check_output(['/usr/bin/lipo', '-archs', str(path)], text=True).split()
        if 'x86_64' not in arch: raise ValueError('Non-Intel native image: ' + str(path))
        images.append(path)
    by_name = {}
    for image in images:
        by_name.setdefault(image.name, []).append(image)
    for alias in contents.rglob('*'):
        if alias.is_symlink() and alias.is_file():
            target = alias.resolve(strict=True)
            target.relative_to(contents.resolve())
            if target in images and alias.name not in by_name:
                by_name[alias.name] = [target]
    for image in images:
        lines = subprocess.check_output(['/usr/bin/otool', '-L', str(image)], text=True).splitlines()[1:]
        for line in lines:
            dep = line.strip().split(' (')[0]
            if dep.startswith(('/usr/lib/', '/System/Library/')): continue
            # Existing @loader_path / @rpath routes must resolve inside the package.
            if dep.startswith('@loader_path/'):
                resolved = (image.parent / dep[len('@loader_path/'):]).resolve(strict=True)
            else:
                matches = by_name.get(Path(dep).name, [])
                if len(matches) != 1: raise ValueError('Missing/ambiguous bundled native dependency: ' + dep)
                resolved = matches[0].resolve()
            resolved.relative_to(contents.resolve())
            new = '@loader_path/' + os.path.relpath(resolved, image.parent)
            if dep != new: run('/usr/bin/install_name_tool', '-change', dep, new, image)
        ids = subprocess.check_output(['/usr/bin/otool', '-D', str(image)], text=True).splitlines()[1:]
        if ids: run('/usr/bin/install_name_tool', '-id', '@loader_path/' + image.name, image)
        # Existing wheel/Python ad-hoc signatures are invalidated by relocation.
        # Ad-hoc signing grants no Developer ID or Gatekeeper/notarization trust.
        run('/usr/bin/codesign', '--force', '--sign', '-', image)
    return [str(p.relative_to(contents)) for p in images]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    build(args.work, args.output)
