"""Authenticated scoped native/import/codec evidence; never enumerates OS libraries.

Only modules in explicitly declared runtime package namespaces are observed.
Native shared-library bytes and observed extension entry files remain distinct.
No Python observation is promoted to native network enforcement.
"""
import copy
import hashlib
import json
import platform
import sys
import importlib.abc
import importlib.machinery
from pathlib import Path
from artifact_verification import VERIFIER, resolve

MAX_CONTRACT_BYTES = 1024 * 1024
NATIVE_KINDS = {'EXTENSION', 'SHARED_LIBRARY', 'FRAMEWORK', 'EXECUTABLE'}
LEVELS = {'VERIFIED_ARTIFACT', 'VERIFIED_ENTRY', 'OBSERVED_LOADED',
          'OBSERVED_METADATA_ONLY', 'OBSERVED_RUNTIME_ONLY', 'EXPECTED_ONLY',
          'MISSING', 'UNVERIFIED', 'UNSUPPORTED'}


def scoped_loaded_library(root, entry, *, system=None):
    """Probe exactly one declared path using RTLD_NOLOAD; never enumerate images.

    A successful loader lookup establishes presence only. It does not establish
    the integrity of mapped pages, architecture, or its transitive dependencies.
    No ordinary dlopen fallback is allowed on unsupported systems.
    """
    import ctypes
    import os
    import _ctypes
    system = system or platform.system()
    path = resolve(root, entry['path'])
    result = {'id': entry['id'], 'parentModule': entry['module'],
              'origin': 'DECLARED_LOCAL_ARTIFACT', 'version': entry['version'],
              'versionEvidence': 'MANIFEST_BOUND_ONLY',
              'architectureEvidence': 'UNVERIFIED', 'actualLoaded': False,
              'status': 'UNSUPPORTED', 'observation': 'RTLD_NOLOAD_EXACT_PATH',
              'mappedIntegrity': 'UNVERIFIED', 'transitiveComplete': False}
    if system not in ('Darwin', 'Linux') or not hasattr(os, 'RTLD_NOLOAD'):
        return result
    try:
        # Balance the loader reference explicitly; CDLL does not close it for us.
        handle = ctypes.CDLL(str(path), mode=os.RTLD_NOLOAD | os.RTLD_NOW)
        try:
            result.update(actualLoaded=bool(handle._handle), status='OBSERVED_LOADED')
        finally:
            if handle._handle:
                _ctypes.dlclose(handle._handle)
    except OSError:
        result['status'] = 'EXPECTED_ONLY' if path.is_file() else 'MISSING'
    return result


def shared_library_receipts(root, contract, *, verifier=VERIFIER):
    """Separate exact disk artifact integrity from actual loader presence."""
    entries = []
    for entry in contract['native']:
        if entry['kind'] not in ('SHARED_LIBRARY', 'FRAMEWORK'):
            continue
        receipt = scoped_loaded_library(root, entry)
        receipt['artifactStatus'] = 'UNVERIFIED'
        try:
            proof = verifier.verify(root, entry['path'], entry, identity=entry['id'],
                                    version=entry['version'], build=contract['buildRevision'])
            receipt.update(artifactStatus=proof['status'], digest=proof['digest'])
        except FileNotFoundError:
            receipt['artifactStatus'] = 'MISSING'
        except (OSError, ValueError):
            pass
        entries.append(receipt)
    return {'entries': entries, 'complete': False,
            'reason': 'transitive-loader-edges-and-mapped-integrity-unverified'}


def native_dependency_graph(contract, imports, native, shared):
    """Logical expected edges with independently observed child identities.

    Parent association is declared, not a claim that a loader edge was observed.
    Absence of runtime loader-edge evidence can never complete this graph.
    """
    actual = {e['id']: e for e in native + shared['entries']}
    modules = {e['module']: e for e in imports}
    edges = []
    for entry in contract['native']:
        child = actual.get(entry['id'], {})
        parent = modules.get(entry['module'])
        edges.append({'parent': parent['id'] if parent else 'declared-runtime',
            'child': entry['id'], 'evidenceLevel': 'EXPECTED_ONLY',
            'runtimeObserved': False, 'childRuntimeObserved': child.get('actualLoaded',
                child.get('status') == 'OBSERVED_LOADED'),
            'expectedIdentity': {'digest': entry['digest'], 'version': entry['version']},
            'actualIdentity': {'digest': child.get('digest') if child.get('artifactStatus') in
                ('VERIFIED_ARTIFACT', 'VERIFIED_ENTRY') else None,
                'artifactStatus': child.get('artifactStatus', 'UNVERIFIED')},
            'status': 'UNVERIFIED'})
    return {'version': 1, 'edges': edges, 'complete': False,
            'reason': 'native-loader-transitive-edges-not-observed'}


