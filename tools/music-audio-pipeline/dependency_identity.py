"""Minimal installed metadata and explicit local byte evidence; no downloads or path disclosure."""
import hashlib
import importlib.metadata
import platform
import sys
from pathlib import Path

PACKAGES = ('setuptools', 'demucs', 'basic-pitch', 'mido', 'librosa', 'soundfile', 'numpy', 'torch', 'torchaudio')

def observe_packages(version=importlib.metadata.version):
    entries = []
    for name in PACKAGES:
        try:
            entries.append({'id': name, 'version': version(name), 'status': 'OBSERVED_METADATA'})
        except importlib.metadata.PackageNotFoundError:
            entries.append({'id': name, 'version': None, 'status': 'MISSING'})
    return {'status': 'UNVERIFIED', 'pythonVersion': sys.version.split()[0],
            'architecture': platform.machine(), 'entries': entries}

def verify_local_asset(root, relative, expected, max_bytes):
    # Digest/size/revision come from an externally authenticated manifest, never a filename.
    root = Path(root).resolve()
    path = root / relative
    if Path(relative).is_absolute() or '..' in Path(relative).parts or path.is_symlink():
        raise ValueError('unsafe-asset-path')
    path = path.resolve()
    if not path.is_relative_to(root):
        raise ValueError('unsafe-asset-path')
    if not path.is_file():
        raise ValueError('missing-model-or-native-asset')
    size = path.stat().st_size
    if size != expected['byteLength'] or size > max_bytes:
        raise ValueError('asset-size-or-budget-mismatch')
    value = hashlib.sha256()
    observed = 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            observed += len(chunk)
            if observed > max_bytes or observed > size:
                raise ValueError('asset-size-or-budget-mismatch')
            value.update(chunk)
    if observed != size or value.hexdigest() != expected['digest']:
        raise ValueError('asset-digest-mismatch')
    return dict(expected)

def validate_dependencies(expected, actual):
    """Exact versions and externally observed artifact digests; metadata alone cannot pass."""
    if not isinstance(expected, list) or not isinstance(actual, list):
        raise ValueError('invalid-dependency-inventory')
    expected_ids = [entry['id'] for entry in expected]
    actual_ids = [entry['id'] for entry in actual]
    if len(set(expected_ids)) != len(expected_ids) or len(set(actual_ids)) != len(actual_ids):
        raise ValueError('duplicate-dependency')
    if set(expected_ids) != set(actual_ids):
        raise ValueError('missing-or-unexpected-dependency')
    by_id = {entry['id']: entry for entry in actual}
    for entry in expected:
        observed = by_id[entry['id']]
        if observed.get('version') != entry['version']:
            raise ValueError('wrong-dependency-version')
        if not entry.get('digest') or observed.get('digest') != entry['digest']:
            raise ValueError('wrong-native-or-package-artifact')
    return True
