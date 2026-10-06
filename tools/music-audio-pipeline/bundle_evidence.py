"""Read-only packaging evidence. Never imports ML packages or grants eligibility."""
import argparse
import hashlib
import importlib.metadata
import json
import platform
import re
import sys
from pathlib import Path

DEPENDENCIES = ('basic-pitch', 'demucs', 'torch', 'torchaudio', 'numpy', 'mido',
                'librosa', 'soundfile', 'scipy', 'julius', 'pretty-midi',
                'onnxruntime', 'tensorflow', 'soxr', 'numba', 'cffi', 'setuptools')
MODEL_SUFFIXES = {'.onnx', '.pt', '.pth', '.th', '.ckpt', '.tflite'}
NATIVE_SUFFIXES = {'.so', '.dylib', '.dll', '.pyd'}


def identity(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        return {'status': 'UNVERIFIED', 'reason': 'not-regular-file'}
    before = path.stat()
    digest = hashlib.sha256(); length = 0
    with path.open('rb') as stream:
        while chunk := stream.read(65536):
            digest.update(chunk); length += len(chunk)
    after = path.stat()
    stamp = lambda st: (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)
    if stamp(before) != stamp(after) or length != before.st_size:
        return {'status': 'UNVERIFIED', 'reason': 'changed-during-read'}
    return {'status': 'OBSERVED_DISK_BYTES', 'byteLength': length, 'sha256': digest.hexdigest()}


def package_files(root):
    """Inspect an explicit caller-selected package only; do not follow symlinks."""
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('explicit-regular-package-directory-required')
    entries = []
    def visit(directory):
        for path in sorted(directory.iterdir()):
            relative = str(path.relative_to(root))
            if path.is_symlink():
                entries.append({'path': relative, 'status': 'UNVERIFIED', 'reason': 'symlink-not-followed'})
            elif path.is_dir():
                visit(path)
            elif path.is_file():
                with path.open('rb') as stream:
                    header = stream.read(4)
                kind = ('MODEL_CANDIDATE' if path.suffix.lower() in MODEL_SUFFIXES else
                        'NATIVE_CANDIDATE' if path.suffix.lower() in NATIVE_SUFFIXES or
                        header in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xca\xfe\xba\xbf', b'\x7fELF') else
                        'SCRIPT' if header.startswith(b'#!') else 'RESOURCE')
                entries.append({'path': relative, 'kind': kind, 'architecture': 'UNKNOWN',
                                'productionReachability': 'UNVERIFIED', **identity(path)})
    visit(root)
    return entries


def distributions(names=DEPENDENCIES, lookup=importlib.metadata.distribution):
    entries = []
    for name in names:
        try:
            dist = lookup(name)
        except importlib.metadata.PackageNotFoundError:
            entries.append({'name': name, 'scope': 'TEST_ONLY', 'status': 'MISSING', 'license': 'LICENSE_UNCONFIRMED'})
            continue
        metadata = dist.metadata
        files = []; licenses = []; payloads = []
        for relative in sorted(dist.files or [], key=str):
            text = str(relative); path = Path(dist.locate_file(relative))
            filename = path.name.lower()
            is_license = bool(re.search(r'(^|[/_.-])(license|licence|notice|copying|copyright)([/_.-]|$)', text.lower()))
            is_metadata = filename in {'metadata', 'wheel', 'record'}
            is_payload = path.suffix.lower() in MODEL_SUFFIXES | NATIVE_SUFFIXES
            if is_license or is_metadata or is_payload:
                item = {'path': text, **identity(path)}
                if is_license: licenses.append(item)
                elif is_payload: payloads.append(item)
                else: files.append(item)
        license_text = metadata.get('License', '')
        entries.append({'name': name, 'version': dist.version, 'scope': 'TEST_ONLY', 'status': 'PRESENT',
                        'license': 'LOCAL_EVIDENCE_PRESENT' if licenses or license_text or metadata.get('License-Expression') else 'LICENSE_UNCONFIRMED',
                        'licenseExpression': metadata.get('License-Expression'),
                        'licenseFieldSummary': license_text.splitlines()[0][:160] if license_text else None,
                        'licenseFieldSha256': hashlib.sha256(license_text.encode()).hexdigest() if license_text else None,
                        'licenseClassifiers': [v for v in metadata.get_all('Classifier', []) if v.startswith('License ::')],
                        'requiresDist': list(dist.requires or []),
                        'dependencyMarkerEvaluation': 'NOT_EVALUATED',
                        'metadataFiles': files, 'licenseFiles': licenses, 'payloadCandidates': payloads,
                        'redistributionApproved': False, 'productionReachability': 'UNVERIFIED'})
    return entries


def report(package_root=None, scope='TEST_ONLY'):
    # The interpreter running this diagnostic is not an installed product runtime.
    result = {'scope': scope, 'publicationEligible': False, 'approvedAnchor': False,
              'runtimeDependencyClosure': 'UNVERIFIED', 'modelsLoaded': False,
              'interpreter': {'version': platform.python_version(), 'platform': platform.system(),
                              'machine': platform.machine(), 'scope': 'DIAGNOSTIC_INTERPRETER_ONLY',
                              **identity(Path(sys.executable).resolve())},
              'distributions': distributions()}
    if package_root is not None:
        result['packageFiles'] = package_files(package_root)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-root', type=Path)
    parser.add_argument('--scope', choices=('TEST_ONLY', 'PACKAGE_OBSERVATION'), default='TEST_ONLY')
    args = parser.parse_args()
    print(json.dumps(report(args.package_root, args.scope), indent=2))
