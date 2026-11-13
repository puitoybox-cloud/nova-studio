"""Offline candidate byte validation; not a signature or release-policy approval."""
import hashlib
import json
import os
from pathlib import Path


def verify(contents):
    contents = Path(contents).resolve(strict=True)
    manifest = contents / 'Resources/package-candidate.json'
    report = json.loads(manifest.read_text())
    if report.get('format') != 'NOVA_INTEL_PACKAGE_CANDIDATE' or report.get('version') != 1:
        raise ValueError('Unknown package inventory')
    expected = {'Resources/package-candidate.json'}
    rows = report.get('files')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 100000:
        raise ValueError('Package inventory budget')
    for row in rows:
        name = row['path']
        if not isinstance(name, str) or name in expected or Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Invalid package inventory path')
        expected.add(name)
        path = contents / name
        path.resolve(strict=True).relative_to(contents)
        if 'symlink' in row:
            if not path.is_symlink() or os.readlink(path) != row['symlink']:
                raise ValueError('Package symlink mismatch: ' + name)
        else:
            if path.is_symlink() or not path.is_file() or path.stat().st_size != row['byteLength']:
                raise ValueError('Package file mismatch: ' + name)
            with path.open('rb') as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != row['sha256']:
                    raise ValueError('Package digest mismatch: ' + name)
            if bool(path.stat().st_mode & 0o111) != row['executable']:
                raise ValueError('Package permissions mismatch: ' + name)
    actual = {p.relative_to(contents).as_posix() for p in contents.rglob('*') if p.is_file() or p.is_symlink()}
    if actual != expected: raise ValueError('Uninventoried package files')
    return report
