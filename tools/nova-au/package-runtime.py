"""Assemble actual Intel AU runtime; build-time network only, never installs.

Reuses the fixed Music Studio Python acquisition/notice and Mach-O relocation
code, without its wheels/models. FFmpeg is built from a fixed upstream commit
with shared LGPL libraries and only PCM WAV / ebur128 metering enabled.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/music-local-generation'))
from build_intel_app import (PYTHON_URL, PYTHON_SHA, download, runtime_notices,
                            relocate, files_manifest)
FFMPEG_COMMIT = 'db69d06eeeab4f46da15030a80d539efb4503ca8'
FFMPEG_URL = 'https://github.com/FFmpeg/FFmpeg.git'
CONFIG = ['--disable-autodetect', '--disable-gpl', '--disable-nonfree',
          '--disable-version3', '--disable-static', '--enable-shared',
          '--disable-doc', '--disable-debug', '--disable-everything',
          '--disable-network', '--disable-x86asm', '--disable-avdevice',
          '--disable-postproc', '--disable-swscale', '--disable-videotoolbox',
          '--disable-audiotoolbox', '--enable-ffmpeg', '--enable-ffprobe',
          '--enable-protocol=file', '--enable-demuxer=wav', '--enable-muxer=null',
          '--enable-decoder=pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le',
          '--enable-encoder=pcm_s16le', '--enable-filter=ebur128,aformat,anull,aresample',
          '--cc=clang', '--arch=x86_64', '--target-os=darwin',
          '--extra-cflags=-mmacosx-version-min=12.0',
          '--extra-ldflags=-mmacosx-version-min=12.0 -Wl,-headerpad_max_install_names']


def run(*args, **kw):
    return subprocess.run(list(map(str, args)), check=True, **kw)


def assemble(bundle, work):
    if platform.system() != 'Darwin' or platform.machine() != 'x86_64':
        raise ValueError('actual Intel macOS required')
    bundle, work = bundle.resolve(strict=True), work.resolve()
    work.mkdir(exist_ok=False)
    contents = bundle / 'Contents'
    runtime = contents / 'Resources/Runtime'
    runtime.mkdir(exist_ok=False)
    notices = runtime / 'Notices'
    notices.mkdir()
    archive = work / 'python.tar.zst'
    download(PYTHON_URL, archive, PYTHON_SHA)
    with (work / 'python.tar').open('wb') as output:
        run('zstd', '-d', '-c', archive, stdout=output)
    with tarfile.open(work / 'python.tar') as tar:
        tar.extractall(work / 'python', filter='data')
    source = work / 'python/python'
    shutil.copytree(source / 'install', runtime / 'Python', symlinks=True)
    runtime_notices(source, notices / 'Python')
    python = runtime / 'Python'
    # No pip, wheels, headers, compiler objects or build-time console entrypoints.
    for name in ('include', 'share'):
        shutil.rmtree(python / name, ignore_errors=True)
    for path in list((python / 'bin').iterdir()):
        if path.name not in ('python3.12', 'python3', 'python'):
            path.unlink()
    for pattern in ('*.a', '*.o', '*.pyc'):
        for path in python.rglob(pattern): path.unlink()
    for path in sorted(python.rglob('__pycache__'), reverse=True):
        shutil.rmtree(path)
    site = python / 'lib/python3.12/site-packages'
    if site.exists(): shutil.rmtree(site)
    site.mkdir()
    ffsource = work / 'ffmpeg-source'
    run('git', 'clone', '--depth', '1', '--branch', 'n7.1.1', FFMPEG_URL, ffsource)
    revision = subprocess.check_output(['git', '-C', str(ffsource), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != FFMPEG_COMMIT: raise ValueError('FFmpeg upstream revision changed')
    # Ship corresponding unmodified source, configuration and library headers;
    # rebuilding shared libraries permits replacement/relinking independently.
    with (notices / 'ffmpeg-source.tar').open('wb') as output:
        run('git', '-C', ffsource, 'archive', '--format=tar', 'HEAD', stdout=output)
    ff = runtime / 'FFmpeg'
    run('./configure', '--prefix=' + str(ff), *CONFIG, cwd=ffsource)
    run('make', '-j3', cwd=ffsource)
    run('make', 'install', cwd=ffsource)
    for name in ('COPYING.LGPLv2.1', 'LICENSE.md', 'CREDITS'):
        shutil.copy2(ffsource / name, notices / name)
    shutil.copy2(ffsource / 'ffbuild/config.log', notices / 'ffmpeg-config.log')
    (notices / 'BUILD.json').write_text(json.dumps(dict(pythonUrl=PYTHON_URL,
        pythonArchiveSha256=PYTHON_SHA, ffmpegUrl=FFMPEG_URL,
        ffmpegCommit=revision, ffmpegSourceSha256=hashlib.sha256((notices/'ffmpeg-source.tar').read_bytes()).hexdigest(),
        configure=CONFIG, sharedLibraries=True, publicationEligible=False), indent=2))
    # Reuse bounded Mach-O parser/closure relocation. No Homebrew dylib copying.
    images = relocate(contents)
    for name in images:
        run('/usr/bin/codesign', '--force', '--sign', '-', contents / name)
    env = {'PATH': '/nonexistent', 'LANG': 'en_US.UTF-8'}
    exe = python / 'bin/python3.12'
    probe = 'import sys,json,hashlib,struct,wave,fcntl,subprocess,resource,math; print(json.dumps(dict(version=sys.version,executable=sys.executable,prefix=sys.prefix,path=sys.path)))'
    output = subprocess.check_output([str(exe), '-I', '-B', '-c', probe], env=env, text=True)
    (notices / 'python-probe.json').write_text(output)
    for tool in ('ffmpeg', 'ffprobe'):
        for flag in ('-version', '-buildconf', '-L'):
            (notices / (tool + flag + '.txt')).write_text(subprocess.check_output([str(ff/'bin'/tool), flag], env=env, text=True, stderr=subprocess.STDOUT))
    manifest = dict(format='nova-contained-runtime-v1', python='Python/bin/python3.12',
        ffmpeg='FFmpeg/bin/ffmpeg', ffprobe='FFmpeg/bin/ffprobe',
        architecture='x86_64', pythonVersion='3.12.15', ffmpegVersion='7.1.1',
        files=files_manifest(runtime), nativeImages=images,
        signed='ad-hoc development only', notarized=False, publicationEligible=False)
    (runtime / 'inventory.json').write_text(json.dumps(manifest, indent=2))
    run('/usr/bin/codesign', '--force', '--sign', '-', bundle)
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', bundle)
    print(json.dumps(dict(bundle=str(bundle), files=len(manifest['files']), publicationEligible=False)))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('bundle', type=Path)
    p.add_argument('work', type=Path)
    a = p.parse_args()
    assemble(a.bundle, a.work)