def load(runtime):
    expected = runtime.expected('assets', 'runtime-evidence')
    path = resolve(runtime.root, 'runtime-evidence.json')
    VERIFIER.verify(runtime.root, 'runtime-evidence.json', expected, MAX_CONTRACT_BYTES,
                    build=runtime.manifest['buildRevision'])
    with path.open('rb') as stream:
        raw = stream.read(MAX_CONTRACT_BYTES + 1)
    if len(raw) > MAX_CONTRACT_BYTES or hashlib.sha256(raw).hexdigest() != expected['digest']:
        raise ValueError('stale-runtime-evidence')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate-runtime-evidence')
            result[key] = value
        return result
    contract = json.loads(raw, object_pairs_hook=unique)
    validate(contract)
    canonical = json.dumps(contract, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    if raw != canonical:
        raise ValueError('noncanonical-runtime-evidence')
    return contract


def validate(contract):
    if (not isinstance(contract, dict) or set(contract) !=
            {'version', 'buildRevision', 'architecture', 'namespaces', 'imports', 'native', 'codec'} or
            type(contract['version']) is not int or contract['version'] != 1):
        raise ValueError('invalid-runtime-evidence')
    if (not isinstance(contract['buildRevision'], str) or not contract['buildRevision'] or
            not isinstance(contract['architecture'], str) or not contract['architecture']):
        raise ValueError('invalid-evidence-build')
    namespaces = contract['namespaces']
    if (not isinstance(namespaces, list) or not namespaces or len(namespaces) > 128 or
            any(not isinstance(n, str) or not n.isidentifier() for n in namespaces) or
            len(set(namespaces)) != len(namespaces)):
        raise ValueError('invalid-runtime-namespaces')
    for kind in ('imports', 'native'):
        values = contract[kind]
        if not isinstance(values, list) or len(values) > 4096:
            raise ValueError('runtime-evidence-budget')
        ids = set()
        for entry in values:
            keys = {'id', 'path', 'digest', 'byteLength', 'version', 'module'}
            if kind == 'native':
                keys |= {'kind', 'footprintComplete'}
            if not isinstance(entry, dict) or set(entry) != keys:
                raise ValueError('invalid-runtime-entry')
            if (not isinstance(entry['id'], str) or not entry['id'] or entry['id'] in ids or
                    not isinstance(entry['version'], str) or not entry['version'] or
                    type(entry['byteLength']) is not int or not 0 < entry['byteLength'] <= 8*1024**3 or
                    not isinstance(entry['digest'], str) or len(entry['digest']) != 64 or
                    any(c not in '0123456789abcdef' for c in entry['digest'])):
                raise ValueError('invalid-runtime-entry-identity')
            ids.add(entry['id'])
            if not isinstance(entry['path'], str):
                raise ValueError('unsafe-runtime-evidence-path')
            relative = Path(entry['path'])
            if relative.is_absolute() or '..' in relative.parts or not relative.parts:
                raise ValueError('unsafe-runtime-evidence-path')
            module = entry['module']
            if module is not None and (not isinstance(module, str) or
                    any(not part.isidentifier() for part in module.split('.')) or
                    module.split('.')[0] not in namespaces):
                raise ValueError('unexpected-runtime-namespace')
            if kind == 'imports' and module is None:
                raise ValueError('missing-dynamic-module')
            if kind == 'native' and (entry['kind'] not in NATIVE_KINDS or
                    type(entry['footprintComplete']) is not bool):
                raise ValueError('invalid-native-evidence')
    modules = [e['module'] for e in contract['imports']]
    if len(set(modules)) != len(modules):
        raise ValueError('duplicate-runtime-import')
    codec = contract['codec']
    if (not isinstance(codec, dict) or set(codec) != {'backend', 'version', 'nativeIds', 'externalExecutable'} or
            not isinstance(codec['nativeIds'], list) or not codec['nativeIds'] or
            len(codec['nativeIds']) != len(set(codec['nativeIds'])) or
            not set(codec['nativeIds']) <= {e['id'] for e in contract['native']} or
            codec['backend'] != 'soundfile' or not isinstance(codec['version'], str) or
            not codec['version'] or codec['externalExecutable'] is not False):
        raise ValueError('unsupported-or-fallback-codec')
    return contract


def observe(root, contract, modules=None, *, build=None, architecture=None, verifier=VERIFIER):
    contract = copy.deepcopy(validate(contract))
    if contract['buildRevision'] != build or contract['architecture'] != (architecture or platform.machine()):
        raise ValueError('wrong-runtime-evidence-build-or-architecture')
    modules = sys.modules if modules is None else modules
    allowed = {e['module']: e for e in contract['imports']}
    scoped = {name for name in modules if name.split('.')[0] in contract['namespaces']}
    errors = ['unexpected-dynamic-import'] if scoped - set(allowed) else []
    imports = []; native = []; proofs = []
    for kind, target in [('imports', imports), ('native', native)]:
        for entry in contract[kind]:
            status = 'UNVERIFIED'; proof = None
            try:
                proof = verifier.verify(root, entry['path'], entry, identity=entry['id'],
                                        version=entry['version'], build=build)
                proofs.append(proof)
                module = modules.get(entry['module']) if entry['module'] else None
                if entry['module']:
                    if module is None:
                        status = 'EXPECTED_ONLY'
                    elif (not getattr(module, '__file__', None) or
                          Path(module.__file__).resolve() != resolve(root, entry['path']).resolve()):
                        status = 'UNVERIFIED'
                    else:
                        status = 'OBSERVED_LOADED'
                        if kind == 'native':
                            spec = getattr(module, '__spec__', None)
                            if (entry['kind'] != 'EXTENSION' or spec is None or
                                    not isinstance(getattr(spec, 'loader', None), importlib.machinery.ExtensionFileLoader) or
                                    not getattr(spec, 'origin', None) or
                                    Path(spec.origin).resolve() != resolve(root, entry['path']).resolve()):
                                status = 'OBSERVED_METADATA_ONLY'
                else:
                    # Shared libraries have byte evidence, not a fabricated loaded receipt.
                    status = 'VERIFIED_ENTRY'
            except FileNotFoundError:
                status = 'MISSING'
            except (OSError, ValueError):
                status = 'UNVERIFIED'
            target.append({'id': entry['id'], 'module': entry['module'], 'version': entry['version'],
                           'versionEvidence': 'MANIFEST_BOUND_ONLY',
                           'digest': entry['digest'], 'status': status,
                           'artifactStatus': 'VERIFIED_ENTRY' if proof else 'UNVERIFIED'})
    dynamic_complete = not errors and bool(imports) and all(e['status'] == 'OBSERVED_LOADED' for e in imports)
    # Native closure needs explicit observed load for every component. Byte-only libraries cannot pass.
    native_complete = bool(native) and all(e['status'] == 'OBSERVED_LOADED' for e in native)
    codec = contract['codec']
    sf = modules.get('soundfile')
    codec_complete = (getattr(sf, '__version__', None) == codec['version'] and
                      'soundfile' in allowed and dynamic_complete and
                      all(e['status'] == 'OBSERVED_LOADED' for e in native if e['id'] in codec['nativeIds']))
    shared = shared_library_receipts(root, contract, verifier=verifier)
    return {'version': 1, 'scope': 'DECLARED_RUNTIME_NAMESPACES_ONLY',
            'contractDigest': hashlib.sha256(json.dumps(contract, sort_keys=True,
                separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest(),
            'nativeClosure': {'complete': native_complete, 'entries': native},
            'dynamicImports': {'complete': dynamic_complete, 'entries': imports, 'errors': errors},
            'codec': {**codec, 'complete': codec_complete, 'status': 'VERIFIED_ENTRY' if codec_complete else 'UNVERIFIED',
                      'versionEvidence': 'OBSERVED_MODULE_VERSION' if codec_complete else 'UNVERIFIED'},
            'largeArtifacts': {'complete': len(proofs) == len(imports)+len(native), 'entries': proofs},
            'network': {'python': 'UNVERIFIED', 'native': 'UNVERIFIED'},
            'sharedLibraries': shared,
            'dynamicNativeGraph': native_dependency_graph(contract, imports, native, shared),
            'complete': False, 'publicationEligible': False}


def upgrade(inventory, evidence=None):
    result = copy.deepcopy(inventory)
    result['identityComplete'] = result.get('complete') is True
    result['runtimeClosureVersion'] = 1
    result['offlineRuntimeComplete'] = False
    result['runtimeEvidence'] = copy.deepcopy(evidence) if evidence else {
        'complete': False, 'reason': 'missing-authenticated-runtime-evidence',
        'network': {'native': 'UNVERIFIED'}}
    result.update(complete=False, processingEligible=False, publicationEligible=False)
    if result.get('status') == 'VERIFIED':
        result['status'] = 'PARTIAL'
    return result


def receipt_evidence(evidence):
    """Bind all scoped entry receipts by digest without exceeding child wire budget.

    Summary digest is observation evidence from the authenticated child, not an
    independent signature or a substitute for missing native network containment.
    """
    result = copy.deepcopy(evidence)
    graph = result.get('dynamicNativeGraph')
    if graph is not None:
        edges = graph.pop('edges')
        graph.update(edgeCount=len(edges), edgesDigest=hashlib.sha256(json.dumps(
            edges, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
    for key in ('nativeClosure', 'dynamicImports', 'largeArtifacts', 'sharedLibraries'):
        value = result[key]
        entries = value.pop('entries')
        statuses = {}
        for entry in entries:
            status = entry['status']
            statuses[status] = statuses.get(status, 0) + 1
        value.update(entryCount=len(entries), statusCounts=statuses,
                     entriesDigest=hashlib.sha256(json.dumps(entries, sort_keys=True,
                         separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest())
    return result


def local_audio_path(path):
    value = str(path)
    if '://' in value or value.startswith(('http:', 'https:', 'ftp:', 'pipe:', 'tcp:', 'udp:')):
        raise ValueError('remote-or-protocol-codec-input')
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('missing-or-unsafe-codec-input')
    return path


def decode_soundfile(module, path, expected_version):
    """Explicit single backend, never system executable/torchaudio dispatch fallback."""
    path = local_audio_path(path)
    if module.__version__ != expected_version:
        raise ValueError('wrong-codec-version')
    return module.read(str(path), dtype='float32', always_2d=True)


class ScopedImportGuard(importlib.abc.MetaPathFinder):
    """Allowlisted dynamic resolution inside declared runtime namespaces only.

    This does not intercept native dlopen or every Python import mechanism.
    Snapshot observation also checks preloaded entries and bypass mismatches.
    """
    def __init__(self, root, contract, verifier=VERIFIER):
        self.root = root
        self.contract = copy.deepcopy(validate(contract))
        self.verifier = verifier
        self.bindings = {e['module']: e for e in self.contract['imports']}

    def find_spec(self, fullname, path=None, target=None):
        if fullname.split('.')[0] not in self.contract['namespaces']:
            return None
        entry = self.bindings.get(fullname)
        if entry is None:
            raise ImportError('unexpected-scoped-dynamic-import')
        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        expected = resolve(self.root, entry['path'])
        if spec is None or not spec.origin or Path(spec.origin).resolve() != expected.resolve():
            raise ImportError('missing-or-wrong-scoped-module-source')
        self.verifier.verify(self.root, entry['path'], entry, identity=entry['id'],
                             version=entry['version'], build=self.contract['buildRevision'])
        if isinstance(getattr(spec, 'loader', None), importlib.machinery.SourceFileLoader):
            spec.loader = VerifiedSourceLoader(expected, entry)
        return spec


class VerifiedSourceLoader(importlib.abc.Loader):
    """Compile the same authenticated source bytes; never use stale bytecode cache."""
    def __init__(self, path, expected):
        self.path = path
        self.expected = copy.deepcopy(expected)

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        with self.path.open('rb') as stream:
            raw = stream.read(MAX_CONTRACT_BYTES + 1)
        if (len(raw) > MAX_CONTRACT_BYTES or len(raw) != self.expected['byteLength'] or
                hashlib.sha256(raw).hexdigest() != self.expected['digest']):
            raise ImportError('stale-scoped-module-source')
        exec(compile(raw, str(self.path), 'exec'), module.__dict__)


def install_import_guard(root, contract):
    guard = ScopedImportGuard(root, contract)
    sys.meta_path.insert(0, guard)
    return guard


def assembly_evidence(runtime):
    """Disk evidence never substitutes for observed imports, codecs or native isolation."""
    try:
        contract = load(runtime)
        evidence = observe(runtime.root, contract, build=runtime.manifest['buildRevision'])
        binding = next(e for e in runtime.bindings['native'] if e.get('id') == 'python-runtime')
        runtime.resolve_executable('python-runtime', resolve(runtime.root, binding['path']))
        return {'complete': False, 'runtimeEvidence': evidence, 'requiredLocalExecutable':
                copy.deepcopy(runtime.native['python-runtime']),
                'reason': 'native-network-and-observed-runtime-acceptance-open'}
    except (ValueError, OSError, KeyError, TypeError, AttributeError, StopIteration):
        return {'complete': False, 'reason': 'missing-or-invalid-runtime-evidence',
                'network': {'native': 'UNVERIFIED'}}
