"""Explicit setup only: fetch fixed licensed assets, verify, build Sinsy locally.
Run in a fresh destination. No download happens from serve.py or compose.py.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import tarfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent

def download(url, path, expected):
    with urllib.request.urlopen(url, timeout=120) as response, path.open('xb') as target:
        shutil.copyfileobj(response, target)
    with path.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected: raise ValueError('download identity mismatch: ' + path.name)


def prepare(destination):
    dest = Path(destination).resolve(); dest.mkdir(parents=True, exist_ok=False)
    models = json.loads((HERE / 'model-lock.json').read_text()); sources = json.loads((HERE / 'source-lock.json').read_text())
    weights = dest / 'weights'; weights.mkdir()
    for name, info in models['files'].items():
        remote = 'onnx/' + name if name.endswith('.onnx') else name
        download(f"https://huggingface.co/{models['model']}/resolve/{models['revision']}/{remote}", weights / name, info['sha256'])
    for name in ['hts', 'sinsy', 'voice']:
        archive = dest / (name + '.tar.gz'); info = sources[name]
        download(info['url'], archive, info['sha256'])
        with tarfile.open(archive) as tar: tar.extractall(dest, filter='data')
    # Sinsy 0.92 predates current Apple libc++ forwarding-reference make_pair.
    # Deduce the types, preserving the exact string pair and insertion behavior.
    # The upstream archive remains SHA-256 locked; record this local modification.
    source_file = dest / 'sinsy-0.92/lib/util/Configurations.cpp'
    original = 'std::make_pair<std::string, std::string>(key, value)'
    source_text = source_file.read_text()
    if source_text.count(original) != 1: raise ValueError('Sinsy portability patch context mismatch')
    source_file.write_text(source_text.replace(original, 'std::make_pair(key, value)'))
    runtime = dest / 'runtime'
    for source, extra in [('hts_engine_API-1.10', []), ('sinsy-0.92', ['CXXFLAGS=-O2 -std=gnu++98', f'--with-hts-engine-header-path={runtime}/include', f'--with-hts-engine-library-path={runtime}/lib'])]:
        subprocess.run(['./configure', f'--prefix={runtime}', *extra], cwd=dest / source, check=True)
        subprocess.run(['make', '-j2'], cwd=dest / source, check=True)
        subprocess.run(['make', 'install'], cwd=dest / source, check=True)
    notices = dest / 'notices'; notices.mkdir()
    (notices / 'Sinsy-local-modifications.txt').write_text('Project NOVA, 2026-10-17: Sinsy 0.92 lib/util/Configurations.cpp: deduce std::make_pair types for modern Apple libc++ compatibility. Upstream copyright and Modified BSD terms unchanged.\n')
    for p in (HERE / 'vendor').iterdir():
        if 'COPYING' in p.name or 'LICENSE' in p.name or 'README' in p.name: shutil.copy2(p, notices / p.name)
    print('Assets prepared. Start with explicit --weights, --sinsy, --dictionary and --voice paths; see README.')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('destination'); prepare(p.parse_args().destination)
