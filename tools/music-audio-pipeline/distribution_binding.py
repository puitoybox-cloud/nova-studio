"""Externally supplied trust boundary. No signature scheme or implicit trust in local JSON."""
import hashlib
import json
from pathlib import Path

def load_manifest(path, trusted_digest, expected_build, max_bytes=65536):
    if not isinstance(trusted_digest, str) or len(trusted_digest) != 64 or any(c not in '0123456789abcdef' for c in trusted_digest):
        raise ValueError('missing-external-trust-anchor')
    with Path(path).open('rb') as stream:
        raw = stream.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError('manifest-budget-exceeded')
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError('duplicate-manifest-key')
            value[key] = item
        return value
    manifest = json.loads(raw, object_pairs_hook=unique)
    if not isinstance(manifest, dict) or set(manifest) != {'version', 'buildRevision', 'helper', 'models', 'dependencies', 'architectures', 'assets'}:
        raise ValueError('invalid-manifest-field')
    if type(manifest['version']) is not int or manifest['version'] != 1:
        raise ValueError('invalid-manifest-version')
    if manifest['buildRevision'] != expected_build:
        raise ValueError('stale-manifest')
    helper = manifest['helper']
    helper_keys = {'version', 'pipelineRevision', 'protocolVersion', 'runtimeVersion', 'sourceDigest', 'requirementsDigest', 'identityModuleDigest', 'dependencyObserverDigest'}
    if not isinstance(helper, dict) or set(helper) != helper_keys:
        raise ValueError('invalid-helper-identity')
    for key, expected in [('version', 1), ('pipelineRevision', 2), ('protocolVersion', 1)]:
        if type(helper[key]) is not int or helper[key] != expected:
            raise ValueError('invalid-helper-identity')
    def digest(value):
        return isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdef' for c in value)
    if not isinstance(helper['runtimeVersion'], str) or not helper['runtimeVersion'] or any(not digest(helper[k]) for k in helper_keys if k.endswith('Digest')):
        raise ValueError('invalid-helper-identity')
    for kind in ['models', 'dependencies', 'assets']:
        entries = manifest[kind]
        if not isinstance(entries, list) or len(entries) > 128:
            raise ValueError('invalid-inventory')
        ids = set()
        for entry in entries:
            keys = {'id', 'version', 'digest'} if kind == 'dependencies' else {'id', 'revision', 'digest', 'byteLength'}
            if not isinstance(entry, dict) or set(entry) != keys or not isinstance(entry['id'], str) or not entry['id'] or entry['id'] in ids or not digest(entry['digest']):
                raise ValueError('duplicate-or-invalid-identity')
            ids.add(entry['id'])
            version = entry['version'] if kind == 'dependencies' else entry['revision']
            if not isinstance(version, str) or not version:
                raise ValueError('invalid-inventory')
            if kind != 'dependencies' and (type(entry['byteLength']) is not int or not 0 < entry['byteLength'] <= 9007199254740991):
                raise ValueError('invalid-inventory')
    architectures = manifest['architectures']
    if not isinstance(architectures, list) or not architectures or any(not isinstance(a, str) or not a for a in architectures) or len(set(architectures)) != len(architectures):
        raise ValueError('unsupported-runtime')
    canonical = json.dumps(manifest, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')
    if hashlib.sha256(canonical).hexdigest() != trusted_digest:
        raise ValueError('manifest-digest-mismatch')
    return manifest

def validate_health(manifest, health):
    if health.get('ok') is not True or health.get('localOnly') is not True or health.get('host') != '127.0.0.1' or health.get('port') != 8766:
        raise ValueError('wrong-helper')
    helper = manifest['helper']
    runtime = health.get('runtimeIdentity', {})
    for key, value in helper.items():
        actual = health.get(key) if key in ('version', 'pipelineRevision', 'sourceDigest') else runtime.get(key)
        if type(actual) is not type(value) or actual != value:
            raise ValueError('wrong-helper:' + key)
    if runtime.get('architecture') not in manifest['architectures']:
        raise ValueError('unsupported-runtime')
    for key, expected, code in [('modelInventory', manifest['models'], 'wrong-model'), ('dependencyInventory', manifest['dependencies'], 'wrong-dependency')]:
        inventory = runtime.get(key, {})
        if inventory.get('status') != 'VERIFIED' or inventory.get('entries') != expected:
            raise ValueError(code)
    return True
